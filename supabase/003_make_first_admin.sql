-- Dupa ce creezi primul user in Supabase Auth, ruleaza acest script.
-- Inlocuieste adresa de email cu emailul tau.

insert into public.profiles (id, full_name, email, role, is_active)
select id, coalesce(raw_user_meta_data->>'full_name', email), email, 'admin', true
from auth.users
where email = 'filippaunovici@gmail.com'
on conflict (id) do update set
  role = 'admin',
  is_active = true,
  email = excluded.email,
  full_name = excluded.full_name;
