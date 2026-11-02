'use client';
import {useEffect,useState} from 'react';

export function ConnectionStatus(){
 const [offline,setOffline]=useState(false),[recovered,setRecovered]=useState(false);
 useEffect(()=>{let timer:ReturnType<typeof setTimeout>|undefined;let wasOffline=!navigator.onLine;
  setOffline(wasOffline);
  const down=()=>{wasOffline=true;setOffline(true);setRecovered(false);clearTimeout(timer);};
  const up=()=>{setOffline(false);if(wasOffline){setRecovered(true);clearTimeout(timer);timer=setTimeout(()=>setRecovered(false),6000);}wasOffline=false;};
  window.addEventListener('offline',down);window.addEventListener('online',up);
  return()=>{clearTimeout(timer);window.removeEventListener('offline',down);window.removeEventListener('online',up);};
 },[]);
 if(!offline&&!recovered)return null;
 return <aside className={'connection-status print-hide'+(offline?' is-offline':'')} role="status" aria-live="polite">{offline?'Conexiune întreruptă. Modificările nu sunt salvate offline.':'Conexiune restabilită. Verifică ultima modificare înainte să o retrimiți.'}</aside>;
}
