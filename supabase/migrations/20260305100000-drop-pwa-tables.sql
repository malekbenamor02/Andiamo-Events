-- Drop PWA-only table: install prompt config (banner text/frequency for "Add to Home Screen").
-- Run this in the Supabase SQL Editor to remove the table and its RLS policy.

DROP POLICY IF EXISTS "app_install_prompt_config_no_client" ON app_install_prompt_config;
DROP TABLE IF EXISTS app_install_prompt_config;
