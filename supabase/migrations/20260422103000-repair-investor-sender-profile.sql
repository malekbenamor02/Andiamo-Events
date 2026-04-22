-- Align sender_profile with institutional template (older rows could have sender_profile = default)
UPDATE public.marketing_campaigns
SET sender_profile = 'investor'
WHERE type = 'email'
  AND email_template = 'investor_vanguard'
  AND sender_profile IS DISTINCT FROM 'investor';
