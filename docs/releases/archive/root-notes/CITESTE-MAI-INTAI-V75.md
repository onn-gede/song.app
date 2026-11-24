# SongApp v75 — 0.12.4 — Un singur control pentru propunerile vizitatorilor

Actualizare peste v74. Fără SQL, dependențe noi, push sau deploy.

În Partajare:
- Cu link public activ apare doar setarea acelui link: „Permite propuneri de la vizitatori” și „Salvează accesul”.
- Formularul de generare a unui link (slug și bifa inițială) apare numai când nu există un link activ. Nu mai sunt două bife cu sens aparent diferit.
- ON permite vizitatorilor propuneri de cântări și momente, în așteptarea aprobării; OFF oprește aceste propuneri. Vizualizarea programului public rămâne posibilă.
- Editarea directă de către utilizatorii cu drepturi este independentă de această setare; viewerii nu primesc drepturi de editare.
- Cele două formulare foloseau deja același câmp allow_contributions: unul modifica linkul existent, celălalt crea un link nou. Nu sunt necesare schimbări în schema bazei.

Două propuneri cu date diferite rămân două. Deduplicarea din v74 vizează numai aceiași parametri (inclusiv nume, observații, poziție, backup), încă pending, retrimiși în 30 secunde. Nu împiedică adăugarea intenționată de momente diferite.

## Aplicare locală
Oprește aplicația cu Ctrl+C, extrage peste D:\Apps\song.app și acceptă înlocuirea fișierelor.

```powershell
Set-Location "D:\Apps\song.app"
npm run build
if ($LASTEXITCODE -eq 0) { npm run local }
```

Nu rula alte SQL-uri pentru această actualizare. Baza și configurarea existentă rămân cele folosite deja.
