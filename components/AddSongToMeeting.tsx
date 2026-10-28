"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { MeetingDatePicker } from "./MeetingDatePicker";
import { Icon } from "./Icon";
import { formatDateTime } from "@/lib/format";
import {
  addSongToMeetingAction,
  createMeetingAndAddSongAction,
  listMeetingsAction,
  type MeetingOption
} from "@/app/(app)/meetings/actions";

export function AddSongToMeeting({ songId, songTitle, compact = false }: { songId: string; songTitle: string; compact?: boolean }) {
  const requestId=useRef("");
  const creationLock=useRef(false);
  const [open, setOpen] = useState(false);
  const [meetings, setMeetings] = useState<MeetingOption[]>([]);
  const [createdMeetingId, setCreatedMeetingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function loadMeetings() {
    try {
      const data = await listMeetingsAction();
      setMeetings(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Nu am putut încărca programele.");
    }
  }

  useEffect(() => {
    if (open) void loadMeetings();
  }, [open]);

  function addToMeeting(meetingId: string, isBackup: boolean) {
    setError(null);
    setMessage(null);
    setCreatedMeetingId(null);
    startTransition(async () => {
      try {
        await addSongToMeetingAction({ meetingId, songId, isBackup });
        setMessage(isBackup ? "Cântarea a fost adăugată ca backup." : "Cântarea a fost adăugată în program.");
        await loadMeetings();
      } catch (error) {
        setError(error instanceof Error ? error.message : "Nu am putut adăuga cântarea.");
      }
    });
  }

  function createMeetingAndAdd(formData: FormData) {
    if(creationLock.current)return;creationLock.current=true;
    setError(null);
    setMessage(null);
    setCreatedMeetingId(null);
    startTransition(async () => {
      try {
        const title = String(formData.get("title") || "").trim();
        const meetingType = String(formData.get("meeting_type") || "").trim();
        const meetingDate = String(formData.get("meeting_date") || "");
        const isBackup = formData.get("is_backup") === "on";

        const meetingId = await createMeetingAndAddSongAction({
          title,
          meetingType: meetingType || null,
          meetingDate,
          songId,
          isBackup,requestId:requestId.current
        });

        setCreatedMeetingId(meetingId);
        setMessage("Programul a fost creat și cântarea a fost adăugată.");
        await loadMeetings();
      } catch (error) {
        creationLock.current=false;
        setError(error instanceof Error ? error.message : "Nu am putut crea programul.");
      }
    });
  }

  return (
    <>
      <button className={compact ? "song-add-button" : "btn secondary btn-compact"} type="button" aria-label={`Adaugă ${songTitle} în program`} onClick={() => {requestId.current=crypto.randomUUID();creationLock.current=false;setOpen(true);}}>
        {compact ? <Icon name="plus" size={18}/> : "Adaugă în program"}
      </button>

      {open ? (
        <div className="dialog-backdrop" role="presentation">
          <div className="dialog dialog-wide" role="dialog" aria-modal="true" aria-label="Adaugă cântare în program">
            <div className="top-row">
              <div>
                <div className="eyebrow">Adaugă cântare</div>
                <h2>{songTitle}</h2>
              </div>
              <button className="btn secondary" type="button" onClick={() => setOpen(false)}>Închide</button>
            </div>

            {message ? <p className="success">{message} {createdMeetingId ? <Link href={`/meetings/${createdMeetingId}`}>Deschide programul</Link> : null}</p> : null}
            {error ? <p className="error">{error}</p> : null}

            <div className="grid grid-2">
              <section className="card-soft">
                <h3>Program existent</h3>
                <div className="list compact-list">
                  {meetings.length === 0 ? <p className="muted">Nu există programe încă.</p> : null}
                  {meetings.map((meeting) => (
                    <div className="row compact-row" key={meeting.id}>
                      <div className="row-main">
                        <div className="row-title">{meeting.title}</div>
                        <div className="muted small">{formatDateTime(meeting.meeting_date)} · {meeting.status}</div>
                      </div>
                      <div className="inline-form nowrap">
                        <button className="btn btn-compact" type="button" disabled={isPending} onClick={() => addToMeeting(meeting.id, false)}>Normal</button>
                        <button className="btn secondary btn-compact" type="button" disabled={isPending} onClick={() => addToMeeting(meeting.id, true)}>Backup</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="card-soft">
                <h3>Program nou</h3>
                <form action={createMeetingAndAdd} className="form-grid">
                  <label className="label">Titlu
                    <input className="input" name="title" placeholder="Duminică dimineața" required />
                  </label>
                  <label className="label">Tip întâlnire
                    <input className="input" name="meeting_type" placeholder="duminica_dimineata" />
                  </label>
                  <MeetingDatePicker disabled={isPending}/>
                  <label className="inline-form small">
                    <input name="is_backup" type="checkbox" /> Adaugă direct ca backup
                  </label>
                  <button className="btn" type="submit" disabled={isPending}>Creează și adaugă</button>
                </form>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
