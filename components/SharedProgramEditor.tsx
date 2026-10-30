"use client";
import Link from 'next/link';
import {MeetingState} from './MeetingState';
import {MeetingProgramBoard} from './MeetingProgramBoard';
import {MeetingResponsibles} from './MeetingResponsibles';
import {AddSongsPanel} from './AddSongsPanel';
import {ProgramNotifications,ProgramNotificationsButton,ProgramNotificationsPanel} from './ProgramNotifications';
import type {MeetingSnapshot} from '@/lib/meeting-state';
export function SharedProgramEditor({meetingId,initial}:{meetingId:string;initial:MeetingSnapshot}){
 return <MeetingState meetingId={meetingId} initial={initial}><ProgramNotifications meetingId={meetingId} initial={[]}><section className="meeting-v48 shared-program-editor"><div className="inline-form"><strong>Editare program partajat</strong><ProgramNotificationsButton/><Link href={`/meetings/${meetingId}`} className="btn secondary">Administrare completă</Link></div><ProgramNotificationsPanel/><MeetingResponsibles meetingId={meetingId} principal={initial.principal} secondary={initial.secondary} editable/><AddSongsPanel meetingId={meetingId}/><MeetingProgramBoard meetingId={meetingId} items={initial.items} canManage/></section></ProgramNotifications></MeetingState>;
}
