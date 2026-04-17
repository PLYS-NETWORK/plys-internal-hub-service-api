# Rule: TypeScript & Project Engineering Standards

## Type Safety Level
- **No Any:** Strictly forbid the use of `any`. Use `unknown` or define a proper `interface/type`.
- **Return Types:** Every function and class method MUST have an explicit return type.
- **Enums vs Const Objects:** Use `as const` objects or String Enums for fixed values to ensure better TypeORM mapping.

## NestJS Specifics
- **Explicit Access Modifiers:** Always use `private`, `protected`, or `public` for class members.
- **Dependency Injection:** Use `readonly` for injected dependencies in constructors (e.g., `constructor(private readonly service: Service) {}`).
- **Async Handling:** Avoid `void` floating promises. Use `await` or return the Promise explicitly.

## DTO & Swagger Consistency
- **ReadOnly DTOs:** All DTO properties should be marked as `readonly`.
- **PickType/PartialType:** Use NestJS Mapped Types (`@nestjs/swagger`) to reuse DTOs instead of duplicating code.