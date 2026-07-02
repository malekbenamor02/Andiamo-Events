-- Extend atomic reassignment RPC core audit details with notify_customer flag.

CREATE OR REPLACE FUNCTION public.admin_reassign_ambassador_order_atomic(
  p_order_id uuid,
  p_expected_ambassador_id uuid,
  p_new_ambassador_id uuid,
  p_admin_id uuid,
  p_old_ambassador_name text DEFAULT NULL,
  p_new_ambassador_name text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_notify_ambassador boolean DEFAULT true,
  p_admin_name text DEFAULT NULL,
  p_admin_email text DEFAULT NULL,
  p_notify_customer boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_order public.orders%ROWTYPE;
  v_log_id uuid;
  v_log_created_at timestamptz;
  v_trimmed_reason text;
  v_details jsonb;
  v_updated public.orders%ROWTYPE;
  v_notify_ambassador boolean := COALESCE(p_notify_ambassador, true);
  v_notify_customer boolean := COALESCE(p_notify_customer, true);
BEGIN
  IF p_order_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid', 'error', 'order_id required');
  END IF;
  IF p_expected_ambassador_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid', 'error', 'expected_ambassador_id required');
  END IF;
  IF p_new_ambassador_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid', 'error', 'new_ambassador_id required');
  END IF;
  IF p_new_ambassador_id = p_expected_ambassador_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid', 'error', 'Cannot reassign to the same ambassador');
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found', 'error', 'Order not found');
  END IF;

  IF v_order.payment_method IS DISTINCT FROM 'ambassador_cash'
     OR v_order.source NOT IN ('platform_cod', 'ambassador_manual') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'invalid',
      'error', 'Only ambassador cash orders can be reassigned'
    );
  END IF;

  IF v_order.status NOT IN ('PENDING_CASH', 'PENDING_ADMIN_APPROVAL') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'invalid',
      'error', 'Order cannot be reassigned in its current status'
    );
  END IF;

  IF v_order.ambassador_id IS DISTINCT FROM p_expected_ambassador_id THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'conflict',
      'error', 'Order changed while reassignment was in progress. Refresh and try again.'
    );
  END IF;

  v_trimmed_reason := NULLIF(left(btrim(COALESCE(p_reason, '')), 500), '');

  v_details := jsonb_strip_nulls(jsonb_build_object(
    'old_ambassador_id', p_expected_ambassador_id,
    'old_ambassador_name', NULLIF(btrim(COALESCE(p_old_ambassador_name, '')), ''),
    'new_ambassador_id', p_new_ambassador_id,
    'new_ambassador_name', NULLIF(btrim(COALESCE(p_new_ambassador_name, '')), ''),
    'event_id', v_order.event_id,
    'order_number', v_order.order_number,
    'reason', v_trimmed_reason,
    'notify_ambassador', v_notify_ambassador,
    'notify_customer', v_notify_customer,
    'notification_status', CASE
      WHEN v_notify_ambassador OR v_notify_customer THEN 'pending'
      ELSE 'skipped'
    END,
    'admin_name', NULLIF(btrim(COALESCE(p_admin_name, '')), ''),
    'admin_email', NULLIF(btrim(COALESCE(p_admin_email, '')), '')
  ));

  UPDATE public.orders
  SET
    ambassador_id = p_new_ambassador_id,
    assigned_at = v_now,
    updated_at = v_now
  WHERE id = p_order_id
    AND ambassador_id = p_expected_ambassador_id
    AND status IN ('PENDING_CASH', 'PENDING_ADMIN_APPROVAL')
    AND payment_method = 'ambassador_cash'
    AND source IN ('platform_cod', 'ambassador_manual')
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'conflict',
      'error', 'Order changed while reassignment was in progress. Refresh and try again.'
    );
  END IF;

  INSERT INTO public.order_logs (
    order_id,
    action,
    performed_by,
    performed_by_type,
    details,
    created_at
  )
  VALUES (
    p_order_id,
    'admin_reassigned',
    p_admin_id,
    'admin',
    v_details,
    v_now
  )
  RETURNING id, created_at INTO v_log_id, v_log_created_at;

  RETURN jsonb_build_object(
    'ok', true,
    'order', jsonb_build_object(
      'id', v_updated.id,
      'ambassador_id', v_updated.ambassador_id,
      'status', v_updated.status,
      'updated_at', v_updated.updated_at,
      'event_id', v_updated.event_id,
      'order_number', v_updated.order_number
    ),
    'audit_log', jsonb_build_object(
      'id', v_log_id,
      'action', 'admin_reassigned',
      'created_at', v_log_created_at,
      'details', v_details
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reassign_ambassador_order_atomic(
  uuid, uuid, uuid, uuid, text, text, text, boolean, text, text, boolean
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_reassign_ambassador_order_atomic(
  uuid, uuid, uuid, uuid, text, text, text, boolean, text, text, boolean
) FROM anon;
REVOKE ALL ON FUNCTION public.admin_reassign_ambassador_order_atomic(
  uuid, uuid, uuid, uuid, text, text, text, boolean, text, text, boolean
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reassign_ambassador_order_atomic(
  uuid, uuid, uuid, uuid, text, text, text, boolean, text, text, boolean
) TO service_role;
