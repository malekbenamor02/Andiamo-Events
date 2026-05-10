-- Backfill `notes.presale` snapshot on existing presale orders.
--
-- The snapshot is what powers the admin "Presale Information" card. New orders
-- created via api/orders-create.js (or server.cjs) write this snapshot at order
-- creation time. This migration retro-fills it for every existing order that has
-- a `presale_code_id` but no `notes.presale` entry yet, so the card renders for
-- historical presale orders too.
--
-- Snapshot fields written:
--   code_id, code_label, discount_type, discount_value,
--   original_subtotal, discounted_subtotal
--
-- Subtotals are derived from order_passes (price * quantity) which capture the
-- actual amount charged. The original subtotal is recovered from the discount:
--   - percent (pct < 100): original = discounted / (1 - pct/100)
--   - fixed:               original = discounted + fixed
--   - percent = 100 / unknown type: fall back to discounted (best-effort)
--
-- Idempotent: re-running this migration is a no-op since the WHERE clause skips
-- orders that already have `notes.presale`.

WITH discounted AS (
  SELECT
    o.id AS order_id,
    COALESCE(
      (SELECT ROUND(SUM(op.price * op.quantity)::numeric, 2)
         FROM public.order_passes op
        WHERE op.order_id = o.id),
      ROUND(
        COALESCE(o.total_price, 0)::numeric - COALESCE(o.fee_amount, 0)::numeric,
        2
      )
    ) AS discounted_subtotal
  FROM public.orders o
  WHERE o.presale_code_id IS NOT NULL
),
to_backfill AS (
  SELECT
    o.id,
    o.presale_code_id,
    pc.label AS code_label,
    pc.discount_type,
    pc.discount_value::numeric AS discount_value,
    d.discounted_subtotal,
    ROUND(
      CASE
        WHEN pc.discount_type = 'percent' AND pc.discount_value::numeric < 100
          THEN d.discounted_subtotal / (1 - pc.discount_value::numeric / 100.0)
        WHEN pc.discount_type = 'fixed'
          THEN d.discounted_subtotal + pc.discount_value::numeric
        ELSE d.discounted_subtotal
      END,
      2
    ) AS original_subtotal
  FROM public.orders o
  JOIN public.presale_codes pc ON pc.id = o.presale_code_id
  JOIN discounted d ON d.order_id = o.id
  WHERE o.presale_code_id IS NOT NULL
    AND d.discounted_subtotal IS NOT NULL
)
UPDATE public.orders o
SET notes = jsonb_set(
  COALESCE(NULLIF(o.notes, '')::jsonb, '{}'::jsonb),
  '{presale}',
  jsonb_build_object(
    'code_id',             t.presale_code_id,
    'code_label',          t.code_label,
    'discount_type',       t.discount_type,
    'discount_value',      t.discount_value,
    'original_subtotal',   t.original_subtotal,
    'discounted_subtotal', t.discounted_subtotal
  ),
  true
)::text
FROM to_backfill t
WHERE o.id = t.id
  AND (
       o.notes IS NULL
    OR o.notes = ''
    OR (NULLIF(o.notes, '')::jsonb -> 'presale') IS NULL
  );

-- Optional verification (run manually):
--   SELECT id, presale_code_id, notes::jsonb -> 'presale' AS presale_snapshot
--     FROM public.orders
--    WHERE presale_code_id IS NOT NULL
--    ORDER BY created_at DESC
--    LIMIT 20;
