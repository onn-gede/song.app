import type { SVGProps } from "react";
const paths: Record<string, React.ReactNode> = {
  bell:<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  users:<><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 4v2"/></>,
  home:<><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-8H9v8H4a1 1 0 0 1-1-1Z"/></>,
  music:<><path d="M9 18V5l12-2v13M9 9l12-2"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="18" cy="16" rx="3" ry="3"/></>,
  calendar:<><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18m-13 5h2m4 0h2"/></>,
  folder:<path d="M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>,
  tag:<><path d="M20 13 11 22 2 13V4h9l9 9Z"/><circle cx="7" cy="9" r="1"/></>,
  upload:<><path d="M12 16V3m-5 5 5-5 5 5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></>,
  check:<><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 6-6"/></>,
  copy:<><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
  settings:<><path d="m12 3 2 3 3-1 2 3-1 3 3 2-1 3-3 1-1 3-4 1-2-3-3 1-2-3 1-3-3-2 1-3 3-1 1-3Z"/><circle cx="12" cy="12" r="3"/></>,
  search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
  arrow:<path d="M4 12h16m-6-6 6 6-6 6"/>,
  chevron:<path d="m9 5 7 7-7 7"/>,
  plus:<path d="M12 4v16M4 12h16"/>,
  close:<path d="m6 6 12 12M18 6 6 18"/>,
  menu:<path d="M4 6h16M4 12h16M4 18h16"/>,
  filter:<><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2" fill="currentColor"/><circle cx="16" cy="12" r="2" fill="currentColor"/><circle cx="10" cy="18" r="2" fill="currentColor"/></>,
  play:<path d="m8 4 13 8-13 8Z"/>,
  logout:<><path d="M9 4H4v16h5m4-4 4-4-4-4m-5 4h13"/></>,
  grid:<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  list:<><path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></>,
  clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
};
export function Icon({name,size=20,...props}:SVGProps<SVGSVGElement> & {name:string;size?:number}) {
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.music}</svg>;
}
