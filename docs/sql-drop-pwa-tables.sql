-- ============================================================
-- Run this in Supabase Dashboard → SQL Editor to drop PWA tables
-- ============================================================
-- This removes only the PWA-related table: app_install_prompt_config
-- (used for the "Install the app" banner text and frequency).
-- fcm_tokens is kept for admin push notifications.
-- ============================================================

DROP POLICY IF EXISTS "app_install_prompt_config_no_client" ON app_install_prompt_config;
DROP TABLE IF EXISTS app_install_prompt_config;
