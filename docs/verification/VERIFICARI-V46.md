# Verificări v46 / 0.4.2

- 35 de teste automate trecute; PostgreSQL/PGlite, RLS și migrări reale.
- Reviziile cresc la adăugare, mutare, ștergere și salvarea responsabililor.
- Reconcilierea stării respinge răspunsuri vechi și acceptă reviziile mai noi.
- Calendarul și clasamentul numără un singur program per piesă, exclud backup, șabloane și viitor, au filtrare și paginare la nivelul bazei.
- Limitele zilei în România, inclusiv schimbarea orei în martie și octombrie, sunt testate.
- Importul gamelor verifică titlu/colecție, ambiguități, minore, alternative, audit și păstrarea editărilor manuale ulterioare.
- UPDATE-V46 este testat inclusiv la reaplicare; INSTALL-NEW este testat separat.
- Build de producție și TypeScript trecute.

Scenarii Chromium cu build de producție și serviciu Supabase simulat:
adăugări consecutive, săgeți, mutare între liste, tragere în listă goală,
moment nou și editat, responsabili de element și de program, print și mobil.
Serviciul de test a furnizat intenționat răspunsuri învechite la randarea paginii
pentru a verifica faptul că acestea nu anulează o salvare deja confirmată.
Au fost forțate 13 răspunsuri vechi; toate schimbările au rămas vizibile.
Au fost verificate și sortarea Cele mai cântate, ultima utilizare din listă,
calendarul pe luni, starea Finalizat și raportul de game. Fără erori JavaScript.

Datele și proiectul Supabase ale utilizatorului nu au fost accesate. Aplicarea
gamelor în baza utilizatorului se face la rularea supabase/updates/UPDATE-V46.sql; raportul din
Colecții arată corespondențele reale după această operație.
