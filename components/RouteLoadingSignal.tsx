"use client";

import { useEffect } from "react";

export function RouteLoadingSignal() {
  useEffect(() => {
    window.dispatchEvent(new Event("songapp:route-loading-start"));
    return () => {
      window.dispatchEvent(new Event("songapp:route-loading-complete"));
    };
  }, []);
  return null;
}
