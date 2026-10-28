export type AppRole = "admin" | "editor" | "worship_leader" | "viewer";
export function canEdit(role: string | null | undefined) {
  return ["admin", "editor", "worship_leader"].includes(role || "");
}
