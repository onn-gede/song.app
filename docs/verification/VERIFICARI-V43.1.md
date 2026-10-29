# Verificări v43.1 — performanță

- Jurnalul utilizatorului arată rulare în modul `next dev` și compilări ale
  paginilor la accesare, inclusiv 11,5 secunde pentru compilarea Colecțiilor.
- Adăugată pornirea cu `npm run local` / PORNESTE-APLICATIA.cmd în modul production.
- Compilare numai dacă lipsesc rezultatele buildului sau sunt mai vechi decât
  sursele, configurația și fișierele de mediu.
- Eliminat efectul care solicita automat istoricul la montarea căutării.
- Dashboardul reutilizează datele deja încărcate; biblioteca solicită istoricul
  doar pentru cântările găsite, în acțiunea de căutare.
- Profilul și clientul Supabase sunt reutilizate în cadrul aceleiași cereri,
  fără cache global de identitate și fără eliminarea verificării accesului.
- Instrumentele de sincronizare vechi, dacă sunt reactivate explicit, nu mai
  interoghează periodic când nu există o rulare activă sau fila este ascunsă.

Validare: verificarea TypeScript, build de producție și 27 teste de regresie trecute.
Consumul efectiv de CPU/RAM pe laptopul utilizatorului trebuie comparat după
pornirea în modul production. Nu au fost măsurate resursele acelui laptop.

Nu este necesară o migrare SQL nouă.
