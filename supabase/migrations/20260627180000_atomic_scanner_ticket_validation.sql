-- Atomic scanner ticket validation: prevents duplicate valid scans under concurrency.
-- Callable only by service_role (backend API).

CREATE UNIQUE INDEX IF NOT EXISTS scans_one_valid_per_qr_ticket_idx
  ON public.scans (qr_ticket_id)
  WHERE scan_result = 'valid' AND qr_ticket_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_scanner_ticket_atomic(
  p_secure_token text,
  p_event_id uuid,
  p_scanner_id uuid,
  p_scan_location text DEFAULT NULL,
  p_device_info text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.qr_tickets%ROWTYPE;
  v_prev_scan public.scans%ROWTYPE;
  v_prev_scanner_name text;
  v_scan_time timestamptz := now();
  v_ticket_json jsonb;
BEGIN
  IF p_secure_token IS NULL OR btrim(p_secure_token) = '' THEN
    RETURN jsonb_build_object(
      'result', 'error',
      'success', false,
      'message', 'secure_token required'
    );
  END IF;

  SELECT * INTO v_ticket
  FROM public.qr_tickets
  WHERE secure_token = p_secure_token
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.scans (
      event_id, scanner_id, scan_result, scan_location, device_info, notes, scan_time
    ) VALUES (
      p_event_id, p_scanner_id, 'invalid', p_scan_location, p_device_info, 'Token not found', v_scan_time
    );
    RETURN jsonb_build_object(
      'result', 'not_found',
      'success', false,
      'message', 'Ticket not found'
    );
  END IF;

  v_ticket_json := jsonb_build_object(
    'id', v_ticket.id,
    'event_id', v_ticket.event_id,
    'event_name', v_ticket.event_name,
    'event_date', v_ticket.event_date,
    'event_venue', v_ticket.event_venue,
    'source', v_ticket.source,
    'invitation_id', v_ticket.invitation_id,
    'pass_type', v_ticket.pass_type,
    'buyer_name', v_ticket.buyer_name,
    'buyer_phone', v_ticket.buyer_phone,
    'buyer_email', v_ticket.buyer_email,
    'ambassador_id', v_ticket.ambassador_id,
    'ambassador_name', v_ticket.ambassador_name,
    'ticket_status', v_ticket.ticket_status
  );

  IF v_ticket.event_id IS NOT NULL AND v_ticket.event_id <> p_event_id THEN
    INSERT INTO public.scans (
      event_id, scanner_id, qr_ticket_id, scan_result, scan_location, device_info,
      ambassador_id, notes, scan_time
    ) VALUES (
      p_event_id, p_scanner_id, v_ticket.id, 'wrong_event', p_scan_location, p_device_info,
      v_ticket.ambassador_id, 'Wrong event', v_scan_time
    );
    RETURN jsonb_build_object(
      'result', 'wrong_event',
      'success', false,
      'message', 'This ticket is for a different event',
      'ticket', v_ticket_json,
      'correct_event', jsonb_build_object(
        'event_id', v_ticket.event_id,
        'event_name', v_ticket.event_name,
        'event_date', v_ticket.event_date
      )
    );
  END IF;

  SELECT s.* INTO v_prev_scan
  FROM public.scans s
  WHERE s.qr_ticket_id = v_ticket.id AND s.scan_result = 'valid'
  ORDER BY s.scan_time ASC
  LIMIT 1;

  IF v_ticket.ticket_status = 'USED' OR FOUND THEN
    v_prev_scanner_name := 'Unknown';
    IF v_prev_scan.scanner_id IS NOT NULL THEN
      SELECT name INTO v_prev_scanner_name FROM public.scanners WHERE id = v_prev_scan.scanner_id;
      IF v_prev_scanner_name IS NULL THEN
        v_prev_scanner_name := 'Unknown';
      END IF;
    END IF;

    INSERT INTO public.scans (
      event_id, scanner_id, qr_ticket_id, scan_result, scan_location, device_info,
      ambassador_id, notes, scan_time
    ) VALUES (
      p_event_id, p_scanner_id, v_ticket.id, 'already_scanned', p_scan_location, p_device_info,
      v_ticket.ambassador_id, 'Duplicate', v_scan_time
    );

    RETURN jsonb_build_object(
      'result', 'already_used',
      'success', false,
      'message', 'Ticket already scanned',
      'ticket', v_ticket_json,
      'previous_scan', jsonb_build_object(
        'scanned_at', COALESCE(v_prev_scan.scan_time, v_scan_time),
        'scanner_name', v_prev_scanner_name
      )
    );
  END IF;

  UPDATE public.qr_tickets
  SET ticket_status = 'USED', updated_at = v_scan_time
  WHERE id = v_ticket.id AND ticket_status = 'VALID';

  IF NOT FOUND THEN
    SELECT s.* INTO v_prev_scan
    FROM public.scans s
    WHERE s.qr_ticket_id = v_ticket.id AND s.scan_result = 'valid'
    ORDER BY s.scan_time ASC
    LIMIT 1;

    v_prev_scanner_name := 'Unknown';
    IF v_prev_scan.scanner_id IS NOT NULL THEN
      SELECT name INTO v_prev_scanner_name FROM public.scanners WHERE id = v_prev_scan.scanner_id;
      IF v_prev_scanner_name IS NULL THEN
        v_prev_scanner_name := 'Unknown';
      END IF;
    END IF;

    INSERT INTO public.scans (
      event_id, scanner_id, qr_ticket_id, scan_result, scan_location, device_info,
      ambassador_id, notes, scan_time
    ) VALUES (
      p_event_id, p_scanner_id, v_ticket.id, 'already_scanned', p_scan_location, p_device_info,
      v_ticket.ambassador_id, 'Duplicate', v_scan_time
    );

    RETURN jsonb_build_object(
      'result', 'already_used',
      'success', false,
      'message', 'Ticket already scanned',
      'ticket', v_ticket_json,
      'previous_scan', jsonb_build_object(
        'scanned_at', COALESCE(v_prev_scan.scan_time, v_scan_time),
        'scanner_name', v_prev_scanner_name
      )
    );
  END IF;

  INSERT INTO public.scans (
    event_id, scanner_id, qr_ticket_id, scan_result, scan_location, device_info,
    ambassador_id, notes, scan_time
  ) VALUES (
    p_event_id, p_scanner_id, v_ticket.id, 'valid', p_scan_location, p_device_info,
    v_ticket.ambassador_id, 'Valid', v_scan_time
  )
  RETURNING scan_time INTO v_scan_time;

  RETURN jsonb_build_object(
    'result', 'valid',
    'success', true,
    'message', 'Ticket validated',
    'ticket', v_ticket_json,
    'scan_time', v_scan_time
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_scanner_ticket_atomic(text, uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_scanner_ticket_atomic(text, uuid, uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.validate_scanner_ticket_atomic(text, uuid, uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.validate_scanner_ticket_atomic(text, uuid, uuid, text, text) TO service_role;

COMMENT ON FUNCTION public.validate_scanner_ticket_atomic IS
  'Atomically validates a QR ticket for scanner flow. Service role only. Row-locks ticket to prevent double-scan races.';
