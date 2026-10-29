# Program și notificări · v54

## Etichete

Toate etichetele folosesc text normal centrat și aceeași înălțime. Bordurile sunt neutre. Colecția este singura etichetă cu fundal în culoarea colecției; textul alb sau închis se alege pentru contrast. Cântare în comun rămâne roșie. Pe mobil etichetele se pot împărți pe rânduri, fără scroll orizontal.

## Salvare rapidă

Când apeși Cântare comun, aspectul se schimbă imediat. Butonul este indisponibil până la confirmare, ca să nu trimită două schimbări simultan. Salvarea folosește un endpoint privat și un singur apel SQL care validează contul, modifică piesa și întoarce programul confirmat. Nu așteaptă recalcularea istoricului, surselor și întregii pagini. Dacă salvarea eșuează, marcajul revine la starea confirmată și arată eroarea.

## Propuneri

Lângă Vezi public este butonul Notificări. Numărul rămâne roșu cât există propuneri în așteptare. Deschide secțiunea pentru Acceptă sau Respinge. Programul și contorul se actualizează împreună după confirmarea bazei. Erorile apar în secțiune și păstrează propunerea disponibilă pentru reîncercare, fără o pagină Server Components cu digest.

Verificarea automată se face la 15 secunde în pagina vizibilă și la revenirea în pagină. Actualizează verifică imediat. Acceptarea este atomică și repetarea cererii nu dublează momentul. Ordinea propusă este relativă la lista principală sau backup, fără prag numeric 900.

## Pagina publică

Alerta apare sus, cu contrast roșu, și rămâne până apeși Am văzut. Titlul tabului semnalează modificarea. Pagina își actualizează datele automat. Activează notificările cere permisiunea browserului doar după click; cu permisiunea acordată, notificarea de sistem poate fi afișată și când browserul este minimizat. Solicităm păstrarea notificării până la interacțiune acolo unde browserul acceptă requireInteraction. Sunetul este opțional și se activează separat.

Verificarea continuă și când pagina este ascunsă, cu revenire imediată la focus sau reconectare. Browserele pot limita temporizatoarele în fundal, iar Windows poate suprima notificările prin setările proprii. Nu există push cu browserul complet închis. Workerul de notificări gestionează doar afișarea/clickul, fără cache de pagini sau abonamente push; la click folosește tabul programului deja deschis, dacă există.

## Instalare

Pe baza existentă cu v53, rulează supabase/updates/UPDATE-V54.sql. Păstrează .env.local. Oprește aplicația și rulează npm ci, npm run build, npm run local. Nu se execută SQL automat și nu se publică nimic.
