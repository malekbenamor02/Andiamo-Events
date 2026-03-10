-- Add dedicated fee columns to orders for online payments
-- fee_amount: 5% fee amount for online card payments
-- total_with_fees: final charge amount (subtotal + fee)

alter table public.orders
  add column if not exists fee_amount numeric(12,3),
  add column if not exists total_with_fees numeric(12,3);

-- Backfill existing online orders where possible
do $$
declare
  rec record;
  v_notes jsonb;
  v_payment_fees jsonb;
  v_subtotal numeric;
  v_fee_amount numeric;
  v_total_with_fees numeric;
begin
  for rec in
    select o.id,
           o.payment_method,
           o.total_price,
           o.notes,
           o.fee_amount,
           o.total_with_fees
      from public.orders o
     where (o.payment_method = 'online' or o.source = 'platform_online')
       and (o.fee_amount is null or o.total_with_fees is null)
  loop
    v_notes := null;
    v_payment_fees := null;
    v_subtotal := null;
    v_fee_amount := null;
    v_total_with_fees := null;

    -- Try to pull from notes.payment_fees JSON if present
    begin
      v_notes := case
        when jsonb_typeof(rec.notes) = 'object' then rec.notes::jsonb
        when rec.notes is not null then rec.notes::jsonb
        else null
      end;
    exception
      when others then
        v_notes := null;
    end;

    if v_notes is not null and v_notes ? 'payment_fees' then
      v_payment_fees := v_notes -> 'payment_fees';
      if v_payment_fees ? 'subtotal' then
        v_subtotal := (v_payment_fees ->> 'subtotal')::numeric;
      end if;
      if v_payment_fees ? 'fee_amount' then
        v_fee_amount := (v_payment_fees ->> 'fee_amount')::numeric;
      end if;
      if v_payment_fees ? 'total_with_fees' then
        v_total_with_fees := (v_payment_fees ->> 'total_with_fees')::numeric;
      end if;
    end if;

    -- If we still don't have values, recompute from order_passes
    if v_subtotal is null or v_fee_amount is null or v_total_with_fees is null then
      select
        coalesce(sum(op.price * op.quantity), 0)
      into v_subtotal
      from public.order_passes op
      where op.order_id = rec.id;

      if v_subtotal is not null and v_subtotal > 0 then
        v_fee_amount := round(v_subtotal * 0.05, 3);
        v_total_with_fees := v_subtotal + v_fee_amount;
      end if;
    end if;

    -- Fallback: if still missing but total_price is present, assume it is already fee-inclusive
    if v_total_with_fees is null and rec.total_price is not null then
      v_total_with_fees := rec.total_price;
      if v_subtotal is null then
        -- derive a subtotal that would produce this total with 5% fee
        v_subtotal := round(v_total_with_fees / 1.05, 3);
      end if;
      if v_fee_amount is null and v_subtotal is not null then
        v_fee_amount := v_total_with_fees - v_subtotal;
      end if;
    end if;

    -- Apply updates when we have at least total_with_fees
    if v_total_with_fees is not null then
      update public.orders
         set fee_amount = coalesce(v_fee_amount, fee_amount),
             total_with_fees = coalesce(v_total_with_fees, total_with_fees),
             -- keep total_price in sync for online orders
             total_price = coalesce(v_total_with_fees, total_price)
       where id = rec.id;
    end if;
  end loop;
end
$$;

