# Programul și colecțiile în v52

## Colecții

Fiecare colecție primește la migrare o culoare. O poți schimba din Colecții → deschide colecția → Culoare → Salvează. La o colecție nouă se propune o culoare din paletă.

La adăugarea cântării, dacă are mai multe surse, alege Colecție de referință. Aceasta determină culoarea, numărul și numele afișat în program. Alegerea se păstrează după salvare și copierea programului. La o piesă fără colecție apare explicit Fără colecție.

## Editare și momente

Creionul de lângă solist/observații deschide editorul. Poți modifica și tonalitatea sau colecția de referință. Salvarea confirmată închide editorul și afișează imediat informațiile. Dacă salvarea eșuează, formularul rămâne deschis.

Adaugă moment este lângă Adaugă cântări și deschide un formular pentru rugăciune, poezie, îndemn, mesaj sau pauză. Momentele rămân colorate diferit de cântări.

## Calendar și avertizări

În rezultatele căutării apar următorul program planificat/în curs și cea mai recentă utilizare trecută, cu data și ora în România. Aceste informații sunt consultative: poți alege să repeți cântarea.

Calendar și istoric deschide luna următoarei planificări sau a ultimei utilizări. Cercurile roșii indică zile cu programe. Selectează o zi pentru lista cu ore și nume; apasă din nou pentru a elimina filtrul. Poți naviga între luni sau sări la următoarea/precedenta lună cu utilizări.

- Programul pe care îl editezi și șabloanele sunt excluse din avertizări.
- Aceeași piesă de două ori în același program reprezintă o singură zi/program în calendar.
- Backup-urile viitoare sunt semnalate ca backup. Rezerva unui program trecut nu este prezentată ca o cântare interpretată.
- Eticheta Cântată în se deduce din prezența în programul principal al unei întâlniri trecute; aplicația nu confirmă interpretarea efectivă pe scenă.

## Starea întâlnirii

Ora de început este cea din program, în Europe/Bucharest. Durata folosită pentru starea automată este de două ore: înainte = În pregătire, început inclusiv = În curs, după două ore inclusiv = Finalizat. Etichetele se actualizează fără reîncărcare și fără polling de rețea; sunt verificate la limitele de timp și când revii în tab.

## Rulare locală

Nu există push sau deploy automat. Aplicația locală utilizează aceeași bază Supabase; aplicarea migrării și modificările datelor sunt vizibile și pentru aplicația online, care rămâne pe versiunea deja publicată.
