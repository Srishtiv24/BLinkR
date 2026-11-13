import express from "express";
import {
  createInterviewToken,
  saveAiFeedback,
  abandonInterview,
} from "../controllers/interviewController.js";
import { localAuth, auth0Auth } from "../middlewares/middleware.js";

const router = express.Router();

// localAuth tries a local JWT first and calls next() either way (even on failure),
// auth0Auth then only runs its own check if req.user isn't already set by localAuth.
const authChain = [localAuth, auth0Auth];

// POST /api/interview/token
// Issues a LiveKit room token and creates an IN_PROGRESS Meeting record.
router.post("/token", ...authChain, createInterviewToken);

// POST /api/interview/:meetingId/feedback
// Saves validated AI feedback to the Meeting document owned by the caller.
router.post("/:meetingId/feedback", ...authChain, saveAiFeedback);

// PATCH /api/interview/:meetingId/abandon
// Marks an AI interview as ABANDONED (feedback skipped or generation failed).
router.patch("/:meetingId/abandon", ...authChain, abandonInterview);

export default router;