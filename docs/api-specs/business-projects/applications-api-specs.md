# ApplicationsController — API Specs

> **Source:** [src/modules/business-projects/controllers/applications.controller.ts](../../../src/modules/business-projects/controllers/applications.controller.ts)
> **Base path:** `/projects/business/:id/applications`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), `@Roles(UserRole.USER)`, `@Platform(ActivePlatform.BUSINESS)`.
> **Response envelope:** `TransformResponseInterceptor` wraps every body in `{ status_code, message, error_code, data, timestamp, path }`.
> **Field-name convention:** request/response columns use **snake_case** (the JSON contract).

## Cross-cutting errors

| HTTP | error_code                                    | When                                     |
| ---- | --------------------------------------------- | ---------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`                           | Missing/invalid Bearer token.            |
| 403  | `BUSINESS_PROFILE_NOT_FOUND`                  | Caller has no active business profile.   |
| 403  | `PROJECT_FORBIDDEN` / 404 `PROJECT_NOT_FOUND` | Project not owned by the caller.         |
| 422  | (validation)                                  | DTO shape failures (UUID, enum, length). |

## Endpoints

### 1. List project applications

- **Endpoint:** `GET /projects/business/:id/applications`
- **Method:** `GET`
- **Path params:** `id` (UUID v4)
- **Query params:** [`ListApplicationsDto`](../../../src/modules/business-projects/dto/requests/list-applications.dto.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `page` | `number` | no | default 1 |
  | `take` | `number` | no | default 20, max 100 |
  | `status` | `ApplicationStatus` | no | enum filter (PENDING / ACCEPTED / REJECTED / WITHDRAWN) |
- **Response 200:** `PageDto<`[`IApplicationListItemResponse`](../../../src/modules/business-projects/dto/responses/interfaces/application-list-item.response.interface.ts)`>` — items: `{ id, consultant: { id, full_name, avatar_url }, cover_letter, status, applied_at, reviewed_at, matching_rate }`. `matching_rate` = `(matching_skills / required_skills_count) × 100`, rounded; `0` when project has 0 required skills.
- **Errors:** cross-cutting only.

### 2. Application detail

- **Endpoint:** `GET /projects/business/:id/applications/:applicationId`
- **Method:** `GET`
- **Path params:** `id` (UUID v4), `applicationId` (UUID v4)
- **Response 200:** [`IApplicationDetailResponse`](../../../src/modules/business-projects/dto/responses/interfaces/application-detail.response.interface.ts) — `{ id, status, cover_letter, applied_at, reviewed_at, rejection_reason, matching_rate, consultant: { id, full_name, avatar_url, skills: [{ id, name, proficiency_level, years_with_skill }] }, interview_answers: [{ question_id, question_text_snapshot, answer, is_question_deleted }] }`
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `APPLICATION_NOT_FOUND` | Application does not belong to this project — thrown by [ApplicationsService.getDetail](../../../src/modules/business-projects/services/applications.service.ts). |

### 3. Approve application

- **Endpoint:** `PATCH /projects/business/:id/applications/:applicationId/approve`
- **Method:** `PATCH`
- **Path params:** `id` (UUID v4), `applicationId` (UUID v4)
- **Response 204:** empty body.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `APPLICATION_NOT_FOUND` | Application not in this project. |
  | 422 | `APPLICATION_CANNOT_APPROVE` | Application is not in PENDING status. |

### 4. Reject application

- **Endpoint:** `PATCH /projects/business/:id/applications/:applicationId/reject`
- **Method:** `PATCH`
- **Path params:** `id` (UUID v4), `applicationId` (UUID v4)
- **Request body:** [`RejectApplicationDto`](../../../src/modules/business-projects/dto/requests/reject-application.dto.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `rejection_reason` | `string` | no | max 1000 chars |
- **Response 204:** empty body.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `APPLICATION_NOT_FOUND` | Application not in this project. |
  | 422 | `APPLICATION_CANNOT_REJECT` | Application is not in PENDING status. |
