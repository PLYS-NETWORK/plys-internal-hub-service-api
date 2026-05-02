# Notifications — Frontend Realtime Integration Guide

> Source: [src/modules/notifications/notifications.gateway.ts](../../../src/modules/notifications/notifications.gateway.ts)
> Companion REST spec: [notifications-api-specs.md](./notifications-api-specs.md)
> Audience: BUSINESS-platform frontend engineers wiring the bell drop-down,
> toast surface, and cache-invalidation logic.

## 1. Architecture in one paragraph

The backend persists every notification in Postgres (the source of truth) and
publishes a `notification.new` Socket.IO event to the recipient's room over a
shared Redis pub/sub fan-out. The FE connects ONE socket per user-session,
listens to a small set of events, calls a REST GET on connect to back-fill any
gap, and then renders live updates as they stream in.

**Durability model:** Redis pub/sub is fire-and-forget — if the socket is
disconnected when the publish fires, the live event is lost forever. The DB row
is not. The FE catch-up step (§3) reconciles the gap on reconnect.

---

## 2. Connecting the Socket.IO client

- **URL:** `${API_BASE_URL}/ws/notifications` (e.g. `https://api.ployos.example/ws/notifications`).
- **Library:** `socket.io-client@4.x`.
- **Auth shape:** the access token (the same Bearer JWT used for REST) plus the
  optional device-id header value go on `auth`.
- **Transports:** prefer `websocket` with `polling` as fallback (matches what
  the gateway accepts).

```ts
import { io, Socket } from 'socket.io-client';
import type { NotificationPayload } from '@/types/notifications'; // see §6

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
`notification.connected` with the current unread count. Use that as the
trigger to render the unread badge AND to fetch the unread list, since any
notifications that fired while you were disconnected will not be replayed by
Redis.

```ts
socket.on('connect', () => {
  // Live transport restored — but events fired while disconnected are gone.
  // The DB still has them; pull them now.
});

socket.on('notification.connected', async ({ unread_count }) => {
  setUnreadBadge(unread_count);
  const page = await fetch(`${apiBase}/api/v1/notifications/me?unread=true&take=20`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).then((r) => r.json());
  hydrateBellList(page.data.data); // page.data.data === NotificationResponseDto[]
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

Three outgoing events from the gateway. None of them carry the standardized
HTTP envelope — what you see is the raw payload.

| Event                       | Payload                                       | When                                                                                        |
| --------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `notification.connected`    | `{ unread_count: number }`                    | After successful handshake.                                                                 |
| `notification.new`          | `NotificationPayload` (typed union — see §6). | Any time the dispatcher fires for the connected user.                                       |
| `notification.unread-count` | `{ unread_count: number }`                    | (Reserved for future server-emitted count refreshes — currently unused; treat as advisory.) |

```ts
socket.on('notification.new', (n: NotificationPayload) => {
  prependToBellList(n); // dedupe by n.id
  setUnreadBadge((c) => c + 1);
  showToast(n); // optional UX: toast on important types
  refetchAffectedQueries(n); // §5
});
```

---

## 5. Auto-trigger / auto-refetch table

This is the BE→FE contract for which UI surface to refresh on each `type`.
"Auto-refetch" here means: invalidate the named React Query / SWR / RTK Query
cache key so the next render fetches fresh data; if you don't use a query
cache, equivalent imperative refetch on whichever screen is currently mounted.

| `type`                | UI action                                                                    | Auto-refetch                                                                       |
| --------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `profile_updated`     | Toast "Profile updated" with the changed fields.                             | `GET /profiles/business/me`                                                        |
| `password_changed`    | Security toast (warning style). Optional: surface "this was you?" CTA.       | (Optional) `GET /auth/sessions` once that endpoint exists.                         |
| `project_published`   | Success toast linking to the project.                                        | `GET /projects/business`, `GET /projects/business/:id`, business overview KPIs.    |
| `project_unpublished` | Toast — show `refund_amount` if present.                                     | Same as `project_published`, plus `GET /payments/business/transactions`.           |
| `new_application`     | Toast with `consultant_name` + `project_title`; click opens the application. | `GET /projects/business/:id/applications`, applicant counters on the project card. |
| `top_up_completed`    | Success toast + balance widget refresh.                                      | Wallet/balance query, `GET /payments/business/transactions`.                       |
| `withdraw_completed`  | Success toast + balance widget refresh.                                      | Same as `top_up_completed`.                                                        |
| `withdraw_reversed`   | Warning toast with the `reason`; balance went up by `amount`.                | Same as `top_up_completed`.                                                        |

Implementation pattern (React Query example):

```ts
import { useQueryClient } from '@tanstack/react-query';

const qc = useQueryClient();
socket.on('notification.new', (n: NotificationPayload) => {
  switch (n.type) {
    case 'new_application':
      qc.invalidateQueries({
        queryKey: ['business', 'projects', n.metadata.project_id, 'applications'],
      });
      break;
    case 'project_published':
    case 'project_unpublished':
      qc.invalidateQueries({ queryKey: ['business', 'projects'] });
      qc.invalidateQueries({
        queryKey: ['business', 'projects', n.metadata.project_id],
      });
      break;
    case 'top_up_completed':
    case 'withdraw_completed':
    case 'withdraw_reversed':
      qc.invalidateQueries({ queryKey: ['business', 'wallet'] });
      qc.invalidateQueries({ queryKey: ['business', 'transactions'] });
      break;
    case 'profile_updated':
      qc.invalidateQueries({ queryKey: ['business', 'profile', 'me'] });
      break;
    case 'password_changed':
      // No data to invalidate — purely a security toast.
      break;
  }
});
```

---

## 6. Redirect rules

Every payload carries two redirect mechanisms; pick whichever fits your routing.

1. **Pre-computed URL** — `n.redirect_url` is server-computed, deep-linked
   into the correct tenant, and ready to navigate to.
   ```ts
   if (n.redirect_url) router.push(n.redirect_url);
   ```
2. **Generic mapping** — `(n.entity_type, n.entity_id)` pair. Use this when
   the FE owns routing and prefers to compose URLs locally.
   ```ts
   const ROUTE_BY_ENTITY: Record<string, (id: string) => string> = {
     project: (id) => `/projects/${id}`,
     application: (id) => `/applications/${id}`,
     transaction: (id) => `/billing/transactions`, // list view; id is in metadata
     user: () => `/settings`,
   };
   const target = ROUTE_BY_ENTITY[n.entity_type]?.(n.entity_id);
   if (target) router.push(target);
   ```

**Recommendation:** prefer `redirect_url` when present, fall back to the
mapping when it's `null`.

```ts
function redirect(n: NotificationPayload, router: AppRouter): void {
  router.push(n.redirect_url ?? ROUTE_BY_ENTITY[n.entity_type]?.(n.entity_id) ?? '/');
}
```

---

## 7. TypeScript types (copy-paste source of truth until a shared package exists)

Mirrors [src/modules/notifications/types/notification-metadata.types.ts](../../../src/modules/notifications/types/notification-metadata.types.ts):

```ts
// notification-types.ts

export const NOTIFICATION_TYPES = {
  PROFILE_UPDATED: 'profile_updated',
  PASSWORD_CHANGED: 'password_changed',
  PROJECT_PUBLISHED: 'project_published',
  PROJECT_UNPUBLISHED: 'project_unpublished',
  NEW_APPLICATION: 'new_application',
  TOP_UP_COMPLETED: 'top_up_completed',
  WITHDRAW_COMPLETED: 'withdraw_completed',
  WITHDRAW_REVERSED: 'withdraw_reversed',
} as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export interface IProfileUpdatedMetadata {
  updated_fields: string[];
}
export interface IPasswordChangedMetadata {
  device_id: string | null;
  ip_address: string;
}
export interface IProjectPublishedMetadata {
  project_id: string;
  project_code: string;
  project_title: string;
}
export interface IProjectUnpublishedMetadata {
  project_id: string;
  project_code: string;
  project_title: string;
  refund_amount?: number;
}
export interface INewApplicationMetadata {
  project_id: string;
  project_code: string;
  project_title: string;
  application_id: string;
  consultant_id: string;
  consultant_name: string;
}
export interface ITopUpCompletedMetadata {
  transaction_id: string;
  transaction_number: string;
  amount: number;
  currency: string;
  new_balance: number;
}
export interface IWithdrawCompletedMetadata {
  transaction_id: string;
  transaction_number: string;
  amount: number;
  currency: string;
  new_balance: number;
}
export interface IWithdrawReversedMetadata extends IWithdrawCompletedMetadata {
  reason: string;
}

export type NotificationMetadataMap = {
  profile_updated: IProfileUpdatedMetadata;
  password_changed: IPasswordChangedMetadata;
  project_published: IProjectPublishedMetadata;
  project_unpublished: IProjectUnpublishedMetadata;
  new_application: INewApplicationMetadata;
  top_up_completed: ITopUpCompletedMetadata;
  withdraw_completed: IWithdrawCompletedMetadata;
  withdraw_reversed: IWithdrawReversedMetadata;
};

// The discriminated-union the FE consumes — TS narrows `metadata` automatically
// when you `switch (n.type)`.
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

## 8. Error handling

| Server emits                                             | What happened                                                                                | FE should…                                                                                                                                                                  |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `error { code: "AUTH_TOKEN_INVALID" }` then disconnect   | Missing / malformed JWT, or session was revoked.                                             | Refresh the access token via `/auth/refresh`, reconnect. If refresh fails, redirect to login.                                                                               |
| `error { code: "AUTH_TOKEN_EXPIRED" }` then disconnect   | Access token TTL elapsed.                                                                    | Same — refresh + reconnect.                                                                                                                                                 |
| `error { code: "AUTH_DEVICE_MISMATCH" }` then disconnect | The handshake `auth.deviceId` doesn't match the JWT `deviceId` claim.                        | Surface "session was started on another device" UX.                                                                                                                         |
| Disconnects with `reason="io server disconnect"`         | The session was revoked server-side (admin force-logout, password change on another device). | Redirect to login.                                                                                                                                                          |
| `connect_error` event                                    | Transport-level failure (network, CORS, server down).                                        | Let Socket.IO retry. After ~30s of failures, surface a degraded-mode banner and start polling `GET /me/unread-count` every 30s as a safety net until the socket reconnects. |

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

## 9. Testing checklist for FE engineers

1. **Initial connect**
   - On login, the socket connects within 1s.
   - `notification.connected` arrives once.
   - The unread badge matches `unread_count`.
2. **Live delivery**
   - Trigger a profile update via REST in another tab — `notification.new` arrives in <500 ms.
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

## 10. FAQ

**Q. Why didn't I get a `notification.new` for the row that's clearly in the DB?**
The socket was disconnected at the moment the dispatcher published. Redis pub/sub
doesn't replay. The row is in Postgres — the bootstrap `GET /me?unread=true` on the
next reconnect will pick it up.

**Q. Can I subscribe to a different user's notifications (e.g. as an admin)?**
No. The gateway joins exactly one room — `user:{caller's own userId}` — based
on the JWT. Cross-user subscription is not exposed.

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
