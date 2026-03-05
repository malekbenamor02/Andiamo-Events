# Firebase Cloud Messaging (FCM) Notification System – Plan

This document is the full plan for adding push notifications to Andiamo Events using **Firebase Cloud Messaging (FCM)**. It covers Firebase setup, web client, service worker, backend sending, token storage, and how it fits with your existing admin notification center.

---

## 1. Current state

| What you have | Notes |
|---------------|--------|
| **Admin in-app notifications** | Dashboard shows realtime events (new orders, ambassador applications, POS orders) via **Supabase Realtime** (`postgres_changes`). |
| **Browser notifications** | When an event occurs, you call `new Notification(title, body)` and play `/sounds/notification.mp3` (only works when the tab is open and user has granted permission). |
| **Service worker** | `public/sw.js` for PWA caching; no FCM yet. |
| **Backend** | Express API (`api/`), Supabase for DB and Realtime. |

**Gap:** If the admin closes the tab or the browser, they get no alert. FCM delivers push notifications **even when the app is closed or in the background**, so admins can be notified of new orders/applications on any device.

---

## 2. Goals

- **Admin push notifications:** Notify admins (and optionally other roles) when:
  - New online order
  - New ambassador application
  - New ambassador order
  - New POS order
  - (Optional) other events you define
- **Delivery:** Notifications appear on device (desktop/mobile) even when the browser tab is closed or the app is in the background.
- **Consistency:** Reuse the same event types and copy as your existing admin notification center; FCM becomes a second delivery channel (push) alongside in-app + browser `Notification`.
- **Security:** Use FCM correctly (VAPID, server-side sending only, no client-side server key).

---

## 3. High-level architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Backend (Node / Supabase)                                               │
│  - On event (new order, new application, etc.):                          │
│    1. Logic runs (existing code path).                                   │
│    2. New: look up FCM tokens for admins (or target topic).              │
│    3. Call FCM Admin SDK or HTTP v1 API to send message.                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Firebase Cloud Messaging                                                │
│  - Delivers to devices by token or topic.                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Client (browser)                                                        │
│  - Foreground: Firebase JS SDK receives message → show in-app + optional │
│    browser Notification.                                                 │
│  - Background: Service worker (firebase-messaging-sw) receives message  │
│    → show system notification (and optionally open app / deep link).      │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Token flow:** When an admin (or user) opens the app and grants notification permission, the client gets an FCM token and sends it to your backend; backend stores it (e.g. in Supabase) and uses it when sending notifications.
- **Optional:** Use FCM **topics** (e.g. `admin-notifications`) so you can send to “all admins” without storing per-device tokens (simpler but less control over per-user targeting).

---

## 4. Implementation plan

### Phase 1 – Firebase project and FCM setup

#### 4.1 Create / use a Firebase project

- Go to [Firebase Console](https://console.firebase.google.com/).
- Create a new project (e.g. “Andiamo Events”) or use an existing one.
- Add a **Web app** in Project settings → Your apps → Add app → Web (</>).
- Register the app with a nickname; optionally enable Firebase Hosting (not required for FCM).
- You will get a `firebaseConfig` object: `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`.

#### 4.2 Enable Cloud Messaging and get keys

- In Firebase Console: **Build → Cloud Messaging**.
- Under **Cloud Messaging API (Legacy)** or **FCM**: ensure the API is enabled (Google may have migrated to “FCM API” in the console).
- **Web configuration:**
  - **Web Push certificates:** Generate a **Key pair** (VAPID key). You get a key pair (public key is used in the client; private key is used only on the server to send messages). Save both.
  - Note the **Sender ID** (same as `messagingSenderId` in `firebaseConfig`).
- **Server key (Legacy):** Optional and deprecated for new apps; prefer **Service account** for backend (see Phase 4).

#### 4.3 Environment variables (client)

- In the repo (e.g. `.env` / `.env.example`), add:
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`
  - `VITE_FIREBASE_VAPID_KEY` (public VAPID key only; see §5.1 for usage)
- Do **not** put the VAPID **private** key or any server secret in the client.

#### 4.4 Environment variables (backend)

- For sending from backend you will need a **service account** (Phase 4). Plan for:
  - `FIREBASE_SERVICE_ACCOUNT_KEY` (path or JSON string) or individual env vars for `project_id`, `private_key`, `client_email` (and optionally `client_id`, etc.).

**Deliverable:** Firebase project created, FCM enabled, VAPID key pair generated, client config in env, backend env placeholders documented.

---

### Phase 2 – Web client: Firebase SDK and token

#### 2.1 Install Firebase

- In the project root:  
  `npm install firebase`
- Use the **modular SDK** (v9+):  
  `import { getMessaging, getToken, onMessage } from 'firebase/messaging';`  
  (and `initializeApp` from `firebase/app`).

#### 2.2 Initialize Firebase in the app

- Create a small module, e.g. `src/lib/firebase.ts` (or `firebase-app.ts`):
  - Read config from `import.meta.env.VITE_FIREBASE_*`.
  - Call `initializeApp(config)` once.
  - Export the app instance (and optionally `getMessaging()` wrapper that checks for browser support).
- Only initialize when config is present so the app still runs without Firebase (e.g. dev without .env).

#### 2.3 Request permission and get FCM token

- In a place that runs for “notification recipients” (e.g. after admin login, or on a dedicated “Notifications” settings area):
  - Check `Notification.permission`; if `default`, call `Notification.requestPermission()`.
  - If permission is `granted`:
    - Call `getToken(messaging, { vapidKey: '<your-public-vapid-key>' })`.
    - You get a long string (FCM device token). Send this token to your backend (see Phase 3).
  - Handle errors (e.g. permission denied, invalid VAPID key, messaging not supported).

#### 2.4 Where to run “request permission + get token”

- **Option A – Admin only:** Run only when the user is on the Dashboard (or after admin login). E.g. in `Dashboard.tsx` or a layout used only for admin, on mount: request permission → get token → send token to API.
- **Option B – Any user:** Run on first load for all users if you plan to notify attendees (e.g. “Your ticket is ready”). For now, the plan assumes **admin-only** to match your current notification center.
- **Option C – Settings page:** Add a “Enable push notifications” toggle in admin (or user) settings; on enable, request permission and get token, then send to backend.

**Deliverable:** Firebase app init module, permission request + `getToken` flow, token sent to backend (API to be added in Phase 3).

---

### Phase 3 – Service worker for background messages

FCM requires a **service worker** that uses the Firebase Messaging SDK to receive messages when the app is in the background or closed. Firebase expects a file named `firebase-messaging-sw.js` at the root of your domain (or you configure the name in `getToken`).

#### 3.1 firebase-messaging-sw.js

- Create `public/firebase-messaging-sw.js` (or `public/firebase-messaging-sw.js` if you serve from `public/`).
- In this file you can only use **scripts that the service worker can load**; typically you use the **firebase-messaging SW script** from the Firebase CDN and pass config + VAPID key.
- Example pattern (content of `firebase-messaging-sw.js`):

  ```js
  importScripts('https://www.gstatic.com/firebasejs/10.x.x/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.x.x/firebase-messaging-compat.js');
  firebase.initializeApp({ /* same config as client, from env or hardcoded for SW */ });
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    // Show notification using Service Worker's registration.showNotification(...)
  });
  ```

- The service worker **cannot** use `import.meta.env`; you must inject the config at build time (e.g. Vite replace) or hardcode a minimal config (projectId, etc.) and ensure the SW is served with the right config.
- **Important:** `getToken()` in the client must reference this SW. By default Firebase looks for `firebase-messaging-sw.js` at the origin root. If your app is at a subpath, set `serviceWorkerRegistration` and/or `serviceWorkerPath` in `getToken` options.

#### 3.2 Coexistence with existing sw.js

- You currently have `public/sw.js` for PWA caching. FCM expects its own SW file.
- **Option A – Two service workers:**  
  - Keep `sw.js` for caching.  
  - Add `firebase-messaging-sw.js` only for FCM.  
  - Register the main `sw.js` as now; Firebase will register `firebase-messaging-sw.js` when you call `getToken()`.  
  - Some browsers allow multiple SWs for different scopes; typically FCM SW is at root and has scope `/`. This can work if your main SW is also at root (scope `/`). If both are at `/`, only one can be active per scope—so you may end up with FCM taking over the root scope.  
- **Option B – Single SW (recommended):**  
  - Use one service worker that does both caching and FCM.  
  - In that SW: import Firebase messaging scripts and set up `onBackgroundMessage`; keep your existing install/fetch/activate for cache.  
  - Register this single SW from your app; when calling `getToken()`, pass this SW’s registration so Firebase uses it for background messages.  
- **Option C – Vite PWA plugin:**  
  - If you adopt `vite-plugin-pwa`, you can use its “inject manifest” and “generate SW” with a custom template that includes FCM. Then one generated SW handles both cache and FCM.

**Recommendation:** Start with **Option B**: a single `sw.js` that includes FCM background handler (and keep your existing cache logic). Document that `firebase-messaging-sw.js` is not used in this case; FCM is configured to use the same `sw.js` via `serviceWorkerRegistration` when calling `getToken()`.

**Deliverable:** One service worker that both caches and handles FCM `onBackgroundMessage`, and shows a system notification (title, body, optional icon/click action).

---

### Phase 4 – Backend: sending notifications via FCM

#### 4.1 Service account (backend auth)

- Firebase Console → Project settings → Service accounts → Generate new private key.  
- You get a JSON file. Store it securely (e.g. in secrets manager or env).  
- In your backend (Node), use **Firebase Admin SDK** with `credential.cert(serviceAccountObject)` so the server can send messages on behalf of the project.

#### 4.2 Install and init Admin SDK

- In the API/backend folder (e.g. where `server.cjs` or `api/` lives):  
  `npm install firebase-admin`
- Create a small module that:
  - Reads the service account (from env or file).
  - Calls `admin.initializeApp({ credential: admin.credential.cert(...) })` once.
  - Exports `admin.messaging()` for sending.

#### 4.3 Send a message

- Use the **FCM HTTP v1** API via Admin SDK:  
  `getMessaging().send({ token: fcmToken, notification: { title, body }, data: { ... } })`.  
- Or send to a **topic**:  
  `send({ topic: 'admin-notifications', notification: { title, body }, data: { ... } })`.  
- **data** payload: optional key-value pairs (string values) for deep linking or in-app handling (e.g. `type: 'new_order'`, `orderId: '...'`).

#### 4.4 When to send

- Hook into your **existing** event flows so one code path both:
  - Does what it does today (e.g. write to DB, trigger Supabase Realtime), and  
  - Sends an FCM message to admins.
- Example trigger points (align with your current Supabase channels):
  - New row in orders (online) → send “New online order” to admin tokens/topic.
  - New ambassador application → send “New ambassador application” to admin tokens/topic.
  - New ambassador order / POS order → same idea.
- Implement as small functions (e.g. `notifyAdminsNewOrder(order)`) that:
  - Resolve FCM tokens (or use topic).
  - Call `getMessaging().send(...)` (or `sendEachForMulticast` for multiple tokens).
  - Log errors and handle invalid/expired tokens (optional: remove from DB).

**Deliverable:** Backend module for Firebase Admin, plus 1–2 integration points (e.g. “new order” and “new application”) that send FCM messages to admins.

---

### Phase 4b – App tab (Admin Dashboard, super admin only)

A new **"App"** tab in the admin dashboard, visible **only to super_admin**, that groups PWA and push notification controls.

#### 4b.1 Tab placement and access

- Add a new tab to the dashboard with **label "App"** and **icon** from `/assets/faviconn.png` (project favicon: `public/assets/faviconn.png`).
- Render the tab (the `TabsTrigger` and its `TabsContent`) only when `currentAdminRole === 'super_admin'` (same pattern as existing super_admin–only tabs: logs, settings, admins, official-invitations, scanners).
- Add `"app"` to the list of tabs that are protected for super_admin (so regular admins cannot open it via URL or state).
- On mobile, include `"app"` in `mobileAllowedTabs` for super_admin if the App tab should be available on small screens.

#### 4b.2 App tab contents (two main areas)

**1. Notification center (send push from PWA)**

- UI for the super admin to **compose and send** push notifications to users (e.g. to a topic like "all-users" or to selected segments).
- Fields: title, body, optional URL/link, optional image, target (topic or "all admins" for testing).
- "Send" calls backend API that uses FCM Admin SDK to send the message.
- Optional: list of recent sent notifications or delivery status (if you store sends in DB).

**2. Install prompt (popup) controls**

- Controls for the **"Install the App"** popup/banner shown to **web users** (visitors) to encourage PWA install.
- Super admin can:
  - **Edit the text**: e.g. title, short description, primary CTA button label ("Install", "Add to Home Screen"), optional "Not now" / "Dismiss" label.
  - **Edit the period / frequency**: e.g. "Show once per session", "Once every X days", "Once per week", "Always until dismissed", or "Disabled".
- Values are stored in backend (e.g. Supabase table or existing settings store) and loaded by the public site so the install banner behavior is configurable without code deploy.
- The **install banner icon** shown to users should use `/assets/faviconn.png` so it matches the App tab and brand.

#### 4b.3 Install prompt – storage and API

- **Storage:** Supabase table, e.g. `app_install_prompt_config` (or a row in a generic `settings` table):  
  - `title`, `body`, `cta_label`, `dismiss_label` (optional),  
  - `show_frequency`: enum or string (`"once_per_session"` | `"once_every_n_days"` | `"once_per_week"` | `"always_until_dismissed"` | `"disabled"`),  
  - `n_days` (nullable, used when `show_frequency === "once_every_n_days"`),  
  - `updated_at`, `updated_by` (admin id).
- **API:**  
  - **GET /api/app/install-prompt-config** (public or authenticated): returns current config for the install banner (used by the public site).  
  - **PUT /api/app/install-prompt-config** (super_admin only): body contains editable fields; updates DB and returns new config.
- **Public banner component:** On the main app (non-admin pages), a component that:  
  - Fetches install-prompt config (or gets it from context/env).  
  - If `show_frequency === "disabled"`, does not render.  
  - Otherwise, checks `beforeinstallprompt` and localStorage/sessionStorage for "last shown" and frequency rules; if allowed, shows the banner with the configured text and icon (`/assets/faviconn.png`).  
  - On "Install" click: uses the stored `beforeinstallprompt` event to prompt; on "Dismiss": saves last-dismissed timestamp/count per the chosen frequency.

**Deliverable:** App tab (name "App", icon `faviconn.png`, super_admin only) with notification center and install-prompt controls; backend storage and API for install-prompt config; public install banner component that reads config and shows based on period; banner uses `/assets/faviconn.png`.

---

### Phase 5 – Token storage and API

#### 5.1 Where to store FCM tokens

- **Option A – Supabase table:**  
  - Table, e.g. `fcm_tokens`: `id`, `user_id` (or `admin_id`), `token` (unique), `device_label` (optional), `created_at`, `updated_at`.  
  - When client gets a token, call your API; API upserts into `fcm_tokens` (e.g. one row per token; same user can have multiple devices).  
- **Option B – No DB (topics only):**  
  - Clients subscribe to a topic, e.g. `admin-notifications`, after login. Backend sends only to that topic. No token storage. Simpler but no per-user or per-device control.  
- **Recommendation:** Use **Option A** for admin notifications so you can target “all admins” by querying tokens by role and support multiple devices per admin.

#### 5.2 API to register token

- **POST /api/notifications/register** (or similar):
  - Body: `{ fcmToken: string, deviceLabel?: string }`.
  - Auth: require admin (or user) JWT/session.
  - Upsert into `fcm_tokens` (associate with current user/admin). Return 200.
- **Optional – POST /api/notifications/unregister:**  
  - Body: `{ fcmToken: string }`. Remove token from DB (e.g. on logout or “Disable notifications”).

**Deliverable:** Supabase table (or equivalent) and register/unregister API used by the client after `getToken()`.

---

### Phase 6 – Foreground handling and integration with existing UI

#### 6.1 Foreground messages

- In the client, use `onMessage(messaging, (payload) => { ... })` so that when the app is in the **foreground**, you handle the message in JS.
- In the handler: you can **reuse** your existing `pushNotification()` (or equivalent) so the same event appears in the admin notification center, plays the notification sound, and optionally shows a browser `Notification` so behavior is consistent with Supabase-driven events.

#### 6.2 Avoid duplicates

- Today: Supabase Realtime fires → `pushNotification()` → in-app + sound + browser Notification.
- After FCM: the same event can be sent both via Realtime and via FCM. If you do both without coordination, the admin might see two notifications.
- **Options:**  
  - **A)** Rely only on FCM for push: when the event occurs, backend sends FCM; do **not** send a duplicate via another channel (e.g. suppress Realtime-triggered notification for that event type).  
  - **B)** Use FCM only for “when tab closed”; when tab is open, keep using Realtime only and do not show FCM in foreground (or show FCM in foreground but do not trigger in-app notification from FCM when Realtime already did).  
  - **C)** Single source of truth: backend sends FCM; client in foreground receives via `onMessage` and pushes to notification center. Realtime can still be used for live data (e.g. list updates) but not for “toast” notification; then no duplicate.  

**Recommendation:** Prefer **C** or **B**: use FCM as the single “notification” channel; in foreground, `onMessage` → same `pushNotification()` so one notification in the center; optionally skip or throttle browser `Notification` when app is focused.

**Deliverable:** `onMessage` handler that feeds into existing admin notification center (and optionally sound + browser Notification), with no duplicate toasts for the same event.

---

### Phase 7 – Security and best practices

- **VAPID:** Use only the **public** key in the client; private key only on the backend (for sending via HTTP v1 with a service account, VAPID private is used in the Web Push path; FCM Admin SDK typically uses the service account).
- **Secrets:** Never commit service account JSON or VAPID private key; use env vars or secret manager.
- **HTTPS:** FCM and push require HTTPS in production (you already plan for PWA on HTTPS).
- **Token handling:** Treat FCM tokens as sensitive (they allow sending to that device); validate and scope register API to the authenticated user.
- **Invalid tokens:** When FCM returns “invalid” or “unregistered”, remove that token from your DB so you don’t keep sending to dead devices.

---

### Phase 8 – Testing and rollout

- **Local:** Use a test Firebase project and test with Chrome (and optionally Firefox). Grant notification permission and trigger a send from backend (e.g. Postman or a small script) to your token.
- **Foreground vs background:** Test with app open (foreground) and with app minimized or tab closed (background); confirm notification appears in both cases.
- **Devices:** Test on at least one Android and one desktop; iOS Safari has limited support for FCM web push (check current support).
- **Rollout:** Enable FCM for admins first; later extend to end-users (e.g. “Your ticket is ready”) if desired.

---

## 5. Specifications for previously open points

Each item below is fully specified so implementation can proceed without ambiguity.

---

### 5.1 VAPID key in client

- **Env var:** `VITE_FIREBASE_VAPID_KEY` (string). This is the **public** VAPID key from Firebase Console → Project settings → Cloud Messaging → Web Push certificates → Key pair. Never expose the private key in the client.
- **Usage:** In the place where you call `getToken()`, pass:  
  `getToken(messaging, { vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY })`.  
  If the env var is missing, do not call `getToken()` (and optionally skip FCM registration).
- **Documentation:** Add to `.env.example`:  
  `VITE_FIREBASE_VAPID_KEY=your-public-vapid-key-here`

---

### 5.2 Service worker Firebase config at build time

- **Constraint:** The service worker file (e.g. `public/sw.js`) runs in a different context and cannot use `import.meta.env`. Firebase config (and optionally VAPID) must be available inside the SW at runtime.
- **Approach (recommended):**  
  1. Keep a **template** file, e.g. `public/sw.template.js`, that contains placeholders such as `__FIREBASE_CONFIG__` and `__FIREBASE_VAPID_KEY__` (or individual keys like `__FIREBASE_API_KEY__`, `__FIREBASE_PROJECT_ID__`, etc.).  
  2. Add a **build script** (e.g. `scripts/inject-sw-config.js` or a Vite plugin) that runs before or during `vite build`: it reads `process.env.VITE_FIREBASE_*` and `process.env.VITE_FIREBASE_VAPID_KEY`, builds a config object, and writes `public/sw.js` with the placeholders replaced by the actual values (e.g. `const firebaseConfig = __FIREBASE_CONFIG__;` → `const firebaseConfig = {"apiKey":"...", ...};`).  
  3. In `sw.js`, use that inlined config to call `firebase.initializeApp(firebaseConfig)` (or the equivalent in the compat script).  
  4. Ensure the script is run in CI and locally before deploy (e.g. `"prebuild": "node scripts/inject-sw-config.js"` or integrate into the build so `dist/sw.js` is generated with the right config).
- **Alternative:** If you do not want to generate `sw.js` from a template, you can serve a small JSON config from your origin (e.g. `/firebase-sw-config.json`) and have the SW fetch it in `install` before initializing Firebase; this adds a network dependency and is less reliable, so the template approach is preferred.

---

### 5.3 Notification click action / deep link

- **FCM payload:** Every message sent via the backend should include in the `data` payload a field used for navigation when the user clicks the notification. Use a single field: `url` (full URL) or `path` (pathname only, e.g. `/admin`, `/event/123`). All values in `data` must be strings.
  - **Examples:**  
    - Admin order alert: `data: { type: 'new_order', orderId: '123', path: '/admin' }` or `url: 'https://yoursite.com/admin'`.  
    - Event reminder: `data: { type: 'event_reminder', eventId: '456', path: '/event/456' }`.
- **Service worker:** In the same file as `onBackgroundMessage`, add a `notificationclick` listener on `self`. When the user clicks the notification:  
  1. Get the URL from the notification's `data` (e.g. `event.notification.data.url` or build from `event.notification.data.path` and `self.location.origin`).  
  2. Call `event.waitUntil(clients.openWindow(url))` (and optionally `event.notification.close()`).  
  3. If no `url`/`path` is present, open the app root: `clients.openWindow(self.location.origin + '/')`.
- **Convention:** Decide a single convention (e.g. always `path` and build full URL in SW as `new URL(path, self.location.origin).href`) and document it so all senders (event-driven and App-tab send) use the same shape.

---

### 5.4 API for "send from App tab"

- **Endpoint:** `POST /api/notifications/send` (or `POST /api/app/notifications/send`).  
- **Auth:** Require authenticated admin with role `super_admin`. Return 403 if role is not `super_admin`.
- **Request body (JSON):**
  - `title` (string, required): notification title.
  - `body` (string, required): notification body.
  - `target` (string, required): one of `"topic"` | `"admins"` | `"tokens"`.
  - `topic` (string, optional): required when `target === "topic"` (e.g. `"all-users"`, `"admin-notifications"`).
  - `tokens` (string[], optional): required when `target === "tokens"`; array of FCM device tokens.
  - `url` or `path` (string, optional): used for notification click (see §5.3); e.g. `path: "/admin"`.
  - `image` (string, optional): URL of an image to show in the notification (if supported).
- **Behavior:** Backend validates the body, then:  
  - If `target === "admins"`: load all tokens from `fcm_tokens` (e.g. where role is admin/super_admin, or all rows if table is admin-only). Send via FCM (e.g. `sendEachForMulticast`).  
  - If `target === "topic"`: call FCM `send({ topic: body.topic, notification: { title, body }, data: { url/path, ... } })`.  
  - If `target === "tokens"`: call FCM `sendEachForMulticast` with the given tokens.  
  Return 200 with a payload such as `{ success: true, sentCount?: number, failureCount?: number }` or 4xx/5xx with an error message. On FCM errors (e.g. invalid token), optionally remove invalid tokens from the DB (see Phase 5).
- **Rate limiting:** See §5.8.

---

### 5.5 Install prompt default config

- **When to use:** When the table `app_install_prompt_config` has no row (or the GET API returns empty), the public install banner should use **defaults** so the app works without a migration or manual insert.
- **Default values (suggested):**
  - `title`: `"Install Andiamo Events"`
  - `body`: `"Add to your home screen for quick access and a better experience."`
  - `cta_label`: `"Install"`
  - `dismiss_label`: `"Not now"`
  - `show_frequency`: `"once_every_n_days"`
  - `n_days`: `7`
- **Implementation:** In the GET handler for install-prompt config, if no row exists, return these defaults (with a flag like `isDefault: true` if useful). Optionally, add a DB migration or seed that inserts one row with these values so the super admin can edit them in the App tab from day one.

---

### 5.6 i18n for install prompt

- **Decision:** Support two locales, **en** and **fr**, to align with the dashboard. Store per-locale fields in the same table.
- **Schema addition:** In `app_install_prompt_config`, add columns (or a JSON column) for:
  - `title_en`, `title_fr`
  - `body_en`, `body_fr`
  - `cta_label_en`, `cta_label_fr`
  - `dismiss_label_en`, `dismiss_label_fr`  
  (If you prefer a single locale for now, keep `title`, `body`, etc.; add `_en`/`_fr` later.)
- **API:** GET accepts optional query `?lang=en|fr` and returns the corresponding text fields (e.g. `title: title_en` when `lang=en`). If `lang` is missing, use a fallback (e.g. browser language or `en`). PUT from the App tab sends both locales so the super admin can edit each.
- **Public banner:** The banner component receives or detects the current locale (e.g. from app context or `navigator.language`) and requests GET with that `lang` (or uses the appropriate fields from the response).

---

### 5.7 FCM token refresh

- **Problem:** FCM can invalidate or refresh the token (e.g. after long inactivity or browser update). The client should re-register so the backend always has a valid token.
- **Implementation:**  
  1. After calling `getToken()` and successfully registering with the backend, subscribe to token refresh. With the Firebase modular SDK (v9+), use `onTokenRefresh(messaging, async () => { const newToken = await getToken(messaging, { vapidKey }); ... })` if available, or the compat equivalent.  
  2. In the callback (or equivalent): get the new token with `getToken(...)`, then call `POST /api/notifications/register` with the new token (same body as initial registration). Optionally unregister the old token on the backend if you track per-token updates.  
  3. If the SDK does not expose a dedicated refresh event, periodically (e.g. once per day when the app is open) call `getToken()` and, if the returned token differs from the one previously sent, call the register API again.  
- **Placement:** This logic lives in the same place as the initial permission + getToken + register flow (e.g. in the Dashboard or the module that handles FCM registration).

---

### 5.8 Rate limiting for send API

- **Scope:** Apply to `POST /api/notifications/send` (and, if you add it, any other "send push" endpoint used by the App tab).
- **Rule:** Allow at most **N** requests per **M** minutes per authenticated admin (e.g. 10 requests per 60 minutes per admin). Use a stable identifier (e.g. admin user id or session id) for the limit key.
- **Implementation:** Use your existing rate-limiting middleware (e.g. `express-rate-limit`) with a dedicated config for this route: `windowMs: 60 * 60 * 1000`, `max: 10`, and a key generator that uses the authenticated admin id. Return 429 with a Retry-After header when the limit is exceeded.
- **Response:** On 429, return a JSON body such as `{ error: "Too many notification sends. Try again later." }` so the App tab can show a user-friendly message.

---

### 5.9 iOS Safari behavior

- **Limitations:** iOS Safari does not support the `beforeinstallprompt` event and has limited support for FCM web push. The PWA install flow on iOS is manual (Share → Add to Home Screen).
- **Install banner:** Detect iOS (e.g. `/iPad|iPhone|iPod/.test(navigator.userAgent)` or similar). If iOS, **do not** show the same "Install" button that triggers `beforeinstallprompt`. Instead, either:  
  - **Option A:** Hide the install banner entirely on iOS.  
  - **Option B:** Show a different message and CTA, e.g. "Add to Home Screen: tap the Share icon and then 'Add to Home Screen'." (no programmatic install).  
- **FCM on iOS:** Document that push notifications may not be delivered when the PWA is not in the foreground on iOS Safari, and that testing on real iOS devices is required. The plan does not change the backend; only the client and docs reflect iOS behavior.

---

### 5.10 Placement of public install banner

- **Component:** Create a dedicated component, e.g. `InstallPromptBanner.tsx` (or `PwaInstallBanner.tsx`), that encapsulates: fetching config, checking frequency, listening for `beforeinstallprompt`, and rendering the banner UI (icon, text, Install / Dismiss buttons).
- **Placement:** Render this component once at the **root** of the app, so it can show on any public page. Concretely: in your root layout or in `App.tsx`, render `<InstallPromptBanner />` inside the same router/layout that wraps public routes (e.g. after the router outlet or as a sibling to main content). Do **not** render it on admin-only routes (e.g. under `/admin` or when the user is identified as admin), so admins are not prompted to "install" the app in the same way as end users. Optionally, gate with a route prefix check (e.g. only when `pathname` does not start with `/admin`).

---

### 5.11 Cross-doc: PWA vs FCM

- **Relationship:** The PWA plan (`docs/pwa-implementation-plan.md`) covers manifest, icons, and service worker caching; the FCM plan adds push and the App tab. The **install prompt** (banner + config) is part of both: PWA plan Phase 3 describes the install UX; FCM plan Phase 4b describes the super_admin controls and config storage.
- **Order:** Implement in this order (or in parallel where independent):  
  1. PWA: manifest + icons + single service worker with caching (see PWA plan Phase 1–2).  
  2. FCM: add Firebase to the **same** service worker (Option B in Phase 3): background handler + notification click.  
  3. Client: Firebase init, getToken, register, onMessage, and (in App tab) send + install-prompt config.  
  4. App tab and public install banner that read config and respect frequency.  
- **Single SW:** Use one `sw.js` (or one generated SW) that handles both cache (install/fetch/activate) and FCM (onBackgroundMessage, notificationclick). Do not register a separate `firebase-messaging-sw.js` if you use the single-SW approach; pass the existing SW registration to `getToken()` so FCM uses it.

---

### 5.12 Supabase RLS and access

- **Tables:** `fcm_tokens`, `app_install_prompt_config` (and optionally a table for "sent notifications" if you store history).
- **fcm_tokens:**  
  - **Insert/update/delete:** Only the backend (using the service role key) should write. The frontend never writes to this table directly; it calls `POST /api/notifications/register`, which runs server-side and uses the service role.  
  - **RLS:** Enable RLS. Policy: no direct access from the client (no SELECT/INSERT/UPDATE/DELETE for anon or authenticated). Backend uses service role and bypasses RLS.  
- **app_install_prompt_config:**  
  - **Read:** If the public install banner fetches config via your **backend** GET API, the backend can read from Supabase with service role; then no public read on the table is needed. If instead the frontend reads from Supabase directly (e.g. with the anon key), add an RLS policy: allow `SELECT` for `anon` (or `authenticated`) on the single row (e.g. `id = 1` or the only row).  
  - **Write:** Only the backend (super_admin only) should update; use `PUT /api/app/install-prompt-config` which uses the service role. RLS: allow no direct INSERT/UPDATE/DELETE for anon; allow UPDATE only for a role that the backend uses (or keep all writes via backend and allow no client writes).  
- **Summary:** Prefer all reads/writes for these tables via your API and service role; then RLS can deny all client roles. If you need public read for install config from the client (e.g. Supabase client with anon key), allow only SELECT on that one table/row.

---

### 5.13 GET install-prompt-config failure

- **Scenario:** The public install banner calls GET `/api/app/install-prompt-config` (or fetches from Supabase). The request fails (network error, 5xx, or timeout).
- **Behavior:**  
  - **Do not** show the install banner if the config could not be loaded (avoid showing a banner with no or stale text).  
  - Use **in-memory or in-code defaults** only when the API explicitly returns a 200 with no body or "use defaults" flag (see §5.5). Do not treat a failed request as "use defaults" so that a broken backend does not silently fall back to hardcoded copy.  
  - Optional: retry once after a short delay (e.g. 2s). If still failing, do not show the banner for that session; the next page load can try again.  
- **Summary:** On failure → do not show banner. On success with no row → return and use default values from §5.5.

---

### 5.14 Audit log for App tab actions

- **Actions to log:**  
  1. When a super admin **sends** a notification from the App tab (POST send): log admin id, timestamp, target (topic / admins / tokens), and optionally title (or a hash) for debugging.  
  2. When a super admin **updates** the install prompt config (PUT install-prompt-config): log admin id, timestamp, and which fields were updated (or a summary).  
- **Where:** Use your existing admin audit / action log (e.g. the same mechanism as `logAdminAction` or the table you use for admin activity).  
- **Payload (suggested):**  
  - Send: `action: 'app.send_push'`, `targetType: 'topic'|'admins'|'tokens'`, `details: { topic?, titleLength }` (avoid logging full body for privacy).  
  - Config update: `action: 'app.install_prompt_config_updated'`, `details: { fields: ['title_en', 'show_frequency'] }`.  
- **Retention:** Follow your existing retention policy for admin logs.

---

## 6. File / component checklist

| Item | Location / action |
|------|-------------------|
| Firebase config (client) | `src/lib/firebase.ts` (or similar) – init app, export app and getMessaging. |
| Env vars | `.env.example`: all `VITE_FIREBASE_*` and backend `FIREBASE_SERVICE_ACCOUNT_*` (or path). |
| Permission + token | In Dashboard (or settings): request permission, getToken, call POST `/api/notifications/register`. |
| Foreground handler | Same place you init messaging: `onMessage(...)` → existing `pushNotification()` or equivalent. |
| Service worker | Extend `public/sw.js` (or new SW) with FCM background handler; show notification in `onBackgroundMessage`. |
| Backend Firebase Admin | New module in `api/` or server: init with service account, export `getMessaging()`. |
| Send helpers | e.g. `api/notifications/send.js` or inside existing order/application handlers: resolve tokens, call `send()`. |
| Token storage | Supabase table `fcm_tokens`; POST/delete in register/unregister API. |
| Register / unregister API | e.g. `api/notifications/register.js`, `api/notifications/unregister.js` (or one router). |
| **App tab** | New tab in `Dashboard.tsx`: label **"App"**, icon `/assets/faviconn.png`, visible only when `currentAdminRole === 'super_admin'`. |
| **App tab – Notification center** | Component (e.g. `AppTab.tsx` or sub-components): form to compose and send push (title, body, target); calls API that uses FCM to send. |
| **App tab – Install prompt controls** | Same tab: form to edit banner text (title, body, CTA, dismiss) and show period (frequency + n_days); calls PUT `/api/app/install-prompt-config`. |
| **Install prompt config storage** | Supabase table `app_install_prompt_config` (or settings row); GET/PUT API for public banner config. |
| **Install prompt API** | GET `/api/app/install-prompt-config` (public), PUT `/api/app/install-prompt-config` (super_admin only). |
| **Public install banner** | Component on main app: fetches config, respects frequency, shows banner with text + icon `/assets/faviconn.png`; uses `beforeinstallprompt` and localStorage/sessionStorage for period. |

---

## 7. Suggested order of work

1. **Phase 1:** Firebase project, FCM, VAPID, env vars (client + backend placeholders).  
2. **Phase 5 (partial):** Design `fcm_tokens` table and register API (so client can send token).  
3. **Phase 2:** Client init, permission, getToken, call register API (e.g. from Dashboard).  
4. **Phase 3:** Service worker: add FCM background handler to `sw.js` (or single SW), show notification.  
5. **Phase 4:** Backend: Admin SDK init, one “send to admins” helper, integrate in one flow (e.g. new order).  
6. **Phase 4b:** App tab: add "App" tab (icon faviconn.png, super_admin only), notification center UI (send push), install-prompt config UI; install-prompt storage + GET/PUT API; public install banner component.  
7. **Phase 6:** Foreground `onMessage` → existing notification center.  
8. **Phase 7–8:** Security review, then test foreground/background and devices.

---

## 8. References

- [FCM for Web](https://firebase.google.com/docs/cloud-messaging/js/client)
- [Firebase Admin SDK – Send to a device](https://firebase.google.com/docs/cloud-messaging/send-message#web)
- [Web Push Protocol / VAPID](https://datatracker.ietf.org/doc/html/rfc8292)
- [Service worker for FCM](https://firebase.google.com/docs/cloud-messaging/js/receive#handle_background_messages)

---

## 9. Summary

- **Firebase:** One project, FCM enabled, VAPID for web, service account for backend.  
- **Client:** Firebase SDK, getToken (with VAPID), send token to backend; `onMessage` for foreground → existing admin notification center.  
- **Service worker:** One SW that does caching + FCM background handler and shows system notifications.  
- **Backend:** Firebase Admin SDK, store tokens in Supabase, send on “new order” / “new application” (and similar) to admin tokens or topic.  
- **UX:** Same notification types and copy as today; FCM adds delivery when the tab is closed or the app is in the background.  
- **App tab (super_admin only):** New dashboard tab **"App"** with icon from `public/assets/faviconn.png`. Contains: (1) **Notification center** to compose and send push notifications from the PWA; (2) **Install prompt controls** to edit the text and show period of the "Install the App" popup for web users. Install banner uses the same icon (`/assets/faviconn.png`) and is driven by config (storage + GET/PUT API) so the super admin can change copy and frequency without code deploy.

This plan gets you to a working FCM-based notification system plus a super_admin-only App tab for sending push and controlling the PWA install prompt.
