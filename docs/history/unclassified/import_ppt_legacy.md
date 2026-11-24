# Import fișiere .ppt vechi

Aplicația citește direct fișierele `.pptx`.

Pentru fișierele vechi `.ppt`, aplicația încearcă să le convertească local în `.pptx` folosind LibreOffice în timpul importului. Fișierele originale nu sunt stocate în Supabase Storage; după conversie și extragerea textului se păstrează doar textul extras și metadatele.

## Windows

Instalează LibreOffice, apoi repornește terminalul și aplicația.

Dacă `soffice` nu este disponibil în PATH, poți seta în `.env.local`:

```env
LIBREOFFICE_PATH="C:\\Program Files\\LibreOffice\\program\\soffice.exe"
```

Apoi rulează din nou:

```bat
rmdir /s /q .next
npm run dev
```

Dacă nu vrei LibreOffice, convertește manual `.ppt` în `.pptx` din PowerPoint sau LibreOffice și importă `.pptx`.
