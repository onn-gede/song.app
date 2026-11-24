# SongApp v65 / 0.11.0 — programe, vizitatori și versuri

## Instalare peste v64
1. Oprește aplicația locală cu Ctrl+C.
2. Extrage acest ZIP peste D:\Apps\song.app, cu înlocuire. Păstrează .env.local și local-assets.
3. În SQL Editor din proiectul Supabase EXISTENT rulează supabase/updates/UPDATE-V65.sql. Nu rulezi INSTALL-NEW.sql și nu reimporți cântările.
4. PowerShell:
   Set-Location "D:\Apps\song.app"
   npm ci
   npm run build
   Numai după build reușit:
   npm run local

Pachetul este o actualizare peste v64, nu o instalare completă. Nu face push sau deploy automat. Nu schimbă hostingul.

## Toate cele nouă cerințe
1. Conturi și roluri: numai administratorii activi pot intra în administrare și pot crea/aproba/modifica/respinge conturi. Protecția există în pagini, acțiunile serverului, RPC-uri și politicile de scriere ale profilelor. Editorii și coordonatorii nu pot promova utilizatori nici prin cereri directe. Utilizatorul își poate schimba în continuare propria parolă. Vezi și setarea Supabase de mai jos pentru blocarea înscrierilor directe în serviciul Auth.
2. Cântate recent: Acasă → Elimină din recente → selectezi folosirile greșite → Confirmă excluderea. Excluderea afectează statisticile, filtrele de popularitate/recență și avertizările din căutare. Cântarea și programul nu se șterg. În pagina cântării, calendarul marchează folosirea «Exclus din statistici» și permite «Restabilește». Corecțiile sunt logate și incluse în backup.
3. Momente: titlul, numărul de ordine și observațiile folosesc culoarea aleasă pentru acel moment.
4. Vizitatori: pagina principală duce utilizatorul fără cont la /vizitator, unde poate deschide următorul program deja publicat. Apare și în pagina de autentificare. Se folosesc numai linkuri active, neexpirate, pentru programe viitoare sau în cele două ore de desfășurare; șabloanele și programele arhivate nu apar. Un program nepublicat nu devine public automat. La vizitarea programului, permisiunile linkului sunt verificate din nou.
5. Print: include echipa, ordinea, tonalitatea selectată în program, numărul și colecția aleasă, strofele, structura, BPM, cântarea în comun, solistul, observațiile, momentele și rezerva. Funcționează în pagina administrată și în programul public, inclusiv când utilizatorul autentificat vede editorul public.
6. Mutare sus/jos și între principal/backup: ordinea se afișează imediat; salvarea folosește o cerere JSON cu o singură operațiune RPC, fără să aștepte rerandarea întregii pagini. La eșec, rândurile revin la ordinea confirmată și apare o eroare. Mutările simultane din același panou sunt blocate până la confirmare.
7. Programele echipei: «Urmează / în curs» este primul tab și filtrul implicit. «Toate programele» este următorul. Programele viitoare se cer separat din bază, nu sunt ascunse în spatele celor mai recente 200 de programe trecute.
8. Program public/live: folosește același component de rând ca editorul; păstrează fontul, culorile colecției, numărul, marcajul roșu «Cântare în comun» și culoarea momentelor. Vizitatorii nu primesc butoane de editare. Prezentarea cu slide-uri primește și ea colecția, numărul și marcajul de cântare în comun; dimensiunea mare a versurilor rămâne potrivită pentru proiectare.
9. Primul vers Tineri: importatorul nu mai elimină un vers doar pentru că este egal cu titlul. Pentru datele deja importate există Administrare → Repară primul vers · Tineri, cu preview și selecție în masă. Nu se ghicește automat că orice titlu este un vers. Procedura de mai jos repară efectiv cântările selectate în baza ta.

## Repararea cântărilor Tineri existente
- Autentificare ca administrator → Administrare → Repară primul vers · Tineri.
- Deschide «Vezi prima strofă înainte / după» și verifică propunerile.
- Selectează individual sau «Selectează toate». Deselectează cântecele la care titlul nu este primul vers.
- Bifează confirmarea și apasă «Repară cântările selectate».
- Se adaugă titlul la începutul primei strofe. Restul strofelor/refrenelor se păstrează și lyrics_text este sincronizat cu secțiunile. Sunt păstrate versiunile anterioare.
- «Anulează reparația» permite revenirea, dacă între timp nu s-au editat versurile. O modificare manuală ulterioară este protejată și nu se suprascrie.
- Lipsa versurilor sau existența deja a liniei-titlu exclude cântarea din propuneri. Se verifică numai colecția Tineri, nu Cartea Neagră PPT. Nu se extrag versuri din PPT/PDF.
- Repararea nu rulează automat odată cu SQL-ul. Nu am acces la baza ta pentru a confirma numărul real de cântări afectate.

## O setare necesară în Supabase pentru conturi strict administrate
În Supabase → Authentication → Sign In / Providers (sau setările generale ale autentificării), dezactivează «Allow new users to sign up». Dezactivează și «Allow anonymous sign-ins» dacă este activ.
Nu dezactiva furnizorul Email: utilizatorii existenți trebuie să poată continua autentificarea cu email și parolă.
Crearea controlată din SongApp folosește Admin API pe server. Această setare blochează înscrierile directe făcute de cineva prin API-ul public Supabase, independent de interfața SongApp. Nu poate fi schimbată prin UPDATE-V65.sql și nu am modificat-o în proiectul tău.
Accesul de vizitator la programul public nu necesită un cont anonim Supabase și rămâne disponibil.
Documentație oficială: https://supabase.com/docs/guides/auth/general-configuration

## Validare
91 teste automate trecute, inclusiv rolurile admin/editor/coordonator/viewer, cereri directe pe profile, acces public doar la programe publicate, corecția reversibilă a istoricului, backup, ordonare, reparare cu preview/undo și protecție la modificări ulterioare. UPDATE-V65.sql verificat și la aplicare repetată.
Build de producție Webpack și TypeScript trecute.
Browser cu backend simulat: acces vizitator, lipsa controalelor private, culori/tags, mobil, print public și privat cu detalii, mutare înaintea unui răspuns întârziat și revenire la eroare, tab implicit, corecție istoric, reparare și undo, acces refuzat editorului la administrarea utilizatorilor, metadate în prezentarea live.
Print PDF generat și inspectat vizual. Nu s-a modificat baza reală și nu s-a făcut deploy.

## Telefon
Varianta aleasă este PWA, fără taxe de publicare în magazinele Android/iOS. Instalarea pe telefon urmează după validarea acestor actualizări; acest pachet nu pretinde că adaugă deja funcționalitatea PWA sau notificări push noi.
