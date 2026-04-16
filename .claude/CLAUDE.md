# Backend Architecture Rules

Tech stack:

- Framework: NestJS
- ORM: TypeORM
- Database: PostgreSQL (Supabase)
- Language: TypeScript

---

# Architecture

Use clean modular architecture.

Each module must contain:

- module
- controller
- service
- dto
- entity
- repository (optional)

Example:

src/modules/users/
  users.module.ts
  users.controller.ts
  users.service.ts
  dto/
  entities/

---

# Controllers

Controllers must:

- only handle HTTP request/response
- never contain business logic
- call services

---

# Services

Services:

- contain business logic
- orchestrate repositories
- handle transactions

---

# Database

Rules:

- Never use synchronize=true
- Always use migrations
- UUID primary keys
- snake_case table names

Common fields:

id UUID PK
created_at
updated_at
deleted_at (optional)

---

# Query Rules

Avoid:

- SELECT *
- N+1 queries

Prefer:

- pagination
- indexes
- transactions

---

# Validation

Use:

class-validator
class-transformer

All endpoints must validate DTOs.

---

# Security

- Never expose Supabase service_role key
- Use RLS policies when possible
- Validate user input
- Use guards for authentication

---

# API Style

REST conventions:

GET /users
GET /users/:id
POST /users
PATCH /users/:id
DELETE /users/:id

---

# Code Quality

Follow:

- SOLID
- dependency injection
- repository pattern

# Logging

All services must include logging.

Use structured logs.

Include:

- requestId
- userId
- operation name

Never log:

- passwords
- tokens
- secrets

# API Versioning

All APIs must support versioning.

Default:

/api/v1

Breaking changes require new version:

/api/v2

# API Documentation

All endpoints must be documented with Swagger.

Requirements:

@ApiTags
@ApiOperation
@ApiResponse
@ApiBearerAuth (when required)