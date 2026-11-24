# Fix v3 - Next 16 proxy cleanup

If the app fails with:

`Both middleware file "./middleware.ts" and proxy file "./proxy.ts" are detected`

then the old root `middleware.ts` from a previous version is still present in your project. Delete only the root file:

```bat
del middleware.ts
rmdir /s /q .next
npm run dev
```

Do not delete `lib/supabase/middleware.ts`. That is only a helper file imported by `proxy.ts`.
