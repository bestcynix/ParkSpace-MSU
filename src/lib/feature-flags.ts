"use client";

import { useEffect, useState } from "react";

export type FeatureFlagKey =
  | "individual_slot_selection"
  | "qr_code_checkin"
  | "guest_bookings"
  | "instant_realtime_sync"
  | "dark_mode_preview"
  | "auto_slot_allocation"
  | "overstay_detection_alert"
  | "public_api_rate_limit";

export const DEFAULT_FLAG_VALUES: Record<FeatureFlagKey, boolean> = {
  individual_slot_selection: true,
  qr_code_checkin: true,
  guest_bookings: false,
  instant_realtime_sync: true,
  dark_mode_preview: false,
  auto_slot_allocation: true,
  overstay_detection_alert: true,
  public_api_rate_limit: true,
};

const STORAGE_KEY = "parkspace_feature_flags_v1";
const EVENT_NAME = "parkspace:feature-flag-change";

export function getFeatureFlag(key: FeatureFlagKey): boolean {
  if (typeof window === "undefined") {
    return DEFAULT_FLAG_VALUES[key] ?? false;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      if (typeof parsed[key] === "boolean") {
        return parsed[key];
      }
    }
  } catch {
    // fallback
  }
  return DEFAULT_FLAG_VALUES[key] ?? false;
}

export function setFeatureFlag(key: FeatureFlagKey, enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    parsed[key] = enabled;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));

    // Also persist as cookie for SSR availability
    document.cookie = `ff_${key}=${enabled ? "1" : "0"}; path=/; max-age=31536000; SameSite=Lax`;

    // Apply dark mode side effect directly
    if (key === "dark_mode_preview") {
      applyDarkModeClass(enabled);
    }

    // Broadcast to current window and other listeners
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { key, enabled } }));
  } catch {
    // Ignore storage quota
  }
}

export function applyDarkModeClass(enabled: boolean): void {
  if (typeof document === "undefined") return;
  if (enabled) {
    document.documentElement.classList.add("dark-theme");
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.classList.remove("dark-theme");
    document.documentElement.removeAttribute("data-theme");
  }
}

export function useFeatureFlag(key: FeatureFlagKey): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => getFeatureFlag(key));

  useEffect(() => {
    // Initialize current state
    setEnabled(getFeatureFlag(key));

    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ key: FeatureFlagKey; enabled: boolean }>;
      if (!custom.detail || custom.detail.key === key) {
        setEnabled(getFeatureFlag(key));
      }
    };

    const storageHandler = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setEnabled(getFeatureFlag(key));
      }
    };

    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener("storage", storageHandler);

    // If dark mode preview, sync DOM on mount
    if (key === "dark_mode_preview") {
      applyDarkModeClass(getFeatureFlag(key));
    }

    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener("storage", storageHandler);
    };
  }, [key]);

  return enabled;
}
