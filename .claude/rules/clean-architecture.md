# Rule: Unit of Work & Centralized Entities

## 1. Centralized Entities
- **Location:** All TypeORM Entities MUST be located in `src/database/entities/`.
- **Constraint:** Do not create `entities/` folders inside individual feature modules.
- **Naming:** Follow explicit naming for PK/FK/Indexes as defined in `database-performance.md`.

## 2. Unit of Work (UoW) Pattern
- **Centralized Access:** Use a `UnitOfWork` service to access repositories.
- **Transaction Control:** The `UnitOfWork` must handle the lifecycle of database transactions to ensure atomicity across multiple repositories.
- **Injection:** Services must inject `UnitOfWork` instead of individual TypeORM Repositories.

## 3. Request Identity via RequestContextService (Mandatory)
All user identity and request metadata must flow through `RequestContextService` — never via `request.user`, `@CurrentUser()`, or explicit `userId` / `sessionId` parameters passed between layers.

### How it works
```
HTTP Request
  └─ RequestContextMiddleware   — initialises AsyncLocalStorage (ip, lang, path…)
  └─ JwtContextMiddleware       — verifies Bearer token → calls requestContext.setUser()
  └─ JwtAuthGuard               — rejects if requestContext.userId is null (non-public routes)
  └─ RolesGuard                 — reads requestContext.userRole
  └─ PlatformGuard              — reads requestContext.activePlatform
  └─ Controller                 — reads context via injected RequestContextService
  └─ Service                    — reads context via injected RequestContextService
```

### Layer rules
- **Middleware (`JwtContextMiddleware`):** Reads the `Authorization: Bearer` header, verifies the JWT, and calls `requestContextService.setUser(userId, email, role, sessionId, deviceId, activePlatform)`. This is the single point where token data enters the system.
- **Guards:** Inject `RequestContextService` and read `userRole` / `activePlatform` / `userId` from it. Never read `request.user`.
- **Controllers:** Inject `RequestContextService` to read `userId`, `sessionId`, etc. Never use `@CurrentUser()` or declare `JwtPayload` parameters.
- **Services:** Inject `RequestContextService` to retrieve the caller's identity. Do not accept `userId` or `sessionId` as method parameters for user-scoped operations.

### Available context getters
```typescript
requestContext.userId          // string | null
requestContext.email           // string | null
requestContext.userRole        // UserRole | null
requestContext.sessionId       // string | null
requestContext.activePlatform  // ActivePlatform | null
requestContext.deviceId        // string | null
requestContext.ipAddress       // string
requestContext.userAgent       // string | null
requestContext.lang            // SupportedLocale
requestContext.requestId       // string
```

### Controller example
```typescript
@Controller('resource')
export class ResourceController {
  constructor(
    private readonly resourceService: ResourceService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Get('me')
  public async getOwn(): Promise<ITranslatedPayload<ResourceResponseDto>> {
    const data = await this.resourceService.getOwn();
    return { messageKey: 'success.ok', data };
  }
}
```

### Service example
```typescript
@Injectable()
export class ResourceService {
  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {}

  public async getOwn(): Promise<ResourceResponseDto> {
    const userId = this.requestContext.userId!;
    // … business logic
  }
}
```

## 4. Guard Usage per Endpoint (Mandatory)
Every protected endpoint must explicitly declare its guards and access requirements:

| Decorator | Guard | Purpose |
|-----------|-------|---------|
| `@Roles(UserRole.X)` | `RolesGuard` | Restrict to a specific user role |
| `@Platform(ActivePlatform.X)` | `PlatformGuard` | Restrict to a specific active platform |
| `@Public()` | skips `JwtAuthGuard` | Mark route as unauthenticated |

`JwtAuthGuard`, `RolesGuard`, and `PlatformGuard` are registered globally — `@UseGuards` on a method or class overrides the global instance for that scope when you need additional specificity.

## 5. Layer Responsibilities
- **Controller:** Declares route, applies guards/decorators, delegates to service. No business logic.
- **Service:** Business logic using `UnitOfWork` to interact with entities; reads caller identity from `RequestContextService`.
- **UnitOfWork:** Provides access to Repositories and manages `queryRunner` for transactions.
