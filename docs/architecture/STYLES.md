# Stiluri globale

`app/styles/index.css` este singurul punct de intrare și păstrează ordinea existentă a cascadei:

1. `base.css` — reguli istorice și baza aplicației;
2. `components.css` — redesign și componente;
3. `density.css` — compactare și ajustări recente;
4. `welcome.css` — pagina publică de intrare;
5. `mobile.css` — corecții pentru ecrane mici.

Nu se mai adaugă fișiere CSS globale direct în `app/layout.tsx`. Stilurile noi folosesc variabilele existente și se adaugă în fișierul domeniului potrivit. Consolidarea selectoarelor vechi se face gradual, cu verificare vizuală desktop și mobil.
