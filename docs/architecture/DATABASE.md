# Baza de date

## Surse canonice

- `supabase/migrations/` conține schema în ordine și este folosită de testele PGlite.
- `supabase/updates/` conține actualizările aplicate unei baze existente.
- `supabase/setup/INSTALL-NEW.sql` este pachetul pentru o instalare nouă.
- `supabase/legacy/` este doar referință istorică.

Nu se păstrează copii ale acelorași migrări în rădăcina proiectului. Un fișier SQL din `legacy/` nu se rulează fără verificarea explicită a versiunii bazei.

## Contracte

Funcțiile SQL cu sufix `_vNN` rămân compatibile cu bazele deja instalate. Codul TypeScript trebuie să le încapsuleze în acțiuni/repository-uri cu nume stabile, astfel încât schimbarea unei versiuni SQL să nu se propage în componente.

RLS rămâne activ pentru tabelele aplicației. Operațiile de administrare folosesc verificare de rol, iar cheia `SUPABASE_SERVICE_ROLE_KEY` este permisă numai în procese server controlate și scripturi administrative.

## Modificări viitoare

Pentru o modificare de schemă:

1. se adaugă o migrare nouă, fără rescrierea migrărilor aplicate;
2. se regenerează pachetele cu `npm run sql:package`;
3. se adaugă test de integrare;
4. se documentează exact fișierul din `supabase/updates/` care trebuie rulat.
