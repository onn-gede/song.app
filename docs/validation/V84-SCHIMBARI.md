# Schimbări v84

- YouTube este disponibil printr-un buton compact și în programul public/live; playerul se încarcă numai la cerere.
- Întâlnirile viitoare sau încă în curs pot fi editate: titlu, tip, dată, oră, observații și program oficial/repetiție.
- Playlisturi independente pentru cântări de repetat ulterior; nu intră în istoric sau statistici și sunt incluse în backupul complet.
- În programul public, eticheta „Cântare în comun” apare numai pentru o cântare marcată activ.
- Pagina Administrare are carduri clare, descrieri și ierarhie vizuală.
- Pagina publică nu mai așteaptă inutil validarea sesiunii în middleware, iar datele pentru metadata/pagină sunt deduplicate pe cerere.
- Ecran de pornire luminos și skeleton pentru navigarea internă, evitând ecranul negru pe mobil.
- Navigarea principală folosește preîncărcarea Next.js pentru tranziții mai rapide.
- Next.js rămâne la versiunea validată `16.4.6`.
