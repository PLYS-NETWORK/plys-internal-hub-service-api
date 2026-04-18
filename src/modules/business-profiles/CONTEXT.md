# Business Profiles — Business Context

## Purpose
Owns the business-side profile and its team membership. A `BusinessProfile` is created by a user to operate on the Business platform; `BusinessMember` records **who** can act on its behalf and at what privilege level. One user → at most one BusinessProfile. One business → many members.

## Tables owned
- `business_profiles` — company metadata (name, industry, address, logo, verification).
- `business_members` — team roster. Every permission decision should query this table, never `business_profiles.user_id`.

## Key invariants
- **`BusinessProfile.userId` is the founding user** and should be auto-inserted as `role = owner` in `BusinessMembers` at create time. Never use it for permission checks directly.
- **Unique per user.** `uq_business_profiles_user_id` prevents a user from creating two businesses.
- **`BusinessMember.role` defaults to `viewer`.** Raw schema defaulted to `'member'` (not in CHECK list); entity uses `VIEWER` (schema fix §low-nits).
- **Roles:** `owner | admin | manager | billing | viewer`. See permission matrix in `marketplace_documentation.md` §4.
- **Owner integrity.** At least one `role = owner, status = active` must exist per business. Removing the last owner should be rejected at the service layer (no DB trigger yet — schema fix §M6).
- **Unique `(business_id, user_id)`** — a user cannot hold two memberships in the same business simultaneously.

## State machines
`BusinessMember.status`:

```
active ↔ suspended
active → left (terminal, keeps row for audit)
```

## External dependencies
- **Auth** — resolves `userId` from the current session.
- **Projects** — every project action checks `BusinessMember.role` for the business that owns the project.
- **Billing** — only `owner` + `billing` roles see invoices.
- **Notifications** — new application received, invoice generated, etc. routed to `manager+` or `billing+` subsets.

## Critical edge cases
- **Owner leaves or is deleted.** Must transfer ownership first, or the business becomes orphaned. Service layer must refuse.
- **Role demotion of the only owner.** Same guard as above.
- **User deletion cascades** — `ON DELETE CASCADE` on the FK to `users` means deleting a user auto-removes memberships. Confirm business-level contracts still work (ownership transfer before delete).
- **Inviting a user who already has a `left` membership** — service layer should resurrect (update status → `active`) rather than create a new row (unique constraint prevents duplicates).
