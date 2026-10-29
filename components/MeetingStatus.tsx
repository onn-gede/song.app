"use client";
import {useEffect,useState} from 'react';
import {meetingStatus} from '@/lib/meeting-state';
export const MEETING_STATUS_LABELS:Record<string,string>={draft:'În pregătire',ready:'Pregătit',in_progress:'În curs',finished:'Finalizat',archived:'Arhivat',template:'Șablon'};
export function useMeetingClock(dates:string[],initialNow:number){
 const [now,setNow]=useState(initialNow);const key=dates.join('|');
 useEffect(()=>{let timer:ReturnType<typeof setTimeout>;let active=true;const dates=key.split('|').map(d=>Date.parse(d)).filter(Number.isFinite);
 const update=()=>{if(!active)return;const now=Date.now();setNow(now);const next=Math.min(...dates.flatMap(d=>[d,d+7200000]).filter(d=>d>now));timer=setTimeout(update,Math.min(60000,Math.max(25,next-now+25)));};
 const visible=()=>{if(document.visibilityState==='visible'){clearTimeout(timer);update();}};update();document.addEventListener('visibilitychange',visible);return()=>{active=false;clearTimeout(timer);document.removeEventListener('visibilitychange',visible);};
 },[key]);return now;
}
export function MeetingStatusBadge({date,status='draft',template=false,initialNow}:{date:string;status?:string;template?:boolean;initialNow:number}){
 const now=useMeetingClock([date],initialNow);const phase=meetingStatus(date,status,template,new Date(now));
 return <span className={`meeting-status status-${phase}`} data-meeting-state={phase} aria-live="polite"><i/>{MEETING_STATUS_LABELS[phase]||phase}</span>;
}
