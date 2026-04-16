# Observability and Logging

Use when implementing logging, monitoring, and tracing.

Goals:

- debug production issues
- track requests
- measure performance
- audit important events

Tools:

- NestJS Logger
- Winston
- Pino
- OpenTelemetry

Best practices:

- structured logs (JSON)
- include requestId
- include userId if available
- avoid logging sensitive data

Log levels:

debug
info
warn
error

Example service logging:

@Injectable()
export class UsersService {

  private readonly logger = new Logger(UsersService.name)

  async createUser(dto: CreateUserDto) {

    this.logger.log(`Creating user with email ${dto.email}`)

    try {

      const user = await this.repo.save(dto)

      this.logger.log(`User created id=${user.id}`)

      return user

    } catch (error) {

      this.logger.error('User creation failed', error.stack)

      throw error
    }
  }
}