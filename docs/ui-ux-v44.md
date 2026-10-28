# SongApp v44 — direcția UI/UX

Scop: biblioteca și programele trebuie să poată fi parcurse rapid, fără
suprapunerea căutării, filtrelor, administrării și acțiunilor periculoase.

## Surse analizate

- Melodia: https://melodia.ro/cantari — structură de căutare, filtre grupate,
  sortare și separarea titlului de tonalitate și metadate. HTML-ul public a fost
  analizat; codul, fonturile, brandul și conținutul lor nu au fost copiate.
- Planning Center Services: https://help.planningcenter.com/en/139437-filter-the-songs-page.html
  — organizarea filtrelor, etichete active și o listă care reflectă simultan
  criteriile selectate.
- Planning Center, Songs page overview:
  https://help.planningcenter.com/en/139427-songs-page-overview.html — ierarhia
  cântărilor, detaliilor și acțiunilor într-o bibliotecă de echipă.

## Adaptarea pentru SongApp

- Verde închis pentru navigare, suprafețe deschise și spații constante între
  secțiuni. Tipografie de sistem, fără încărcare din servicii externe.
- Mai puține chenare și insigne concurente. Titlul este primul reper; sursa și
  tematica sunt secundare; tonalitatea și tempo-ul au coloane separate.
- Căutarea nu mai afișează un al doilea set de rezultate peste o listă filtrată.
  Colecția, categoria, tonalitatea și textul căutat lucrează împreună.
- Filtrele frecvente rămân accesibile; cele ocazionale se deschid explicit.
- Panourile de partajare, momente suplimentare și ștergere nu ocupă permanent
  spațiul de pregătire al programului.
- Pe telefon, meniul este retras; informația principală rămâne vizibilă, iar
  tempo-ul și unele acțiuni secundare sunt simplificate. Detaliul cântării
  păstrează accesul la toate funcțiile permise rolului.
- Seleția pentru operațiuni în masă este un mod explicit, cu confirmare pentru
  ștergere. Nu se modifică permisiunile sau regulile de acces.

## Limitele acestui calup

Navigarea, biblioteca, dashboardul, programele și importul sunt prioritare.
Formularele de administrare și editorii mai vechi primesc sistemul vizual comun;
nu sunt rescrise toate fluxurile lor. Nu sunt introduse funcții fără date reale,
favorite fictive sau statistici inventate.
