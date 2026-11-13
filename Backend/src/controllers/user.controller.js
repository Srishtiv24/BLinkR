import httpStatus from "http-status";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Meeting } from "../models/meeting.model.js";
import { User } from "../models/user.model.js";

// ---------------------------------------------------------------------------
// Auth – unchanged
// ---------------------------------------------------------------------------

const login = async (req, res) => {
  const { password, email } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Please provide both email and password" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(httpStatus.NOT_FOUND)
        .json({ message: "User NOT FOUND!" });
    }
    if (user.authProvider === "local") {
      const isMatch = await bcrypt.compare(password, user.password);

      if (isMatch) {
        const token = jwt.sign(
          { id: user._id, name: user.name, email: user.email },
          process.env.JWT_SECRET_KEY,
          { expiresIn: "1h" }
        );

        return res.status(httpStatus.OK).json({
          token: token,
          user: { name: user.name, email: user.email, id: user._id },
        });
      } else {
        return res
          .status(httpStatus.UNAUTHORIZED)
          .json({ message: "Invalid email or password" });
      }
    } else {
      return res
        .status(400)
        .json({ message: "Use Google login for this account" });
    }
  } catch (err) {
    return res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: `Something went wrong ${err}` });
  }
};

const register = async (req, res) => {
  const { name, password, email } = req.body;
  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ message: "Please provide name, email, and password" });
  }

  try {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res
        .status(httpStatus.CONFLICT)
        .json({ message: "User already exists!" });
    }
    if (password.length < 6) {
      return res.status(400).json({
        errors: { password: "Password must be at least 6 characters long." },
      });
    }
    if (
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[!@#$%^&*(),.?":{}|<>]/.test(password)
    ) {
      return res.status(400).json({
        errors: {
          password:
            "Password must include at least one uppercase letter, one number, and one special character.",
        },
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name: name,
      email: email,
      password: hashedPassword,
      authProvider: "local",
    });

    await newUser.save();
    res.status(httpStatus.CREATED).json({ message: "User registered" });
  } catch (e) {
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: `Something went wrong ${e}` });
  }
};

// ---------------------------------------------------------------------------
// History – extended to return typed interview history
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/users/activities
 *
 * Returns the authenticated user's interview history — both AI and HUMAN
 * interviews — ordered most recent first.
 *
 * Supports optional query params:
 *   page  (default 1)     – 1-based page number
 *   limit (default 20)    – max records per page (capped at 100)
 *   type  (AI | HUMAN)    – filter by interview_type
 *
 * Each record includes computed duration_seconds so the UI doesn't need to
 * store a redundant field in the DB.
 *
 * Human interviews are returned without ai_feedback (it's always null for
 * them), so the UI can tell them apart by interview_type === "HUMAN".
 */
const getUserHistory = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(httpStatus.UNAUTHORIZED).json({ message: "Not authenticated" });
    }

    // ── Pagination ──────────────────────────────────────────────────────────
    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip  = (page - 1) * limit;

    // ── Filter ──────────────────────────────────────────────────────────────
    const filter = { user_id: userId };
    if (req.query.type && ["AI", "HUMAN"].includes(req.query.type)) {
      filter.interview_type = req.query.type;
    }

    const [meetings, total] = await Promise.all([
      Meeting.find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          "_id user_id meeting_code date interview_type status " +
          "start_time end_time resume_id " +
          "ai_feedback.overall_score ai_feedback.saved_at ai_feedback.summary"
        )
        .lean(),
      Meeting.countDocuments(filter),
    ]);

    // ── Shape each record ───────────────────────────────────────────────────
    const items = meetings.map((m) => shapeHistoryItem(m));

    return res.status(httpStatus.OK).json({
      items,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (e) {
    console.error("getUserHistory error:", e);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: `Something went wrong ${e}` });
  }
};

/**
 * GET /api/v1/users/activities/:meetingId
 *
 * Returns full details for one interview owned by the authenticated user,
 * including the complete ai_feedback object (for AI interviews).
 */
const getInterviewDetails = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(httpStatus.UNAUTHORIZED).json({ message: "Not authenticated" });
    }

    const { meetingId } = req.params;
    if (!meetingId || !mongoose.isValidObjectId(meetingId)) {
      return res.status(httpStatus.BAD_REQUEST).json({ message: "Invalid meetingId" });
    }

    const meeting = await Meeting.findById(meetingId).lean();
    if (!meeting) {
      return res.status(httpStatus.NOT_FOUND).json({ message: "Interview not found" });
    }

    // Ownership check — a user can only view their own interviews.
    if (meeting.user_id.toString() !== userId.toString()) {
      return res.status(httpStatus.FORBIDDEN).json({ message: "Access denied" });
    }

    return res.status(httpStatus.OK).json({ interview: shapeDetailItem(meeting) });
  } catch (e) {
    console.error("getInterviewDetails error:", e);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: `Something went wrong ${e}` });
  }
};

// ---------------------------------------------------------------------------
// Human-interview history helpers – unchanged but now also called by typed history
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/users/activities
 * Records a human-to-human meeting in history.
 * No AI scores are generated or stored for human interviews.
 */
const addToHistory = async (req, res) => {
  const { meetingCode } = req.body;
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(httpStatus.UNAUTHORIZED).json({ message: "Not authenticated" });
    }

    const newMeeting = new Meeting({
      user_id:        userId,
      meeting_code:   meetingCode,
      interview_type: "HUMAN",
      status:         "COMPLETED",
      start_time:     new Date(),
    });
    await newMeeting.save();

    res
      .status(httpStatus.CREATED)
      .json({ message: "Added meeting details to history" });
  } catch (e) {
    res.json({ message: `Something went wrong ${e}` });
  }
};

const clearUserHistory = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const meetings = await Meeting.deleteMany({ user_id: userId });
    res.json(meetings);
  } catch (e) {
    res.json({ message: `Something went wrong ${e}` });
  }
};

// ---------------------------------------------------------------------------
// Shape helpers – compute display-only fields server-side instead of storing
// ---------------------------------------------------------------------------

/** Compute interview duration in seconds, or null if timestamps are missing. */
function computeDuration(m) {
  if (!m.start_time || !m.end_time) return null;
  const ms = new Date(m.end_time) - new Date(m.start_time);
  return ms > 0 ? Math.round(ms / 1000) : null;
}

/** Minimal history-list item — includes enough to render a history card. */
function shapeHistoryItem(m) {
  const item = {
    id:             m._id,
    meeting_code:   m.meeting_code,
    date:           m.date,
    interview_type: m.interview_type || null,
    status:         m.status || null,
    start_time:     m.start_time || null,
    end_time:       m.end_time   || null,
    duration_seconds: computeDuration(m),
    resume_id:      m.resume_id || null,
    // For AI interviews: surface the headline score + saved_at + summary
    // so the history list can render a score chip without fetching full details.
    ai_summary: m.interview_type === "AI" && m.ai_feedback
      ? {
          overall_score: m.ai_feedback.overall_score ?? null,
          summary:       m.ai_feedback.summary       ?? null,
          saved_at:      m.ai_feedback.saved_at      ?? null,
        }
      : null,
  };
  return item;
}

/** Full detail item — includes the complete ai_feedback object. */
function shapeDetailItem(m) {
  return {
    id:               m._id,
    meeting_code:     m.meeting_code,
    date:             m.date,
    interview_type:   m.interview_type || null,
    status:           m.status         || null,
    start_time:       m.start_time     || null,
    end_time:         m.end_time       || null,
    duration_seconds: computeDuration(m),
    resume_id:        m.resume_id      || null,
    // Full AI feedback only for AI interviews; null for HUMAN ones.
    ai_feedback: m.interview_type === "AI" ? (m.ai_feedback || null) : null,
  };
}

export {
  login,
  register,
  getUserHistory,
  getInterviewDetails,
  addToHistory,
  clearUserHistory,
};
