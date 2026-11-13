import mongoose, { Schema } from "mongoose";

// ------------------------------------------------------------------
// Sub-schema: one category entry in the AI feedback object.
// ------------------------------------------------------------------
const feedbackCategorySchema = new Schema(
  {
    name:    { type: String, required: true },
    score:   { type: Number, min: 0, max: 10, required: true },
    comment: { type: String, default: "" },
  },
  { _id: false }
);

// ------------------------------------------------------------------
// Sub-schema: one entry in the improvement_plan array.
// ------------------------------------------------------------------
const improvementPlanItemSchema = new Schema(
  {
    area:                   { type: String, required: true },
    observation:            { type: String, default: "" },
    why_it_matters:         { type: String, default: "" },
    how_to_improve:         { type: String, default: "" },
    example_from_interview: { type: String, default: "" },
  },
  { _id: false }
);

// ------------------------------------------------------------------
// Sub-schema: the complete AI feedback block.
// Stored only when the LiveKit agent successfully generates feedback.
// ------------------------------------------------------------------
const aiFeedbackSchema = new Schema(
  {
    overall_score:    { type: Number, min: 0, max: 100, required: true },
    categories:       { type: [feedbackCategorySchema], default: [] },
    strengths:        { type: [String], default: [] },
    improvements:     { type: [String], default: [] },
    improvement_plan: { type: [improvementPlanItemSchema], default: [] },
    summary:          { type: String, default: "" },
    // Timestamp recorded server-side when feedback is persisted so the
    // UI can distinguish «completed with feedback» from «feedback pending».
    saved_at:         { type: Date, default: Date.now },
  },
  { _id: false }
);

// ------------------------------------------------------------------
// Main Meeting schema.
// Existing required fields (user_id, meeting_code, date) are unchanged.
// All new fields are optional so existing documents remain valid.
// ------------------------------------------------------------------
const meetingSchema = new Schema({
  // ── existing fields ─────────────────────────────────────────────
  user_id:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  meeting_code: { type: String, required: true },
  date:         { type: Date, default: Date.now, required: true },

  // ── new fields (all optional for backward compat) ────────────────

  /** "AI" for LiveKit AI interviews; "HUMAN" for peer video meetings. */
  interview_type: {
    type: String,
    enum: ["AI", "HUMAN"],
    default: null,
  },

  /**
   * Lifecycle:
   *   IN_PROGRESS – room created, interview underway
   *   COMPLETED   – interview ended with valid AI feedback saved
   *   ABANDONED   – ended without feedback (user skipped / timeout / error)
   */
  status: {
    type: String,
    enum: ["IN_PROGRESS", "COMPLETED", "ABANDONED"],
    default: null,
  },

  /** When the interview room was created (mirrors `date` for AI; set on join for HUMAN). */
  start_time: { type: Date, default: null },

  /** When the interview ended (disconnect or feedback saved). */
  end_time: { type: Date, default: null },

  /** Optional link to the Resume used for question generation. */
  resume_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Resume",
    default: null,
  },

  /**
   * Structured AI feedback written by the LiveKit agent.
   * Null when feedback was not generated or failed.
   * Once set to a valid object, a subsequent empty/malformed save is rejected
   * by the controller (not here) to prevent accidental overwrite.
   */
  ai_feedback: { type: aiFeedbackSchema, default: null },
});

const Meeting = mongoose.model("Meeting", meetingSchema);

export { Meeting };