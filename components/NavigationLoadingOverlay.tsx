"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AppLoaderContent } from "./AppLoaderContent";

const SHOW_AFTER_MS = 1800;
const MINIMUM_VISIBLE_MS = 4000;
const LOGIN_LOADER_COOKIE = "songapp_login_loader";

export function NavigationLoadingOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const delayTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const visibleSince = useRef(0);
  const initialRoute = useRef(true);

  function cancelDelay() {
    if (delayTimer.current) window.clearTimeout(delayTimer.current);
    delayTimer.current = null;
  }

  function complete() {
    cancelDelay();
    if (!visibleSince.current) return;
    const remaining = Math.max(0, MINIMUM_VISIBLE_MS - (Date.now() - visibleSince.current));
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      setVisible(false);
      visibleSince.current = 0;
      hideTimer.current = null;
    }, remaining);
  }

  function force() {
    cancelDelay();
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    visibleSince.current = Date.now();
    setVisible(true);
    hideTimer.current = window.setTimeout(() => {
      setVisible(false);
      visibleSince.current = 0;
      hideTimer.current = null;
    }, MINIMUM_VISIBLE_MS);
  }

  function consumeLoginLoader() {
    const enabled = document.cookie.split(";").some((entry) => entry.trim() === `${LOGIN_LOADER_COOKIE}=1`);
    if (enabled) document.cookie = `${LOGIN_LOADER_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
    return enabled;
  }

  useEffect(() => {
    if (consumeLoginLoader()) {
      initialRoute.current = false;
      force();
      return;
    }
    if (initialRoute.current) {
      initialRoute.current = false;
      return;
    }
    complete();
    // complete intentionally reads refs and the current visibility timestamp.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  useEffect(() => {
    const start = () => {
      // A route can emit more than one loading signal. Keep the first timer,
      // and never replace a forced four-second loader (login/program creation).
      if (delayTimer.current || visibleSince.current) return;
      delayTimer.current = window.setTimeout(() => {
        visibleSince.current = Date.now();
        setVisible(true);
        delayTimer.current = null;
      }, SHOW_AFTER_MS);
    };
    const click = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link || link.download || link.target === "_blank") return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.href === window.location.href || url.hash) return;
      start();
    };
    const loadingComplete = () => complete();
    const forceLoader = () => force();
    document.addEventListener("click", click, true);
    window.addEventListener("popstate", start);
    window.addEventListener("songapp:route-loading-start", start);
    window.addEventListener("songapp:route-loading-complete", loadingComplete);
    window.addEventListener("songapp:force-loader", forceLoader);
    return () => {
      document.removeEventListener("click", click, true);
      window.removeEventListener("popstate", start);
      window.removeEventListener("songapp:route-loading-start", start);
      window.removeEventListener("songapp:route-loading-complete", loadingComplete);
      window.removeEventListener("songapp:force-loader", forceLoader);
      cancelDelay();
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, []);
  if (!visible) return null;
  return (
    <div className="app-global-loader navigation-loading-overlay" role="status" aria-live="polite">
      <AppLoaderContent />
    </div>
  );
}
