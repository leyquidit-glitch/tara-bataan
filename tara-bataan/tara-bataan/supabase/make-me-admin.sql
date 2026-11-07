-- Run this AFTER you have logged in to your site once with your own email.
-- Replace the email below with the one you used, then Run.
update public.profiles
set role = 'admin'
where email = 'YOUR-EMAIL@example.com';

-- Check it worked (should show your email with role = admin):
select email, role from public.profiles where role = 'admin';
