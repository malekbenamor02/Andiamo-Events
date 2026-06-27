# 08 — Supabase Logs Review

**Source:** Supabase MCP `get_logs` service=`api`  
**Project:** `ykeryyraxmtjunnotoep`  
**Window:** Last 24 hours (MCP limitation)  
**Audit timestamp:** 2026-06-27  

---

## Time range checked

Approximately **24 hours** ending at log fetch time. MCP does not support arbitrary historical ranges or SQL-style filtering by table in this tool.

---

## Requests to admins / orders / tickets from anon?

| Table / path | Observed in sample? | Notes |
|--------------|:-------------------:|-------|
| `/rest/v1/admins` | **Not in sample** | Does not prove absence — sample dominated by other paths |
| `/rest/v1/orders` | **Not in sample** | Same |
| `/rest/v1/tickets` | **Not in sample** | Same |

**Observed paths (confirmed in log batch):**

| Path | Methods | User agent class |
|------|---------|------------------|
| `/rest/v1/site_content` | GET, OPTIONS | Mobile browsers (Instagram in-app WebView) |
| `/rest/v1/site_logs` | POST, OPTIONS | Mobile browsers |
| `/rest/v1/academy_settings` | GET | `node` (server/cron) |
| `/rest/v1/academy_registrations` | HEAD | `node` |
| `/rest/v1/marketing_campaigns` | GET | `node` |
| `/realtime/v1/websocket` | GET (101) | Mobile browsers |

**Interpretation:** Recent traffic is mostly public site content and academy cron checks. **Lack of admins/orders/tickets in this window does not mean those endpoints were never scraped** — pentest or bulk exfil may occur outside sampled window.

---

## High-volume reads

| Pattern | Assessment |
|---------|------------|
| `site_content` GET | Frequent — consistent with normal site traffic |
| `academy_registrations` HEAD | Repeated cron-style polling from `node` |
| `academy_settings` GET | Repeated server reads |

No single IP volume statistics available from MCP export. No evidence of mass pagination on orders in this sample.

---

## Suspicious IPs / user agents

| Observation | Risk note |
|-------------|-----------|
| Instagram in-app browsers | Normal marketing traffic |
| `node` user agent | Expected for Vercel/server functions |
| No obvious scanner UA strings in sample | Limited sample |

**Not included:** Raw IP addresses (withheld to avoid PII / operational detail in audit doc). MCP log entries contain embedded UA strings only.

---

## Service role vs anon in logs

Log lines show `apikey=REDACTED` on websocket connections — key type not decoded in export. Server `node` requests to `academy_*` and `marketing_campaigns` likely use service role from backend (not verified per-request).

---

## Limitations

| Limitation | Impact |
|------------|--------|
| 24-hour window only | Cannot confirm historical exfiltration |
| No per-role breakdown in export | Cannot distinguish anon vs service role for REST calls |
| No request body logging | Cannot see filtered columns |
| Sample size capped | MCP returns recent batch, not full aggregate |
| Postgres / auth logs not fetched | Separate services not reviewed |

---

## Recommendations (logging)

1. Enable Supabase log drains to SIEM for `/rest/v1/admins`, `/rest/v1/orders`, `/rest/v1/tickets`.
2. Alert on anon SELECT returning >N rows on sensitive tables.
3. Retain 30+ days for forensic review after RLS remediation.

---

## Personal data

This document intentionally excludes customer emails, phone numbers, and full IP addresses. User agent strings are summarized by class only.
