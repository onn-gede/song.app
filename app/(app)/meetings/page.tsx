import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { CreateMeetingModal } from "@/components/CreateMeetingModal";

export default async function MeetingsPage() {
  const supabase = await createClient();
  const { data: meetings, error } = await supabase
    .from("meetings")
    .select("id,title,meeting_type,meeting_date,status")
    .order("meeting_date", { ascending: false })
    .limit(100);

  return (
    <>
      <div className="top-row">
        <div>
          <div className="eyebrow">Programe</div>
          <h1>Întâlniri și playlisturi</h1>
        </div>
        <CreateMeetingModal />
      </div>

      <section className="card">
        <div className="inline-form" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ marginBottom: 0 }}>Programe existente</h2>
          <span className="badge">{(meetings || []).length} programe</span>
        </div>
        {error ? <p className="error">{error.message}</p> : null}
        <div className="list compact-list">
          {(meetings || []).map((meeting) => (
            <Link className="row compact-row meeting-link-row" key={meeting.id} href={`/meetings/${meeting.id}`}>
              <span className="row-main">
                <span className="row-title">{meeting.title}</span>
                <span className="muted small meta-line">
                  <span>{formatDateTime(meeting.meeting_date)}</span>
                  <span>·</span>
                  <span>{meeting.meeting_type || "fără tip"}</span>
                </span>
              </span>
              <span className="badge">{meeting.status}</span>
            </Link>
          ))}
          {(!meetings || meetings.length === 0) ? <p className="muted">Nu există programe încă.</p> : null}
        </div>
      </section>
    </>
  );
}
