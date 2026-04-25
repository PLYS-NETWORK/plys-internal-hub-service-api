# Rule: TypeScript & Project Engineering Standards

## Type Safety Level
- **No Any:** Strictly forbid the use of `any`. Use `unknown` or define a proper `interface/type`.
- **Return Types:** Every function and class method MUST have an explicit return type.
- **Enums vs Const Objects:** Use `as const` objects or String Enums for fixed values to ensure better TypeORM mapping.

## NestJS Specifics
- **Explicit Access Modifiers:** Always use `private`, `protected`, or `public` for class members.
- **Dependency Injection:** Use `readonly` for injected dependencies in constructors (e.g., `constructor(private readonly service: Service) {}`).
- **Async Handling:** Avoid `void` floating promises. Use `await` or return the Promise explicitly.

## Interface Contract (Mandatory)

Every `@Injectable()` service, provider, and strategy class **must** implement a dedicated TypeScript interface. No exceptions.

### Rules

1. **One interface per class.** Place the interface in a sibling `interfaces/` folder using the naming convention `<name>.service.interface.ts`, `<name>.provider.interface.ts`, or `<name>.strategy.interface.ts`.

2. **Interface-first JSDoc.** Every method and every non-trivial property defined in the interface **must** have a `/** ... */` JSDoc block that describes:
   - What the method does (one sentence).
   - Each `@param` with its expected shape/constraints.
   - `@returns` — what the resolved value represents.
   - `@throws` — every exception the implementation may raise, with the HTTP status or error code.

3. **`@inheritdoc` on implementations.** Above every `public` method that satisfies the interface contract, add exactly:
   ```typescript
   /** @inheritdoc */
   public async myMethod(...): Promise<...> { ... }
   ```
   Never repeat the full JSDoc in the implementation — `@inheritdoc` pulls it from the interface automatically.

4. **No loose public methods.** Any `public` method on a service/provider/strategy that is not on the interface must be justified (e.g., it is a lifecycle hook or called only within the same class). Prefer extracting it to the interface or making it `private`/`protected`.

### Folder layout

```
src/modules/<feature>/
├── interfaces/
│   └── <name>.service.interface.ts   ← interface + full JSDoc here
└── <name>.service.ts                 ← implements IXxxService; @inheritdoc on each method
```

### Code example

```typescript
// interfaces/payment.service.interface.ts
export interface IPaymentService {
  /**
   * Creates a hosted checkout session with a locked amount the customer cannot edit.
   * @param params Checkout parameters including amount in minor units, currency, and metadata.
   * @returns Checkout session containing the processor invoice ID and redirect URL.
   * @throws InternalServerErrorException if the payment provider rejects the request.
   */
  createCheckoutSession(params: ICreateCheckoutSessionParams): Promise<ICheckoutSession>;
}

// payment.service.ts
@Injectable()
export class PaymentService implements IPaymentService {
  /** @inheritdoc */
  public async createCheckoutSession(params: ICreateCheckoutSessionParams): Promise<ICheckoutSession> {
    // implementation
  }
}
```

## DTO & Swagger Consistency
- **ReadOnly DTOs:** All DTO properties should be marked as `readonly`.
- **PickType/PartialType:** Use NestJS Mapped Types (`@nestjs/swagger`) to reuse DTOs instead of duplicating code.