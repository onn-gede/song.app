import { requireProfile } from "@/lib/auth";
import { ExportDatabaseButton, ExportPackageButton, RestorePackage } from "@/components/BackupTools";
export default async function BackupPage() {
  await requireProfile("admin");
  return (
    <>
      <h1>Backup și restaurare</h1>
      <section className="card">
        <h2>Backup complet al conținutului</h2>
        <p>
          Cântări, colecții, categorii, programe, echipe, soliști, observații, versuri și toate fișierele
          atașate, inclusiv PPT/PDF. Include și datele auxiliare ale bibliotecii.
        </p>
        <p>
          Conturile și jurnalul sunt incluse doar ca evidență. Parolele, cheile private și configurația
          proiectului Supabase nu sunt incluse. Păstrează arhiva într-un loc privat.
        </p>
        <div className="backup-export-actions">
          <div>
            <strong>Backup complet</strong>
            <p className="small muted">Date + toate fișierele atașate, pentru restaurare completă.</p>
            <ExportPackageButton />
          </div>
          <div>
            <strong>Doar baza de date</strong>
            <p className="small muted">Export JSON rapid, fără PPT, PDF și alte atașamente.</p>
            <ExportDatabaseButton />
          </div>
        </div>
      </section>
      <RestorePackage />
    </>
  );
}
