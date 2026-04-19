# Business Profiles — Business Context

## Purpose
Owns the company-side profile for a user operating on the Business platform. A `BusinessProfile` is created during onboarding after email verification. One user → at most one `BusinessProfile`.

## Table owned
- `business_profiles` — company metadata: name, industry, size, address, contact, logo, verification status, partner status, payment credit flag.

## Key invariants
- **Unique per user.** `uq_business_profiles_user_id` prevents a user from creating two profiles. Attempting to onboard again returns `409 CONFLICT`.
- **`userId` identifies the owner.** All user-scoped reads and writes resolve the profile by `userId`, not by `id`.
- **Boolean flags are admin-only.** `is_verified`, `is_partner_platform`, and `allow_payment_credit` can only be set to `true` by a user with `role = ADMIN_PLATFORM`. They are never toggled back to `false` via the current API.
- **Partial updates.** `PATCH /me` only touches fields explicitly present in the request body; absent optional fields are left unchanged.

## API surface

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| `POST` | `/business-profiles/onboard` | USER | Create the business profile (once per user) |
| `PATCH` | `/business-profiles/me` | USER | Update own profile (partial) |
| `PATCH` | `/business-profiles/:id/partner` | ADMIN_PLATFORM | Set `is_partner_platform = true` |
| `PATCH` | `/business-profiles/:id/payment-credit` | ADMIN_PLATFORM | Set `allow_payment_credit = true` |

## Role-based access
Uses `UserRole` enum (`ADMIN_PLATFORM | USER`) stored on the `users` table and embedded in the JWT payload. The `RolesGuard` enforces `@Roles(UserRole.ADMIN_PLATFORM)` on the three admin mutation endpoints.

## External dependencies
- **Auth** — resolves `userId` from the JWT via `@CurrentUser()` decorator.
- **Unit of Work** — all repository access goes through `UnitOfWorkService`; no direct repository injection.

## Critical edge cases
- **Double onboard.** Service calls `findByUserId` before creating; throws `409` if a profile already exists.
- **Profile not found on update.** `findByUserId` returns `null` → throws `404`. The client must onboard first.
- **Admin actions on non-existent profile.** `findOne({ where: { id } })` returns `null` → throws `404`.
