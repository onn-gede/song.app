"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const STORAGE_KEY = "songapp:return-to-program";

function validProgramPath(value: string | null) {
  if (!value) return null;
  if (/^\/meetings\/[0-9a-f-]+$/i.test(value)) return value;
  if (/^\/program\/[a-z0-9-]+$/i.test(value)) return value;
  return null;
}

export function ProgramReturnButton() {
  const pathname = usePathname();
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    if (!pathname.startsWith("/songs/")) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      setHref(null);
      return;
    }

    const fromQuery = validProgramPath(new URLSearchParams(window.location.search).get("returnTo"));
    if (fromQuery) window.sessionStorage.setItem(STORAGE_KEY, fromQuery);
    setHref(fromQuery || validProgramPath(window.sessionStorage.getItem(STORAGE_KEY)));
  }, [pathname]);

  if (!href || !pathname.startsWith("/songs/")) return null;
  return <Link className="program-return-button print-hide" href={href}>← Înapoi la program</Link>;
}
