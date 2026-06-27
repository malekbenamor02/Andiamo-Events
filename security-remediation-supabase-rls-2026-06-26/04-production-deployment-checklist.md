# Production deployment checklist

**STOP:** Do not apply SQL to production until you explicitly approve after reviewing this branch and local validation.

## Pre-deploy

- [ ] Confirm Supabase backup / PITR window documented in dashboard
- [ ] Review migration `20260627120000_fix_critical_rls_exposure.sql`
- [ ] Verify Vercel production has `SUPABASE_SERVICE_ROLE_KEY` (required)
- [ ] Verify `JWT_SECRET` is set (not fallback)
- [ ] Merge/deploy **backend + frontend** before or with migration (API must use service role)

## Apply migration (after approval only)

```bash
supabase link --project-ref ykeryyraxmtjunnotoep
supabase db push
```

Or approved MCP `apply_migration` with same SQL file.

## Post-deploy

- [ ] Deploy Vercel (API + frontend)
- [ ] Run `npm run security:rls` against **production** URL/anon key (read-only)
- [ ] Run `verification.sql` in Supabase SQL editor
- [ ] Smoke: public site, checkout, admin login, dashboard tabs
- [ ] Smoke: ambassador login, scanner
- [ ] Force admin password reset for all admins
- [ ] Rotate `JWT_SECRET` (invalidate sessions)
- [ ] Optional: rotate `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Monitor Supabase API logs 48h for 401/503 spikes

## Rollback

1. Revert Vercel deployment to previous release.
2. **Do not** restore open RLS policies except emergency — prefer forward fix.

## Approval gate

| Approved by | Date | Migration applied |
|-------------|------|-------------------|
| _Pending_ | | No |
