# Rule: Unit of Work & Centralized Entities

## 1. Centralized Entities
- **Location:** All TypeORM Entities MUST be located in `src/database/entities/`.
- **Constraint:** Do not create `entities/` folders inside individual feature modules.
- **Naming:** Follow explicit naming for PK/FK/Indexes as defined in `database-performance.md`.

## 2. Unit of Work (UoW) Pattern
- **Centralized Access:** Use a `UnitOfWork` service to access repositories. 
- **Transaction Control:** The `UnitOfWork` must handle the lifecycle of database transactions to ensure atomicity across multiple repositories.
- **Injection:** Services must inject `UnitOfWork` instead of individual TypeORM Repositories.

## 3. Layer Responsibilities
- **Controller:** Request handling & Input DTO validation.
- **Service:** Business logic using `UnitOfWork` to interact with multiple entities.
- **UnitOfWork:** Providing access to Repositories and managing `queryRunner` for transactions.