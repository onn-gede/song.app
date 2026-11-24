# Verificări v45 / 0.4.1

## Automate

- `npm test`: 30 de teste trecute, inclusiv PostgreSQL/PGlite cu migrările și RLS.
- Adăugări repetate, reordonare sus/jos, transfer principal ↔ backup și plasare într-o listă goală.
- Validare atomică: o destinație invalidă nu lasă poziții sau grupe parțial modificate.
- Adăugarea unei cântări și a unui moment după mutări nu produce conflicte de poziție.
- Utilizatorii viewer, inactivi și anonimi nu pot muta elementele interne.
- Responsabilii programului se păstrează la duplicare și sunt incluși în datele linkului public.
- UPDATE-V45 poate fi reaplicat; pachetul de instalare nouă execută migrările.
- Build Next.js de producție și TypeScript: trecute.

## Interfață și print

Scenarii în Chromium, cu build de producție și serviciu Supabase simulat cu date de test:

- Două adăugări consecutive, săgeți, transfer în ambele sensuri fără reîncărcare manuală.
- Tragere reală cu mouse-ul de mâner în backup gol, apoi înaintea unei cântări din principal.
- Adăugare și editare moment; salvare responsabil pe element; actualizare imediată.
- Salvare principal + doi secundari și verificarea păstrării la reîncărcare.
- Verificare desktop și mobil de 390 px, fără depășire orizontală.
- Prima apăsare Print/PDF folosește documentul A4 separat, fără navigare sau formulare.
- PDF generat și inspectat vizual; titlu, dată, echipă și ordinea programului lizibile.
- Print public verificat separat; program lung (43 de elemente) generat pe două pagini A4 și inspectat.

Nu au fost accesate datele sau proiectul Supabase al utilizatorului. Actualizarea
UPDATE-V45.sql trebuie aplicată în proiectul existent înainte de folosirea funcțiilor noi.
