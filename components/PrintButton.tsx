"use client";

export function PrintButton({ label = "Print / PDF" }: { label?: string }) {
  return (
    <button className="btn secondary btn-compact print-hide" type="button" onClick={() => window.print()}>
      {label}
    </button>
  );
}
