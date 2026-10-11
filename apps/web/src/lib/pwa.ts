import { useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
let snapshot = { canInstall: false, installed: false };

function refresh(): void {
  const standalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true);
  const next = {
    canInstall: deferred !== null,
    installed: installed || standalone,
  };
  if (
    next.canInstall !== snapshot.canInstall ||
    next.installed !== snapshot.installed
  ) {
    snapshot = next;
  }
  for (const l of listeners) {
    l();
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    refresh();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    refresh();
  });
  refresh();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useInstallPrompt() {
  const state = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot
  );
  return {
    ...state,
    install: async () => {
      if (!deferred) {
        return false;
      }
      await deferred.prompt();
      const choice = await deferred.userChoice;
      deferred = null;
      refresh();
      return choice.outcome === "accepted";
    },
  };
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) {
    return false;
  }
  return (
    (await navigator.storage.persisted()) || (await navigator.storage.persist())
  );
}

export async function isStoragePersistent(): Promise<boolean> {
  return (await navigator.storage?.persisted?.()) ?? false;
}

export async function storageUsageMb(): Promise<number | null> {
  const estimate = await navigator.storage?.estimate?.();
  return estimate?.usage === undefined ? null : estimate.usage / (1024 * 1024);
}
