import fs from "fs";
import pdf from "pdf-extraction";
import { Resume } from "../models/resume.model.js";
import axios from "axios";
import httpStatus from "http-status";

const DEFAULT_QUESTIONS = [
  { type: "intro", level: "basic", question: "Tell me about yourself." },
  { type: "skill", level: "basic", question: "What programming languages are you most comfortable with?" },
  { type: "project", level: "intermediate", question: "Can you describe a project you're proud of?" },
  { type: "experience", level: "advanced", question: "How have you handled critical production issues?" },
];

const QUESTIONS_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "interview_questions",
    strict: true,
    schema: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["intro", "skill", "project", "experience"] },
              level: { type: "string", enum: ["basic", "intermediate", "advanced"] },
              question: { type: "string" },
            },
            required: ["type", "level", "question"],
            additionalProperties: false,
          },
        },
      },
      required: ["questions"],
      additionalProperties: false,
    },
  },
};

const VALID_TYPES = ["intro", "skill", "project", "experience"];
const VALID_LEVELS = ["basic", "intermediate", "advanced"];

// Some free/reasoning-style models don't strictly honor `response_format`
// even when advertised as supporting structured_outputs — they emit a
// chain-of-thought preamble ("We need to...", <think>...</think> blocks,
// ```json fences, etc.) alongside or instead of pure JSON in `content`.
// Strip that wrapper and pull out just the {...} object before parsing.
const extractJsonBlock = (raw) => {
  let text = raw.trim();

  // Strip <think>...</think> or similar reasoning tags some models emit inline.
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // Strip markdown code fences (```json ... ``` or ``` ... ```).
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

  // If there's still leading/trailing prose around the JSON object, extract
  // just the outermost {...} block.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`No JSON object found in model output: ${text.slice(0, 300)}`);
  }
  return text.slice(start, end + 1);
};

// Some smaller/free models don't reliably respect the enum constraint in the
// JSON schema and swap the `type` and `level` fields (e.g. returning
// type: "basic", level: "intro" instead of type: "intro", level: "basic").
// Detect and correct that swap here so a model's mistake doesn't turn into a
// 500 from Mongoose enum validation downstream.
const normalizeQuestion = (q) => {
  let { type, level, question } = q;
  if (VALID_LEVELS.includes(type) && VALID_TYPES.includes(level)) {
    [type, level] = [level, type];
  }
  return { type, level, question };
};

const buildMessages = (prompt) => [
  { role: "system", content: "You are an AI that generates recruiter interview questions based on resumes." },
  { role: "user", content: prompt },
];

// Collects the question text from any previously generated question sets on
// this resume (generalized, skill, and prior regenerate rounds) so we can
// tell the model what NOT to repeat. Without this, calling regenerate/skill
// generation more than once on the same resume tends to produce heavily
// overlapping or identical questions, since the only real input (the resume
// text) hasn't changed between calls.
const getPreviouslyAskedQuestions = (resume) => {
  const sets = [resume.generalizedQuestions, resume.skillQuestions, resume.regenerateQuestions];
  const seen = new Set();
  for (const set of sets) {
    if (!Array.isArray(set)) continue;
    for (const q of set) {
      if (q?.question) seen.add(q.question.trim());
    }
  }
  return [...seen];
};

const buildAvoidRepeatsBlock = (previousQuestions) => {
  if (!previousQuestions.length) return "";
  return `\n\nDo NOT repeat, rephrase, or closely mirror any of the following questions already asked to this candidate:\n${previousQuestions
    .map((q, i) => `${i + 1}. ${q}`)
    .join("\n")}`;
};

// ---------------------------------------------------------------------------
// Extracts the questions array from an OpenAI/OpenRouter/Kilo-shaped response,
// or throws a descriptive error if the request/model/provider failed.
// Handles two distinct failure shapes:
//   1. Top-level error — the whole request failed, no `choices` at all
//      (e.g. Kilo's {"error": {"message": ..., "code": 503}} overload response)
//   2. In-band error — a choice exists but carries an error instead of a
//      message (e.g. liquid/lfm-2.5-2.6b:free returning finish_reason: "error")
// ---------------------------------------------------------------------------
const extractQuestions = (data, sourceLabel) => {
  if (data?.error) {
    throw new Error(`${sourceLabel} error: ${JSON.stringify(data.error)}`);
  }

  const choice = data?.choices?.[0];

  if (choice?.finish_reason === "error" || choice?.error) {
    throw new Error(`${sourceLabel} in-band error: ${JSON.stringify(choice?.error)}`);
  }

  if (choice?.finish_reason === "length") {
    throw new Error(
      `${sourceLabel} response was truncated (finish_reason: length) — model ran out of tokens, likely while reasoning, before producing the JSON answer`
    );
  }

  const raw = choice?.message?.content;
  if (!raw) {
    throw new Error(`${sourceLabel} unexpected response: ${JSON.stringify(data).slice(0, 300)}`);
  }

  const parsed = JSON.parse(extractJsonBlock(raw));
  const questions = parsed.questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error(`${sourceLabel} response was not a non-empty array`);
  }

  const normalized = questions.map(normalizeQuestion);
  const invalid = normalized.filter(
    (q) => !VALID_TYPES.includes(q.type) || !VALID_LEVELS.includes(q.level)
  );
  if (invalid.length) {
    throw new Error(
      `${sourceLabel} returned questions with invalid type/level even after normalization: ${JSON.stringify(invalid).slice(0, 300)}`
    );
  }

  return normalized;
};

// ---------------------------------------------------------------------------
// Dynamic model discovery — no hardcoded model IDs. Caches the result in
// memory so we're not hitting /models on every single question-generation
// request; free-model availability doesn't change second to second.
// ---------------------------------------------------------------------------
let orModelsCache = { models: [], fetchedAt: 0 };
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

const fetchFreeStructuredOutputModels = async () => {
  const now = Date.now();
  if (orModelsCache.models.length && now - orModelsCache.fetchedAt < CACHE_TTL_MS) {
    return orModelsCache.models;
  }

  const res = await axios.get("https://openrouter.ai/api/v1/models", {
    params: { supported_parameters: "structured_outputs" }, // only models that can honor response_format
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
    timeout: 10000,
  });

  const models = (res.data?.data || [])
    .filter((m) => m.pricing?.prompt === "0" && m.pricing?.completion === "0") // free only
    .filter((m) => !m.id.startsWith("openrouter/")) // exclude meta-routers like openrouter/free — not valid inside a models fallback list
    .sort((a, b) => (b.context_length || 0) - (a.context_length || 0)) // prefer bigger context as a simple quality proxy
    .map((m) => m.id);

  if (models.length === 0) {
    throw new Error("No free OpenRouter models currently support structured_outputs");
  }

  orModelsCache = { models, fetchedAt: now };
  return models;
};

// Tier 1 & 2: OpenRouter. Primary + fallbacks all go into ONE `models` array —
// sending a separate top-level `model` field alongside `models` on the raw
// REST endpoint causes a 400 bad_request; that combined shape is only valid
// through the OpenAI SDK's client-side wrapper, not the raw HTTP body.
// NOTE: OpenRouter caps the `models` fallback array at 3 entries — sending
// more than 3 returns a 400 "'models' array must have 3 items or fewer."
const callOpenRouter = async (prompt, { temperature } = {}) => {
  const freeModels = await fetchFreeStructuredOutputModels();
  const modelList = freeModels.slice(0, 3); // first entry is primary, rest are automatic fallbacks (max 3 total)

  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      models: modelList,
      messages: buildMessages(prompt),
      max_tokens: 4000,
      response_format: QUESTIONS_SCHEMA,
      reasoning: { exclude: true }, // keep chain-of-thought out of `content` — some free models otherwise burn the whole token budget thinking and never emit the JSON answer
      ...(temperature != null ? { temperature } : {}),
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 20000,
    }
  );

  return extractQuestions(response.data, `OpenRouter (tried: ${modelList.join(", ")})`);
};

// Tier 3: Kilo Gateway — a fully separate provider/account, used only if
// OpenRouter is unreachable entirely (not just one model failing).
let kiloModelsCache = { models: [], fetchedAt: 0 };

// NOTE: previously this silently fell back to the hardcoded string
// "kilo-auto/balanced" whenever discovery failed (network error, bad auth,
// unexpected response shape, etc). That model requires paid sign-in on this
// account, so every discovery failure was masked and surfaced downstream as
// a confusing "PAID_MODEL_AUTH_REQUIRED" error from the chat/completions call
// instead of a clear discovery error. Now we log the real cause and re-throw,
// letting generateQuestionsAI's existing catch fall through to
// DEFAULT_QUESTIONS instead of hitting a paid model blind.
const fetchKiloModel = async () => {
  const now = Date.now();
  if (kiloModelsCache.models.length && now - kiloModelsCache.fetchedAt < CACHE_TTL_MS) {
    return kiloModelsCache.models[0];
  }
  try {
    const res = await axios.get("https://api.kilo.ai/api/gateway/models", {
      headers: { Authorization: `Bearer ${process.env.KILOCODE_API_KEY}` },
      timeout: 10000,
    });
    const free = (res.data?.data || res.data || [])
      .filter((m) => m.pricing?.prompt === "0" && m.pricing?.completion === "0")
      .map((m) => m.id);
    if (free.length) {
      kiloModelsCache = { models: free, fetchedAt: now };
      return free[0];
    }
    throw new Error("Kilo discovery returned no free models");
  } catch (err) {
    console.error("Kilo model discovery failed:", err.response?.data || err.message);
    throw err;
  }
};

const callKilo = async (prompt, { temperature } = {}) => {
  const model = await fetchKiloModel();
  const response = await axios.post(
    "https://api.kilo.ai/api/gateway/chat/completions",
    {
      model,
      messages: buildMessages(prompt),
      max_tokens: 4000,
      response_format: QUESTIONS_SCHEMA,
      reasoning: { exclude: true },
      ...(temperature != null ? { temperature } : {}),
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.KILOCODE_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 35000,
    }
  );
  return extractQuestions(response.data, `Kilo Gateway (${model})`);
};

const generateQuestionsAI = async (prompt, options = {}) => {
  try {
    return await callOpenRouter(prompt, options);
  } catch (openRouterErr) {
    const detail = openRouterErr.response?.data
      ? JSON.stringify(openRouterErr.response.data)
      : openRouterErr.message;
    console.error("OpenRouter failed, trying Kilo Gateway:", detail);
    try {
      return await callKilo(prompt, options);
    } catch (kiloErr) {
      const kiloDetail = kiloErr.response?.data
        ? JSON.stringify(kiloErr.response.data)
        : kiloErr.message;
      console.error("Kilo Gateway also failed, using fallback questions:", kiloDetail);
      return DEFAULT_QUESTIONS;
    }
  }
};

export const generalizedQuestions = async (req, res) => {
  try {
    const resume = await Resume.findById(req.params.id);
    if (!resume) return res.status(httpStatus.NOT_FOUND).json({ message: "Resume not found" });

    const prompt = `Generate 20 interview questions based on this resume.
    Order them strictly as follows:
    1. intro (basic → intermediate → advanced)
    2. skill (basic → intermediate → advanced)
    3. project (basic → intermediate → advanced)
    4. experience (basic → intermediate → advanced)
    Ensure at least 10 skills questions.
    Resume:\n\n${resume.resumeText}${buildAvoidRepeatsBlock(getPreviouslyAskedQuestions(resume))}`;

    const questions = await generateQuestionsAI(prompt);
    resume.generalizedQuestions = questions;
    await resume.save();

    res.status(httpStatus.OK).json({
      message: "Generalized questions generated successfully",
      questions: resume.generalizedQuestions,
    });
  } catch (err) {
    console.error("Failed to generate generalized questions:", err);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({
        message: "Error generating generalized questions",
        error: err.message,
      });
  }
};

export const skillQuestions = async (req, res) => {
  try {
    const resume = await Resume.findById(req.params.id);
    if (!resume) return res.status(httpStatus.NOT_FOUND).json({ message: "Resume not found" });

    const prompt = `Generate 20 skill-focused interview questions based on this resume.
    Cover basic → intermediate → advanced levels.
    Resume:\n\n${resume.resumeText}${buildAvoidRepeatsBlock(getPreviouslyAskedQuestions(resume))}`;

    const questions = await generateQuestionsAI(prompt);
    resume.skillQuestions = questions;
    await resume.save();
    res.status(httpStatus.OK).json({
      message: "Skill questions generated successfully",
      questions: resume.skillQuestions,
    });
  } catch (err) {
    console.error("Failed to generate skill questions:", err);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({
        message: "Error generating skill questions",
        error: err.message,
      });
  }
};

export const regenerateQuestions = async (req, res) => {
  try {
    const resume = await Resume.findById(req.params.id);
    if (!resume) {
      return res.status(httpStatus.NOT_FOUND).json({ message: "Resume not found" });
    }

    const prompt = `Generate a fresh set of 20 interview questions based on this resume.
      Ensure the distribution is:
      - 16 skill-focused questions (basic → intermediate → advanced)
      - 4 questions on experience/projects (basic → intermediate → advanced)
      Resume:\n\n${resume.resumeText}${buildAvoidRepeatsBlock(getPreviouslyAskedQuestions(resume))}`;

    // Higher temperature here specifically because "regenerate" implies the
    // user wants variety on a repeat call, not the same questions again.
    const questions = await generateQuestionsAI(prompt, { temperature: 1.1 });

    resume.regenerateQuestions = questions;
    await resume.save();

    res.status(httpStatus.OK).json({
      message: "Fresh set of regenerate questions created successfully",
      questions: resume.regenerateQuestions,
    });
  } catch (err) {
    console.error("Failed to regenerate questions:", err);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: "Error regenerating questions", error: err.message });
  }
};

// GET /api/v1/resume/latest
// Returns the logged-in user's most recently uploaded resume, if any, so
// the frontend can offer "use my existing resume" without forcing a
// re-upload every time.
export const getLatestResume = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(httpStatus.UNAUTHORIZED).json({ message: "Not authenticated" });
    }
    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(httpStatus.UNAUTHORIZED).json({ message: "Not authenticated" });
    }

    const resume = await Resume.findOne({ userId })
      .sort({ date: -1 })
      .select("_id date")
      .lean();

    if (!resume) {
      return res.status(httpStatus.OK).json({ resume: null });
    }

    return res.status(httpStatus.OK).json({
      resume: { resumeId: resume._id, uploadedAt: resume.date },
    });
  } catch (err) {
    console.error("getLatestResume error:", err);
    return res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: "Failed to check for existing resume" });
  }
};

export const uploadResume = async (req, res) => {
  let filePath;
  try {
    if (!req.file || !req.file.path) {
      return res.status(httpStatus.BAD_REQUEST).json({ message: "No file uploaded" });
    }
    filePath = req.file.path;

    if (!req.user) {
      return res.status(httpStatus.UNAUTHORIZED).json({ message: "Not authenticated" });
    }
    const userId = req.user._id || req.user.id;
    if (!userId) {
      return res.status(httpStatus.UNAUTHORIZED).json({ message: "Not authenticated" });
    }

    const dataBuffer = await fs.promises.readFile(filePath);
    const parsed = await pdf(dataBuffer);
    const cleanedText = parsed.text
      .replace(/[^\x00-\x7F]/g, "") // remove non-ASCII artifacts
      .replace(/\s+/g, " ") // collapse all whitespace (spaces, tabs, newlines)
      .trim(); // remove leading/trailing space

    const resume = new Resume({
      resumeText: cleanedText,
      userId,
    });

    await resume.save();
    res.status(httpStatus.OK).json({
      message: "Resume uploaded successfully",
      resumeId: resume._id,
    });
  } catch (err) {
    console.error("Resume upload failed:", err);
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: "Error parsing resume", error: err.message });
  } finally {
    // Cleanup runs regardless of success/failure — previously it only ran
    // in the happy path, leaving files on disk forever if pdf parsing threw.
    if (filePath) {
      try {
        await fs.promises.unlink(filePath);
      } catch (cleanupErr) {
        console.error("Failed to delete uploaded file:", cleanupErr);
      }
    }
  }
};