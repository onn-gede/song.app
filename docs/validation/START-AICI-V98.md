# Validare V98

1. Deschide o cântare fără PPT/PPTX și verifică butonul **Exportă PPTX** lângă „Versuri structurate”.
2. Deschide o cântare cu PPT/PPTX și verifică butonul **Descarcă PPT/PPTX existent**.
   O înregistrare PPT/PPTX fără `storage_path` trebuie să afișeze **Exportă PPTX**, nu un link 404.
   Același lucru este valabil dacă `storage_path` există în baza de date, dar obiectul lipsește din Storage.
3. Exportă o prezentare direct din FreeShow, apoi import-o în SongApp; verifică titlul, ordinea și tipurile secțiunilor.
4. Importă un link cu Strofa/Refren/Bridge; în preview trebuie să apară numai versurile, separate prin rând gol.
5. Într-un program, verifică denumirea **FreeShow Sync**.
6. Cu o sesiune locală expirată, reîncarcă aplicația; trebuie să ajungi la login fără repetarea erorii `refresh_token_not_found`.

Nu există migrare SQL pentru această versiune.
