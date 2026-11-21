# Validare SongApp v87 · FreeShow local

## Verificare rapidă

1. FreeShow este pornit și API este activ în `Settings → Connections`.
2. Rulează `npm run freeshow:bridge` într-o fereastră PowerShell separată.
3. Confirmă mesajul `Conectorul SongApp → FreeShow este pornit`.
4. Deschide SongApp de la `https://songappbcb.netlify.app` pe același PC.
5. Într-un program, deschide `FreeShow local`.
6. Folosește `http://127.0.0.1:5510/freeshow`, fără cheie API.
7. `Testează conexiunea` trebuie să confirme legătura.
8. `Trimite programul` trebuie să creeze prezentarea în FreeShow.
9. Verifică `Anterior`, `Următor` și `Ecran gol`.

## Observație

Portul `5513` din captură aparține OutputShow și nu se introduce în SongApp. FreeShow REST rămâne pe `5506`; portul `5510` este doar conectorul local SongApp.
