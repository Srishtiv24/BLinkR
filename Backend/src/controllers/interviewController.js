import { AccessToken } from "livekit-server-sdk";
import httpStatus from "http-status";
import mongoose from "mongoose";
import { Meeting } from "../models/meeting.model.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pull the authenticated user's MongoDB ObjectId from req.user regardless of
 *  whether it came from a local JWT (has .id string) or an Auth0 Mongoose doc
 *  (has ._id ObjectId). Returns null if neither is present. */
const resolveUserId = (user) => {
  if (!user) return null;
  const raw = user._id || user.id;
  if (!raw) return null;
  try {
    return new mongoose.Types.ObjectId(raw.toString());
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// POST /api/interview/token
// Creates a LiveKit room token and immediately persists an IN_PROGRESS Meeting
// record so every AI interview has a stable DB anchor from the start.
// Returns the meetingId alongside the token so the frontend can pass it back
// on the feedback-save call.
// ---------------------------------------------------------------------------
export const createInterviewToken = async (req, res) => {
  try {
    if (!req.user) {
      return res
        .status(httpStatus.UNAUTHORIZED)
        .json({ message: "Not authenticated" });
    }

    const {
      candidateName,
      role,
      interviewType,
      experienceLevel,
      focusAreas,
      difficulty,
      resumeQuestions,
      resumeId, // optional – sent by the frontend when the candidate chose a resume
    } = req.body;

    if (!candidateName) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ message: "candidateName is required" });
    }

    const userId = resolveUserId(req.user);
    if (!userId) {
      return res
        .status(httpStatus.UNAUTHORIZED)
        .json({ message: "Could not resolve authenticated user" });
    }

    // One room per interview session
    const roomName = `interview-${userId}-${Date.now()}`;
    const identity = `candidate-${userId}`;

    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity,
        name: candidateName,
        // metadata the agent reads on join to tailor the whole interview
        metadata: JSON.stringify({
          role: role || "General Software Engineer",
          interviewType: interviewType || "Technical",
          experienceLevel: experienceLevel || "Mid-level",
          focusAreas: focusAreas || "",
          difficulty: difficulty || "Medium",
          resumeQuestions: Array.isArray(resumeQuestions)
            ? resumeQuestions
            : null,
        }),
      }
    );

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    // ── Persist a Meeting record so feedback can be associated later ──
    const now = new Date();
    let resumeObjectId = null;
    if (resumeId) {
      try {
        resumeObjectId = new mongoose.Types.ObjectId(resumeId);
      } catch {
        // resumeId was malformed — continue without it; don't block token issue
        console.warn("createInterviewToken: invalid resumeId, ignoring:", resumeId);
      }
    }

    const meeting = new Meeting({
      user_id:        userId,
      meeting_code:   roomName,
      date:           now,
      interview_type: "AI",
      status:         "IN_PROGRESS",
      start_time:     now,
      resume_id:      resumeObjectId,
    });
    await meeting.save();

    return res.status(httpStatus.OK).json({
      token,
      url:       process.env.LIVEKIT_URL,
      roomName,
      identity,
      meetingId: meeting._id.toString(), // returned so the client can reference this record
    });
  } catch (err) {
    console.error("createInterviewToken error:", err);
    return res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: "Failed to create interview session" });
  }
};

// ---------------------------------------------------------------------------
// POST /api/interview/:meetingId/feedback
// Called by the frontend AFTER the LiveKit agent sends interview_feedback over
// the data channel. The client forwards the feedback JSON here for server-side
// validation and persistence.
//
// Security guarantees:
//  • Ownership checked: meeting.user_id must equal the authenticated user's id.
//  • Feedback structure validated before touching the database.
//  • Idempotent: if called again with valid feedback it updates the same doc
//    rather than creating a duplicate. If the doc already has ai_feedback set
//    and the new payload is malformed/empty, the existing feedback is preserved.
// ---------------------------------------------------------------------------
export const saveAiFeedback = async (req, res) => {
  try {
    if (!req.user) {
      return res
        .status(httpStatus.UNAUTHORIZED)
        .json({ message: "Not authenticated" });
    }

    const userId = resolveUserId(req.user);
    if (!userId) {
      return res
        .status(httpStatus.UNAUTHORIZED)
        .json({ message: "Could not resolve authenticated user" });
    }

    const { meetingId } = req.params;
    if (!meetingId || !mongoose.isValidObjectId(meetingId)) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ message: "Invalid meetingId" });
    }

    // ── Ownership check ───────────────────────────────────────────
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res
        .status(httpStatus.NOT_FOUND)
        .json({ message: "Meeting not found" });
    }
    if (meeting.user_id.toString() !== userId.toString()) {
      // Do not leak whether the meeting exists for a different user
      return res
        .status(httpStatus.FORBIDDEN)
        .json({ message: "Access denied" });
    }

    // ── Feedback payload validation ───────────────────────────────
    const { feedback } = req.body;
    const validationError = validateFeedback(feedback);
    if (validationError) {
      // If the meeting already has good feedback, don't overwrite it with
      // a bad re-try; just report the error.
      if (meeting.ai_feedback) {
        return res
          .status(httpStatus.UNPROCESSABLE_ENTITY)
          .json({
            message: "Feedback validation failed; existing feedback preserved",
            error: validationError,
          });
      }
      // First save attempt also failed — mark ABANDONED so history shows a
      // completed-but-no-feedback entry rather than hanging IN_PROGRESS.
      meeting.status   = "ABANDONED";
      meeting.end_time = new Date();
      await meeting.save();
      return res
        .status(httpStatus.UNPROCESSABLE_ENTITY)
        .json({ message: "Feedback validation failed", error: validationError });
    }

    // ── Persist ───────────────────────────────────────────────────
    meeting.ai_feedback = {
      overall_score:    feedback.overall_score,
      categories:       feedback.categories || [],
      strengths:        feedback.strengths || [],
      improvements:     feedback.improvements || [],
      improvement_plan: feedback.improvement_plan || [],
      summary:          feedback.summary || "",
      saved_at:         new Date(),
    };
    meeting.status   = "COMPLETED";
    meeting.end_time = new Date();
    await meeting.save();

    return res.status(httpStatus.OK).json({
      message:   "Feedback saved",
      meetingId: meeting._id.toString(),
      status:    meeting.status,
    });
  } catch (err) {
    console.error("saveAiFeedback error:", err);
    return res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: "Failed to save feedback" });
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/interview/:meetingId/abandon
// Marks an AI interview as ABANDONED when the candidate skips feedback or the
// agent fails to generate it — so history shows the session rather than leaving
// it stuck as IN_PROGRESS.
// ---------------------------------------------------------------------------
export const abandonInterview = async (req, res) => {
  try {
    if (!req.user) {
      return res
        .status(httpStatus.UNAUTHORIZED)
        .json({ message: "Not authenticated" });
    }

    const userId = resolveUserId(req.user);
    const { meetingId } = req.params;

    if (!meetingId || !mongoose.isValidObjectId(meetingId)) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ message: "Invalid meetingId" });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
    }
    if (meeting.user_id.toString() !== userId.toString()) {
      return res.status(httpStatus.FORBIDDEN).json({ message: "Access denied" });
    }

    // Only update if still IN_PROGRESS — don't downgrade a COMPLETED meeting.
    if (meeting.status === "IN_PROGRESS") {
      meeting.status   = "ABANDONED";
      meeting.end_time = new Date();
      await meeting.save();
    }

    return res.status(httpStatus.OK).json({ message: "Interview marked abandoned" });
  } catch (err) {
    console.error("abandonInterview error:", err);
    return res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: "Failed to mark interview abandoned" });
  }
};

// ---------------------------------------------------------------------------
// Validation helper — returns an error string if invalid, null if OK.
// Scores must be numeric and within the expected ranges.
// ---------------------------------------------------------------------------
function validateFeedback(fb) {
  if (!fb || typeof fb !== "object") {
    return "feedback must be a non-null object";
  }

  // overall_score: integer 0-100
  const os = fb.overall_score;
  if (os == null) return "overall_score is required";
  if (typeof os !== "number" || !Number.isFinite(os))
    return "overall_score must be a number";
  if (os < 0 || os > 100)
    return `overall_score out of range (got ${os}, expected 0-100)`;

  // categories: array of { name, score, comment }
  if (!Array.isArray(fb.categories))
    return "categories must be an array";
  for (const [i, cat] of fb.categories.entries()) {
    if (!cat.name || typeof cat.name !== "string")
      return `categories[${i}].name must be a non-empty string`;
    if (cat.score == null || typeof cat.score !== "number" || !Number.isFinite(cat.score))
      return `categories[${i}].score must be a number`;
    if (cat.score < 0 || cat.score > 10)
      return `categories[${i}].score out of range (got ${cat.score}, expected 0-10)`;
  }

  // strengths / improvements: arrays of strings
  if (!Array.isArray(fb.strengths))    return "strengths must be an array";
  if (!Array.isArray(fb.improvements)) return "improvements must be an array";

  // improvement_plan: array of objects with required 'area'
  if (!Array.isArray(fb.improvement_plan))
    return "improvement_plan must be an array";
  for (const [i, item] of fb.improvement_plan.entries()) {
    if (!item.area || typeof item.area !== "string")
      return `improvement_plan[${i}].area must be a non-empty string`;
  }

  return null; // all good
}