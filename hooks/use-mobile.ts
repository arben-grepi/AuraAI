import * as React from "react";

const MOBILE_BREAKPOINT = 768;

function subscribe(onStoreChange: () => void): () => void {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  const onChange = () => onStoreChange();
  mql.addEventListener("change", onChange);
  window.addEventListener("resize", onChange);
  return () => {
    mql.removeEventListener("change", onChange);
    window.removeEventListener("resize", onChange);
  };
}

function getSnapshot(): boolean {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

/** SSR + first hydrated client frame: desktop layout (must match server HTML). */
function getServerSnapshot(): boolean {
  return false;
}

/**
 * Mobile vs desktop breakpoint. Uses useSyncExternalStore so the hydrated first
 * paint matches the server (non-mobile) and updates after hydration — avoids
 * Sidebar SSR/client DOM mismatches.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
