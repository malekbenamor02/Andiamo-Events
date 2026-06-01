-- Marketing email tick: every 2 minutes (~3000 recipients in ~4h with batch 25, no inter-email delay).
-- Invokes Edge Function marketing-email-tick → MARKETING_CRON_URL on Vercel.
SELECT cron.alter_job(
  (
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'marketing_email_tick_every_15_min'
    LIMIT 1
  ),
  schedule := '*/2 * * * *'
);
