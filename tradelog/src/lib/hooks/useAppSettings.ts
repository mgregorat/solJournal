"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type AppSettings = {
  autoSyncOnLogin: boolean;
  preloadDataInBackground: boolean;
};

const DEFAULT_SETTINGS: AppSettings = {
  autoSyncOnLogin: true,
  preloadDataInBackground: true,
};

function normalizeSettings(value: unknown): AppSettings {
  const settings = (value ?? {}) as Partial<AppSettings>;
  return {
    autoSyncOnLogin:
      typeof settings.autoSyncOnLogin === "boolean"
        ? settings.autoSyncOnLogin
        : DEFAULT_SETTINGS.autoSyncOnLogin,
    preloadDataInBackground:
      typeof settings.preloadDataInBackground === "boolean"
        ? settings.preloadDataInBackground
        : DEFAULT_SETTINGS.preloadDataInBackground,
  };
}

export function useAppSettings(userId?: number | null) {
  const storageKey = useMemo(
    () => (userId ? `tradelog:settings:${userId}` : null),
    [userId]
  );
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") {
      setSettingsState(DEFAULT_SETTINGS);
      return;
    }

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        localStorage.setItem(storageKey, JSON.stringify(DEFAULT_SETTINGS));
        setSettingsState(DEFAULT_SETTINGS);
        return;
      }

      const parsed = JSON.parse(raw);
      const normalized = normalizeSettings(parsed);
      setSettingsState(normalized);
    } catch {
      setSettingsState(DEFAULT_SETTINGS);
    }
  }, [storageKey]);

  const persist = useCallback(
    (next: AppSettings) => {
      setSettingsState(next);
      if (!storageKey || typeof window === "undefined") return;
      localStorage.setItem(storageKey, JSON.stringify(next));
    },
    [storageKey]
  );

  const setSettings = useCallback(
    (updater: Partial<AppSettings> | ((prev: AppSettings) => AppSettings)) => {
      if (typeof updater === "function") {
        persist((updater as (prev: AppSettings) => AppSettings)(settings));
        return;
      }
      persist({ ...settings, ...updater });
    },
    [persist, settings]
  );

  const updateSetting = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      persist({ ...settings, [key]: value });
    },
    [persist, settings]
  );

  return {
    settings,
    setSettings,
    updateSetting,
    storageKey,
    defaults: DEFAULT_SETTINGS,
  };
}
