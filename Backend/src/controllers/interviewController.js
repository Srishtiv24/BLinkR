import { AccessToken } from "livekit-server-sdk";
import httpStatus from "http-status";

// POST /api/interview/token
// body: { candidateName, role, interviewType, experienceLevel, focusAreas, difficulty }
export const createInterviewToken = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(httpStatus.UNAUTHORIZED).json({ message: "Not authenticated" });
    }

    const {
      candidateName,
      role,
      interviewType,
      experienceLevel,
      focusAreas,
      difficulty,
    } = req.body;

    if (!candidateName) {
      return res.status(httpStatus.BAD_REQUEST).json({ message: "candidateName is required" });
    }

    // req.user is either a decoded local JWT payload (has _id/id) or a Mongo User doc
    const userId = (req.user._id || req.user.id || "guest").toString();

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

    return res.status(httpStatus.OK).json({
      token,
      url: process.env.LIVEKIT_URL,
      roomName,
      identity,
    });
  } catch (err) {
    console.error("createInterviewToken error:", err);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "Failed to create interview session" });
  }
};