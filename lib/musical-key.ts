export function effectiveMusicalKey(selected?:string|null,original?:string|null):string|null {
 return selected?.trim() || original?.trim() || null;
}
