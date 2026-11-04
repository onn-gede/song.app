"use client";
import {MeetingPrintDocument} from "./MeetingPrintDocument";
import {PrintButton} from "./PrintButton";
import Link from 'next/link';
import {MeetingState} from './MeetingState';
import {MeetingProgramBoard} from './MeetingProgramBoard';
import {MeetingResponsibles} from './MeetingResponsibles';
import {AddSongsPanel} from './AddSongsPanel';
import {ProgramNotifications,ProgramNotificationsButton,ProgramNotificationsPanel} from './ProgramNotifications';
import type {MeetingSnapshot} from '@/lib/meeting-state';
export function SharedProgramEditor({meetingId,initial,title,date,programKind="official"}:{meetingId:string;initial:MeetingSnapshot;title:string;date:string;programKind?:string}){
 return <MeetingState meetingId={meetingId} initial={initial}><ProgramNotifications meetingId={meetingId} initial={[]}><MeetingPrintDocument title={title} date={date} programKind={programKind} principal={initial.principal} secondary={initial.secondary} items={initial.items}/><section className="meeting-v48 shared-program-editor program-surface-v65 print-hide"><div className="inline-form"><strong>Editare program partajat</strong><span className="program-kind-text">{programKind==='rehearsal'?'Repetiție':'Program oficial'}</span><PrintButton/><ProgramNotificationsButton/><Link href={`/meetings/${meetingId}`} className="btn secondary">Administrare completă</Link></div><ProgramNotificationsPanel/><MeetingResponsibles meetingId={meetingId} principal={initial.principal} secondary={initial.secondary} editable/><AddSongsPanel meetingId={meetingId}/><MeetingProgramBoard meetingId={meetingId} items={initial.items} canManage returnHref={`/meetings/${meetingId}`}/></section></ProgramNotifications></MeetingState>;
}
