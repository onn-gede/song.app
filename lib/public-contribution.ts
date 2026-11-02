/** Limits match the database RPC; UI limits are only a convenience. */
export const PUBLIC_LIMITS = {slug:200, query:300, title:180, text:4000, name:120, notes:1000} as const;
export function publicText(value: unknown, limit: number, label: string): string {
  if (value != null && typeof value !== 'string') throw new Error(`${label}: valoare invalidă.`);
  const raw = value || '';
  if (Array.from(raw).length > limit) throw new Error(`${label}: maximum ${limit} de caractere.`);
  return raw.trim();
}
export function publicPosition(value: unknown): number | null {
  if (value == null || value === '') return null;
  const position=Number(value);
  if (!Number.isInteger(position) || position<1 || position>999) throw new Error('Poziția trebuie să fie între 1 și 999.');
  return position;
}
export function publicContributionError(error: {code?:string}): Error {
  if(error.code==='P0073')return new Error('Sunt prea multe propuneri pentru acest program. Așteaptă puțin sau contactează echipa.');
  if(error.code==='22001')return new Error('Unul dintre texte este prea lung. Scurtează-l și încearcă din nou.');
  return new Error('Propunerea nu poate fi trimisă. Verifică dacă linkul mai permite sugestii sau încearcă din nou mai târziu.');
}
