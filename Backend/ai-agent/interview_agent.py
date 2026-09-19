"""
BlinkR AI Voice Interviewer — LiveKit Agent
Run this as a standalone worker process (separate from your Express backend).

Install:
    pip install "livekit-agents[google,silero,elevenlabs,openai]" python-dotenv openai

Env vars needed (.env in this folder or exported):
    LIVEKIT_URL=wss://your-project.livekit.cloud
    LIVEKIT_API_KEY=...
    LIVEKIT_API_SECRET=...
    GOOGLE_API_KEY=...        # Gemini API key (from Google AI Studio)
    ELEVENLABS_API_KEY=...    # from elevenlabs.io, free tier, no card needed
    KILO_API_KEY=...          # from kilo.ai — used for post-interview feedback
                               # generation, AND as a 3rd fallback LLM if both
                               # Gemini models in the main interview are exhausted

Run:
    python interview_agent.py dev
    (use "start" instead of "dev" in production)

Architecture: STT -> LLM -> TTS cascade (not the single native-audio model).
This is deliberate: the native-audio speech-to-speech model's own listening
was mis-transcribing English speech (with an Indian accent) into Devanagari
script. Using a dedicated STT stage lets us hard-lock the recognized
language to English, which the combined model did not reliably respect.
"""

import os
import re
import asyncio
import httpx
from dotenv import load_dotenv

from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    WorkerOptions,
    cli,
    llm,
)
from livekit.plugins import silero
from livekit.plugins.google import LLM as GeminiLLM
from livekit.plugins import openai as lk_openai
from livekit.plugins.google.beta import GeminiSTT, GeminiTTS
from livekit.plugins import elevenlabs
from livekit.agents.llm import FallbackAdapter
from livekit.agents.tts import FallbackAdapter as TTSFallbackAdapter
from openai import AsyncOpenAI
import json

QUOTA_MESSAGE = (
    "I'm sorry, I've hit a usage limit and can't continue right now. "
    "Please try again in a little while."
)

FEEDBACK_INSTRUCTIONS = """You are evaluating a completed mock interview. Based on the
full transcript below, produce an assessment as STRICT JSON only — no markdown
fences, no commentary outside the JSON, just the object, matching exactly this shape:

{
  "overall_score": <integer 0-100>,
  "categories": [
    {"name": "Technical Knowledge", "score": <integer 0-10>, "comment": "<1-2 sentence note>"},
    {"name": "Communication", "score": <integer 0-10>, "comment": "<1-2 sentence note>"},
    {"name": "Clarity of Answers", "score": <integer 0-10>, "comment": "<1-2 sentence note>"},
    {"name": "Problem Solving", "score": <integer 0-10>, "comment": "<1-2 sentence note>"},
    {"name": "Confidence", "score": <integer 0-10>, "comment": "<1-2 sentence note>"}
  ],
  "strengths": ["<short point>", "<short point>"],
  "improvements": ["<short point>", "<short point>"],
  "improvement_plan": [
    {
      "area": "<short label, e.g. 'Explaining time complexity'>",
      "observation": "<specific, concrete description of what the candidate actually
        did or said that shows this gap — quote or closely paraphrase their real
        words, don't speak generically>",
      "why_it_matters": "<1-2 sentences on the real-world impact of this gap in an
        actual interview or on the job>",
      "how_to_improve": "<a specific, actionable technique or practice exercise —
        not generic advice like 'practice more'. e.g. 'Before answering, restate the
        question and name the data structure you'll use, out loud, in one sentence,
        before diving into details.'>",
      "example_from_interview": "<a short, direct reference to the moment in the
        transcript this is based on, e.g. 'When asked about closures, you jumped
        straight to a code example without first defining the concept.'>"
    }
  ],
  "summary": "<2-3 sentence overall summary>"
}

Base every score and observation strictly on what the candidate actually said in
the transcript below, not the interviewer's own turns. If the transcript is too
short to fairly judge a category, still give a best-estimate score and note that
briefly in that category's comment.

For "improvement_plan": produce 3-5 entries. Each one must be genuinely specific
to THIS candidate's actual answers — grounded in a real moment from the transcript,
not a generic interview tip that could apply to anyone. Prioritize the most
impactful gaps first. If the candidate did well overall with few real gaps, it's
fine to return fewer entries (minimum 1) rather than inventing weak ones.
"""

load_dotenv()

BASE_INSTRUCTIONS = """You are BlinkR AI Interviewer, a friendly but rigorous technical interviewer.

Rules:
- Ask ONE question at a time. Wait for the candidate's full answer before responding.
- Keep your own turns short and conversational (voice, not essay).
- After each answer, briefly acknowledge it, then either ask a natural follow-up
  or move to the next question.
- Cover a mix of: fundamentals, practical problem-solving, and a short scenario question.
- Ask about 5-6 questions total, then wrap up by thanking the candidate and telling
  them the interview is complete.
- Be encouraging in tone but do not just say "good job" to everything — probe
  shallow answers with a clarifying follow-up.
- Always respond in English only.
"""


class InterviewerAgent(Agent):
    def __init__(self, config: dict, room):
        role = config.get("role", "General Software Engineer")
        interview_type = config.get("interviewType", "Technical")
        experience_level = config.get("experienceLevel", "Mid-level")
        focus_areas = config.get("focusAreas", "")
        difficulty = config.get("difficulty", "Medium")

        type_guidance = {
            "Technical": "Focus on technical/coding fundamentals, problem-solving, "
            "and hands-on knowledge relevant to the role.",
            "Behavioral": "Focus on past experiences, teamwork, conflict resolution, "
            "and situational judgement (e.g. 'Tell me about a time when...').",
            "HR/Screening": "Focus on background, motivation, expectations, "
            "availability, and general fit — light on deep technical detail.",
            "Mixed": "Blend technical questions with a couple of behavioral/"
            "situational questions.",
        }.get(interview_type, "Focus on technical/coding fundamentals.")

        extra_instructions = (
            f"\nInterview configuration:\n"
            f"- Role: {role}\n"
            f"- Interview type: {interview_type}. {type_guidance}\n"
            f"- Candidate experience level: {experience_level} — calibrate question "
            f"difficulty accordingly (don't ask senior-level system design questions "
            f"to a fresher, and don't ask only basics to a senior).\n"
            f"- Overall difficulty preference: {difficulty}.\n"
        )
        if focus_areas.strip():
            extra_instructions += (
                f"- The candidate specifically wants to focus on: {focus_areas}. "
                "Prioritize questions from these areas where relevant.\n"
            )

        super().__init__(instructions=BASE_INSTRUCTIONS + extra_instructions)
        self._room = room

    async def _notify_quota_exceeded(self):
        print("[interview_agent] LLM failed (all fallbacks exhausted) — notifying user")
        try:
            await self._room.local_participant.publish_data(
                payload=json.dumps(
                    {"type": "interview_error", "message": QUOTA_MESSAGE}
                ).encode("utf-8"),
                reliable=True,
            )
        except Exception as e:
            print(f"[interview_agent] failed to publish error banner: {e}")

    async def llm_node(self, chat_ctx, tools, model_settings):
        # FallbackAdapter only raises when every backup model has also
        # failed (e.g. all out of free-tier quota) — it does not emit an
        # "error" event on itself, so we catch the raised exception here
        # directly, which is the documented way to customize this stage.
        try:
            async for chunk in Agent.default.llm_node(self, chat_ctx, tools, model_settings):
                yield chunk
        except Exception as e:
            print(f"[interview_agent] llm_node failed: {type(e).__name__}: {e}")
            await self._notify_quota_exceeded()
            # Yielding plain text here makes it flow through the normal TTS
            # pipeline as if it were the model's own reply, so the candidate
            # actually hears an explanation instead of silence.
            yield QUOTA_MESSAGE


def _transcript_from_history(history: "llm.ChatContext") -> str:
    lines = []
    for msg in history.messages():
        if msg.role not in ("user", "assistant"):
            continue
        speaker = "Candidate" if msg.role == "user" else "Interviewer"
        text = (msg.text_content or "").strip()
        if text:
            lines.append(f"{speaker}: {text}")
    return "\n".join(lines)


KILO_GATEWAY_BASE_URL = "https://api.kilo.ai/api/gateway"
# Kilo's specific free models change over time (confirmed: a hardcoded model
# id we tried, "z-ai/glm-5:free", was already gone within days). "kilo-auto/free"
# is Kilo's own router alias that rotates through whichever free models are
# currently available, so Kilo itself handles keeping this valid instead of us.
KILO_FEEDBACK_MODEL = "kilo-auto/free"


async def _generate_feedback(role: str, history: "llm.ChatContext") -> dict:
    transcript = _transcript_from_history(history)
    print(f"[interview_agent] feedback: transcript has {len(transcript)} chars")
    if not transcript.strip():
        print("[interview_agent] feedback: transcript empty, skipping LLM call")
        return {
            "overall_score": None,
            "categories": [],
            "strengths": [],
            "improvements": [],
            "improvement_plan": [],
            "summary": "Not enough conversation happened to generate feedback.",
        }

    prompt = FEEDBACK_INSTRUCTIONS + f"\n\nRole interviewed for: {role}\n\nTranscript:\n{transcript}"

    # Feedback generation is deliberately routed through Kilo Gateway instead
    # of Gemini — this is a separate provider/quota entirely, so generating
    # feedback never competes with the main interview conversation's Gemini
    # token budget.
    client = AsyncOpenAI(
        api_key=os.environ["KILO_API_KEY"],
        base_url=KILO_GATEWAY_BASE_URL,
    )

    print(f"[interview_agent] feedback: calling Kilo Gateway ({KILO_FEEDBACK_MODEL})...")
    response = await client.chat.completions.create(
        model=KILO_FEEDBACK_MODEL,
        messages=[
            {"role": "system", "content": "You output strict JSON only, nothing else."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.5,
    )
    text = response.choices[0].message.content or ""
    print(f"[interview_agent] feedback: Kilo Gateway returned {len(text)} chars")

    # Strip markdown code fences in case the model adds them despite instructions.
    cleaned = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    try:
        parsed = json.loads(cleaned)
        print("[interview_agent] feedback: JSON parsed OK")
        return parsed
    except Exception as e:
        print(f"[interview_agent] failed to parse feedback JSON: {e}\nraw: {text}")
        return {
            "overall_score": None,
            "categories": [],
            "strengths": [],
            "improvements": [],
            "improvement_plan": [],
            "summary": "Feedback could not be generated due to a formatting error. "
            "Please try ending the interview again.",
        }


async def entrypoint(ctx: JobContext):
    await ctx.connect()

    config = {}
    participant = await ctx.wait_for_participant()
    try:
        config = json.loads(participant.metadata or "{}")
    except Exception:
        pass
    role = config.get("role", "General Software Engineer")

    api_key = os.environ["GOOGLE_API_KEY"]

    # Kept as a separate variable (not just inline in AgentSession) so we can
    # reuse the exact same fallback-protected LLM for feedback generation too.
    fallback_llms = [
        GeminiLLM(
            model="gemini-3.5-flash-lite",  # primary: confirmed 500 RPD on this
            # account (vs. gemini-flash-lite-latest, which turned out to have
            # ZERO allocated quota — every request to it was silently failing
            # and cascading to the fallback the whole time)
            api_key=api_key,
            temperature=0.7,
        ),
        GeminiLLM(
            model="gemini-3.6-flash",  # backup: different model = separate quota bucket
            api_key=api_key,
            temperature=0.7,
        ),
    ]

    # Third rung, only added if a Kilo key is configured: if BOTH Gemini
    # models are exhausted (their daily quota is shared account-wide and we
    # hit this repeatedly today from testing), fall over to Kilo Gateway's
    # free router instead of the interview just failing outright. It's a
    # weaker, rotating free model, so this is deliberately a last resort,
    # not something we lean on normally.
    kilo_key = os.environ.get("KILO_API_KEY")
    if kilo_key:
        fallback_llms.append(
            lk_openai.LLM(
                model=KILO_FEEDBACK_MODEL,  # "kilo-auto/free"
                api_key=kilo_key,
                base_url=KILO_GATEWAY_BASE_URL,
                timeout=httpx.Timeout(20.0),
            )
        )
    else:
        print("[interview_agent] KILO_API_KEY not set — skipping Kilo as a 3rd LLM fallback")

    llm_adapter = FallbackAdapter(
        fallback_llms,
        # Gemini's API rejects any deadline under 10s ("Manually set
        # deadline Xs is too short"), but FallbackAdapter's own default
        # is 5s — that mismatch was causing instant false failures,
        # not real quota errors. 15s gives real headroom above the
        # 10s floor while still failing over reasonably quickly.
        attempt_timeout=15.0,
    )

    # Log exactly which model went down/came back, on both fallback chains.
    # Without this, all you see is a generic framework warning like
    # "livekit.plugins.google.llm.LLM recovery failed" — which doesn't say
    # WHICH configured instance (primary Gemini? backup? Kilo?) or say
    # whether it's the LLM or TTS stage that's affected.
    def _on_llm_availability_changed(ev):
        state = "back UP" if ev.available else "went DOWN"
        print(f"[interview_agent] LLM fallback: model='{ev.llm.model}' "
              f"provider='{ev.llm.provider}' {state}")

    def _on_tts_availability_changed(ev):
        state = "back UP" if ev.available else "went DOWN"
        print(f"[interview_agent] TTS fallback: model='{ev.tts.model}' "
              f"provider='{ev.tts.provider}' {state}")

    llm_adapter.on("llm_availability_changed", _on_llm_availability_changed)

    tts_adapter = TTSFallbackAdapter(
        [
            elevenlabs.TTS(
                api_key=os.environ["ELEVENLABS_API_KEY"],
                model="eleven_turbo_v2_5",
            ),
            GeminiTTS(
                voice_name="Kore",
                api_key=api_key,
            ),
        ]
    )
    tts_adapter.on("tts_availability_changed", _on_tts_availability_changed)

    session = AgentSession(
        # Dedicated STT stage, hard-locked to English — this is the fix for
        # the Hindi-script mis-transcription issue.
        stt=GeminiSTT(
            language="en-US",
            api_key=api_key,
        ),
        # Standard (non-realtime) Gemini text model for reasoning/dialogue.
        # Wrapped in a FallbackAdapter: if the primary model hits a quota
        # wall or errors out mid-interview, it automatically retries on the
        # backup model instead of crashing the whole session.
        llm=llm_adapter,
        # ElevenLabs is primary TTS. Gemini TTS is the backup — its very
        # tight free-tier quota (3 req/min) makes it a poor primary, but
        # that's fine for a fallback that should rarely actually fire.
        # Wrapping in FallbackAdapter means an ElevenLabs outage or quota
        # exhaustion (which we hit today) doesn't kill the whole session.
        tts=tts_adapter,
        # Voice activity detection for turn-taking (who's speaking when).
        vad=silero.VAD.load(),
    )

    await session.start(
        agent=InterviewerAgent(config=config, room=ctx.room),
        room=ctx.room,
    )

    # STT/TTS errors do emit a real "error" event on the session (unlike
    # the LLM FallbackAdapter case, which is handled directly in
    # llm_node above), so this covers those cases as a second net.
    async def _on_error(ev):
        error_type = type(ev.error).__name__
        print(f"[interview_agent] session error: {error_type}: {ev.error}")
        try:
            await ctx.room.local_participant.publish_data(
                payload=json.dumps(
                    {"type": "interview_error", "message": QUOTA_MESSAGE}
                ).encode("utf-8"),
                reliable=True,
            )
        except Exception:
            pass

    session.on("error", lambda ev: asyncio.create_task(_on_error(ev)))

    # Frontend sends {"type": "request_feedback"} over the data channel when
    # the candidate clicks "End Interview" — generate a structured
    # assessment from the conversation so far and send it back.
    async def _handle_feedback_request():
        try:
            print("[interview_agent] feedback: request received, generating...")
            feedback = await _generate_feedback(role, session.history)
            await ctx.room.local_participant.publish_data(
                payload=json.dumps(
                    {"type": "interview_feedback", "data": feedback}
                ).encode("utf-8"),
                reliable=True,
            )
            print("[interview_agent] feedback: published successfully")
        except Exception as e:
            import traceback
            print(f"[interview_agent] feedback generation failed: {e}")
            traceback.print_exc()
            try:
                await ctx.room.local_participant.publish_data(
                    payload=json.dumps(
                        {
                            "type": "interview_feedback_error",
                            "message": "Could not generate feedback right now.",
                        }
                    ).encode("utf-8"),
                    reliable=True,
                )
                print("[interview_agent] feedback: error notice published")
            except Exception as e2:
                print(f"[interview_agent] feedback: even the error notice failed: {e2}")

    def _on_data(data_packet):
        print(f"[interview_agent] data_received: topic={data_packet.topic!r} "
              f"len={len(data_packet.data)} bytes")
        try:
            msg = json.loads(data_packet.data.decode("utf-8"))
        except Exception as e:
            print(f"[interview_agent] data_received: failed to parse as JSON: {e}")
            return
        print(f"[interview_agent] data_received: parsed type={msg.get('type')!r}")
        if msg.get("type") == "request_feedback":
            asyncio.create_task(_handle_feedback_request())

    ctx.room.on("data_received", _on_data)
    print("[interview_agent] registered data_received listener")

    await session.generate_reply(
        instructions="Greet the candidate warmly, confirm the role you're "
        "interviewing them for, and ask your first question."
    )


if __name__ == "__main__":
    print(f"[interview_agent] starting up — feedback model: {KILO_FEEDBACK_MODEL}")
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))