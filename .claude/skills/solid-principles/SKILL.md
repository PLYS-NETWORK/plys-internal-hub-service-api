# Skill: SOLID & Design Patterns

## Principles
- **SRP:** Keep Services focused. If a Service exceeds 500 lines, refactor into domain-specific sub-services.
- **OCP (Open/Closed):** Use the **Strategy Pattern** for interchangeable logic like Payment Gateways (Momo, Stripe, VNPay) or Shipping Providers.
- **DIP (Dependency Inversion):** Always inject dependencies via constructors. Use Interfaces for mocking in unit tests.

## Code Quality
- Prefer Composition over Inheritance.
- Keep functions small and focused on a single task.