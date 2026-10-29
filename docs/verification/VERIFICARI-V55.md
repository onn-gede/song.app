# Verificări v55 / 0.7.3 · import Carte roșie

## Sursa verificată la 29.10.2026

- API filtrat exclusiv categorie=cr: 24 pagini × 50 rezultate, 1.200 ID-uri distincte.
- 601 înregistrări numerotate 001–601 și 599 fără număr.
- 597 variante fără număr asociate după titlu unic; două asociate după egalitatea versurilor (nr. 516 și 044).
- Pregătire completă: 601 cântări disponibile; 571 texte din API, 30 extrase din fișiere PPT. Nu au rămas variante sursă fără corespondent în catalogul verificat.
- Nr. 019 și 044 au același titlu, dar texte diferite. Se păstrează separat, după numărul din carte și identitatea sursei.

## Teste

- 64 teste trecute: 58 teste generale/DB și 6 teste specifice parserului/importatorului.
- Test SQL: colecție existentă, creare, potrivire după titlu, maparea ID-urilor alternative, reluare fără duplicate, păstrarea versurilor/tonalității/notelor existente, completarea versurilor goale, conflicte de număr, cazuri fără versuri și două piese distincte cu același titlu.
- Admin și service role pot importa; viewer, cont inactiv și anon sunt respinși. Nu se modifică politicile tabelelor existente.
- Migrarea UPDATE-V55 rerulată; instalarea nouă completă verificată separat în PGlite.
- Parser: grupare canonice/variante, titluri ambigue, categorii greșite, numere repetate, ID-uri repetate, strofe/refren/repetiții, citirea atomilor PPT Unicode, restricții de host și cale pentru fișiere.
- Verificare suplimentară pe TOATE cele 601 payload-uri reale pregătite, într-o bază PostgreSQL temporară PGlite: prima trecere created=601, a doua existing=601; total 601 songs, 601 song_sources, 1.200 song_link_imports. Fără dubluri sau conflicte în baza goală de test.
- Build de producție și TypeScript trecute. Nu există modificări de UI în v55.

## Limite

Nu există în acest mediu conexiunea privată la baza Supabase a utilizatorului. Testele și pregătirea sursei nu au scris în baza reală. Importul efectiv se execută local cu npm run import:red-book, după UPDATE-V55.sql, folosind configurația existentă din .env.local.

Baza reală poate avea duplicate sau conflicte care nu există în baza temporară; acestea sunt raportate pentru verificare și nu sunt suprascrise. Piesele deja prezente sunt reutilizate, deci numărul de piese nou-create poate fi sub 601.

Nu au fost folosite parole sau chei reale. Cache-ul cu paginile/fișierele sursei nu se distribuie în arhivă. Codul importatorului citește datele direct de la sursă când utilizatorul îl rulează. Fără push sau deploy.
