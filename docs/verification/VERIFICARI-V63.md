# Verificare v63 / 0.9.1

Istoricul cântat se bazează exclusiv pe elementele existente în lista principală a programelor care au început. Nu se bazează pe jurnalul de activitate și nu păstrează artificial utilizarea unei piese eliminate. Backupurile, șabloanele și datele viitoare nu se numără ca utilizări cântate. O cântare repetată de mai multe ori în același program are o singură utilizare pentru acel program.

Corecția principală este actualizarea interfeței: după mutare/eliminare se invalidează biblioteca, paginile cântărilor și sumarul. Paginile deschise se actualizează la revenire și la notificarea unei schimbări în alt tab. Căutarea din program nu mai reutilizează istoricul din cache după o modificare a programului. Nu există polling nou permanent în bibliotecă.

Categoriile sunt multiple. + Categorie adaugă o asociere și păstrează categoriile precedente; lista afișează toate categoriile existente. Un test atribuie trei categorii și repetă prima asociere: rămân exact trei, fără dubluri.

Textul vizibil Trage a fost eliminat din rânduri. Mânerul, tooltip-ul și descrierea accesibilă se păstrează.

Validare: 83 teste trecute, inclusiv eliminare din program în curs (ora de început acum o oră), eliminare după program (ora de început acum trei ore), revenirea ultimei utilizări la programul anterior, mutare în backup cu zero utilizări cântate și revenirea în principal. Verificate funcțiile de istoric, recent și most_sung. Build de producție Webpack și TypeScript reușit. Browser local cu Next.js și Supabase simulat: actualizarea bibliotecii la mesaj din alt tab și lipsa textului vizibil Trage, pe lângă testele UI v62.

Nu s-au modificat datele live și nu s-a făcut push/deploy. Nu se extrag versuri și nu se reimportă PPT/PDF.
