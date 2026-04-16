# API Versioning

Use when designing stable public APIs.

Versioning strategies:

- URI versioning
- header versioning
- media type versioning

Preferred for NestJS:

URI versioning.

Example:

/api/v1/users
/api/v2/users

NestJS setup:

app.enableVersioning({
  type: VersioningType.URI
})

Controller example:

@Controller({
  path: 'users',
  version: '1'
})
export class UsersController {}