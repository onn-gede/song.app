# Validare v77 / 0.13.0

## Automat
- 102 teste trecute: 90 TypeScript/DB, 7 Carte roșie, 3 PPT, 2 build local. Nicio eroare.
- Test nou pentru transportul JSON: 401/403/429, răspuns HTML, timeout, anulare, lipsă conexiune și absența retry-ului automat pentru mutații.
- Build de producție Webpack pe Linux, cu valori Supabase fictive, trecut. Include TypeScript. Aceste valori nu sunt incluse în arhivă.
- npm audit: 0 vulnerabilități cunoscute la verificarea din 30.10.2026.

## Interactiv, Chromium cu touch emulat
Au fost montate componentele reale într-un harness izolat cu API și acțiuni simulate. Nu s-au folosit conturi reale și nu s-a scris în Supabase real.

| Flux | Rezultat |
|---|---|
| Căutare lentă urmată de căutare nouă | răspunsul vechi nu înlocuiește rezultatele noi |
| Două adăugări consecutive | lista se actualizează și câmpul se golește |
| Solist și observații | textul se actualizează și editorul se închide |
| Cântare comun / săgeți | actualizare fără reîncărcare manuală |
| Principal ↔ backup | mutare în ambele sensuri |
| Eroare HTML la mutare | poziția optimistă revine și eroarea este vizibilă |
| Eroare la ștergere | elementul rămâne, eroarea apare și reîncercarea reușește |
| Offline → online | banner și citire nouă a snapshotului |
| Preview versuri tactil | dialogul rămâne deschis la derulare și se închide explicit |
| Program nou | Escape închide și focusul revine pe buton |
| Layout | verificat la 390px și 1440px; fără overflow orizontal pe mobil în fixture |
| Print | documentul dedicat este vizibil în modul print; PDF de test generat |

Nicio eroare JavaScript în harness. Screenshots/PDF de test au fost folosite intern și nu sunt incluse în arhivă.

## Limite
Testele de interfață simulează răspunsurile de salvare; nu demonstrează că setările live sau toate dispozitivele sunt configurate corect. Testele DB verifică schema/politicile într-o bază izolată PGlite. Nu reprezintă un test de penetrare sau o certificare de securitate.

Rămâne necesară o probă pe iPhone/Android real, în special tastatura, instalarea PWA, sesiunea la revenirea din fundal și deschiderea PDF/PPT. Nu există încă o adresă HTTPS de test pentru acest calup; nu s-a făcut deploy. Instrucțiunile de instalare PWA existente rămân în aplicație.
