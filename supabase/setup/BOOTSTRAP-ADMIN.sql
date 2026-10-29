-- NUMAI dacă nu există deja un admin activ. Creează întâi contul în Supabase Auth.
-- Înlocuiește adresa de mai jos. Nu rula automat la fiecare actualizare.
do $$ declare v_email text:='CHANGE_ME@example.org';v_id uuid; begin
 if v_email='CHANGE_ME@example.org' then raise exception 'Completează emailul contului tău.'; end if;
 select id into v_id from auth.users where lower(email)=lower(v_email);
 if v_id is null then raise exception 'Creează întâi contul în Supabase Authentication.'; end if;
 if exists(select 1 from public.profiles where role='admin' and is_active) then raise exception 'Există deja un admin activ. Gestionează conturile din aplicație.'; end if;
 insert into public.profiles(id,email,role,is_active) values(v_id,v_email,'admin',true) on conflict(id) do update set role='admin',is_active=true;
end $$;
