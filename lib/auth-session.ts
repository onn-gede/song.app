// Only definitive session failures justify removing cookies. Network errors do not.
export function invalidRefreshSession(error:unknown){const code=(error as {code?:string}|null)?.code;return ['refresh_token_not_found','refresh_token_already_used','session_not_found','session_expired'].includes(code||'');}
export function sessionCookieNames(cookies:{name:string}[],url:string){let project:string;try{project=new URL(url).hostname.split('.')[0];}catch{return [];}
 const base=`sb-${project}-auth-token`;return cookies.map(c=>c.name).filter(name=>name===base||name===base+'-user'||name.startsWith(base+'.')&&/^\d+$/.test(name.slice(base.length+1))||name.startsWith(base+'-user.')&&/^\d+$/.test(name.slice(base.length+6)));}
