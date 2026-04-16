# Rate Limiting Skill

Use when protecting APIs from abuse.

Tools:

- @nestjs/throttler
- Redis store for distributed rate limit

Rules:

- apply rate limiting to public APIs
- protect authentication endpoints
- use IP or userId keys

Example:

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 20
    })
  ]
})
export class AppModule {}

Controller example:

@Throttle(10, 60)
@Post('login')
login() {}