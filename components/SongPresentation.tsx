"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type PresentationSlide = {
  id: string;
  label: string;
  content: string;
  musicalKey?:string|null;verseCount?:number|null;structure?:string|null;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function splitFallbackLyrics(lyricsText: string | null | undefined): PresentationSlide[] {
  const chunks = String(lyricsText || "")
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return chunks.map((content, index) => ({
    id: `fallback-${index}`,
    label: `Slide ${index + 1}`,
    content,
  }));
}

function normalizeLines(content: string) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function calculateAutoScale(lines: string[]) {
  const lineCount = Math.max(1, lines.length);
  const longestLine = Math.max(1, ...lines.map((line) => line.length));
  const byLines = lineCount <= 6 ? 1 : 6 / lineCount;
  const byLength = longestLine <= 34 ? 1 : 34 / longestLine;
  return clamp(Math.min(byLines, byLength), 0.52, 1);
}

export function SongPresentation({
  songId,
  title,
  slides,
  fallbackLyrics,
  returnHref,
  defaultKey,live=false,
}: {
  songId: string;
  title: string;
  slides: PresentationSlide[];
  fallbackLyrics?: string | null;
  returnHref?: string;
  defaultKey?:string|null;live?:boolean;
}) {
  const router = useRouter();
  const exitHref = returnHref || `/songs/${songId}`;
  const allSlides = useMemo(() => {
    const prepared = slides
      .map((slide) => ({
        ...slide,
        content: slide.content.trim(),
        label: slide.label?.trim() || "Slide",
      }))
      .filter((slide) => slide.content.length > 0);
    return prepared.length > 0 ? prepared : splitFallbackLyrics(fallbackLyrics);
  }, [slides, fallbackLyrics]);

  const [index, setIndex] = useState(0);
  const [fontScale, setFontScale] = useState(92);
  const [flash,setFlash]=useState(false);const previousSlides=useRef<string|null>(null);
  const contentVersion=JSON.stringify(allSlides);
  useEffect(()=>{if(previousSlides.current!==null&&previousSlides.current!==contentVersion){setFlash(true);const timer=setTimeout(()=>setFlash(false),5000);previousSlides.current=contentVersion;return()=>clearTimeout(timer);}previousSlides.current=contentVersion;},[contentVersion]);
  useEffect(()=>{if(!live)return;const update=()=>{if(!document.hidden)router.refresh();};const timer=setInterval(update,15000);window.addEventListener('focus',update);return()=>{clearInterval(timer);window.removeEventListener('focus',update);};},[live,router]);
  const current = allSlides[Math.min(index,Math.max(0,allSlides.length-1))];
  const musicalKey=current?.musicalKey!==undefined ? current.musicalKey : defaultKey;
  const currentLines = useMemo(() => normalizeLines(current?.content || ""), [current?.content]);
  const autoScale = useMemo(() => calculateAutoScale(currentLines), [currentLines]);
  const combinedScale = autoScale * (fontScale / 100);
  const canGoPrev = index > 0;
  const canGoNext = index < allSlides.length - 1;

  useEffect(() => {
    const saved = window.localStorage.getItem("songapp:presentation-font-scale");
    if (saved) setFontScale(clamp(Number(saved) || 92, 60, 115));
  }, []);

  useEffect(() => {
    window.localStorage.setItem("songapp:presentation-font-scale", String(fontScale));
  }, [fontScale]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        router.push(exitHref);
        return;
      }
      if (["ArrowRight", "PageDown", " ", "Enter"].includes(event.key)) {
        event.preventDefault();
        setIndex((value) => clamp(value + 1, 0, Math.max(0, allSlides.length - 1)));
      }
      if (["ArrowLeft", "PageUp", "Backspace"].includes(event.key)) {
        event.preventDefault();
        setIndex((value) => clamp(value - 1, 0, Math.max(0, allSlides.length - 1)));
      }
      if (event.key === "Home") setIndex(0);
      if (event.key === "End") setIndex(Math.max(0, allSlides.length - 1));
      if ((event.ctrlKey || event.metaKey) && ["+", "="].includes(event.key)) {
        event.preventDefault();
        setFontScale((value) => clamp(value + 5, 60, 115));
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "-") {
        event.preventDefault();
        setFontScale((value) => clamp(value - 5, 60, 115));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [allSlides.length, router, exitHref]);

  if (allSlides.length === 0) {
    return (
      <div className="presentation-shell">
        <div className="presentation-empty">
          <h1>{title}</h1>
          <p>Nu există elemente pentru prezentare.</p>
          <Link className="presentation-link" href={exitHref}>Înapoi</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="presentation-shell">
      <header className="presentation-topbar">
        <div>
          <div className="presentation-eyebrow">Prezentare</div>
          <strong>{title}</strong>
        </div>
        <div className="presentation-actions">
          <span>{index + 1} / {allSlides.length}</span>
          <button className="presentation-mini-button" type="button" onClick={() => setFontScale((value) => clamp(value - 5, 60, 115))}>A−</button>
          <span className="presentation-scale">{fontScale}%</span>
          <button className="presentation-mini-button" type="button" onClick={() => setFontScale((value) => clamp(value + 5, 60, 115))}>A+</button>
          <button className="presentation-mini-button" type="button" onClick={() => setFontScale(92)}>Reset</button>
          <Link className="presentation-link" href={exitHref}>Ieșire</Link>
        </div>
      </header>

      <main className={"presentation-slide"+(flash?" recent-program-change":"")} onClick={() => setIndex((value) => clamp(value + 1, 0, allSlides.length - 1))}>
        <div className="presentation-slide-heading"><div className="presentation-label">{current.label}</div>{current.verseCount!==undefined?<span className="badge">Strofe: {current.verseCount??"—"}</span>:null}{current.structure?<span className="badge">Structură: {current.structure}</span>:null}{musicalKey!==undefined?<span className="presentation-musical-key" aria-label="Tonalitatea cântării">Tonalitate {musicalKey || "—"}</span>:null}</div>
        <div
          className="presentation-lyrics"
          style={{
            fontSize: `clamp(24px, ${(5.7 * combinedScale).toFixed(2)}vw, ${(82 * combinedScale).toFixed(0)}px)`,
            lineHeight: currentLines.length > 7 ? 1.16 : 1.2,
          }}
        >
          {currentLines.map((line, lineIndex) => (
            <div className="presentation-line" key={`${current.id}-line-${lineIndex}`}>{line}</div>
          ))}
        </div>
      </main>

      <footer className="presentation-footer">
        <button type="button" onClick={() => setIndex((value) => clamp(value - 1, 0, allSlides.length - 1))} disabled={!canGoPrev}>
          ← Înapoi
        </button>
        <div className="presentation-dots" aria-label="Slide-uri">
          {allSlides.map((slide, slideIndex) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`Mergi la ${slide.label}`}
              className={slideIndex === index ? "active" : ""}
              onClick={() => setIndex(slideIndex)}
            />
          ))}
        </div>
        <button type="button" onClick={() => setIndex((value) => clamp(value + 1, 0, allSlides.length - 1))} disabled={!canGoNext}>
          Înainte →
        </button>
        <span className="presentation-hint">ESC ieșire · Ctrl +/- mărime text</span>
      </footer>
    </div>
  );
}
