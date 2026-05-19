# Notifications — Frontend Realtime Integration Guide

> Source: [src/modules/notifications/notifications.gateway.ts](../../../src/modules/notifications/notifications.gateway.ts)
> Companion REST spec: [notifications-api-specs.md](../business/notifications/notifications-api-specs.md) (same controller is shared across business / consultant / admin frontends — gated on `@Roles(UserRole.USER, UserRole.ADMIN_PLATFORM)`).
>
> **Role-specific event catalogs (metadata shapes, redirect URLs, cache-invalidation hints):**
>
> - Admin platform → [notifications-admin-events.md](../admin/notifications/notifications-admin-events-api-specs.md)
> - Business platform → [notifications-business-events.md](../business/notifications/notifications-business-events-api-specs.md)
> - Consultant platform → [notifications-consultant-events.md](../consultant/notifications/notifications-consultant-events-api-specs.md)

---

## 1. Architecture in one paragraph

The backend persists every notification in Postgres (the source of truth) and
publishes a `notification.new` Socket.IO event to the recipient's room over a
shared Redis pub/sub fan-out. The FE connects ONE socket per user-session,
listens to a small set of events, calls a REST GET on connect to back-fill any
gap, and then renders live updates as they stream in.

The gateway is **platform-agnostic** — every authenticated user (business,
consultant, admin) can connect. The only gates are JWT validity + an active
`user_sessions` row + opt-in device-binding (§7). The room name is purely
`user:{userId}`, so each user receives exactly their own notifications.

**Durability model:** Redis pub/sub is fire-and-forget — if the socket is
disconnected when the publish fires, the live event is lost forever. The DB row
is not. The FE catch-up step (§3) reconciles the gap on reconnect.

---

## 2. Connecting the Socket.IO client

- **URL:** `${API_BASE_URL}/ws/notifications` (e.g. `https://api.ployos.example/ws/notifications`). The path component (`/ws/notifications`) is the Socket.IO namespace — pass the full URL as shown, not just the origin.
- **Library:** `socket.io-client@4.x`.
- **Auth transport:** the access token (the same Bearer JWT used for REST) can travel either:
  - On `auth.token` — the recommended path for browser SPAs. Accepts the raw JWT or `"Bearer <jwt>"` (the gateway strips the prefix).
  - On the standard `Authorization: Bearer <jwt>` HTTP header — for native clients that can't set `auth`.
- **Device binding (opt-in):** if you pass `auth.deviceId`, the gateway compares it against the `deviceId` claim baked into the JWT and rejects on mismatch. Sending nothing (or a JWT minted without `deviceId`) skips the check.
- **Transports:** prefer `websocket` with `polling` as fallback (matches what the gateway accepts).
- **CORS:** the gateway uses its own CORS list (`ALLOWED_ORIGINS` env), not the HTTP `app.enableCors()` config — bring the origin you connect from up with the BE team if you see a handshake fail.

```ts
import { io, Socket } from 'socket.io-client';

interface ConnectArgs {
  apiBaseUrl: string;
  accessToken: string;
  deviceId?: string;
}

export function connectNotificationsSocket(args: ConnectArgs): Socket {
  const socket = io(`${args.apiBaseUrl}/ws/notifications`, {
    auth: { token: args.accessToken, deviceId: args.deviceId },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 10_000,
  });
  return socket;
}
```

Reconnect behavior is handled by Socket.IO automatically. The FE only needs
to re-bootstrap (§3) on the `connect` event.

---

## 3. Bootstrap — catching up after an offline gap

Every time the socket connects (initial open OR a reconnect), the gateway emits
`notification.connected` with the **current** unread count (read straight from
Postgres — `COUNT(*) WHERE is_read = false`). Use that as the trigger to render
the unread badge AND to fetch the unread list, since any notifications that
fired while you were disconnected will not be replayed by Redis.

```ts
socket.on('connect', () => {
  // Live transport restored — but events fired while disconnected are gone.
  // The DB still has them; pull them now.
});

socket.on('notification.connected', async ({ unread_count }) => {
  setUnreadBadge(unread_count);
  // The REST response is wrapped by the standardized envelope, so the cursor
  // page sits at `body.data`, and its rows at `body.data.data`.
  const body = await fetch(`${apiBase}/api/v1/notifications/me?unread=true&take=20`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).then((r) => r.json());
  hydrateBellList(body.data.data); // body.data.data === NotificationResponseDto[]
});

socket.on('disconnect', () => {
  // Keep last-known unread count visible; the next 'connect' will refresh it.
});
```

> **Tip:** the live `notification.new` events that arrive AFTER your fetch
> completes should be merged at the top of the list. If a `notification.new`
> arrives while the fetch is in-flight, deduplicate by `id` so you don't render
> the same row twice.

---

## 4. Live event handlers

The gateway emits exactly two outgoing events. Neither carries the standardized
HTTP envelope — what you see is the raw payload.

| Event                    | Payload                         | When                                                                            |
| ------------------------ | ------------------------------- | ------------------------------------------------------------------------------- |
| `notification.connected` | `{ unread_count: number }`      | Once, immediately after a successful handshake (initial connect AND reconnect). |
| `notification.new`       | `NotificationPayload` (see §5). | Any time the dispatcher fires for the connected user.                           |

There is **no** server-emitted `notification.unread-count` event today — count
changes are inferred from the `notification.new` stream and from REST calls
(e.g. after `PATCH /me/:id/read`). If you need a fresh count without listening
for a new notification, call `GET /me/unread-count` (Redis-cached, 24 h TTL).

```ts
socket.on('notification.new', (n: NotificationPayload) => {
  prependToBellList(n); // dedupe by n.id
  setUnreadBadge((c) => c + 1);
  showToast(n); // optional UX: toast on important types
  refetchAffectedQueries(n); // §6
});
```

---

## 5. TypeScript types (copy-paste source of truth)

Mirrors [src/modules/notifications/types/notification-metadata.types.ts](../../../src/modules/notifications/types/notification-metadata.types.ts).
The discriminated union type lets TypeScript narrow `metadata` automatically when you `switch` on `n.type`.

```ts
// The discriminated-union the FE consumes.
export type NotificationPayload = {
  [K in NotificationType]: {
    id: string;
    type: K;
    title: string;
    body: string;
    metadata: NotificationMetadataMap[K];
    entity_type: string;
    entity_id: string;
    redirect_url: string | null;
    is_read: boolean;
    read_at: string | null;
    created_at: string;
    actor_id: string | null;
  };
}[NotificationType];
```

For the full `NotificationMetadataMap` and per-type metadata interfaces, import from the shared
type package or copy from the role-specific catalogs linked at the top of this document.

---

## 6. Redirect rules

Every payload carries two redirect mechanisms; pick whichever fits your routing.

1. **Pre-computed URL** — `n.redirect_url` is server-computed, deep-linked
   into the correct tenant, and ready to navigate to. The base URL the server
   uses is selected by notification type — `ployosUrl` for business, `lonaUrl`
   for consultant, `internalHubUrl` for admin.
   ```ts
   if (n.redirect_url) router.push(n.redirect_url);
   ```
2. **Generic mapping** — `(n.entity_type, n.entity_id)` pair. Use this when
   the FE owns routing and prefers to compose URLs locally.
   ```ts
   const ROUTE_BY_ENTITY: Record<string, (id: string) => string> = {
     project: (id) => `/projects/${id}`,
     task: (id) => `/tasks/${id}`,
     application: (id) => `/applications/${id}`,
     transaction: () => `/billing/transactions`,
     user: () => `/settings`,
   };
   const target = ROUTE_BY_ENTITY[n.entity_type]?.(n.entity_id);
   if (target) router.push(target);
   ```

**Recommendation:** prefer `redirect_url` when present, fall back to the
mapping when it is `null`.

```ts
function redirect(n: NotificationPayload, router: AppRouter): void {
  router.push(n.redirect_url ?? ROUTE_BY_ENTITY[n.entity_type]?.(n.entity_id) ?? '/');
}
```

For the full per-type redirect URL patterns, see the role-specific catalogs linked at the top.

---

## 7. Error handling

The gateway emits an `error` event with `{ code }` immediately before disconnecting whenever the handshake fails. Codes come from `ERROR_CODES` in [src/common/constants/error-codes.ts](../../../src/common/constants/error-codes.ts).

| Server emits                                             | What happened                                                                                                                                                                                                  | FE should…                                                                                                                                                                  |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `error { code: "AUTH_TOKEN_INVALID" }` then disconnect   | One of: token missing, JWT signature failed, JWT payload had no `sessionId`, the matching `user_sessions` row is missing / already rotated (`used_at` set) / past its `expires_at`, or the gateway lost track. | Refresh the access token via `/auth/refresh`, reconnect. If refresh fails, redirect to login.                                                                               |
| `error { code: "AUTH_TOKEN_EXPIRED" }` then disconnect   | Access token TTL elapsed (JWT verify threw `TokenExpiredError`).                                                                                                                                               | Same — refresh + reconnect.                                                                                                                                                 |
| `error { code: "AUTH_DEVICE_MISMATCH" }` then disconnect | The handshake `auth.deviceId` was supplied AND the JWT also carries a `deviceId` claim AND the two strings don't match. Asymmetric: if either side is missing/empty the check is skipped.                      | Surface "session was started on another device" UX.                                                                                                                         |
| Disconnects with `reason="io server disconnect"`         | The session was revoked server-side (admin force-logout, password change on another device, refresh-token replay detection).                                                                                   | Redirect to login.                                                                                                                                                          |
| `connect_error` event                                    | Transport-level failure (network, CORS, server down).                                                                                                                                                          | Let Socket.IO retry. After ~30s of failures, surface a degraded-mode banner and start polling `GET /me/unread-count` every 30s as a safety net until the socket reconnects. |

```ts
socket.on('connect_error', (err) => {
  // Logged + surfaced after a threshold; not on every retry.
});

socket.on('error', (payload: { code: string }) => {
  if (payload.code === 'AUTH_TOKEN_EXPIRED' || payload.code === 'AUTH_TOKEN_INVALID') {
    refreshAccessTokenAndReconnect();
  } else if (payload.code === 'AUTH_DEVICE_MISMATCH') {
    redirectToLogin('device-mismatch');
  }
});
```

---

## 8. Testing checklist for FE engineers

1. **Initial connect**
   - On login, the socket connects within 1s.
   - `notification.connected` arrives once.
   - The unread badge matches `unread_count`.
2. **Live delivery**
   - Trigger a notification-generating action via REST in another tab — `notification.new` arrives in <500 ms.
   - Toast renders. List prepends. Badge increments.
3. **Read transitions**
   - Click a notification → `PATCH /me/:id/read` → row's `is_read` flips to `true` and badge decrements (also live across other tabs — each tab's socket reflects the update on its next REST refresh).
4. **Mark all read**
   - `PATCH /me/read-all` → badge goes to 0; list still renders, items now styled as read.
5. **Multi-tab**
   - Open the app in two browser tabs; trigger a notification once.
   - Both tabs' sockets receive `notification.new` (each tab's socket joins the same `user:{userId}` room independently).
6. **Offline gap**
   - Close the tab. Trigger a notification via REST. Re-open the tab.
   - On reconnect, `notification.connected.unread_count` reflects the new count, and the unread fetch returns the missed row.
7. **Error paths**
   - Connect with a stale JWT — server emits `error AUTH_TOKEN_INVALID` then disconnects; FE refresh-and-reconnect succeeds.
   - Stop the API server — `connect_error` fires repeatedly; after threshold, FE shows degraded banner and falls back to polling.

---

## 9. FAQ

**Q. Why didn't I get a `notification.new` for the row that's clearly in the DB?**
The socket was disconnected at the moment the dispatcher published. Redis pub/sub
doesn't replay. The row is in Postgres — the bootstrap `GET /me?unread=true` on the
next reconnect will pick it up.

**Q. Can I subscribe to a different user's notifications (e.g. as an admin)?**
No. The gateway joins exactly one room — `user:{caller's own userId}` — based
on the JWT. Cross-user subscription is not exposed.

**Q. Do consultant and admin frontends use the same socket?**
Yes. The gateway is platform-agnostic — admin, consultant, and business users all
connect to `/ws/notifications` with their access JWT. The dispatcher only
publishes notifications targeted at the recipient `userId`, so platforms never
see each other's events.

**Q. What's the latency budget?**
End-to-end (DB write → live event on socket) is ~5-50 ms on a healthy single
region; multi-region adds ~Redis-to-Redis RTT. The FE should not assume sub-100 ms.

**Q. How is multi-instance scaling handled?**
The dispatcher publishes to Redis once. Every API instance has its own
`psubscribe('notif:user:*')` listener; whichever one currently holds the
recipient's socket forwards the event to that socket. Empty rooms on other
instances no-op cheaply.

**Q. What if I lose the access token (refresh fails)?**
Redirect to login. The socket cannot recover from an expired refresh token.

**Q. Which notification types does my platform receive?**
See the role-specific catalogs linked at the top of this document.
