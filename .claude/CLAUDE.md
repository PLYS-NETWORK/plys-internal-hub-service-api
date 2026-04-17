# Marketplace Backend: Senior Developer Guidelines

## Tech Stack
- **Framework:** NestJS (TypeScript)
- **Database:** PostgreSQL
- **ORM:** TypeORM
- **Documentation:** Swagger (@nestjs/swagger)
- **Validation:** class-validator, class-transformer

## Operational Commands
- **Install:** `npm install`
- **Build:** `npm run build`
- **Dev:** `npm run start:dev`
- **Lint/Format:** `npm run lint` / `npm run format`
- **Database:** `npm run typeorm migration:generate -- -n [Name]` / `npm run typeorm migration:run`

## Senior Engineering Standards
1. **Zero-Inference Security:** Never assume client data is safe.
2. **The "Why" Rule:** For complex logic, add comments explaining the rationale (Design Pattern used, performance trade-offs) to assist Junior/Intern developers.
3. **Explicit Typing:** Avoid `any` at all costs. Every object must have a DTO, Interface, or Entity.
4. **Error Handling:** All exceptions must be caught by a Global Exception Filter.

## Global Constraints
- Enforce `StandardizedResponse<T>` format: `{ statusCode, message, data, timestamp, path }`.
- **Naming Convention (DB):** Never use auto-generated hashes for Constraints/Indexes. All Foreign Keys, Unique Constraints, and Indexes must follow the naming pattern: `prefix_table_column`.