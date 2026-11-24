const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;

export function youtubeVideoId(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    let candidate = "";
    if (host === "youtu.be") candidate = url.pathname.split("/").filter(Boolean)[0] || "";
    else if (["youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com"].includes(host)) {
      candidate = url.searchParams.get("v") || "";
      if (!candidate) {
        const parts = url.pathname.split("/").filter(Boolean);
        if (["embed", "shorts", "live"].includes(parts[0] || "")) candidate = parts[1] || "";
      }
    }
    return YOUTUBE_ID.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

export function normalizeYouTubeUrl(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const id = youtubeVideoId(raw);
  if (!id) throw new Error("Introdu un link YouTube valid (youtube.com sau youtu.be).");
  return `https://www.youtube.com/watch?v=${id}`;
}

export function youtubePrivacyEmbedUrl(value: string | null | undefined) {
  const id = youtubeVideoId(value);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0` : null;
}

export function youtubeThumbnailUrl(value: string | null | undefined) {
  const id = youtubeVideoId(value);
  return id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : null;
}
