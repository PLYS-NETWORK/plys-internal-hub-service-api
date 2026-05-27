# Notifications — Frontend Realtime Integration Guide

> Source: [apps/api-gateway/src/http/platform/notifications.gateway.ts](../../../apps/api-gateway/src/http/platform/notifications.gateway.ts)
> Live emit: [packages/common-nest/modules/notifications-realtime/notification-realtime-emitter.service.ts](../../../packages/common-nest/modules/notifications-realtime/notification-realtime-emitter.service.ts)
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
delivers a `notification.new` Socket.IO event to the recipient's room. **Ployos,
Lonaos, and Plys Internal Hub** all connect to the same namespace
(`/ws/notifications`) on api-gateway with their platform JWT.

Cross-instance scaling uses **`@socket.io/redis-adapter`** on api-gateway.
platform-service emits live events with **`@socket.io/redis-emitter`** directly
into the recipient's Socket.IO room — there is no global `notif:user:*` Redis
pub/sub fan-out on the gateway anymore.

The FE connects ONE socket per user-session, listens to a small set of events,
calls a REST GET on connect to back-fill any gap, and then renders live updates
as they stream in.

The gateway is **platform-agnostic** — every authenticated user (business,
consultant, admin) can connect. The only gates are JWT validity + an active
`user_sessions` row (+ opt-in device-binding in §7). The room name is purely
`user:{userId}`, so each user receives exactly their own notifications.

**Durability model:** Live delivery is fire-and-forget — if the socket is
disconnected when the emit fires, the live event is lost. The DB row is not.
The FE catch-up step (§3) reconciles the gap on reconnect.

---

## 2. Connecting the Socket.IO client

- **URL:** `${API_BASE_URL}/ws/notifications` (e.g. `https://api.example/ws/notifications`). The path component (`/ws/notifications`) is the Socket.IO namespace — pass the full URL as shown, not just the origin.
- **Library:** `socket.io-client@4.x`.
- **Auth transport:** the access token (the same Bearer JWT used for REST) can travel either:
  - On `auth.token` — the recommended path for browser SPAs. Accepts the raw JWT or `"Bearer <jwt>"` (the gateway strips the prefix).
  - On the standard `Authorization: Bearer <jwt>` HTTP header — for native clients that can't set `auth`.
- **Device binding (opt-in):** if you pass `auth.deviceId`, the gateway compares it against the `deviceId` claim baked into the JWT and rejects on mismatch. Sending nothing (or a JWT minted without `deviceId`) skips the check.
- **Transports:** prefer `websocket` with `polling` as fallback (matches what the gateway accepts).
- **CORS:** uses the same origin policy as HTTP (`ALLOWED_ORIGINS` + optional `CORS_ALLOW_LOCALHOST` on dev). List the deployed frontend origin (Ployos, Lonaos, or Internal Hub URL). On the **dev VPS**, set `CORS_ALLOW_LOCALHOST=true` to connect from a local SPA (`http://localhost:*`) without adding every port to `ALLOWED_ORIGINS`.

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
`notification.connected` with the **current** unread count. The gateway reads
`notif:unread:{userId}` from Redis when the cache is warm; otherwise it falls
back to a Postgres `COUNT(*)`. Use the event as the trigger to render the unread
badge AND to fetch the unread list, since any notifications that fired while you
were disconnected will not be replayed over the socket.

```ts
socket.on('connect', () => {
  // Live transport restored — but events fired while disconnected are gone.
  // The DB still has them; pull them now.
});

socket.on('notification.connected', async ({ unread_count }) => {
  setUnreadBadge(unread_count);
  const body = await fetch(`${apiBase}/api/v1/notifications/me?unread=true&take=20`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).then((r) => r.json());
  hydrateBellList(body.data.data);
});

socket.on('disconnect', () => {
  // Keep last-known unread count visible; the next 'connect' will refresh it.
});
```

> **Tip:** merge live `notification.new` events after your fetch completes and
> deduplicate by `id`.

---

## 4. Live event handlers

| Event                    | Payload                         | When                                                                            |
| ------------------------ | ------------------------------- | ------------------------------------------------------------------------------- |
| `notification.connected` | `{ unread_count: number }`      | Once, immediately after a successful handshake (initial connect AND reconnect). |
| `notification.new`       | `NotificationPayload` (see §5). | Any time the dispatcher fires for the connected user.                           |

There is **no** server-emitted `notification.unread-count` event — count changes
are inferred from the `notification.new` stream and from REST calls.

```ts
socket.on('notification.new', (n: NotificationPayload) => {
  prependToBellList(n);
  setUnreadBadge((c) => c + 1);
  showToast(n);
  refetchAffectedQueries(n);
});
```

---

## 5. TypeScript types (copy-paste source of truth)

Mirrors [apps/platform-service/src/modules/notifications/types/notification-metadata.types.ts](../../../apps/platform-service/src/modules/notifications/types/notification-metadata.types.ts).

```ts
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

---

## 6. Redirect rules

Every payload carries two redirect mechanisms:

1. **Pre-computed URL** — `n.redirect_url` is server-computed. Base URL is selected by notification type — `ployosUrl` for business, `lonaosUrl` for consultant (Lonaos), `internalHubUrl` for admin.
2. **Generic mapping** — `(n.entity_type, n.entity_id)` pair for client-composed routes.

**Recommendation:** prefer `redirect_url` when present, fall back to entity mapping when `null`.

---

## 7. Error handling

| Server emits                                                    | What happened                                                                      | FE should…                                                                       |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `error { code: "AUTH_TOKEN_INVALID" }` then disconnect          | Token missing, JWT invalid, or session revoked                                     | Refresh token via `/auth/refresh`, reconnect; redirect to login if refresh fails |
| `error { code: "AUTH_TOKEN_EXPIRED" }` then disconnect          | Access token TTL elapsed                                                           | Same as above                                                                    |
| `error { code: "AUTH_DEVICE_MISMATCH" }` then disconnect        | Handshake `deviceId` mismatches JWT claim                                          | Surface device-mismatch UX                                                       |
| `error { code: "WS_CONNECT_RATE_LIMITED" }` then disconnect     | Too many handshake attempts from this IP (`WS_CONNECT_RATE_LIMIT`, default 30/min) | Back off reconnect; surface rate-limit message                                   |
| `error { code: "WS_MAX_CONNECTIONS_EXCEEDED" }` then disconnect | Oldest tab evicted when user exceeds `WS_MAX_CONNECTIONS_PER_USER` (default 10)    | Expected on heavy multi-tab use; reconnect or close extra tabs                   |
| `connect_error`                                                 | Transport failure (network, CORS, server down)                                     | Let Socket.IO retry; fall back to polling `GET /me/unread-count` after ~30s      |

```ts
socket.on('error', (payload: { code: string }) => {
  if (payload.code === 'AUTH_TOKEN_EXPIRED' || payload.code === 'AUTH_TOKEN_INVALID') {
    refreshAccessTokenAndReconnect();
  } else if (payload.code === 'AUTH_DEVICE_MISMATCH') {
    redirectToLogin('device-mismatch');
  } else if (payload.code === 'WS_CONNECT_RATE_LIMITED') {
    showRateLimitBanner();
  }
});
```

---

## 8. Testing checklist for FE engineers

1. **Initial connect** — socket connects; `notification.connected` arrives; badge matches count.
2. **Live delivery** — trigger notification in another tab; `notification.new` in <500 ms.
3. **Multi-tab** — both tabs receive the same event (same `user:{userId}` room).
4. **Offline gap** — disconnect, trigger notification, reconnect; bootstrap fetch returns missed row.
5. **Rate limit** — rapid reconnect storm surfaces `WS_CONNECT_RATE_LIMITED` (staging only).
6. **Three clients** — Ployos, Lonaos, and Internal Hub each connect with their JWT; only own notifications arrive.

---

## 9. FAQ

**Q. Why didn't I get a `notification.new` for the row that's clearly in the DB?**
The socket was disconnected at emit time. The row is in Postgres — bootstrap
`GET /me?unread=true` on reconnect picks it up.

**Q. Do Ployos, Lonaos, and Internal Hub use the same socket?**
Yes. All three connect to `/ws/notifications` with their access JWT. Events are
targeted by recipient `userId` only.

**Q. How is multi-instance scaling handled?**
api-gateway uses `@socket.io/redis-adapter` so rooms sync across replicas.
platform-service emits via `@socket.io/redis-emitter` into the recipient room.
No gateway-wide `psubscribe` pattern.

**Q. What's the latency budget?**
End-to-end (DB write → live event) is ~5–50 ms on a healthy single region.

**Q. Which notification types does my platform receive?**
See the role-specific catalogs linked at the top.

---

## 10. Backend mitigations (reference)

| Former risk                        | Status    | Implementation                                                  |
| ---------------------------------- | --------- | --------------------------------------------------------------- |
| Global Redis pub/sub fan-out       | Resolved  | redis-emitter targeted room emit from platform-service          |
| Multi-instance gateway             | Resolved  | `@socket.io/redis-adapter` in api-gateway `main.ts`             |
| Per-connect identity gRPC          | Mitigated | `ws:session:valid:{sessionId}` Redis cache (30s TTL)            |
| Unread count gRPC on every connect | Mitigated | Read `notif:unread:{userId}` from Redis first                   |
| WS CORS drift                      | Resolved  | `EnvironmentsService.allowedOrigins` in gateway `afterInit`     |
| No WS rate limiting                | Resolved  | `WS_CONNECT_RATE_LIMIT`, `WS_MAX_CONNECTIONS_PER_USER` env vars |
| Wrong consultant redirects         | Resolved  | `baseUrlKey: 'lonaosUrl'` on all consultant notification types  |
| Fire-and-forget delivery           | Accepted  | Postgres + FE bootstrap (by design)                             |
| Multi-tab duplication              | Accepted  | Multiple sockets per user in same room (intended)               |

Env vars (see `.env.example`):

- `WS_MAX_CONNECTIONS_PER_USER` (default `10`)
- `WS_CONNECT_RATE_LIMIT` (default `30` handshakes per IP per minute)
- `ALLOWED_ORIGINS` — must list Ployos, Lonaos, and Internal Hub frontend origins (not API hostnames)
- `CORS_ALLOW_LOCALHOST=true` — dev VPS only; allows local SPAs to connect without listing localhost ports
