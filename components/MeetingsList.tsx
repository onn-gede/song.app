"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "./Icon";
import { useMeetingClock, MEETING_STATUS_LABELS } from "./MeetingStatus";
import { meetingStatus } from "@/lib/meeting-state";

type Row = {
  id: string;
  title: string;
  meeting_type: string | null;
  meeting_date: string;
  status: string;
  is_template: boolean;
  program_kind?: "official" | "rehearsal";
};

type Mode = "all" | "upcoming" | "finished" | "templates";
type MeetingState = ReturnType<typeof meetingStatus>;
const BUCHAREST = "Europe/Bucharest";

function dateKey(value: string | number | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUCHAREST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const pick = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function monthFrom(value: string | number | Date) {
  const [year, month] = dateKey(value).split("-").map(Number);
  return { year, month };
}

function longDate(date: Date) {
  return date.toLocaleDateString("ro-RO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: BUCHAREST,
  });
}

function timeLabel(date: Date) {
  return date.toLocaleTimeString("ro-RO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: BUCHAREST,
  });
}

function kindLabel(meeting: Row) {
  return meeting.program_kind === "rehearsal" ? "Repetiție" : "Program oficial";
}

function MeetingCard({ meeting, status }: { meeting: Row; status: MeetingState }) {
  const date = new Date(meeting.meeting_date);
  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className={`meeting-card-v44 ${meeting.program_kind === "rehearsal" ? "is-rehearsal" : "is-official"}`}
    >
      <div className="meeting-card-top">
        <span className={`meeting-date-tile${meeting.is_template ? " is-template" : ""}`}>
          {meeting.is_template ? (
            <Icon name="copy" size={26} />
          ) : (
            <>
              <small>
                {date.toLocaleDateString("ro-RO", { month: "short", timeZone: BUCHAREST }).replace(".", "")}
              </small>
              <strong>{date.toLocaleDateString("ro-RO", { day: "2-digit", timeZone: BUCHAREST })}</strong>
            </>
          )}
        </span>
        <span className={`meeting-status status-${status}`} data-meeting-state={status}>
          <i />
          {MEETING_STATUS_LABELS[status] || status}
        </span>
      </div>
      <div className="meeting-kind-line">{kindLabel(meeting)}</div>
      <h2>{meeting.title}</h2>
      <p>{meeting.is_template ? "Șablon pentru un program nou" : `${longDate(date)} · ${timeLabel(date)}`}</p>
      <div className="meeting-card-bottom">
        <span>{meeting.meeting_type?.replace(/_/g, " ") || "Program"}</span>
        <Icon name="arrow" size={18} />
      </div>
    </Link>
  );
}

function MeetingTable({ meetings, now }: { meetings: Row[]; now: number }) {
  if (!meetings.length) return null;
  return (
    <div className="meetings-table-wrap">
      <table className="meetings-table">
        <thead>
          <tr>
            <th>Program</th>
            <th>Data și ora</th>
            <th>Tip</th>
            <th>Stare</th>
            <th aria-label="Deschide" />
          </tr>
        </thead>
        <tbody>
          {meetings.map((meeting) => {
            const date = new Date(meeting.meeting_date);
            const status = meetingStatus(
              meeting.meeting_date,
              meeting.status,
              meeting.is_template,
              new Date(now),
            );
            return (
              <tr
                key={meeting.id}
                className={meeting.program_kind === "rehearsal" ? "is-rehearsal" : "is-official"}
              >
                <td>
                  <Link href={`/meetings/${meeting.id}`}>
                    <strong>{meeting.title}</strong>
                    {meeting.meeting_type ? <small>{meeting.meeting_type.replace(/_/g, " ")}</small> : null}
                  </Link>
                </td>
                <td>
                  {date.toLocaleDateString("ro-RO", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    timeZone: BUCHAREST,
                  })}
                  <small>{timeLabel(date)}</small>
                </td>
                <td>{kindLabel(meeting)}</td>
                <td>
                  <span className={`meeting-status status-${status}`}>
                    <i /> {MEETING_STATUS_LABELS[status] || status}
                  </span>
                </td>
                <td>
                  <Link
                    className="meeting-row-open"
                    href={`/meetings/${meeting.id}`}
                    aria-label={`Deschide ${meeting.title}`}
                  >
                    <Icon name="chevron" size={17} />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MeetingsCalendar({ meetings, now }: { meetings: Row[]; now: number }) {
  const [view, setView] = useState(() => monthFrom(now));
  const [selected, setSelected] = useState<string | null>(null);
  const byDay = useMemo(() => {
    const map = new Map<string, Row[]>();
    meetings.forEach((meeting) => {
      if (meeting.is_template) return;
      const key = dateKey(meeting.meeting_date);
      map.set(key, [...(map.get(key) || []), meeting]);
    });
    map.forEach((rows) => rows.sort((a, b) => Date.parse(a.meeting_date) - Date.parse(b.meeting_date)));
    return map;
  }, [meetings]);
  const days = new Date(Date.UTC(view.year, view.month, 0)).getUTCDate();
  const firstWeekday = (new Date(Date.UTC(view.year, view.month - 1, 1)).getUTCDay() + 6) % 7;
  const today = dateKey(now);
  const selectedMeetings = selected ? byDay.get(selected) || [] : [];
  const monthTitle = new Intl.DateTimeFormat("ro-RO", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(view.year, view.month - 1, 15)),
  );

  function moveMonth(delta: number) {
    const next = new Date(Date.UTC(view.year, view.month - 1 + delta, 1));
    setView({ year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 });
    setSelected(null);
  }

  return (
    <aside className="meetings-calendar" aria-label="Calendarul programelor">
      <div className="meetings-calendar-heading">
        <div>
          <div className="eyebrow">Calendar</div>
          <h2>{monthTitle}</h2>
        </div>
        <div className="inline-form">
          <button
            type="button"
            className="icon-btn"
            onClick={() => moveMonth(-1)}
            aria-label="Luna precedentă"
          >
            ‹
          </button>
          <button type="button" className="icon-btn" onClick={() => moveMonth(1)} aria-label="Luna următoare">
            ›
          </button>
        </div>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">
        {["Lu", "Ma", "Mi", "Jo", "Vi", "Sâ", "Du"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-days">
        {Array.from({ length: firstWeekday }).map((_, index) => (
          <span key={`empty-${index}`} />
        ))}
        {Array.from({ length: days }, (_, index) => index + 1).map((day) => {
          const key = `${view.year}-${String(view.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const rows = byDay.get(key) || [];
          return (
            <button
              type="button"
              key={key}
              className={`${key === today ? "is-today" : ""} ${selected === key ? "is-selected" : ""}`}
              onClick={() => setSelected(rows.length ? key : null)}
              aria-label={`${day} ${monthTitle}${rows.length ? `, ${rows.length} programări` : ""}`}
            >
              <span>{day}</span>
              {rows.length ? (
                <i className={key < today ? "is-past" : "is-future"} aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="calendar-legend">
        <span>
          <i className="is-future" /> Urmează
        </span>
        <span>
          <i className="is-past" /> Trecut
        </span>
      </div>
      {selected ? (
        <div className="calendar-selection">
          <strong>
            {new Date(`${selected}T12:00:00`).toLocaleDateString("ro-RO", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </strong>
          {selectedMeetings.map((meeting) => (
            <Link key={meeting.id} href={`/meetings/${meeting.id}`}>
              <span>{meeting.title}</span>
              <small>
                {timeLabel(new Date(meeting.meeting_date))} · {kindLabel(meeting)}
              </small>
            </Link>
          ))}
        </div>
      ) : (
        <p className="muted small calendar-help">Alege o dată marcată pentru a vedea programările.</p>
      )}
    </aside>
  );
}

function Pagination({
  page,
  pages,
  onPage,
}: {
  page: number;
  pages: number;
  onPage: (page: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <nav className="meetings-pagination" aria-label="Pagini programe">
      <button
        type="button"
        className="btn secondary btn-compact"
        disabled={page === 1}
        onClick={() => onPage(page - 1)}
      >
        Înapoi
      </button>
      <div>
        {Array.from({ length: pages }, (_, index) => index + 1).map((number) => (
          <button
            type="button"
            key={number}
            className={number === page ? "is-current" : ""}
            aria-current={number === page ? "page" : undefined}
            onClick={() => onPage(number)}
          >
            {number}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn secondary btn-compact"
        disabled={page === pages}
        onClick={() => onPage(page + 1)}
      >
        Înainte
      </button>
    </nav>
  );
}

export function MeetingsList({
  meetings,
  mode,
  initialNow,
}: {
  meetings: Row[];
  mode: Mode;
  initialNow: number;
}) {
  const now = useMeetingClock(
    meetings.map((meeting) => meeting.meeting_date),
    initialNow,
  );
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [mode]);
  const stateFor = (meeting: Row) =>
    meetingStatus(meeting.meeting_date, meeting.status, meeting.is_template, new Date(now));
  const visible = meetings.filter((meeting) => {
    const state = stateFor(meeting);
    return mode === "templates"
      ? meeting.is_template
      : mode === "upcoming"
        ? state === "draft" || state === "ready" || state === "in_progress"
        : mode === "finished"
          ? state === "finished"
          : !meeting.is_template;
  });
  const active = visible
    .filter((meeting) => ["draft", "ready", "in_progress"].includes(stateFor(meeting)))
    .sort((a, b) => Date.parse(a.meeting_date) - Date.parse(b.meeting_date));
  const featured = mode === "templates" || mode === "finished" ? [] : active.slice(0, 3);
  const featuredIds = new Set(featured.map((meeting) => meeting.id));
  const tableRows = visible
    .filter((meeting) => !featuredIds.has(meeting.id))
    .sort((a, b) => {
      const aFinished = stateFor(a) === "finished";
      const bFinished = stateFor(b) === "finished";
      if (aFinished !== bFinished) return aFinished ? 1 : -1;
      return aFinished
        ? Date.parse(b.meeting_date) - Date.parse(a.meeting_date)
        : Date.parse(a.meeting_date) - Date.parse(b.meeting_date);
    });
  const perPage = mode === "templates" ? 6 : Math.max(3, 6 - featured.length);
  const pagedSource = mode === "templates" ? visible : tableRows;
  const pages = Math.max(1, Math.ceil(pagedSource.length / perPage));
  const safePage = Math.min(page, pages);
  const pageRows = pagedSource.slice((safePage - 1) * perPage, safePage * perPage);
  const caption =
    mode === "templates"
      ? "Șabloane reutilizabile"
      : mode === "upcoming"
        ? "Întâlniri viitoare și în curs"
        : mode === "finished"
          ? "Programe finalizate"
          : "Programe existente";

  return (
    <>
      <div className="results-caption-v44">
        <span>{caption}</span>
        <small>
          {visible.length} {mode === "templates" ? "șabloane" : "programe"}
        </small>
      </div>
      <div className={mode === "templates" ? "" : "meetings-overview-layout"}>
        <div className="meetings-overview-main">
          {mode === "templates" ? (
            <div className="meeting-cards-v44">
              {pageRows.map((meeting) => (
                <MeetingCard key={meeting.id} meeting={meeting} status={stateFor(meeting)} />
              ))}
            </div>
          ) : (
            <>
              {featured.length ? (
                <section className="featured-meetings" aria-labelledby="featured-meetings-title">
                  <h2 id="featured-meetings-title">Urmează</h2>
                  <div className="meeting-cards-v44">
                    {featured.map((meeting) => (
                      <MeetingCard key={meeting.id} meeting={meeting} status={stateFor(meeting)} />
                    ))}
                  </div>
                </section>
              ) : null}
              {pageRows.length ? (
                <section className="other-meetings" aria-labelledby="other-meetings-title">
                  <h2 id="other-meetings-title">{featured.length ? "Mai departe" : caption}</h2>
                  <MeetingTable meetings={pageRows} now={now} />
                </section>
              ) : null}
            </>
          )}
          <Pagination page={safePage} pages={pages} onPage={setPage} />
        </div>
        {mode !== "templates" ? <MeetingsCalendar meetings={meetings} now={now} /> : null}
      </div>
      {!visible.length ? (
        <div className="empty-state-v44">
          <span>
            <Icon name="calendar" size={32} />
          </span>
          <h2>Niciun program aici</h2>
          <p>
            {mode === "templates"
              ? "Păstrează un program existent ca șablon."
              : "Creează o întâlnire și alege cântările din bibliotecă."}
          </p>
        </div>
      ) : null}
    </>
  );
}
