"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  Clock3,
  Copy,
  Download,
  Eye,
  Info,
  Layers,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Sliders,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  X,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { setFeatureFlag, type FeatureFlagKey } from "@/lib/feature-flags";

type FlagRole = "admin";
export type FlagStatusFilter = "ALL" | "ENABLED" | "DISABLED";

export type FeatureFlag = {
  key: string;
  name_th: string;
  name_en: string;
  description_th: string;
  description_en: string;
  category: "booking" | "operations" | "access" | "infra" | "ui";
  default_enabled: boolean;
  enabled: boolean;
  environment_override: boolean;
  impact_th: string;
  impact_en: string;
  updated_at: string;
};

const DEFAULT_FEATURE_FLAGS: FeatureFlag[] = [
  {
    key: "individual_slot_selection",
    name_th: "การเลือกช่องจอดรายช่อง (Individual Slot Selection)",
    name_en: "Individual Slot Selection",
    description_th: "อนุญาตให้ผู้ใช้ระบุแถวและตำแหน่งช่องจอดแบบเจาะจง (Row A–G) ได้โดยตรงในหน้าจอง",
    description_en: "Allows drivers to select specific bays and row letters (Row A-G) rather than area-only capacity allocation.",
    category: "booking",
    default_enabled: true,
    enabled: true,
    environment_override: false,
    impact_th: "ส่งผลต่อหน้า /parking/:code/slots และขั้นตอนการจองแบบเจาะจงช่อง",
    impact_en: "Enables bay selection interactive matrix on /parking/:code/slots.",
    updated_at: "2026-09-09T08:00:00Z",
  },
  {
    key: "qr_code_checkin",
    name_th: "การเช็คอินด้วย QR Code (QR Code Check-in)",
    name_en: "QR Code Check-in",
    description_th: "เปิดใช้งานการสร้าง QR Pass ประจำการจอง และเครื่องสแกนของเจ้าหน้าที่สำหรับ Check-in / Check-out",
    description_en: "Enables dynamic QR Pass token generation and staff scanner verification on entrance and exit.",
    category: "operations",
    default_enabled: true,
    enabled: true,
    environment_override: false,
    impact_th: "ส่งผลต่อหน้า /staff/scan และปุ่มแสดง QR ในประวัติการจอง",
    impact_en: "Controls staff QR scanner module and user QR pass generation modal.",
    updated_at: "2026-09-09T08:00:00Z",
  },
  {
    key: "guest_bookings",
    name_th: "การจองสำหรับบุคคลภายนอก (Guest Bookings)",
    name_en: "Guest Bookings",
    description_th: "อนุญาตให้ผู้มาติดต่อภายนอกสามารถจองช่องจอดชั่วคราวได้โดยไม่ต้องใช้บัญชีมหาวิทยาลัย (@msu.ac.th)",
    description_en: "Permits public campus visitors without university single-sign-on credentials to reserve visitor parking spaces.",
    category: "access",
    default_enabled: false,
    enabled: false,
    environment_override: false,
    impact_th: "เปิดให้จองแบบ Guest บนโหมดสาธารณะโดยไม่ต้องเข้าสู่ระบบ",
    impact_en: "Unlocks guest checkout flow without requiring verified MSU SSO credentials.",
    updated_at: "2026-09-09T08:00:00Z",
  },
  {
    key: "instant_realtime_sync",
    name_th: "การซิงก์ข้อมูลสดแบบ Realtime (Instant Realtime Sync)",
    name_en: "Instant Realtime Sync",
    description_th: "เชื่อมต่อ Supabase Realtime Channels เพื่อรับการแจ้งเตือน postgres_changes ของช่องจอดทันที (300ms debounce)",
    description_en: "Maintains active WebSocket channels for immediate 300ms occupancy refreshes upon slot status changes.",
    category: "infra",
    default_enabled: true,
    enabled: true,
    environment_override: false,
    impact_th: "ลดภาระการ Polling และทำให้แถบสถานะอัปเดตแบบเรียลไทม์",
    impact_en: "Replaces interval polling with push-based Postgres change subscriptions.",
    updated_at: "2026-09-09T08:00:00Z",
  },
  {
    key: "dark_mode_preview",
    name_th: "พรีวิวโหมดมืด (Dark Mode Preview)",
    name_en: "Dark Mode Preview",
    description_th: "เปิดใช้งานธีมสีเข้มและการแสดงผลคอนทราสต์สูงสำหรับใช้งานเวลากลางคืนหรือจอแสดงผลกลางแจ้ง",
    description_en: "Activates experimental high-contrast dark color palette for night-time navigation and outdoor visibility.",
    category: "ui",
    default_enabled: false,
    enabled: false,
    environment_override: false,
    impact_th: "เพิ่มตัวเลือกธีมมืดในหน้าตั้งค่าและการแสดงผลหลัก",
    impact_en: "Enables dark color scheme toggle in user settings and app shell.",
    updated_at: "2026-09-09T08:00:00Z",
  },
  {
    key: "auto_slot_allocation",
    name_th: "การจัดสรรช่องจอดอัตโนมัติ (Auto Slot Allocation)",
    name_en: "Auto Slot Allocation",
    description_th: "คำนวณและเลือกช่องจอดที่ดีที่สุดให้อัตโนมัติตามประเภทรถ ความหนาแน่น และระยะเดินเท้า",
    description_en: "Calculates and automatically reserves the optimal available slot matching vehicle classification and walking distance.",
    category: "booking",
    default_enabled: true,
    enabled: true,
    environment_override: false,
    impact_th: "ช่วยแนะนำช่องจอดในขั้นตอน Quick Book",
    impact_en: "Assigns closest available bay automatically during expedited booking.",
    updated_at: "2026-09-09T08:00:00Z",
  },
  {
    key: "overstay_detection_alert",
    name_th: "การแจ้งเตือนการจอดเกินเวลา (Overstay Detection Alerts)",
    name_en: "Overstay Detection Alerts",
    description_th: "ระบบแจ้งเตือนอัตโนมัติเมื่อรถจอดเกินระยะเวลาที่กำหนดในรายการจอง พร้อมแจ้งเจ้าหน้าที่หน้างาน",
    description_en: "Automatically calculates overstay_minutes in active parking sessions and triggers warning notifications.",
    category: "operations",
    default_enabled: true,
    enabled: true,
    environment_override: false,
    impact_th: "ส่งการแจ้งเตือนในหน้ารวมและบันทึกลงใน parking_sessions",
    impact_en: "Flags active sessions in parking_sessions and triggers notification logs.",
    updated_at: "2026-09-09T08:00:00Z",
  },
  {
    key: "public_api_rate_limit",
    name_th: "การจำกัดอัตราเรียก API สาธารณะ (API Rate Limiting)",
    name_en: "Public API Rate Limiting",
    description_th: "จำกัดคำขอต่อนาทีบนเส้นทาง API ที่ไม่ผ่านการยืนยันตัวตนเพื่อป้องกันการโจมตีหรือการใช้ทรัพยากรเกินพิกัด",
    description_en: "Applies sliding window rate limiting on unauthenticated map and capacity endpoints.",
    category: "infra",
    default_enabled: true,
    enabled: true,
    environment_override: false,
    impact_th: "ป้องกันการดึงข้อมูลบ่อยเกินไปบน endpoint /api/*",
    impact_en: "Enforces 100 req/min limits on public campus map coordinates.",
    updated_at: "2026-09-09T08:00:00Z",
  },
];

const STORAGE_KEY = "parkspace_feature_flags_v1";

export function FeatureFlagsManager({ locale, role }: { locale: Locale; role: FlagRole }) {
  const t = getCopy(locale);
  const [flags, setFlags] = useState<FeatureFlag[]>(() => {
    if (typeof window === "undefined") return DEFAULT_FEATURE_FLAGS;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, boolean>;
        return DEFAULT_FEATURE_FLAGS.map((flag) => ({
          ...flag,
          enabled: typeof parsed[flag.key] === "boolean" ? parsed[flag.key] : flag.default_enabled,
        }));
      }
    } catch {
      // Keep defaults
    }
    return DEFAULT_FEATURE_FLAGS;
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FlagStatusFilter>("ALL");
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Save changes to localStorage and optionally audit log to Supabase
  const persistFlags = useCallback(
    async (updatedFlags: FeatureFlag[], changedFlag?: FeatureFlag) => {
      setFlags(updatedFlags);

      try {
        if (changedFlag) {
          setFeatureFlag(changedFlag.key as FeatureFlagKey, changedFlag.enabled);
        } else {
          for (const flag of updatedFlags) {
            setFeatureFlag(flag.key as FeatureFlagKey, flag.enabled);
          }
        }

        // Feedback message
        const changedDesc = changedFlag
          ? locale === "th"
            ? `สลับสถานะ "${changedFlag.name_th}" เป็น ${changedFlag.enabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}`
            : `Toggled "${changedFlag.name_en}" to ${changedFlag.enabled ? "Enabled" : "Disabled"}`
          : locale === "th"
            ? "บันทึกการตั้งค่าลงเครื่องเรียบร้อยแล้ว"
            : "Saved feature flags to local storage.";

        setSaveNote(changedDesc);
        window.setTimeout(() => setSaveNote(null), 3000);

        // Record to Supabase audit_logs / system_events if configured
        if (isSupabaseConfigured() && changedFlag) {
          const supabase = createSupabaseBrowserClient();
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session) {
            void supabase.from("audit_logs").insert({
              event_id: `evt_ff_${Date.now()}`,
              trace_id: `tr_ff_${Date.now().toString(36)}`,
              actor_type: role,
              actor_id: sessionData.session.user.id,
              action: `FEATURE_FLAG_TOGGLE`,
              entity_type: "feature_flags",
              result: "SUCCESS",
              metadata: {
                flag_key: changedFlag.key,
                new_state: changedFlag.enabled,
                previous_state: !changedFlag.enabled,
              },
            });
          }
        }
      } catch (err) {
        setSaveNote(err instanceof Error ? err.message : "Failed to persist flag state.");
      }
    },
    [locale, role],
  );

  const toggleFlag = (flagKey: string) => {
    let modified: FeatureFlag | undefined;
    const nextFlags = flags.map((flag) => {
      if (flag.key === flagKey) {
        modified = {
          ...flag,
          enabled: !flag.enabled,
          updated_at: new Date().toISOString(),
        };
        return modified;
      }
      return flag;
    });

    void persistFlags(nextFlags, modified);
  };

  const resetToDefaults = () => {
    const nextFlags = DEFAULT_FEATURE_FLAGS.map((f) => ({
      ...f,
      enabled: f.default_enabled,
      updated_at: new Date().toISOString(),
    }));
    void persistFlags(nextFlags);
  };

  // Search and filter
  const filteredFlags = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return flags.filter((flag) => {
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ENABLED" && flag.enabled) ||
        (statusFilter === "DISABLED" && !flag.enabled);

      if (!matchesStatus) return false;
      if (!normalized) return true;

      return (
        flag.key.toLowerCase().includes(normalized) ||
        flag.name_th.toLowerCase().includes(normalized) ||
        flag.name_en.toLowerCase().includes(normalized) ||
        flag.description_th.toLowerCase().includes(normalized) ||
        flag.description_en.toLowerCase().includes(normalized) ||
        flag.category.toLowerCase().includes(normalized)
      );
    });
  }, [flags, statusFilter, query]);

  const enabledCount = useMemo(() => flags.filter((f) => f.enabled).length, [flags]);
  const disabledCount = useMemo(() => flags.filter((f) => !f.enabled).length, [flags]);

  const copyJson = (text: string, key = "global") => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="feature-flags-manager data-manager" style={{ marginTop: 24 }}>
      {/* Header with Title and Standard < N > Badge */}
      <div className="data-manager-heading">
        <div>
          <p className="eyebrow">{t.admin} · {t.featureFlags}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2>{locale === "th" ? "ตัวจัดการ Feature Flags" : "Feature Flags Manager"}</h2>
            <span
              className="data-badge font-mono"
              style={{
                background: "var(--gold-soft, #fff5cf)",
                color: "var(--gold-dark, #846600)",
                fontSize: 12,
                padding: "4px 10px",
                fontFamily: "monospace",
              }}
              title={locale === "th" ? `จำนวนฟีเจอร์: ${filteredFlags.length}` : `Flags count: ${filteredFlags.length}`}
            >
              {filteredFlags.length} {locale === "th" ? "ฟีเจอร์" : "flags"}
            </span>
          </div>
          <p className="page-subtitle">
            {locale === "th"
              ? "ควบคุมการเปิด-ปิดระบบฟังก์ชันหลักของ ParkSpace MSU บันทึกสถานะและทำงานทันที"
              : "Toggle, test, and control application subsystems dynamically with local and remote persistence."}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            className="secondary-button small-button"
            type="button"
            onClick={resetToDefaults}
            title={locale === "th" ? "รีเซ็ตเป็นค่าเริ่มต้น" : "Reset to defaults"}
          >
            <RotateCcw size={14} />
            {locale === "th" ? "คืนค่าเริ่มต้น" : "Reset Defaults"}
          </button>
          <button
            className="secondary-button small-button"
            type="button"
            onClick={() =>
              copyJson(
                JSON.stringify(
                  Object.fromEntries(flags.map((f) => [f.key, f.enabled])),
                  null,
                  2,
                ),
                "export-all",
              )
            }
          >
            {copiedKey === "export-all" ? <Check size={14} color="#2b9d65" /> : <Copy size={14} />}
            {copiedKey === "export-all"
              ? locale === "th"
                ? "คัดลอกแล้ว"
                : "Copied!"
              : locale === "th"
                ? "ส่งออก JSON"
                : "Export JSON"}
          </button>
        </div>
      </div>

      {/* Status Filter Chips with Standard < N > Badges */}
      <div
        className="chip-row"
        style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, marginTop: 16 }}
        role="tablist"
        aria-label={locale === "th" ? "กรองตามสถานะฟีเจอร์" : "Filter feature flags"}
      >
        {(["ALL", "ENABLED", "DISABLED"] as FlagStatusFilter[]).map((st) => {
          const isSelected = statusFilter === st;
          const count = st === "ALL" ? flags.length : st === "ENABLED" ? enabledCount : disabledCount;
          const label =
            st === "ALL"
              ? locale === "th"
                ? "ทั้งหมด"
                : "All Flags"
              : st === "ENABLED"
                ? locale === "th"
                  ? "เปิดใช้งาน"
                  : "Enabled"
                : locale === "th"
                  ? "ปิดใช้งาน"
                  : "Disabled";

          return (
            <button
              className={`filter-chip ${isSelected ? "active" : ""}`}
              key={st}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setStatusFilter(st)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
              }}
            >
              {st === "ALL" ? (
                <Sliders size={13} />
              ) : st === "ENABLED" ? (
                <ToggleRight size={14} color={isSelected ? undefined : "#2b9d65"} />
              ) : (
                <ToggleLeft size={14} color={isSelected ? undefined : "var(--muted)"} />
              )}
              <span>{label}</span>
              <span
                className="font-mono"
                style={{
                  fontSize: 11,
                  opacity: 0.9,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: isSelected ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.05)",
                }}
              >
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 18,
          flexWrap: "wrap",
        }}
      >
        <div className="user-search-box" style={{ flex: "1 1 280px", margin: 0 }}>
          <Search size={16} />
          <input
            aria-label={locale === "th" ? "ค้นหาชื่อฟีเจอร์หรือคีย์" : "Search feature flag or key"}
            placeholder={
              locale === "th"
                ? `ค้นหาด้วยชื่อ คีย์ หรือคำอธิบาย (${filteredFlags.length} รายการ)`
                : `Filter ${filteredFlags.length} feature flags by name, key, or category...`
            }
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="data-badge font-mono" style={{ padding: "6px 12px", fontSize: 11 }}>
            {filteredFlags.length === flags.length
              ? `${flags.length} flags`
              : `${filteredFlags.length} / ${flags.length} flags`}
          </span>
          {query && (
            <button
              className="text-link"
              type="button"
              onClick={() => setQuery("")}
              style={{ fontSize: 12, cursor: "pointer" }}
            >
              {t.clear}
            </button>
          )}
        </div>
      </div>

      {/* Save Notification Note */}
      {saveNote ? (
        <div className="form-note" role="status" style={{ marginTop: 14 }}>
          <Sparkles size={16} color="#2b9d65" />
          <span>{saveNote}</span>
        </div>
      ) : null}

      {/* Feature Flags Grid / List */}
      {filteredFlags.length ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 14,
            marginTop: 18,
          }}
        >
          {filteredFlags.map((flag) => {
            const isEnabled = flag.enabled;
            const flagName = locale === "th" ? flag.name_th : flag.name_en;
            const flagDesc = locale === "th" ? flag.description_th : flag.description_en;

            return (
              <div
                key={flag.key}
                style={{
                  border: `1px solid ${isEnabled ? "var(--line, #e2e8f0)" : "var(--line, #f1f5f9)"}`,
                  borderRadius: 18,
                  background: isEnabled ? "var(--surface)" : "var(--surface-header, #fafbfc)",
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: isEnabled ? "0 2px 8px rgba(0,0,0,0.03)" : "none",
                  transition: "all 0.2s ease",
                }}
              >
                <div>
                  {/* Top Badges & Switch */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <span
                        className="status-badge"
                        style={{
                          background: isEnabled ? "#e6f4ea" : "#f1f3f4",
                          color: isEnabled ? "#137333" : "#5f6368",
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "3px 8px",
                          borderRadius: 6,
                        }}
                      >
                        {isEnabled
                          ? locale === "th"
                            ? "เปิดใช้งาน (ENABLED)"
                            : "ENABLED"
                          : locale === "th"
                            ? "ปิดใช้งาน (DISABLED)"
                            : "DISABLED"}
                      </span>
                      <span className="data-badge" style={{ fontSize: 10, textTransform: "uppercase" }}>
                        {flag.category}
                      </span>
                    </div>

                    {/* Toggle Switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isEnabled}
                      aria-label={`${locale === "th" ? "สลับ" : "Toggle"} ${flagName}`}
                      onClick={() => toggleFlag(flag.key)}
                      style={{
                        background: isEnabled ? "#2b9d65" : "#d1d5db",
                        border: "none",
                        width: 46,
                        height: 26,
                        borderRadius: 999,
                        position: "relative",
                        cursor: "pointer",
                        outline: "none",
                        padding: 2,
                        transition: "background-color 0.2s ease",
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: "#ffffff",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                          transform: isEnabled ? "translateX(20px)" : "translateX(0px)",
                          transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                      />
                    </button>
                  </div>

                  {/* Title and Key */}
                  <h3 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, lineHeight: 1.35 }}>
                    {flagName}
                  </h3>
                  <p
                    style={{
                      margin: "0 0 10px",
                      fontFamily: "monospace",
                      fontSize: 11,
                      color: "var(--muted)",
                      wordBreak: "break-all",
                    }}
                  >
                    {flag.key}
                  </p>

                  {/* Description */}
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      color: isEnabled ? "inherit" : "var(--muted)",
                      lineHeight: 1.5,
                    }}
                  >
                    {flagDesc}
                  </p>
                </div>

                {/* Card Footer Actions */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: 16,
                    paddingTop: 12,
                    borderTop: "1px solid var(--line-soft, #f0f2f5)",
                  }}
                >
                  <button
                    className="text-link"
                    type="button"
                    onClick={() => setSelectedFlag(flag)}
                    style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    <Info size={12} />
                    {locale === "th" ? "ดูผลกระทบ" : "Inspect Impact"}
                  </button>

                  <small style={{ color: "var(--muted)", fontSize: 10 }}>
                    {flag.default_enabled ? (locale === "th" ? "เปิดโดยปริยาย" : "Default: ON") : (locale === "th" ? "ปิดโดยปริยาย" : "Default: OFF")}
                  </small>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-card compact-empty" style={{ marginTop: 24 }}>
          <div>
            <Search size={28} />
            <h2>{query ? t.noResults : t.noRecords}</h2>
            <p>
              {query
                ? locale === "th"
                  ? "ไม่พบฟีเจอร์แฟล็กที่ตรงกับคำค้นหา"
                  : "No feature flags matched your search query."
                : locale === "th"
                  ? "ไม่มีรายการ Feature Flags"
                  : "No feature flags registered."}
            </p>
          </div>
        </div>
      )}

      {/* Feature Flag Inspector Modal */}
      {selectedFlag ? (
        <div
          className="confirm-overlay"
          role="presentation"
          onClick={() => setSelectedFlag(null)}
          style={{ zIndex: 120 }}
        >
          <div
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={locale === "th" ? "ข้อมูล Feature Flag" : "Feature Flag Inspector"}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(94vw, 600px)",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              padding: 24,
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                alignItems: "start",
                justifyContent: "space-between",
                borderBottom: "1px solid var(--line)",
                paddingBottom: 14,
                marginBottom: 16,
              }}
            >
              <div>
                <span className="data-badge" style={{ marginBottom: 6 }}>
                  <Settings size={12} />
                  {selectedFlag.category}
                </span>
                <h2 style={{ margin: "4px 0 0", fontSize: 18 }}>
                  {locale === "th" ? selectedFlag.name_th : selectedFlag.name_en}
                </h2>
                <p style={{ margin: "3px 0 0", color: "var(--muted)", fontSize: 12, fontFamily: "monospace" }}>
                  Key: {selectedFlag.key}
                </p>
              </div>

              <button
                className="icon-button"
                type="button"
                onClick={() => setSelectedFlag(null)}
                aria-label={t.close}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ overflowY: "auto", flex: 1, paddingRight: 4, display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Status Banner */}
              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: selectedFlag.enabled ? "#e6f4ea" : "#f8f9fa",
                  border: `1px solid ${selectedFlag.enabled ? "#b7e1cd" : "var(--line)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <strong style={{ fontSize: 13, color: selectedFlag.enabled ? "#137333" : "inherit" }}>
                    {selectedFlag.enabled
                      ? locale === "th"
                        ? "สถานะปัจจุบัน: เปิดใช้งาน (Active)"
                        : "Current State: Enabled (Active)"
                      : locale === "th"
                        ? "สถานะปัจจุบัน: ปิดใช้งาน (Disabled)"
                        : "Current State: Disabled (Inactive)"}
                  </strong>
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--muted)" }}>
                    {locale === "th" ? "สลับสถานะได้ทันทีโดยไม่ต้อง Build ระบบใหม่" : "Can be toggled without requiring a project rebuild."}
                  </p>
                </div>

                <button
                  className={selectedFlag.enabled ? "secondary-button" : "primary-button"}
                  type="button"
                  onClick={() => {
                    toggleFlag(selectedFlag.key);
                    setSelectedFlag((prev) => (prev ? { ...prev, enabled: !prev.enabled } : null));
                  }}
                  style={{ minWidth: 100 }}
                >
                  {selectedFlag.enabled
                    ? locale === "th"
                      ? "ปิดใช้งาน"
                      : "Disable"
                    : locale === "th"
                      ? "เปิดใช้งาน"
                      : "Enable"}
                </button>
              </div>

              {/* Subsystem Impact */}
              <div style={{ background: "var(--surface-header, #f7f9fb)", padding: 14, borderRadius: 12, border: "1px solid var(--line)" }}>
                <small style={{ color: "var(--muted)", textTransform: "uppercase", fontWeight: 700, fontSize: 10 }}>
                  {locale === "th" ? "ขอบเขตผลกระทบต่อระบบ" : "Subsystem Scope & Impact"}
                </small>
                <p style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.55 }}>
                  {locale === "th" ? selectedFlag.impact_th : selectedFlag.impact_en}
                </p>
              </div>

              {/* Description */}
              <div>
                <small style={{ color: "var(--muted)", textTransform: "uppercase", fontWeight: 700, fontSize: 10 }}>
                  {locale === "th" ? "คำอธิบายการทำงาน" : "Functional Description"}
                </small>
                <p style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.6 }}>
                  {locale === "th" ? selectedFlag.description_th : selectedFlag.description_en}
                </p>
              </div>

              {/* JSON Definition */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <small style={{ color: "var(--muted)", textTransform: "uppercase", fontWeight: 700, fontSize: 10 }}>
                    JSON Configuration
                  </small>
                  <button
                    className="secondary-button small-button"
                    type="button"
                    onClick={() => copyJson(JSON.stringify(selectedFlag, null, 2), "modal-flag")}
                  >
                    {copiedKey === "modal-flag" ? <Check size={13} color="#2b9d65" /> : <Copy size={13} />}
                    {copiedKey === "modal-flag" ? (locale === "th" ? "คัดลอกแล้ว" : "Copied!") : (locale === "th" ? "คัดลอก JSON" : "Copy JSON")}
                  </button>
                </div>
                <pre
                  style={{
                    margin: 0,
                    padding: 12,
                    borderRadius: 10,
                    background: "var(--surface-header, #f7f9fb)",
                    border: "1px solid var(--line)",
                    fontFamily: "monospace",
                    fontSize: 11,
                    maxHeight: 140,
                    overflowY: "auto",
                  }}
                >
                  {JSON.stringify(selectedFlag, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--line)", textAlign: "right" }}>
              <button className="primary-button" type="button" onClick={() => setSelectedFlag(null)}>
                {t.close}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
