@echo off
echo Cleaning old Next.js middleware files...
if exist middleware.ts del middleware.ts
if exist middleware.js del middleware.js
if exist src\middleware.ts del src\middleware.ts
if exist src\middleware.js del src\middleware.js
if exist .next rmdir /s /q .next
echo Done. Now run: npm run dev
pause
