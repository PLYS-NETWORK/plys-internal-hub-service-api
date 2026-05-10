# Consultant Application — API Specs

This directory covers the end-to-end consultant vetting flow: from profile submission through AI-assisted evaluation to admin approval or rejection.

## Files

| File                                                           | Audience              | Covers                                                                      |
| -------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------- |
| [consultant.md](./consultant.md)                               | Consultant (Lona app) | Profile submission, interview Q&A, interview finalisation                   |
| [admin-applications.md](./admin-applications.md)               | Internal Hub admin    | Listing, detail view, triggering evaluation, manual scoring, final decision |
| [admin-interview-questions.md](./admin-interview-questions.md) | Internal Hub admin    | Managing the COMMUNICATION and SYSTEM_KNOWLEDGE question bank               |

## Pipeline at a glance

```
Consultant                         System                              Admin
──────────                         ──────                              ─────
POST /profile  ──────────────►  [GENERATE_SKILL_QUESTIONS job]
                                   assigns 30 questions
                                   sends interview-ready email
                                   status → IN_INTERVIEW

GET /interview
POST /interview/answers (×30)
POST /interview/submit ──────►  status → INTERVIEW_SUBMITTED
                                   emails consultant + all admins ──►  sees new application

                                                                   POST /:id/start-evaluation
                                   [RUN_COPYLEAKS_EVALUATION job]
                                   ├── pass (aggregate AI score < 30)
                                   │     status → PENDING_AI_EVALUATION
                                   │     [RUN_AI_EVALUATION job]
                                   │     status → PENDING_ADMIN_EVALUATION
                                   │                                 GET /:id/manual-questions
                                   │                                 PATCH /:id/manual-evaluation
                                   │                                 finalScore = AI×60% + Admin×40%
                                   │                                 status → PENDING_FINAL_DECISION
                                   │                                 POST /:id/decide
                                   │     ├── APPROVED → isVerified=true, skill scores saved
                                   │     └── REJECTED → blocked 3 months
                                   └── fail (aggregate AI score ≥ 30)
                                         status → COPYLEAKS_FAILED
                                         blocked 3 months, rejection email sent
```

## Score formula

```
finalScore = (ai_eval_score × 0.6) + (admin_eval_score × 0.4)
Pass threshold: finalScore ≥ 80
```

## Block enforcement

A rejected consultant (score < 80 or Copyleaks failure) is blocked for **3 months** from re-applying. The block is enforced at two points:

1. **Registration** — `POST /auth/register` for `active_platform=consultant` returns `403 CONSULTANT_APPLICATION_BLOCKED` if a block is active.
2. **Profile submission** — `POST /consultant/application/profile` also checks and returns the same error code.
