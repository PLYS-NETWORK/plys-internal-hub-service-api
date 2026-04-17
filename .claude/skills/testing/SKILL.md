# Skill: Unit Testing Standards (Jest)

## Pattern
- Follow the **AAA** pattern: Arrange, Act, Assert.
- Mocking: Use `jest.mock()` or NestJS `Test.createTestingModule` with `overrideProvider`.

## Coverage Requirements
- Every new Service method must have a corresponding unit test.
- Use `faker` for generating mock marketplace data (products, prices, user profiles).