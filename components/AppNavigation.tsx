"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { canEdit } from "@/lib/permissions";
import { Icon } from "./Icon";
const groups=[
 {label:"Spațiul de lucru",items:[{href:"/dashboard",title:"Acasă",icon:"home",access:"read"},{href:"/songs",title:"Cântări",icon:"music",access:"read"},{href:"/meetings",title:"Programe",icon:"calendar",access:"read"}]},
 {label:"Organizare",items:[{href:"/collections",title:"Colecții",icon:"folder",access:"read"},{href:"/collections/youth-keys",title:"Game Tineri",icon:"music",access:"read"},{href:"/categories",title:"Categorii",icon:"tag",access:"read"},{href:"/review",title:"De verificat",icon:"check",access:"editor"},{href:"/duplicates",title:"Duplicate",icon:"copy",access:"editor"}]},
 {label:"Administrare",items:[{href:"/external-sources",title:"Surse externe",icon:"upload",access:"editor"},{href:"/admin/users",title:"Utilizatori",icon:"users",access:"admin"},{href:"/admin/activity",title:"Activitate",icon:"clock",access:"admin"},{href:"/admin",title:"Setări",icon:"settings",access:"admin"}]}
];
export function AppNavigation({role,showExternalSync=false}:{role:string;showExternalSync?:boolean}) {
 const path=usePathname();
 return <><nav className="workspace-nav" aria-label="Meniu principal">{groups.map(group=>{
  const items=group.items.filter(item=>(item.href!=="/external-sources"||showExternalSync)&&(item.access==="read"||(item.access==="admin"?role==="admin":canEdit(role))));
  if(!items.length)return null;
  return <div className="workspace-nav-group" key={group.label}><span className="workspace-nav-label">{group.label}</span>{items.map(item=>{
   const active=path===item.href||(path.startsWith(item.href+"/")&&item.href!=="/collections"&&item.href!=="/admin");
   return <Link prefetch={false} key={item.href} href={item.href} className={`workspace-nav-link${active?" active":""}`} aria-current={active?"page":undefined}><Icon name={item.icon}/><span>{item.title}</span>{active?<span className="nav-active-dot"/>:null}</Link>;
  })}</div>;
 })}</nav>{canEdit(role)?<Link prefetch={false} href="/import" className={`workspace-import-link${path==="/import"?" active":""}`} aria-current={path==="/import"?"page":undefined}><Icon name="plus"/><span>Importă o cântare</span></Link>:null}</>;
}
