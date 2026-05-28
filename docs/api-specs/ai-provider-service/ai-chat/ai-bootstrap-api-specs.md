# AiBootstrapController — API Specs

> **Source:** [apps/ai-provider-service/src/modules/ai-bootstrap/ai-bootstrap.controller.ts](../../../../apps/ai-provider-service/src/modules/ai-bootstrap/ai-bootstrap.controller.ts)
> **Base path:** `/api/v1/projects/:projectId/ai-bootstrap`
> **Scope:** Bearer auth, `@Roles(USER)`, `@Platform(BUSINESS)` — enforced by global `JwtAuthGuard`, `RolesGuard`, `PlatformGuard`.
> **Response envelope:** `TransformResponseInterceptor` wraps every body in `{ status_code, message, error_code, data, timestamp, path }`.

The bootstrap is the single read the FE issues when the AI chat panel opens. It aggregates everything the panel needs in one round trip — project state, the AI-context snapshot (or `null` if not derived yet), the calling user's chat sessions, live tasks, project-required skills, and the skill catalog.

## Cross-cutting errors

| HTTP | error_code                   | When                                                       |
| ---- | ---------------------------- | ---------------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`          | Missing/invalid Bearer token.                              |
| 403  | `BUSINESS_PROFILE_NOT_FOUND` | Caller has no active business profile.                     |
| 404  | `PROJECT_NOT_FOUND`          | Project not owned by the caller (or doesn't exist at all). |

## Endpoints

### 1. Aggregate read for the chat panel

- **Endpoint:** `GET /projects/:projectId/ai-bootstrap`
- **Method:** `GET`
- **Path params:** `projectId` (UUID v4)
- **Behaviour:** [AiBootstrapService.bootstrap](../../../../apps/ai-provider-service/src/modules/ai-bootstrap/ai-bootstrap.service.ts) verifies project ownership via [BusinessAccessService.resolveOwnedProject](../../../../apps/ai-provider-service/src/modules/business-projects/services/business-access.service.ts), then runs five reads in parallel: `project_ai_context` row, `project_required_skills` (joined to skills), all tasks for the project, the calling user's chat sessions (delegated to [`ProjectChatSessionService.listProjectSessions`](../../../../apps/ai-provider-service/src/modules/project-chat-session/project-chat-session.service.ts)), and the global skill catalog.
- **Response 200:** [`IAiBootstrapResponse`](../../../../apps/ai-provider-service/src/modules/ai-bootstrap/dto/responses/interfaces/ai-bootstrap.response.interface.ts) — see shape below.
- **Errors:** cross-cutting only.

```jsonc
{
  "project": {
    "id": "uuid",
    "code": "WEB",
    "title": "Health App MVP",
    "introduction": {
      "type": "doc",
      "content": [
        /* TipTap */
      ],
    } /* or null */,
    "status": "draft" /* draft | configured | published | in_progress | done | cancelled */,
  },
  "context": {
    /* null when no project_ai_context row exists yet */
    "domain": "Consumer mobile health app" /* or null */,
    "primary_stack": ["React Native", "Node.js", "PostgreSQL"] /* or null */,
    "conventions": "Tasks priced in $500 increments…" /* or null */,
    "task_index": [
      {
        "id": "uuid",
        "title": "User research interviews",
        "price": "500.00",
        "kanban_status": "draft",
        "summary": null /* FE-derived; null until the FE patches via /ai-context/derived */,
      },
    ],
    "skill_clusters": {
      /* FE-managed map keyed by skill UUID */
    },
    "planning_summary": "..." /* or null — captures original planning */,
    "refine_summary": null,
    "extend_summary": null,
    "decisions": [
      {
        "at": "2026-05-05T01:00:00.000Z",
        "source": "planning" /* planning | refine | extend | derived_write */,
        "actor_user_id": "uuid",
        "request_id": "req-...",
        "decision": "Mobile excluded from v1",
        "rationale": "...",
      },
    ],
    "last_indexed_at": "2026-05-05T01:00:00.000Z",
    "needs_reindex": false /* FE polls this; flips to true on task / skill / status mutations */,
  },
  "sessions": [
    {
      "id": "uuid",
      "mode": "PLANNING" /* PLANNING | REFINE | EXTEND */,
      "stage": null /* FE-driven sub-state, only PLANNING uses it */,
      "title": "Initial planning",
      "status": "active" /* active | completed | abandoned */,
      "message_count": 24,
      "implemented_at": null,
      "created_task_ids": null,
      "created_at": "2026-05-04T10:00:00.000Z",
      "updated_at": "2026-05-05T15:30:00.000Z",
    },
  ],
  "live_setting": { "max_consultants": 5 },
  "live_tasks": [
    {
      "id": "uuid",
      "code": "WEB-1",
      "title": "Implement OAuth flow",
      "description": {
        "type": "doc",
        "content": [
          /* TipTap */
        ],
      } /* or null */,
      "price": "500.00",
      "creation_mode": "ai_assisted" /* manual | ai_assisted */,
      "kanban_status": "draft",
      "display_order": 1,
    },
  ],
  "live_skills": [{ "id": "uuid", "name": "React" /* translated for request locale */ }],
  "available_skills": [{ "id": "uuid", "name": "React" }],
}
```

#### Field notes

- `context: null` is the legitimate empty state for a brand-new project. The FE should treat it as "no derived context yet" and hide the AI-derived panels (domain / summaries / skill clusters) until a chat session is created and the FE has written derived fields back.
- `sessions[]` is filtered to the calling user — every business user has their own thread on the project, ordered `updated_at DESC`. `draft` payloads are intentionally omitted to keep the bootstrap small; fetch them via `GET /chat-sessions/:sessionId/meta` when resuming.
- `live_tasks[]` includes drafts and published tasks. `creation_mode` distinguishes user-typed (`manual`) from AI-authored (`ai_assisted`) entries — the FE can highlight AI-authored tasks in the planning UI.
- `available_skills[]` is the global catalog. Translation of `name` happens server-side using the request `Accept-Language`. Cache locally on the FE for the chat session lifetime.
- `live_skills[]` is the project's required-skill subset of the catalog, also translated server-side.
- The sub-shape `IBootstrapAiContext` is documented at [apps/ai-provider-service/src/modules/ai-bootstrap/dto/responses/interfaces/ai-bootstrap.response.interface.ts](../../../../apps/ai-provider-service/src/modules/ai-bootstrap/dto/responses/interfaces/ai-bootstrap.response.interface.ts).
