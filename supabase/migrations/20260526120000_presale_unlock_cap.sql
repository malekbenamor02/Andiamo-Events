-- Per-code max unlock (code-entry) cap + atomic claim/release for concurrency safety

ALTER TABLE public.presale_codes
  ADD COLUMN IF NOT EXISTS max_total_unlocks integer NULL
    CHECK (max_total_unlocks IS NULL OR max_total_unlocks > 0);

COMMENT ON COLUMN public.presale_codes.max_total_unlocks IS
  'Optional cap on successful presale unlocks (code entries). NULL = unlimited. Uses redemption_count.';

COMMENT ON COLUMN public.presale_codes.redemption_count IS
  'Successful presale unlocks (valid code entered, session created). Enforced via presale_claim_unlock_slot.';

CREATE OR REPLACE FUNCTION public.presale_claim_unlock_slot(p_event_id uuid, p_presale_code_id uuid)
RETURNS SETOF public.presale_codes
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH updated AS (
    UPDATE public.presale_codes c
    SET
      redemption_count = c.redemption_count + 1,
      updated_at = now()
    WHERE c.id = p_presale_code_id
      AND c.event_id = p_event_id
      AND c.revoked_at IS NULL
      AND c.paused_at IS NULL
      AND (c.active_from IS NULL OR c.active_from <= now())
      AND (c.active_until IS NULL OR c.active_until >= now())
      AND (
        c.max_total_unlocks IS NULL
        OR c.redemption_count < c.max_total_unlocks
      )
    RETURNING c.*
  )
  SELECT * FROM updated;
$function$;

COMMENT ON FUNCTION public.presale_claim_unlock_slot(uuid, uuid) IS
  'Atomically increments redemption_count when unlock cap allows; returns 0 rows if exhausted.';

CREATE OR REPLACE FUNCTION public.presale_release_unlock_slot(p_presale_code_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  UPDATE public.presale_codes
  SET
    redemption_count = GREATEST(0, redemption_count - 1),
    updated_at = now()
  WHERE id = p_presale_code_id;
$function$;

COMMENT ON FUNCTION public.presale_release_unlock_slot(uuid) IS
  'Rolls back one redemption_count after a failed session create following presale_claim_unlock_slot.';
