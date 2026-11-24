# Fix v24 — filtrare colecții fără Bad Request

Rezolvă eroarea apărută când filtrezi cântările după colecție:

- `Bad Request`
- `TypeError: fetch failed`

Cauza probabilă era filtrarea cu `.in("id", [...multe id-uri...])`, care genera URL-uri foarte lungi către Supabase/PostgREST când o colecție avea multe cântări.

Schimbare:

- `/songs` nu mai trimite liste mari de id-uri în query.
- aplicația încarcă biblioteca activă și aplică filtrele local în pagina server.
- filtrele după colecție, categorie, număr, status, tonalitate și sortare rămân active.

Aplicare:

```bat
rmdir /s /q .next
npm run dev
```

Nu este nevoie de SQL nou.
