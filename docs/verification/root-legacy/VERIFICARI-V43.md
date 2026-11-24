# Verificări v43

- 27 teste automate: trecute.
- Instalare nouă și actualizări SQL: executate pe PostgreSQL local de test.
- Extragerea titlului, autorului, albumului și tematicii din DOM.
- Preluarea unei singure variante de versuri, fără duplicarea afișărilor ascunse.
- Păstrarea liniilor, diacriticelor, strofelor, refrenului și bridge-ului.
- Citirea câmpului de ordine a interpretării separat de versuri.
- URL-uri limitate la cântări Resurse Creștine; redirecționări validate înainte de accesare.
- Erori explicite pentru răspunsuri 403, 429, pagini nevalide sau prea mari.
- Salvare atomică în mai multe colecții; repetarea salvării nu dublează aceeași cântare.
- Reutilizarea cântărilor importate anterior, cu păstrarea editărilor locale.
- Drepturi de import refuzate pentru viewer și profil inactiv.
- Suspendarea rulărilor vechi păstrează datele bibliotecii.

Extragerea a fost verificată pe HTML-ul real al linkului exemplu: două strofe,
un refren, un bridge și ordinea interpretării. Textul integral al paginii nu
este inclus în pachetul de teste; fixture-urile sunt sintetice.

Urmează proba pe baza reală a utilizatorului și verificarea vizuală pe dispozitive reale.
