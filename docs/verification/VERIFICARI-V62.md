# Verificări v62 / 0.9.0

## Funcționalități

- Strofe: se numără secțiunile de tip strofă atunci când există. Pentru PPT/PDF sau text nestructurat apare „—”; numărul poate fi completat manual din editorul de detalii al cântării în program. Valoarea manuală aparține cântării și apare și în alte programe.
- Structură: se salvează separat pentru fiecare apariție în program; nu rescrie structura de bază. Exemple: S,R,S,R,R,B,S,R sau S1,R,S2,R. S fără număr avansează prin strofe și reia de la prima după ultima. R/B fără număr folosesc prima secțiune de acel tip. Structura este afișată în program, public, print și prezentarea textuală. Pentru secțiuni identificate, prezentarea respectă ordinea cerută, inclusiv repetițiile. Dacă lipsesc secțiunile cerute, se păstrează ordinea existentă. Nu se rescriu și nu se rearanjează fișierele PPT/PDF.
- Modificări: elementele nou adăugate sau modificate primesc chenar roșu timp de 5 secunde. Se evidențiază și schimbările de poziție. Prima încărcare a paginii nu evidențiază întreaga listă. În pagina publică momentul celor 5 secunde începe când modificarea ajunge prin actualizarea automată, nu în clipa salvării pe alt dispozitiv. Elementele eliminate dispar din listă.
- Preview: butonul Versuri ⓘ oferă prima strofă și primul refren identificat, prin hover sau focus/click, în program și /songs. Previzualizarea din /songs se încarcă numai la cerere. Fără versuri, explică disponibilitatea PPT/PDF. Nu s-au extras versuri din prezentări.
- Căutare avansată: colecție, categorie, tonalitate; panou deschis/închis, resetare. Filtrele se aplică în baza de date înainte de limitarea rezultatelor. Panoul închis păstrează filtrele active și indică numărul lor.
- Categorii: + Categorie în lista /songs adaugă o categorie existentă fără a elimina celelalte; repetarea aceleiași atribuiri nu dublează asocierea.
- Program partajat: un cont activ cu drept de editare (administrator/editor/coordonator) vede direct comenzile de adăugare, reordonare, mutare, eliminare, momente și detalii. Vizualizatorii și vizitatorii fără cont păstrează pagina publică fără aceste comenzi. Propunerile externe rămân disponibile conform setării linkului.

## Validare

82 teste trecute: 70 TypeScript/DB, 7 import cărți, 3 manifest/validare PPT și 2 build local. Testul v62 verifică metadatele, păstrarea structurii originale, copierea programului, categorii idempotente, filtre, link public și refuzul mutațiilor pentru viewer/inactiv/anonim. Instalarea SQL nouă și actualizările existente au trecut în PostgreSQL de test PGlite.

Build de producție cu Webpack și TypeScript reușit. Browser local cu Next.js de producție și Supabase simulat: preview strofă/refren, filtre deschise/închise/resetate, chenar de 5 secunde la adăugare, salvare număr/structură, categorie din listă, editare în public cu cont, pagină anonimă fără comenzi, actualizare automată publică cu chenar de 5 secunde, metadate în prezentarea efectivă. Biblioteca și editorul public verificate la 390px, fără overflow orizontal. Fără erori JavaScript.

Nu s-a făcut push, deploy, import sau modificare în baza live. Fișierele PPT/PDF rămân cele deja încărcate.
