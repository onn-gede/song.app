import { formatDateTime } from "@/lib/format";
import type { RecentUsage } from "@/app/(app)/meetings/actions";

export function getRecentUsageTooltip(usage?: RecentUsage) {
  if (!usage) return null;
  const count = usage.times_used > 1 ? ` · ${usage.times_used} folosiri` : "";
  const meeting = usage.last_meeting_title ? ` · ${usage.last_meeting_title}` : "";
  return `Folosită recent: ${formatDateTime(usage.last_used_at)}${meeting}${count}`;
}

export function RecentUsageIcon({ usage, label = "Folosită recent" }: { usage?: RecentUsage; label?: string }) {
  const tooltip = getRecentUsageTooltip(usage);
  if (!tooltip) return null;

  return (
    <span className="recent-usage-icon" title={tooltip} aria-label={tooltip} role="img">
      !<span className="sr-only">{label}</span>
    </span>
  );
}
