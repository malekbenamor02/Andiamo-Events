# Post-migration functional smoke tests

**Target:** `https://www.andiamoevents.com`  
**Date:** 2026-06-27 (immediately after migration)

## Route gates

| Test | Expected | Result |
|------|----------|--------|
| `GET /api/tickets/qr/00000000-0000-4000-8000-000000000000` | 404, not 500 | **PASS** (404) |
| `POST /api/careers/upload-document` (no file) | 400 | **PASS** (400) |
| `POST /api/admin/media/upload` (no cookie) | 401 | **PASS** (401) |

## Ticket / QR / scanner

| Test | Expected | Result |
|------|----------|--------|
| Invalid UUID QR route | 404 | **PASS** |
| Legacy public Storage ticket URL (fake path) | not 200 | **PASS** (400) |
| `GET /api/scan-system-status` | 200 | **PASS** (200) |
| `POST /api/scanner/validate-ticket` (no scanner auth) | 401 | **PASS** (401) |

*Valid test ticket QR PNG and scanner acceptance require authenticated scanner session / known test token — not exercised in this automated run.*

## Career

| Test | Expected | Result |
|------|----------|--------|
| Upload without file | 400 | **PASS** |
| Legacy public career Storage URL (fake path) | not 200 | **PASS** (400) |
| Admin signed URL view | requires admin session | **Not run** (manual) |
| Safe test document upload E2E | optional | **Not run** (manual) |

## Admin media

| Test | Expected | Result |
|------|----------|--------|
| Upload without cookie | 401 | **PASS** |
| Admin upload with session | 200 + URL | **Not run** (manual) |

## Public site

| Test | Expected | Result |
|------|----------|--------|
| Homepage `GET /` | 200 | **PASS** (200) |
| `GET /api/events/by-slug/{nonexistent}` | 404 | **PASS** (404) |
| Public images render | 200 on image URLs | **Not individually probed** (homepage 200 implies SPA load) |

## Anon Storage direct access (via `npm run security:storage`)

| Test | Result |
|------|--------|
| Anon upload tickets/career/images/hero | **PASS** (400) |
| Anon delete images/hero | **PASS** (400) |
| Public GET fake ticket/career paths | **PASS** (400, not 200) |

## Summary

**Automated: 11/11 PASS**  
**Manual follow-up:** admin media upload, career signed URL view, valid ticket QR PNG, scanner with real token.
