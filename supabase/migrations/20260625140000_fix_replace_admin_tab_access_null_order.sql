-- Fix replace_admin_tab_access: jsonb null mobile_order must not be cast via integer record column.

CREATE OR REPLACE FUNCTION public.replace_admin_tab_access(
  p_admin_id uuid,
  p_rows jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.admin_tab_access WHERE admin_id = p_admin_id;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.admin_tab_access (admin_id, tab_key, show_in_mobile, mobile_order)
  SELECT
    p_admin_id,
    r.tab_key,
    COALESCE(r.show_in_mobile, false),
    CASE
      WHEN r.mobile_order IS NULL OR btrim(r.mobile_order) = '' OR lower(btrim(r.mobile_order)) = 'null' THEN NULL
      ELSE r.mobile_order::integer
    END
  FROM jsonb_to_recordset(p_rows) AS r(
    tab_key text,
    show_in_mobile boolean,
    mobile_order text
  );
END;
$$;
