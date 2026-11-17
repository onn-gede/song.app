export function normalizeMusicalKey(value: unknown) {
  const key = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!key) return null;
  if (key.length > 20) throw new Error("Tonalitatea poate avea maximum 20 de caractere.");
  return key;
}

export function effectiveMusicalKey(selected: unknown, fallback: unknown) {
  return normalizeMusicalKey(selected) ?? normalizeMusicalKey(fallback);
}

