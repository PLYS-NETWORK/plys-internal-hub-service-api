# Consultant Onboarding — API Specs

End-to-end consultant vetting flow under the **admin-managed onboarding-question bank** model.

**Base path:** `/api/v1`
**Response envelope:** every endpoint is wrapped by `TransformResponseInterceptor` into
`{ status_code, message, error_code, data, timestamp, path }`. The per-endpoint examples below show only the **`data`** portion unless the error envelope matters.
**Field naming:** JSON contract is **snake_case**. TypeScript classes use camelCase internally; `@Expose({ name: 'snake_key' })` and a service-layer plain mapping bridge the two.

## Audiences

| File                                                                                                           | Audience                | Covers                                                                                 |
| -------------------------------------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------- |
| [consultant](../consultant-service/onboarding/onboarding-api-specs.md)                                         | Consultant (Lonaos app) | Basic profile (Step 1) + active-question fetch + bulk answer submission (Step 2)       |
| [admin](../internal-admin-service/consultant-onboarding/consultant-onboarding-api-specs.md)                    | Internal Hub admin      | Onboarding review (list, detail, decide APPROVE / REJECT)                              |
| [admin-onboarding-questions](../internal-admin-service/onboarding-questions/onboarding-questions-api-specs.md) | Internal Hub admin      | CRUD + active/inactive toggle + soft delete + bulk reorder on the global question bank |

## Pipeline at a glance

```
Consultant                                  System                                  Admin
──────────                                  ──────                                  ─────
                                            (admin curates the question bank
                                              via /admin/onboarding-questions
                                              ahead of time — CRUD, active toggle,
                                              soft delete, bulk reorder.)

POST /files?purpose=consultant_cv    ───►   stores CV under consultant-CVs/<env>/...
                                            stamps file row with purpose=CONSULTANT_CV
                                            returns { id, url, ... }

POST /consultant/onboarding/profile  ───►   updates ConsultantProfile (basic info + cv_url)
       { full_name, bio, ..., cv_url }      ConsultantOnboarding → IN_INTERVIEW
                                            profile_submitted_at = now

GET  /consultant/onboarding/questions ───►  returns all active onboarding_questions
                                            ordered by position (no per-consultant
                                            assignment; everyone sees the same set)

POST /consultant/onboarding/interview/submit
       { answers: [{ onboarding_question_id, answer_value }] }
                                       ───► validates coverage (one answer per
                                            active question) + per-item shape,
                                            then freezes a question_snapshot on
                                            every row.
                                            ConsultantOnboarding → INTERVIEW_SUBMITTED
                                            interview_submitted_at = now
                                            emails consultant + active admins
                                                                          │
                                                                          ▼ (admin reads answers)
                                            POST /admin/onboardings/:id/decide
                                              ├── APPROVED → ConsultantProfile.isVerified = true
                                              │                in-app + email notification (consultant)
                                              │                consultant can start skill exams
                                              └── REJECTED → blocked_until = now + 3 months
                                                            rejection email with rejection_note
                                                            login, register, profile-submit
                                                            all blocked for 3 months
```

## Onboarding statuses

| Status                | Meaning                                                                        |
| --------------------- | ------------------------------------------------------------------------------ |
| `PENDING_BASIC_INFO`  | Registration done; consultant has not submitted basic profile yet.             |
| `IN_INTERVIEW`        | Basic profile submitted; consultant is fetching questions / preparing answers. |
| `INTERVIEW_SUBMITTED` | All answers submitted; pending admin review.                                   |
| `APPROVED`            | Admin approved; `ConsultantProfile.isVerified = true`; skill exams unlocked.   |
| `REJECTED`            | Admin rejected; `blocked_until = now + 3 months`. Login is blocked until then. |

## Question types

| Type       | `options` payload on the question                     | `answer_value` payload on a submission |
| ---------- | ----------------------------------------------------- | -------------------------------------- |
| `TEXT`     | `null`                                                | `{ "text": "..." }`                    |
| `RADIO`    | `[{ "value": "opt_yes", "label": "Yes" }, ...]` (≥ 2) | `{ "value": "opt_yes" }`               |
| `CHECKBOX` | `[{ "value": "opt_yes", "label": "Yes" }, ...]` (≥ 2) | `{ "values": ["opt_yes", "opt_no"] }`  |

Options carry a stable `value` and a human-readable `label`. Answers reference the `value` so an admin editing a label later does not invalidate prior submissions. Every saved answer also carries a frozen `question_snapshot` capturing the question text + options at submission time, so the admin review screen stays consistent even if the underlying onboarding question is later edited or soft-deleted.

## CV upload

CVs are uploaded via the shared `POST /files` endpoint with `?purpose=consultant_cv`:

- Files land at `consultant-CVs/<NODE_ENV>/<yyyy>/<mm>/<uuid>.<ext>` on the configured storage provider.
- The returned `url` is then passed verbatim as `cv_url` to `POST /consultant/onboarding/profile`.
- `purpose=consultant_cv` is the only purpose value accepted at upload time; any other value is silently ignored so existing callers keep working.

## Rejection block (auth interaction)

When the admin rejects:

1. `consultant_onboardings.blocked_until = now + 3 months`.
2. Consultant receives the rejection email.
3. For 3 months, **login**, **register**, and **profile-submit** all return `403 CONSULTANT_ONBOARDING_BLOCKED` with `details.blocked_until`. See [consultant account gates](../identity-service/auth/consultant-account-gates-api-specs.md#onboarding-rejection-block-read-first).
4. After the block expires the consultant may re-register / re-onboard.

## Companion docs

- [Consultant account gates](../identity-service/auth/consultant-account-gates-api-specs.md) — login behaviour around the rejection block.
- [Notifications — Consultant Event Catalog](../consultant-service/notifications/notifications-consultant-events-api-specs.md) — onboarding_approved notification.
- [Files — Upload + Purpose](./files-api-specs.md) — shared `/files` upload endpoint.
