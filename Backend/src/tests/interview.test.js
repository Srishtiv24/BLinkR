/**
 * Interview persistence tests
 *
 * Uses:
 *   - mongodb-memory-server  (in-process MongoDB, no external connection required)
 *   - supertest              (HTTP assertions against the Express app)
 *   - vitest                 (ESM-compatible test runner)
 *
 * Run:
 *   npx vitest run src/tests/interview.test.js
 *
 * These tests cover:
 *   1.  AI feedback persistence — happy path
 *   2.  Invalid / malformed feedback (score out of range, missing field)
 *   3.  Missing feedback / feedback-generation failure → ABANDONED
 *   4.  Duplicate save retry → updates same Meeting, no duplicates
 *   5.  Unauthorized access: a user cannot save/read another user's meeting
 *   6.  Human interview history — appears without ai_feedback
 *   7.  GET /activities  — history and pagination
 *   8.  GET /activities/:id — detail endpoint
 *   9.  Compatibility: existing Meeting records without new fields still load
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

// ── Unit under test ──────────────────────────────────────────────────────────
import { Meeting } from "../models/meeting.model.js";
import { User } from "../models/user.model.js";

// We import the controller functions directly for unit-level tests so we don't
// need the full Express stack running for every case.
import {
  saveAiFeedback,
  abandonInterview,
} from "../controllers/interviewController.js";
import {
  getUserHistory,
  getInterviewDetails,
  addToHistory,
} from "../controllers/user.controller.js";

// ── Test constants ───────────────────────────────────────────────────────────
process.env.JWT_SECRET_KEY = "test-secret-key-for-vitest";
process.env.LIVEKIT_API_KEY = "fake-lk-key";
process.env.LIVEKIT_API_SECRET = "fake-lk-secret";
process.env.LIVEKIT_URL = "wss://test.livekit.example";

const VALID_FEEDBACK = {
  overall_score: 72,
  categories: [
    { name: "Technical Knowledge", score: 7, comment: "Good understanding of fundamentals." },
    { name: "Communication",       score: 6, comment: "Clear but could be more concise." },
    { name: "Clarity of Answers",  score: 7, comment: "Structured responses." },
    { name: "Problem Solving",     score: 8, comment: "Systematic approach." },
    { name: "Confidence",          score: 6, comment: "Confident overall." },
  ],
  strengths:    ["Strong on data structures", "Clear communication"],
  improvements: ["Could go deeper on system design"],
  improvement_plan: [
    {
      area:                   "System design depth",
      observation:            "Candidate skipped trade-off analysis",
      why_it_matters:         "Senior roles require this",
      how_to_improve:         "Practice designing for scale",
      example_from_interview: "When asked about caching, focused only on Redis",
    },
  ],
  summary: "A solid mid-level candidate with good fundamentals.",
};

// ── MongoDB in-process setup ─────────────────────────────────────────────────
let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  // Clean all collections between tests for isolation
  await Promise.all([Meeting.deleteMany({}), User.deleteMany({})]);
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Create a minimal User document and return it plus a signed JWT. */
async function createUser(overrides = {}) {
  const user = new User({
    name: overrides.name || "Test User",
    email: overrides.email || `user-${Date.now()}@example.com`,
    password: "HashedNotCheckedInTests",
    authProvider: "local",
  });
  await user.save();
  const token = jwt.sign(
    { id: user._id.toString(), name: user.name, email: user.email },
    process.env.JWT_SECRET_KEY,
    { expiresIn: "1h" }
  );
  return { user, token };
}

/** Create an AI Meeting document for a given user. */
async function createAIMeeting(userId, overrides = {}) {
  const now = new Date();
  return Meeting.create({
    user_id:        userId,
    meeting_code:   overrides.meeting_code || `interview-${userId}-${Date.now()}`,
    date:           now,
    interview_type: "AI",
    status:         overrides.status || "IN_PROGRESS",
    start_time:     now,
    ...overrides,
  });
}

/** Build a mock req/res pair that the controller functions accept. */
function mockReqRes({ user, params = {}, body = {}, query = {} } = {}) {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const res = { status, json };
  const req = { user, params, body, query };
  return { req, res, json, status };
}

// Use vitest's vi for mocking
import { vi } from "vitest";

// ════════════════════════════════════════════════════════════════════════════
// 1. Successful AI feedback persistence
// ════════════════════════════════════════════════════════════════════════════
describe("1. AI feedback persistence — happy path", () => {
  it("saves valid feedback, sets status=COMPLETED, sets end_time", async () => {
    const { user } = await createUser();
    const meeting = await createAIMeeting(user._id);

    const { req, res, status, json } = mockReqRes({
      user:   { id: user._id.toString() },
      params: { meetingId: meeting._id.toString() },
      body:   { feedback: VALID_FEEDBACK },
    });

    await saveAiFeedback(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Feedback saved", status: "COMPLETED" })
    );

    const updated = await Meeting.findById(meeting._id).lean();
    expect(updated.status).toBe("COMPLETED");
    expect(updated.ai_feedback).toBeTruthy();
    expect(updated.ai_feedback.overall_score).toBe(72);
    expect(updated.ai_feedback.categories).toHaveLength(5);
    expect(updated.end_time).toBeTruthy();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. Invalid / malformed feedback
// ════════════════════════════════════════════════════════════════════════════
describe("2. Invalid feedback is rejected", () => {
  it("rejects if overall_score is missing", async () => {
    const { user } = await createUser();
    const meeting = await createAIMeeting(user._id);
    const bad = { ...VALID_FEEDBACK };
    delete bad.overall_score;

    const { req, res, status } = mockReqRes({
      user:   { id: user._id.toString() },
      params: { meetingId: meeting._id.toString() },
      body:   { feedback: bad },
    });

    await saveAiFeedback(req, res);
    expect(status).toHaveBeenCalledWith(422);

    // Meeting should be ABANDONED (first save attempt)
    const updated = await Meeting.findById(meeting._id).lean();
    expect(updated.status).toBe("ABANDONED");
    expect(updated.ai_feedback).toBeNull();
  });

  it("rejects if overall_score is out of range (> 100)", async () => {
    const { user } = await createUser();
    const meeting = await createAIMeeting(user._id);

    const { req, res, status } = mockReqRes({
      user:   { id: user._id.toString() },
      params: { meetingId: meeting._id.toString() },
      body:   { feedback: { ...VALID_FEEDBACK, overall_score: 150 } },
    });

    await saveAiFeedback(req, res);
    expect(status).toHaveBeenCalledWith(422);
  });

  it("rejects if a category score is out of range (> 10)", async () => {
    const { user } = await createUser();
    const meeting = await createAIMeeting(user._id);
    const badCategories = VALID_FEEDBACK.categories.map((c, i) =>
      i === 0 ? { ...c, score: 15 } : c
    );

    const { req, res, status } = mockReqRes({
      user:   { id: user._id.toString() },
      params: { meetingId: meeting._id.toString() },
      body:   { feedback: { ...VALID_FEEDBACK, categories: badCategories } },
    });

    await saveAiFeedback(req, res);
    expect(status).toHaveBeenCalledWith(422);
  });

  it("rejects feedback that is null", async () => {
    const { user } = await createUser();
    const meeting = await createAIMeeting(user._id);

    const { req, res, status } = mockReqRes({
      user:   { id: user._id.toString() },
      params: { meetingId: meeting._id.toString() },
      body:   { feedback: null },
    });

    await saveAiFeedback(req, res);
    expect(status).toHaveBeenCalledWith(422);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. Missing feedback / generation failure → ABANDONED
// ════════════════════════════════════════════════════════════════════════════
describe("3. Abandon endpoint", () => {
  it("sets status=ABANDONED and end_time when called on IN_PROGRESS meeting", async () => {
    const { user } = await createUser();
    const meeting = await createAIMeeting(user._id);

    const { req, res, status, json } = mockReqRes({
      user:   { id: user._id.toString() },
      params: { meetingId: meeting._id.toString() },
      body:   {},
    });

    await abandonInterview(req, res);
    expect(status).toHaveBeenCalledWith(200);

    const updated = await Meeting.findById(meeting._id).lean();
    expect(updated.status).toBe("ABANDONED");
    expect(updated.end_time).toBeTruthy();
  });

  it("does NOT downgrade a COMPLETED meeting to ABANDONED", async () => {
    const { user } = await createUser();
    const meeting = await createAIMeeting(user._id, {
      status:     "COMPLETED",
      ai_feedback: VALID_FEEDBACK,
    });

    const { req, res, status } = mockReqRes({
      user:   { id: user._id.toString() },
      params: { meetingId: meeting._id.toString() },
      body:   {},
    });

    await abandonInterview(req, res);
    expect(status).toHaveBeenCalledWith(200);

    const updated = await Meeting.findById(meeting._id).lean();
    expect(updated.status).toBe("COMPLETED"); // unchanged
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. Duplicate save retry — idempotent
// ════════════════════════════════════════════════════════════════════════════
describe("4. Duplicate save retry", () => {
  it("second valid save updates same record, no duplicate created", async () => {
    const { user } = await createUser();
    const meeting = await createAIMeeting(user._id);
    const makeReq = (score) => mockReqRes({
      user:   { id: user._id.toString() },
      params: { meetingId: meeting._id.toString() },
      body:   { feedback: { ...VALID_FEEDBACK, overall_score: score } },
    });

    // First save
    await saveAiFeedback(makeReq(72).req, makeReq(72).res);
    // Second save (updated score)
    const second = makeReq(80);
    await saveAiFeedback(second.req, second.res);

    const total = await Meeting.countDocuments({ user_id: user._id });
    expect(total).toBe(1); // no duplicate created

    const updated = await Meeting.findById(meeting._id).lean();
    expect(updated.ai_feedback.overall_score).toBe(80);
  });

  it("malformed second save does NOT overwrite existing good feedback", async () => {
    const { user } = await createUser();
    const meeting = await createAIMeeting(user._id);

    // First save — valid
    const first = mockReqRes({
      user:   { id: user._id.toString() },
      params: { meetingId: meeting._id.toString() },
      body:   { feedback: VALID_FEEDBACK },
    });
    await saveAiFeedback(first.req, first.res);

    // Second save — malformed
    const second = mockReqRes({
      user:   { id: user._id.toString() },
      params: { meetingId: meeting._id.toString() },
      body:   { feedback: null },
    });
    await saveAiFeedback(second.req, second.res);
    expect(second.status).toHaveBeenCalledWith(422);

    // Original feedback is still intact
    const updated = await Meeting.findById(meeting._id).lean();
    expect(updated.ai_feedback.overall_score).toBe(72);
    expect(updated.status).toBe("COMPLETED");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. Unauthorized access — user cannot touch another user's meeting
// ════════════════════════════════════════════════════════════════════════════
describe("5. Authorization", () => {
  it("403 when saving feedback to another user's meeting", async () => {
    const { user: owner } = await createUser();
    const { user: attacker } = await createUser({ email: "attacker@x.com" });
    const meeting = await createAIMeeting(owner._id);

    const { req, res, status } = mockReqRes({
      user:   { id: attacker._id.toString() },
      params: { meetingId: meeting._id.toString() },
      body:   { feedback: VALID_FEEDBACK },
    });

    await saveAiFeedback(req, res);
    expect(status).toHaveBeenCalledWith(403);

    // Meeting unchanged
    const updated = await Meeting.findById(meeting._id).lean();
    expect(updated.ai_feedback).toBeNull();
  });

  it("403 when abandoning another user's meeting", async () => {
    const { user: owner } = await createUser();
    const { user: attacker } = await createUser({ email: "attacker2@x.com" });
    const meeting = await createAIMeeting(owner._id);

    const { req, res, status } = mockReqRes({
      user:   { id: attacker._id.toString() },
      params: { meetingId: meeting._id.toString() },
      body:   {},
    });

    await abandonInterview(req, res);
    expect(status).toHaveBeenCalledWith(403);

    const updated = await Meeting.findById(meeting._id).lean();
    expect(updated.status).toBe("IN_PROGRESS"); // unchanged
  });

  it("403 when fetching details of another user's interview", async () => {
    const { user: owner } = await createUser();
    const { user: attacker } = await createUser({ email: "attacker3@x.com" });
    const meeting = await createAIMeeting(owner._id);

    const { req, res, status } = mockReqRes({
      user:   { id: attacker._id.toString() },
      params: { meetingId: meeting._id.toString() },
    });

    await getInterviewDetails(req, res);
    expect(status).toHaveBeenCalledWith(403);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. Human interview history — appears without ai_feedback
// ════════════════════════════════════════════════════════════════════════════
describe("6. Human interview history", () => {
  it("addToHistory creates a HUMAN meeting without ai_feedback", async () => {
    const { user } = await createUser();
    const { req, res, status } = mockReqRes({
      user:   { id: user._id.toString() },
      params: {},
      body:   { meetingCode: "abc123" },
    });

    await addToHistory(req, res);
    expect(status).toHaveBeenCalledWith(201);

    const m = await Meeting.findOne({ user_id: user._id }).lean();
    expect(m.interview_type).toBe("HUMAN");
    expect(m.status).toBe("COMPLETED");
    expect(m.ai_feedback).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7. History list endpoint — pagination and type filter
// ════════════════════════════════════════════════════════════════════════════
describe("7. GET /activities — history list", () => {
  it("returns only meetings belonging to the authenticated user", async () => {
    const { user: u1 } = await createUser();
    const { user: u2 } = await createUser({ email: "u2@x.com" });

    await createAIMeeting(u1._id);
    await createAIMeeting(u1._id);
    await createAIMeeting(u2._id); // should not appear for u1

    let captured;
    const res = {
      status: (code) => ({ json: (data) => { captured = { code, data }; } }),
      json:   (data) => { captured = { code: 200, data }; },
    };

    await getUserHistory(
      { user: { id: u1._id.toString() }, query: {} },
      res
    );

    expect(captured.data.items).toHaveLength(2);
    expect(captured.data.pagination.total).toBe(2);
  });

  it("filters by interview_type=HUMAN correctly", async () => {
    const { user } = await createUser();

    await createAIMeeting(user._id);
    await Meeting.create({
      user_id:        user._id,
      meeting_code:   "human-code",
      date:           new Date(),
      interview_type: "HUMAN",
      status:         "COMPLETED",
    });

    let captured;
    const res = {
      status: (code) => ({ json: (data) => { captured = { code, data }; } }),
      json:   (data) => { captured = { code: 200, data }; },
    };

    await getUserHistory(
      { user: { id: user._id.toString() }, query: { type: "HUMAN" } },
      res
    );

    expect(captured.data.items).toHaveLength(1);
    expect(captured.data.items[0].interview_type).toBe("HUMAN");
    expect(captured.data.items[0].ai_summary).toBeNull();
  });

  it("returns ai_summary for completed AI meetings", async () => {
    const { user } = await createUser();
    const meeting = await createAIMeeting(user._id, { status: "COMPLETED" });
    // Manually set ai_feedback
    meeting.ai_feedback = { ...VALID_FEEDBACK, saved_at: new Date() };
    await meeting.save();

    let captured;
    const res = {
      status: (code) => ({ json: (data) => { captured = { code, data }; } }),
      json:   (data) => { captured = { code: 200, data }; },
    };

    await getUserHistory(
      { user: { id: user._id.toString() }, query: {} },
      res
    );

    const item = captured.data.items[0];
    expect(item.ai_summary).toBeTruthy();
    expect(item.ai_summary.overall_score).toBe(72);
  });

  it("pagination: page 2 returns second batch", async () => {
    const { user } = await createUser();
    for (let i = 0; i < 5; i++) await createAIMeeting(user._id);

    let captured;
    const res = {
      status: (code) => ({ json: (data) => { captured = { code, data }; } }),
      json:   (data) => { captured = { code: 200, data }; },
    };

    await getUserHistory(
      { user: { id: user._id.toString() }, query: { page: "2", limit: "3" } },
      res
    );

    expect(captured.data.items).toHaveLength(2); // 5 total, 3 on page 1, 2 on page 2
    expect(captured.data.pagination.pages).toBe(2);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 8. GET /activities/:id — detail endpoint
// ════════════════════════════════════════════════════════════════════════════
describe("8. getInterviewDetails", () => {
  it("returns full ai_feedback for own AI interview", async () => {
    const { user } = await createUser();
    const meeting = await createAIMeeting(user._id, { status: "COMPLETED" });
    meeting.ai_feedback = { ...VALID_FEEDBACK, saved_at: new Date() };
    await meeting.save();

    let captured;
    const res = {
      status: (code) => ({ json: (data) => { captured = { code, data }; } }),
      json:   (data) => { captured = { code: 200, data }; },
    };

    await getInterviewDetails(
      { user: { id: user._id.toString() }, params: { meetingId: meeting._id.toString() } },
      res
    );

    expect(captured.code).toBe(200);
    const iv = captured.data.interview;
    expect(iv.ai_feedback.overall_score).toBe(72);
    expect(iv.ai_feedback.categories).toHaveLength(5);
    expect(iv.ai_feedback.improvement_plan).toHaveLength(1);
    expect(iv.duration_seconds).toBeNull(); // end_time not set in this fixture
  });

  it("returns ai_feedback=null for HUMAN interviews", async () => {
    const { user } = await createUser();
    const meeting = await Meeting.create({
      user_id:        user._id,
      meeting_code:   "human-xyz",
      date:           new Date(),
      interview_type: "HUMAN",
      status:         "COMPLETED",
    });

    let captured;
    const res = {
      status: (code) => ({ json: (data) => { captured = { code, data }; } }),
      json:   (data) => { captured = { code: 200, data }; },
    };

    await getInterviewDetails(
      { user: { id: user._id.toString() }, params: { meetingId: meeting._id.toString() } },
      res
    );

    expect(captured.code).toBe(200);
    expect(captured.data.interview.ai_feedback).toBeNull();
  });

  it("404 for non-existent meetingId", async () => {
    const { user } = await createUser();
    const fakeId = new mongoose.Types.ObjectId().toString();

    let captured;
    const res = {
      status: (code) => ({ json: (data) => { captured = { code, data }; } }),
      json:   (data) => { captured = { code: 200, data }; },
    };

    await getInterviewDetails(
      { user: { id: user._id.toString() }, params: { meetingId: fakeId } },
      res
    );

    expect(captured.code).toBe(404);
  });

  it("computes duration_seconds when both timestamps are set", async () => {
    const { user } = await createUser();
    const start = new Date("2026-10-01T10:00:00Z");
    const end   = new Date("2026-10-01T10:25:00Z");
    const meeting = await Meeting.create({
      user_id:        user._id,
      meeting_code:   "timed-room",
      date:           start,
      interview_type: "AI",
      status:         "COMPLETED",
      start_time:     start,
      end_time:       end,
    });

    let captured;
    const res = {
      status: (code) => ({ json: (data) => { captured = { code, data }; } }),
      json:   (data) => { captured = { code: 200, data }; },
    };

    await getInterviewDetails(
      { user: { id: user._id.toString() }, params: { meetingId: meeting._id.toString() } },
      res
    );

    expect(captured.data.interview.duration_seconds).toBe(1500); // 25 minutes
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 9. Backward compatibility — legacy Meeting records load correctly
// ════════════════════════════════════════════════════════════════════════════
describe("9. Backward compatibility with legacy records", () => {
  it("loads a legacy meeting that has only user_id, meeting_code, date", async () => {
    const { user } = await createUser();
    // Insert a legacy document that lacks ALL new fields
    const raw = await Meeting.collection.insertOne({
      user_id:      user._id,
      meeting_code: "legacy-code",
      date:         new Date(),
    });

    const loaded = await Meeting.findById(raw.insertedId).lean();
    expect(loaded).toBeTruthy();
    // Raw insertOne bypasses Mongoose defaults — fields are absent in BSON
    // (undefined), not set to null. Both undefined and null mean "not present".
    expect(loaded.interview_type == null).toBe(true);
    expect(loaded.ai_feedback == null).toBe(true);
    expect(loaded.status == null).toBe(true);
  });

  it("history includes legacy records without crashing", async () => {
    const { user } = await createUser();
    await Meeting.collection.insertOne({
      user_id:      user._id,
      meeting_code: "legacy-code-2",
      date:         new Date(),
    });

    let captured;
    const res = {
      status: (code) => ({ json: (data) => { captured = { code, data }; } }),
      json:   (data) => { captured = { code: 200, data }; },
    };

    await getUserHistory(
      { user: { id: user._id.toString() }, query: {} },
      res
    );

    expect(captured.code).toBe(200);
    expect(captured.data.items).toHaveLength(1);
    const item = captured.data.items[0];
    expect(item.interview_type).toBeNull();
    expect(item.ai_summary).toBeNull();
  });
});
