# SongApp v96 · corecție build EXE

Buildul Windows v95 s-a oprit deoarece instalarea Inno Setup de pe runnerul
GitHub nu include traducerile neoficiale și nu a găsit `Romanian.isl`.

V96 include traducerea română direct în repository și o încarcă din folderul
installerului. Buildul nu mai depinde de componentele opționale instalate pe
runnerul GitHub.

Nu este necesar SQL și nu se modifică baza de date.
