# Rule: Structured Logging Standard

## 1. Logger Declaration (Mandatory)
Every `@Injectable()` class that contains business logic **must** declare a private logger and a `rid` getter:

```typescript
private readonly logger = new Logger(MyService.name);

private get rid(): string {
  return this.requestContext.requestId;
}
```

- `RequestContextService` must be injected in the constructor.
- The `rid` getter provides the request ID for log correlation without repeating `this.requestContext.requestId` inline.

---

## 2. Log Levels & When to Use

| Level | Method | When |
|-------|--------|------|
| **Info** | `logger.log` | Method entry (start) and successful completion |
| **Warn** | `logger.warn` | Non-throwing edge cases: not found but handled gracefully, duplicates skipped, empty results |
| **Error** | `logger.error` | Every thrown exception path, and caught errors before rethrowing |

---

## 3. Log Format (Mandatory)

```
[{requestId}] {methodName} — {phase} | {key}: {value}, {key}: {value}
```

- **Entry:** `[${this.rid}] methodName — start | key: value`
- **Success:** `[${this.rid}] methodName — complete | key: value`
- **Warn:** `[${this.rid}] methodName — reason | key: value`
- **Error:** `[${this.rid}] methodName — failed | error: {message}`

### Example
```typescript
public async getProfile(): Promise<ProfileResponseDto> {
  const userId = this.requestContext.userId!;
  this.logger.log(`[${this.rid}] getProfile — start | userId: ${userId}`);

  const profile = await this.uow.profiles.findByUserId(userId);

  if (!profile) {
    this.logger.warn(`[${this.rid}] getProfile — profile not found | userId: ${userId}`);
    throw new TranslatableException({ ... });
  }

  return this.toResponseDto(profile);
}
```

---

## 4. PII & Security Rules

- **Never log passwords** — omit `dto.password`, `dto.current_password`, `dto.new_password` from all log lines.
- **Token values** — never log raw token strings. Log only derived identifiers (userId, tokenHash prefix).
- **Email addresses** — acceptable to log in server-side logs; they are already present in DB audit columns.

---

## 5. Infrastructure Services (EmailService, PaymentService)

Shared infrastructure services follow the same pattern and must also:
- Inject `RequestContextService` for `requestId`
- Wrap every provider call in `try/catch` with `logger.error` before rethrowing
- Log both start and successful delivery

---

## 6. What NOT to Log

- Internal private helper methods (e.g. `toResponseDto`, `sha256`) — no entry logs needed
- `logger.debug` — not used; use `logger.log` for operational info
- Repeated logs inside loops — log counts/summaries instead (e.g. `inserted: 5`, `skipped: 2`)
