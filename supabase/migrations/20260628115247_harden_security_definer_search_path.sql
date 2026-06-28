-- Fix SECURITY DEFINER search_path on ticket fulfillment / scanner RPCs (F-007).
-- Preserves SECURITY DEFINER, owner, grants, and function bodies.
-- Idempotent: safe to re-run.

ALTER FUNCTION public.insert_fulfillment_tickets_locked(uuid, jsonb)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.validate_scanner_ticket_atomic(text, uuid, uuid, text, text)
  SET search_path = public, pg_catalog;
