-- Concurrency-safe ticket fulfillment: deterministic slot per order_pass + advisory lock RPC.
-- pass_sequence is 0-based index within order_pass.quantity (NULL on legacy rows).

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS pass_sequence INTEGER;

COMMENT ON COLUMN public.tickets.pass_sequence IS
  '0-based slot index within order_pass.quantity. UNIQUE with order_pass_id prevents duplicate tickets under concurrent confirm.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_order_pass_pass_sequence
  ON public.tickets (order_pass_id, pass_sequence)
  WHERE pass_sequence IS NOT NULL;

CREATE OR REPLACE FUNCTION public.insert_fulfillment_tickets_locked(
  p_order_id uuid,
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
  v_inserted int := 0;
  v_skipped int := 0;
  v_id uuid;
  v_order_pass_id uuid;
  v_pass_sequence int;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_id required');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_order_id::text));

  IF NOT EXISTS (
    SELECT 1 FROM public.orders WHERE id = p_order_id AND status = 'PAID'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order not PAID');
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb))
  LOOP
    v_order_pass_id := NULLIF(v_row->>'order_pass_id', 'null')::uuid;
    v_pass_sequence := NULLIF(v_row->>'pass_sequence', 'null')::int;

    IF v_order_pass_id IS NULL OR v_pass_sequence IS NULL OR v_pass_sequence < 0 THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.order_passes op
      WHERE op.id = v_order_pass_id
        AND op.order_id = p_order_id
        AND v_pass_sequence < GREATEST(op.quantity, 0)
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.tickets (
      order_id,
      order_pass_id,
      pass_sequence,
      secure_token,
      qr_code_url,
      status,
      generated_at
    )
    VALUES (
      p_order_id,
      v_order_pass_id,
      v_pass_sequence,
      v_row->>'secure_token',
      v_row->>'qr_code_url',
      COALESCE(v_row->>'status', 'GENERATED'),
      COALESCE((v_row->>'generated_at')::timestamptz, now())
    )
    ON CONFLICT (order_pass_id, pass_sequence)
    WHERE pass_sequence IS NOT NULL
    DO NOTHING
    RETURNING id INTO v_id;

    IF v_id IS NOT NULL THEN
      v_inserted := v_inserted + 1;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'inserted', v_inserted,
    'skipped', v_skipped
  );
END;
$$;

REVOKE ALL ON FUNCTION public.insert_fulfillment_tickets_locked(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.insert_fulfillment_tickets_locked(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.insert_fulfillment_tickets_locked(uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.insert_fulfillment_tickets_locked(uuid, jsonb) TO service_role;
