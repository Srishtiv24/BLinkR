import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["intro", "skill", "project", "experience"], // consistent across all
    required: true,
  },
  level: {
    type: String,
    enum: ["basic", "intermediate", "advanced"],
    required: true,
  },
  question: { type: String, required: true },
});

const resumeSchema = new mongoose.Schema({
  resumeText: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  generalizedQuestions: [questionSchema],
  skillQuestions: [questionSchema],
  regenerateQuestions: [questionSchema],
});

const Resume = mongoose.model("Resume", resumeSchema);

export { Resume };