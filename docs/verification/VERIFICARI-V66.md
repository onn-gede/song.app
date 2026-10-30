# SongApp v66 / 0.11.1 — Bun venit, sesiuni și propuneri publice

## Instalare peste v65
1. Oprește aplicația cu Ctrl+C.
2. Extrage arhiva peste D:\Apps\song.app, cu înlocuire. Păstrează .env.local și local-assets.
3. În SQL Editor al proiectului Supabase EXISTENT rulează supabase/updates/UPDATE-V66.sql.
   Dacă ai construit v65, dar nu ai rulat încă UPDATE-V65.sql, rulează V65 mai întâi.
   Nu rulezi INSTALL-NEW.sql și nu reimporți cântările.
4. În PowerShell:
   Set-Location "D:\Apps\song.app"
   npm ci
   npm run build
   Numai după build reușit:
   npm run local
5. Deschide http://localhost:3000. Aceeași pagină de intrare este disponibilă și la /login și /vizitator.

Nu sunt necesare chei noi. Nu se face push sau deploy automat. Acest pachet include și modificările v65, dar actualizarea SQL V65 trebuie aplicată înainte de V66 dacă lipsește.

## Pagina de bun venit
- Desktop: autentificarea este în stânga; lista programelor publice este în dreapta, pe un fundal verde discret.
- Telefon/tabletă îngustă: secțiunile apar una sub alta, cu un singur scroll al paginii.
- Programele au dată, oră, an, stare și acces direct. Se afișează patru pe pagină, cu navigare între pagini.
- Lista conține numai programe ne-arhivate și ne-șablon, cu link public activ și neexpirat. Mai întâi cele în curs, apoi cele viitoare, apoi cele încheiate, de la cele mai recente.
- Programele nepublicate nu devin publice. La deschiderea linkului se verifică din nou că acesta este activ.
- Emailul rămâne completat după o parolă greșită; utilizatorul corectează doar parola.
- Lipsa programelor și erorile de încărcare au mesaje dedicate. Formularul de autentificare rămâne disponibil.
- Utilizatorii autentificați și activi ajung în dashboard. Un cont inactiv poate urmări în continuare programele publice fără acces la editare.

## Invalid Refresh Token: Refresh Token Not Found
Sesiunea veche din browser nu mai poate fi reînnoită de Supabase. Buildul a reușit; eroarea nu cere reinstalarea bazei sau a conturilor.
Corecția reînnoiește/verifică sesiunea înainte de randare, inclusiv la intrare și pe paginile publice, transmite cookie-urile actualizate spre componente și păstrează cookie-urile de curățare inclusiv pe redirect către login.
Se curăță numai cookie-urile proiectului Supabase curent, inclusiv fragmentele unei sesiuni împărțite în mai multe cookie-uri. Erorile de rețea nu sunt tratate ca motiv de ștergere a cookie-urilor.
Lista publică, căutările/propunerile vizitatorilor și verificările live ale programului public folosesc conexiuni anonime, independente de sesiunea unui utilizator.
La prima accesare după actualizare, biblioteca Supabase poate afișa încă o eroare pentru tokenul vechi, înainte ca răspunsul să expire cookie-urile. Nu trebuie să se repete la nesfârșit la următoarele accesări. Autentifică-te din nou.
Dacă o filă veche continuă să facă cereri: închide filele localhost și redeschide http://localhost:3000; poți verifica și într-o fereastră privată. Nu șterge datele Supabase și nu schimba cheile pentru această problemă.

## Sugestii de la vizitatori
În programul public sunt două butoane clare: «Propune o cântare» și «Propune un moment». Formularele se deschid doar la apăsare și permit nume opțional, poziție și observații. Tipurile de moment sunt aceleași ca în editor: Cântare, Diverse, Rugăciune, Poezie, Îndemn, Mesaj, Pauză.
Cântarea poate fi căutată în biblioteca disponibilă pentru propuneri. Nu este necesar contul.
Propunerile sunt în așteptare și ajung în notificările echipei; vizitatorul nu modifică direct ordinea și nu poate aproba sau elimina elemente.
V66 activează o singură dată sugestiile pentru linkurile publice active/neexpirate ale programelor viitoare sau în curs. Linkurile noi permit sugestii implicit; poți debifa această opțiune la creare.
Pentru oprire ulterioară: pagina administrată a programului → Partajare → debifează «Permite propuneri externe» → Salvează accesul. Atât interfața, cât și funcția din bază respectă oprirea. Reaplicarea UPDATE-V66.sql nu reactivează o opțiune oprită manual după prima actualizare.
La linkuri expirate, dezactivate sau cu sugestii oprite nu se acceptă propuneri.

## Validare locală
94 teste automate trecute; build de producție Webpack și TypeScript trecute.
Browser și HTTP cu servicii simulate: cookie expirat eliminat pe redirect, oprirea repetării refresh-ului, reînnoire validă păstrată în răspuns și în cererea către pagină, desktop cu două coloane, mobil fără scroll orizontal, paginarea publică, propunere de moment și cântare fără cont, program principal nemodificat direct, autentificare după tratarea sesiunii.
Verificări în baza locală: permisiuni, programe nepublicate/expirate excluse, propuneri în așteptare, refuzul aprobării anonime, dezactivare respectată și activare inițială făcută numai o dată.
Capturile desktop/mobil au fost inspectate vizual. Nu s-a modificat proiectul tău Supabase și nu s-a făcut deploy.
Cele șase alerte npm audit din jurnalul tău nu au fost rezolvate prin acest patch; sunt separate de tratarea sesiunii și necesită verificarea raportului exact înainte de actualizarea dependențelor.
