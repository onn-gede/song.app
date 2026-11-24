# Arhivă reparată v58

Pachetul conține aplicația, SQL-ul și toate cele 803 previzualizări PDF. Arhiva PPT originală nu este duplicată în acest pachet mai mic.

1. Extrage pachetul într-un folder nou.
2. Copiază arhiva ta nemodificată `Cantarile Evangheliei - cartea neagra.zip` în subfolderul `local-assets/black-book/` și redenumește copia `originals.zip`. Folderul există deja și conține `previews`. Nu trebuie să extragi PPT-urile.
3. Copiază `.env.local` din aplicația existentă.
4. Urmează `docs/guides/IMPORT-PPT-V58.md`: UPDATE-V58.sql în aceeași bază, apoi npm ci, npm run import:black-book, npm run build, npm run local.

Aplicația și SQL-ul sunt aceleași ca în v58; corecția privește pachetul de descărcare. Nu s-a făcut push, deploy sau import în baza ta.
