# Validare v92 · instalator Windows FreeShow

## Conținut

- wizard Windows cu pașii Bun venit, Opțiuni și Finalizare;
- instalare per utilizator, fără drepturi de administrator;
- opțiune de pornire automată cu Windows;
- opțiune de pornire imediată după instalare;
- scurtături în meniul Start pentru Pornire, Oprire și Dezinstalare;
- loguri locale pentru diagnostic;
- linkuri oficiale pentru Node.js și FreeShow;
- descărcare directă din pagina Administrare.

## Verificări efectuate

- arhiva ZIP a instalatorului a trecut verificarea de integritate;
- testul structurii instalatorului a trecut;
- suita automată existentă a proiectului a trecut;
- buildul de producție Next.js 16.4.6 a trecut.

## Limitare de validare

Wizardul folosește Windows PowerShell și Windows Forms. Logica și pachetul au fost
validate automat, dar aspectul ferestrei trebuie confirmat o singură dată pe un PC
Windows înainte de publicarea pe LIVE.
