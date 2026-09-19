import express from "express";
import { createInterviewToken } from "../controllers/interviewController.js";
import { localAuth, auth0Auth } from "../middlewares/middleware.js";

const router = express.Router();

// localAuth tries a local JWT first and calls next() either way (even on failure),
// auth0Auth then only runs its own check if req.user isn't already set by localAuth
router.post("/token", localAuth, auth0Auth, createInterviewToken);

export default router;