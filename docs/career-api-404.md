# Career API 404 Errors

If you see **404 (Not Found)** for endpoints like:

- `api/admin/careers/domains`
- `api/admin/careers/applications`
- `api/careers/city-options`
- `api/careers/gender-options`
- `api/admin/careers/settings`

**Cause:** The career routes are implemented in the **Node backend** (`server.cjs`). Those requests must hit the server that has those routes registered. A 404 means either the backend is not running or the request is going to an origin that doesn’t serve the career API.

**Fix:**

1. **Development (local)**  
   Run both the frontend and the backend:
   ```bash
   npm run dev:full
   ```
   This starts:
   - Vite dev server (e.g. port 3000) – serves the app and proxies `/api` to the backend
   - Node server (port 8082) – serves `/api/...` including career routes  

   If you only run `npm run dev`, the proxy forwards `/api` to `localhost:8082` but nothing is listening there, so you get connection errors or 404.

2. **Check that career routes loaded**  
   When the Node server starts, you should see in the console:
   ```text
   Career routes registered at /api/careers/* and /api/admin/careers/*
   ```
   If you see instead:
   ```text
   Career routes not loaded: <error message>
   ```
   then the career module failed to load (e.g. missing dependency or exception in `careerRoutes.cjs`). Fix the reported error and restart the server.

3. **Production**  
   The same process that serves your app must also run `server.cjs` (or your main Node app) so that `/api/admin/careers/*` and `/api/careers/*` are handled there. If the frontend is deployed on a static host and the API on another domain, set `VITE_API_TARGET` (or your API base URL) so the frontend calls the correct API origin; the server that runs `server.cjs` must have the career routes registered.

**Summary:** Career APIs live on the Node server. Use `npm run dev:full` in development and ensure the Node server is running and loads career routes so those URLs are not 404.
