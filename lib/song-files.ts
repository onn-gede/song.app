export type SongFileAvailability = {
  file_name?: string | null;
  file_type?: string | null;
  storage_path?: string | null;
  presentation_only_v58?: boolean | null;
  upload_complete_v58?: boolean | null;
};

export function isPowerPointFile(file: SongFileAvailability) {
  const type = String(file.file_type || "").toLowerCase();
  return type === "ppt" || type === "pptx" || /\.pptx?$/i.test(String(file.file_name || ""));
}

export function storageObjectTarget(pathValue: string | null | undefined) {
  const path = String(pathValue || "").replace(/^\/+|\/+$/g, "");
  // Importurile vechi din ZIP puteau memora „arhiva.zip#fișier.pptx”.
  // Aceasta este o referință internă, nu un obiect descărcabil din Storage.
  if (!path || path.includes("#")) return null;
  const separator = path.lastIndexOf("/");
  const folder = separator >= 0 ? path.slice(0, separator) : "";
  const name = separator >= 0 ? path.slice(separator + 1) : path;
  return name ? { path, folder, name } : null;
}

export function canCheckStoredPowerPoint(file: SongFileAvailability) {
  if (!isPowerPointFile(file) || !storageObjectTarget(file.storage_path)) return false;
  return !file.presentation_only_v58 || !!file.upload_complete_v58;
}
