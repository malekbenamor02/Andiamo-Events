Andiamo Events - Presale System Specification
OVERVIEW
The Presale System is an access control and discount layer applied to existing events in Andiamo Events.
It does not replace the event, ticket, payment, or QR systems.
CORE CONCEPT
- Presale is enabled per event (optional flag)
- Users must enter a code + access link
- Access is granted for 24 hours via cookie session
PRESALE CODE SYSTEM
- Multiple codes per event
- Custom admin-defined codes
- Each code has one discount type:
 - percentage OR fixed amount
- Codes can be paused, regenerated, and tracked
ACCESS FLOW
1. User opens event link
2. System checks presale session
3. If no session, user enters code
4. Code validation (reCAPTCHA + rate limit)
5. Session created (24h cookie)
6. Event + tickets become accessible
TICKET FLOW
- Ticket selection always visible throughout checkout
- Flow: selection → user info → payment → QR ticket
PAYMENT RULES
- Same as public checkout: each pass's allowed payment methods (admin dashboard) and active payment options
- Presale does not force online-only; ambassador cash and other channels work when passes allow them
- Backend still enforces pass allowed_payment_methods on order create
SESSION RULES
- Stored in secure HTTP-only cookie
- Valid for 24 hours
- Tied to event + code
SECURITY
- Google reCAPTCHA on code entry
- Rate limiting for brute force attempts
- Backend validation mandatory
EVENT VISIBILITY
- If presale OFF: normal public event
- If presale ON: locked behind code until session valid
ADMIN FEATURES
- Create / pause / regenerate codes
- Multiple codes per event
- Full analytics dashboard
- Export users and orders
- Audit logs for all actions
ANALYTICS
- Code usage attempts
- Successful unlocks
- Conversion rate
- Revenue per code
- Failed attempts tracking
AUDIT SYSTEM
- Code creation/modification logs
- Access attempts logs
- Purchase tracking per code
- Admin action logs
SYSTEM INTEGRATION RULE
- No changes to existing event system
- No changes to ticket system
- No changes to payment system
- Only an access + pricing layer added


PRESALE SYSTEM — SPEC GAP CLARIFICATION (FINALIZED RULES)

This document defines missing constraints required before implementation.

1. CODE MODEL (FINAL DECISION REQUIRED BEHAVIOR)
1.1 Access Structure
✔ One Event → Many Codes

Each presale event supports:

multiple independent codes
each code has its own rules and analytics
1.2 Code Types

Each code must support:

Usage Mode (MANDATORY FIELD)
SINGLE-USE (1 successful redemption per user session OR per order — to be defined at implementation level)
MULTI-USE (unlimited until limits reached)
Redemption Limits

Each code may optionally define:

max_total_redemptions
max_redemptions_per_user (optional future extension)
Validity Window

Each code must support:

active_from (optional)
active_until (optional)

If not set:

inherits event presale window
1.3 Code Regeneration Rule (CRITICAL)

When admin regenerates a code:

Option A (STRICT — RECOMMENDED)
old code becomes immediately invalid
all unused sessions remain valid until expiry OR are invalidated immediately (must be explicitly chosen per event)
REQUIRED DECISION:

👉 session invalidation strategy must be defined per event:

immediate revoke OR
keep existing sessions until expiry
2. SESSION / COOKIE MODEL
2.1 Cookie Scope
cookie is scoped per domain
key format must include event identifier to avoid collision

Example logic (conceptual):

presale_session:{event_id}
2.2 SameSite Policy

Recommended default:

SameSite = Lax

Reason:

allows normal navigation from email links
avoids breaking presale entry flows

Strict is NOT recommended for this use case.

2.3 CSRF Strategy

Because cookie is trusted for access:

Required:
any mutation endpoint (checkout, apply discount, purchase) must include CSRF protection OR equivalent token binding

Presale session alone is NOT sufficient security.

2.4 Multi-Event Behavior
Each event has isolated session namespace
no cross-event session leakage allowed
3. DISCOUNT RULE ENGINE
3.1 Discount Types

Each code supports:

percentage discount
fixed amount discount
3.2 Stacking Rules (CRITICAL)

You must define:

Default rule (RECOMMENDED):
Presale discount is NON-stackable

Meaning:

cannot combine with:
promo codes
bundles
other discounts
3.3 Priority Rule

If multiple pricing modifiers exist:

Priority order:

Presale code discount (highest priority)
Event-level promotions
System-wide promotions
3.4 Fixed Amount Rules

Must define:

currency = event currency
rounding rule:
round to nearest cent / smallest currency unit
prevent negative pricing:
final price minimum = 0
4. RATE LIMITING & ABUSE CONTROL
4.1 Scope Levels

Rate limits must apply at:

IP level
per IP address
Code level
per presale code
Event level
global event protection layer
4.2 Recommended Limits (CONFIGURABLE)
invalid code attempts per IP: 5–10 per minute
per code: threshold before temporary lock
exponential backoff after repeated failures
4.3 Response Strategy

To prevent enumeration:

NEVER reveal:
“code exists / does not exist”
Always return:

generic error message:

“Invalid access”

4.4 HTTP Response Strategy
429 → rate limit exceeded
403 → access denied (generic, no details)
avoid exposing validation reason in production mode
5. ANALYTICS & AUDIT MODEL
5.1 Required Event Logs

System must store:

Code Attempt Event
code_id
event_id
timestamp
ip_address
success/failure
failure_reason (internal only)
Session Event
session_created
session_expired
session_invalidated_reason
Purchase Event
order_id
code_id
event_id
revenue
tickets_count
Admin Event
admin_user_id
action_type (create/pause/regenerate/delete)
target_code_id
timestamp
5.2 PII Handling (IMPORTANT)

Exports may include:

user email / phone ONLY if necessary for operations

Must define:

GDPR-like retention rules (optional but recommended)
6. RECAPTCHA STRATEGY
6.1 Version

Must explicitly choose:

reCAPTCHA v2 (recommended for simplicity)
OR
reCAPTCHA v3 (invisible scoring system)
6.2 Scope

Required on:

code submission endpoint ONLY

Optional (if abuse increases):

checkout confirmation
7. AUTHENTICATION MODEL
7.1 Logged-in Users

Presale system must support:

Option A (Anonymous mode)
no user account required
Option B (Authenticated mode)
presale session can be linked to user_id
7.2 Recommended (Hybrid Safe Model)
anonymous access allowed
BUT system optionally attaches:
user_id if logged in

Used for:

analytics accuracy
abuse prevention
customer support tracing
8. FINAL SYSTEM RULE SUMMARY

This presale system must guarantee:

Access Control
multi-code per event
strict session-based unlock
24h cookie validity
Pricing Control
non-stackable discount system
deterministic price calculation
Security
rate limiting per IP/code/event
reCAPTCHA validation
no enumeration leaks
Analytics
full traceability per code
revenue attribution per code
admin audit logging
Session Integrity
isolated per event
no cross-event leakage
optional invalidation on code regeneration
⚠️ KEY TAKEAWAY

These missing rules were not “features” — they are system integrity constraints.

Without them, you risk:

discount abuse
code leaks scaling out of control
inconsistent pricing
unreliable analytics
security bypasses