"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const VERSION_STORAGE_KEY = "miniclassisland_web_app_version";
const AUTH_PATH_RE = /^\/(login|register|auth|pre-registration)(\/|$)/;

function triggerPrecache(reg: ServiceWorkerRegistration) {
  const sw = reg.active || reg.waiting || reg.installing;
  if (sw) {
    sw.postMessage({ type: "START_PRECACHE" });
  }
}

async function checkRemoteVersion(reg: ServiceWorkerRegistration) {
  try {
    const resp = await fetch("/version.json", { cache: "no-store" });
    if (!resp.ok) return;
    const data = await resp.json();
    const remoteVersion = typeof data?.version === "string" ? data.version : "";
    if (!remoteVersion) return;

    const cachedVersion = localStorage.getItem(VERSION_STORAGE_KEY);
    if (cachedVersion !== remoteVersion) {
      localStorage.setItem(VERSION_STORAGE_KEY, remoteVersion);
      await reg.update();
    }
    triggerPrecache(reg);
  } catch {
    // Ignore offline / network errors when checking version
  }
}

export default function ServiceWorkerRegistrar() {
  const { isAuthenticated, initialized } = useAuth();
  const pathname = usePathname() || "/";
  const isAuthPage = AUTH_PATH_RE.test(pathname);
  const canCache = initialized && isAuthenticated && !isAuthPage;

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const onMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "PRECACHE_PROGRESS") {
        const detail = {
          status: event.data.status as "updating" | "done",
          percent: Number(event.data.percent ?? 0),
        };
        (window as unknown as Record<string, unknown>).__mciCacheProgress = detail;
        window.dispatchEvent(new CustomEvent("mci-sw-cache-progress", { detail }));
      }
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);

  useEffect(() => {
    if (!canCache || typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let registration: ServiceWorkerRegistration | null = null;
    let lastCheck = 0;

    const runCheck = () => {
      const now = Date.now();
      if (!registration || now - lastCheck < 60_000) return;
      lastCheck = now;
      void checkRemoteVersion(registration);
    };

    navigator.serviceWorker
      .register("/worker.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        registration = reg;
        lastCheck = Date.now();
        void checkRemoteVersion(reg);
      })
      .catch(() => {
        // Service worker registration failed
      });

    const onControllerChange = () => {
      if (registration) {
        triggerPrecache(registration);
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        runCheck();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [canCache]);

  return null;
}
