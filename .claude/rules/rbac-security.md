# Rule: RBAC & Device Security

## Role Definitions
- **ADMIN:** Full system access, Seller approval, financial oversight.
- **SELLER:** Product management, order fulfillment, revenue analytics.
- **BUYER:** Search, purchase, personal wallet management.

## Authorization Logic
- Use `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles(Role.ADMIN)`.
- **Ownership Validation:** Sellers must only access resources where `resource.sellerId === request.user.id`.

## Device-Binding
- For sensitive Seller/Admin sessions, store `deviceId` or `fingerprint` in the JWT payload or DB.
- Trigger re-authentication if the device hardware identifier changes unexpectedly.