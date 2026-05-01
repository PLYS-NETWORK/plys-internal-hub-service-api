# Projects — Consultant Discovery

## Purpose

Read-only project discovery for consultants. The business-side project flow (creation, configuration, publish/republish, overview, board, settings, applications, backlogs) has moved to `BusinessProjectsModule` (`/projects/business/...`). This module owns only the two consultant endpoints under `/projects-consultant`.

## Endpoints

| Method | Path                       | Operation                                                  |
| ------ | -------------------------- | ---------------------------------------------------------- |
| GET    | `/projects-consultant`     | Paginated public projects matching the consultant's skills |
| GET    | `/projects-consultant/:id` | Detail of a single public project                          |

## Layout

```
src/modules/projects/
├── consultant-project.controller.ts
├── interfaces/consultant-project-service.interface.ts
├── services/consultant-project.service.ts
├── dto/
│   └── responses/
│       ├── consultant-project-response.dto.ts
│       ├── consultant-project-list-item-response.dto.ts
│       ├── project-skill-response.dto.ts
│       └── project-interview-question-response.dto.ts
└── projects.module.ts
```

## Notes

- Only `public` projects are surfaced. The list endpoint runs an intersection of `consultant_skills` × `project_required_skills` (skill UUID overlap).
- Skill names are translated once per request locale (i18n key `skill.<name>`).
- Empty consultant skill set short-circuits to an empty page without hitting the projects table.
- The list view collapses interview questions to a `need_interview: boolean`. Full question text is only fetched on the detail endpoint.
