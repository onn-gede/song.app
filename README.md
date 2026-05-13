# SongApp Next MVP

Primul MVP pentru aplicația de cântări:

- login cu Supabase Auth
- dashboard cu search mare
- listă completă de cântări
- detaliu cântare
- creare programe / întâlniri
- adăugare cântări în program
- adăugare cântări backup
- adăugare elemente text: rugăciune, îndemn, mesaj, pauză
- evidențiere cântări folosite în ultimele 30 zile
- link public view-only pentru program

## 1. Supabase

În Supabase SQL Editor rulează în ordine:

```sql
supabase/001_init_schema.sql
supabase/002_seed_core_data.sql
supabase/003_make_first_admin.sql
samples/004_seed_tineret_from_pptx.sql
supabase/005_app_helper_functions.sql
```

Dacă ai rulat deja primele 3, rulează acum doar:

```sql
samples/004_seed_tineret_from_pptx.sql
supabase/005_app_helper_functions.sql
```

Userul tău trebuie să existe în `Authentication > Users`, iar în `public.profiles` trebuie să ai `role = admin` și `is_active = true`.

Verificare:

```sql
select email, role, is_active from public.profiles;
select count(*) from public.songs;
select * from public.search_songs('Isus', 10);
```

## 2. Variabile de mediu

Copiază fișierul `.env.example` în `.env.local`:

```bash
copy .env.example .env.local
```

Completează:

```env
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon_key_din_Supabase
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Le găsești în Supabase:

```txt
Project Settings > API
```

## 3. Pornire locală

```bash
npm install
npm run dev
```

Apoi deschide:

```txt
http://localhost:3000
```

## 4. Test rapid

1. Intră cu email/parolă.
2. Caută `Isus` în dashboard.
3. Deschide o cântare.
4. Apasă `Adaugă în program`.
5. Creează un program nou.
6. Intră la `Programe / întâlniri`.
7. Deschide programul.
8. Adaugă o cântare normală și una backup.
9. Adaugă un element text de tip rugăciune/îndemn.
10. Generează link public.

## 5. Observații

Acesta este MVP-ul de lucru. Nu include încă:

- editare completă cântări
- drag & drop pentru reordonarea programului
- import din interfață
- categorii editabile în UI
- generare automată de versete
- management useri din UI

Acestea intră în sprinturile următoare.
