# v106 / 0.35.0

- programele și repetițiile noi primesc automat link public; accesul poate fi oprit și reactivat fără pierderea linkului;
- programele existente fără niciun link sunt publicate la migrare, iar alegerile private existente sunt păstrate;
- corectarea primului vers poate fi previzualizată și aplicată punctual din pagina cântării;
- loader inițial pe fundal deschis și loader de rută afișat numai după 0,4 secunde;
- salvarea principală este centrată și accesibilă pe mobil, iar comenzile programului sunt compacte;
- solistul și observațiile rămân directe în editare, dar sunt pliate sub un control discret în live/public;
- navigarea din program spre cântare păstrează întoarcerea contextuală;
- căutarea YouTube acceptă `YOUTUBE_DATA_API_KEY` sau `YOUTUBE_API_KEY` și păstrează fallbackul manual.

Necesită `supabase/updates/UPDATE-V106.sql` pe baza existentă.
