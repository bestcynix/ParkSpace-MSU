"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { applyDarkModeClass, getFeatureFlag, setFeatureFlag } from "@/lib/feature-flags";

export function ThemeToggle({ locale }: { locale: Locale }) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check saved theme in localStorage or feature flags
    const savedTheme = window.localStorage.getItem("parkspace_theme");
    const flagDark = getFeatureFlag("dark_mode_preview");
    const isDarkMode = savedTheme === "dark" || (!savedTheme && flagDark);
    setIsDark(isDarkMode);
    applyDarkModeClass(isDarkMode);
  }, []);

  function toggleTheme() {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("parkspace_theme", nextDark ? "dark" : "light");
      setFeatureFlag("dark_mode_preview", nextDark);
      applyDarkModeClass(nextDark);
    }
  }

  const label = locale === "th"
    ? isDark ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"
    : isDark ? "Switch to light mode" : "Switch to dark mode";

  if (!mounted) {
    return (
      <button
        type="button"
        className="icon-button theme-toggle-btn"
        aria-label="Toggle theme"
        disabled
        style={{ opacity: 0.6 }}
      >
        <Moon size={18} />
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`icon-button theme-toggle-btn ${isDark ? "is-dark" : "is-light"}`}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
    >
      {isDark ? (
        <Sun size={18} className="theme-icon sun" style={{ color: "#f8c928" }} />
      ) : (
        <Moon size={18} className="theme-icon moon" style={{ color: "#4b5563" }} />
      )}
    </button>
  );
}
