# SongApp v67 / 0.11.2 — Fotografie discretă și maximum patru programe

## Instalare
1. Oprește aplicația locală cu Ctrl+C.
2. Extrage acest ZIP peste D:\Apps\song.app, cu înlocuire. Păstrează .env.local și local-assets.
3. În SQL Editor al ACELUIAȘI proiect Supabase:
   - dacă V66 este deja aplicat, rulează numai supabase/updates/UPDATE-V67.sql;
   - dacă te-ai oprit la V65, rulează UPDATE-V66.sql, apoi UPDATE-V67.sql;
   - dacă nu ai aplicat nici V65, rulează V65 → V66 → V67.
   V67 trebuie aplicat ultimul. Nu rula INSTALL-NEW.sql și nu reimporta cântările.
4. PowerShell:
   Set-Location "D:\Apps\song.app"
   npm ci
   npm run build
   Numai după build reușit:
   npm run local
5. Deschide http://localhost:3000.

Arhiva include cumulativ și actualizările V65/V66. Nu face push sau deploy automat.

## Programe pentru vizitatori
Pe pagina de intrare apar maximum patru programe, fără paginare:
- un singur program deja început: cel mai recent după data întâlnirii, fie în curs, fie încheiat;
- apoi următoarele programe viitoare, în ordinea apropiată, până la maximum patru în total;
- dacă nu există un program trecut/în curs public, se pot afișa până la patru programe viitoare.

Se aleg numai programe publicate cu link activ și neexpirat; programele private, șabloanele și cele arhivate nu sunt listate. Nu se afișează istoricul mai vechi în pagina de login. Limita este aplicată atât în baza de date, cât și în interfață. Parametrii vechi de paginare nu oferă acces la alte pagini ale listei.
Nu se șterg programe și nu se dezactivează linkurile publice mai vechi deja distribuite. Restricția cerută se aplică listei afișate pe pagina de intrare.
Sugestiile fără cont, aprobarea lor de către echipă și gestionarea sesiunilor expirate din V66 rămân disponibile.

## Fotografia bisericii
Este folosită fotografia furnizată, convertită în WebP pentru livrare, fără regenerarea clădirii.
- Desktop: 800 × 1196, 65.462 bytes (aproximativ 65 KB).
- Mobil: 420 × 628, 21.894 bytes (aproximativ 22 KB).
- Originalul PNG de aproximativ 3,5 MB nu este inclus în aplicație.

Fotografia apare în fundalul zonei de autentificare, cu opacitate redusă și gradient de estompare spre partea superioară. Nu acoperă interacțiunile formularului. Pe mobil estomparea este și mai discretă.
Browserul alege varianta potrivită prin picture/source. Încărcarea are prioritate mică, decodare asincronă și nu necesită procesare a imaginii pe server la fiecare accesare. Nu există animație sau bibliotecă suplimentară pentru fotografie.
Fișierele statice au nume cu versiune și cache public de lungă durată. Formularul și datele utilizatorului nu primesc această regulă de cache.

## Verificări
95 teste automate trecute, inclusiv selecția exactă «ultimul început + următoarele», plafonul de patru, imposibilitatea de a cere pagini mai vechi prin RPC, scenariul fără programe trecute și lista goală.
Build de producție Webpack și TypeScript trecute.
Browser cu servicii simulate: două coloane desktop, una sub alta pe mobil, fotografie încărcată și decodată din varianta corectă, dimensiuni sub 80 KB / 30 KB, cache immutable pe imagini, lipsa paginării și lipsa scrollului orizontal. Capturile desktop și mobil au fost inspectate vizual.
Au fost reverificate și sesiunea expirată, reînnoirea validă, autentificarea din formular și sugestiile de cântări/momente fără cont. Nu s-a făcut deploy și nu s-a modificat baza ta reală.
