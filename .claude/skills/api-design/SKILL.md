# API Design

Follow REST conventions.

Endpoints must:

- be predictable
- return consistent response format

Response structure:

{
  data: any,
  meta?: any,
  error?: string
}

Pagination:

limit
offset
total