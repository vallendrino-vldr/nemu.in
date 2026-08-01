-- ════════════════════════════════════════════════════════════════════
-- ONE-TIME: promote yourself to God Mode.
--
-- Run this AFTER you have signed in with Google at least once, so the
-- profile row actually exists. Replace the email, run it, done.
--
-- Deliberately not automated: an env var that grants platform ownership
-- is a backdoor waiting to be misconfigured.
-- ════════════════════════════════════════════════════════════════════

update public.profiles
   set role = 'super_admin'
 where lower(email) = lower('ganti@email-kamu.com');

-- Sanity check — should print exactly one row with role = super_admin.
select id, email, role, credits from public.profiles where role = 'super_admin';
