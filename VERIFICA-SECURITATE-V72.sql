-- Diagnostic numai citire. Rulează în Supabase SQL Editor ca administrator.
-- Nu modifică date, politici sau permisiuni. Nu exportă parole/chei/date personale.
-- Listele trebuie interpretate: unele RPC-uri sunt intenționat publice.
select c.relname as tabela,c.relrowsecurity as rls_activ,
 has_table_privilege('anon',c.oid,'SELECT') as anon_select,
 has_table_privilege('anon',c.oid,'INSERT') as anon_insert,
 has_table_privilege('anon',c.oid,'UPDATE') as anon_update,
 has_table_privilege('anon',c.oid,'DELETE') as anon_delete
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' order by c.relname;

select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where schemaname in ('public','storage') order by schemaname,tablename,policyname;

select p.oid::regprocedure::text as functie,p.prosecdef as security_definer,
 p.proconfig as configuratie,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef order by 1;

select id,name,public,file_size_limit,allowed_mime_types from storage.buckets order by name;
