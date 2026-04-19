import fs from "fs";
import pdf from "pdf-extraction";
import { Resume } from "../models/resume.model.js";
import axios from "axios";

const generateQuestionsAI = async (prompt) => {
  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "nvidia/nemotron-3-nano-30b-a3b:free",
      messages: [
        {
          role: "system",
          content:
            "You are an AI that generates recruiter interview questions based on resumes. Output JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
  let questions = [
    { type: "intro", level: "basic", question: "Tell me about yourself." },
    {
      type: "skill",
      level: "basic",
      question: "What programming languages are you most comfortable with?",
    },
    {
      type: "project",
      level: "intermediate",
      question: "Can you describe a project you’re proud of?",
    },
    {
      type: "experience",
      level: "advanced",
      question: "How have you handled critical production issues?",
    },
  ];

  try {
    questions = JSON.parse(response.data.choices[0].message.content);
  } catch (err) {
    console.error("Failed to parse AI response:", err);
    questions = []; // fallback
  }
  return questions;
};

export const generalizedQuestions = async (req, res) => {
  try {
    const resume = await Resume.findById(req.params.id);
    if (!resume) return res.status(404).json({ message: "Resume not found" });

    const prompt = `Generate 20 interview questions based on this resume.
    Order them strictly as follows:
    1. intro (basic → intermediate → advanced)
    2. skill (basic → intermediate → advanced)
    3. project (basic → intermediate → advanced)
    4. experience (basic → intermediate → advanced)
    Ensure at least 10 skills questions.
    Output JSON array with objects: { type, level, question }.
    Resume:\n\n${resume.resumeText}`;

    const questions = await generateQuestionsAI(prompt);
    resume.generalizedQuestions = questions;
    await resume.save();

    res.status(200).json({
      message: "Generalized questions generated successfully",
      questions: resume.generalizedQuestions,
    });
  } catch (err) {
    console.error("Failed to generate generalized questions:", err);
    res
      .status(500)
      .json({
        message: "Error generating generalized questions",
        error: err.message,
      });
  }
};

export const skillQuestions = async (req, res) => {
  try {
    const resume = await Resume.findById(req.params.id);
    if (!resume) return res.status(404).json({ message: "Resume not found" });

    const prompt = `Generate 20 skill-focused interview questions based on this resume.
    Cover basic → intermediate → advanced levels.
    Output JSON array with objects: { type: "skill", level, question }.
    Resume:\n\n${resume.resumeText}`;

    const questions = await generateQuestionsAI(prompt);
    resume.skillQuestions = questions;
    await resume.save();
    res.status(200).json({
      message: "Skill questions generated successfully",
      questions: resume.skillQuestions,
    });
  } catch (err) {
    console.error("Failed to generate skill questions:", err);
    res
      .status(500)
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
      return res.status(404).json({ message: "Resume not found" });
    }

    const prompt = `Generate a fresh set of 20 interview questions based on this resume.
      Ensure the distribution is:
      - 16 skill-focused questions (basic → intermediate → advanced)
      - 4 questions on experience/projects (basic → intermediate → advanced)
      Output JSON array with objects: { type, level, question }.
      Resume:\n\n${resume.resumeText}`;

    const questions = await generateQuestionsAI(prompt);

    resume.regenerateQuestions = questions;
    await resume.save();

    res.status(200).json({
      message: "Fresh set of regenerate questions created successfully",
      questions: resume.regenerateQuestions,
    });
  } catch (err) {
    console.error("Failed to regenerate questions:", err);
    res
      .status(500)
      .json({ message: "Error regenerating questions", error: err.message });
  }
};

export const uploadResume = async (req, res) => {
  try {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const filePath = req.file.path; //multer
    const dataBuffer = await fs.promises.readFile(filePath); //read
    const parsed = await pdf(dataBuffer);
    const cleanedText = parsed.text
      .replace(/[^\x00-\x7F]/g, "") // remove non-ASCII artifacts
      .replace(/\s+/g, " ") // collapse all whitespace (spaces, tabs, newlines)
      .trim(); // remove leading/trailing space

    console.log(cleanedText);
    const resume = new Resume({
      resumeText: cleanedText,
      userId: "69910706cfe26d562b4362e3", //hard coded for now , u have to extract user id from middleware
    });

    try {
      await fs.promises.unlink(filePath);
      console.log("File deleted:", filePath);
    } catch (err) {
      console.error("Failed to delete file:", err);
    }
    await resume.save();
    res.status(200).json({
      message: "Resume uploaded successfully",
      resumeId: resume._id,
    });
  } catch (err) {
    console.error("Resume upload failed:", err);
    res
      .status(500)
      .json({ message: "Error parsing resume", error: err.message });
  }
};
