"use client";

import { useState } from "react";
import { CheckCircle2, Lock, Power, RefreshCw, Save, Settings, ShieldAlert, Sliders } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { useNotifications } from "@/components/layout/NotificationProvider";

export function SystemSettingsPanel({ locale }: { locale: Locale }) {
  const isTh = locale === "th";
  const { notify } = useNotifications();

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [allowRegistration, setAllowRegistration] = useState(true);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(7);
  const [bookingGracePeriodMinutes, setBookingGracePeriodMinutes] = useState(15);
  const [saving, setSaving] = useState(false);

  function handleSave() {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      notify({
        title: isTh ? "บันทึกการตั้งค่าสำเร็จ" : "Settings Saved",
        message: isTh ? "การตั้งค่าระบบได้รับการอัปเดตเรียบร้อยแล้ว" : "System settings updated successfully",
        kind: "success",
      });
    }, 400);
  }

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 800 }}>
      <div className="review-panel" style={{ padding: 22 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 17, display: "flex", alignItems: "center", gap: 8 }}>
          <Sliders size={18} />
          {isTh ? "การกำหนดค่านโยบายการจอง (Booking Policies)" : "Booking Policies"}
        </h3>
        <p style={{ margin: "0 0 18px", color: "var(--muted)", fontSize: 12 }}>
          {isTh ? "กำหนดเงื่อนไขระยะเวลาการจองและระยะผ่อนปรนหน้างาน" : "Configure booking limits and grace periods."}
        </p>

        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
              {isTh ? "จองล่วงหน้าได้สูงสุด (วัน):" : "Max Advance Booking Days:"}
            </label>
            <input
              type="number"
              min={1}
              max={30}
              className="form-control"
              value={maxAdvanceDays}
              onChange={(e) => setMaxAdvanceDays(parseInt(e.target.value || "1", 10))}
              style={{ maxWidth: 200 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
              {isTh ? "ระยะเวลาผ่อนปรนก่อนตัดสิทธิ์ No-Show (นาที):" : "No-Show Grace Period (Minutes):"}
            </label>
            <input
              type="number"
              min={5}
              max={60}
              className="form-control"
              value={bookingGracePeriodMinutes}
              onChange={(e) => setBookingGracePeriodMinutes(parseInt(e.target.value || "15", 10))}
              style={{ maxWidth: 200 }}
            />
          </div>
        </div>
      </div>

      <div className="review-panel" style={{ padding: 22 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 17, display: "flex", alignItems: "center", gap: 8 }}>
          <Lock size={18} />
          {isTh ? "ความปลอดภัยและการเข้าถึง (Security & Access)" : "Security & Access"}
        </h3>
        <p style={{ margin: "0 0 18px", color: "var(--muted)", fontSize: 12 }}>
          {isTh ? "ควบคุมการเปิดรับสมัครสมาชิกและโหมดปิดปรับปรุงระบบ" : "Control member signups and maintenance mode."}
        </p>

        <div style={{ display: "grid", gap: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={allowRegistration}
              onChange={(e) => setAllowRegistration(e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            <div>
              <strong style={{ fontSize: 13, display: "block" }}>{isTh ? "เปิดรับสมัครสมาชิกใหม่" : "Allow New Signups"}</strong>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>{isTh ? "อนุญาตให้นิสิต/บุคลากรลงทะเบียนเข้าใช้งาน" : "Enable user registration"}</span>
            </div>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={maintenanceMode}
              onChange={(e) => setMaintenanceMode(e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            <div>
              <strong style={{ fontSize: 13, display: "block", color: maintenanceMode ? "var(--red)" : "inherit" }}>
                {isTh ? "โหมดปิดปรับปรุงชั่วคราว (Maintenance Mode)" : "Maintenance Mode"}
              </strong>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                {isTh ? "ล็อกระบบให้เข้าถึงได้เฉพาะ Admin เท่านั้น" : "Restrict access to admins only"}
              </span>
            </div>
          </label>
        </div>
      </div>

      <button
        type="button"
        className="primary-button"
        onClick={handleSave}
        disabled={saving}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, justifySelf: "start" }}
      >
        {saving ? <RefreshCw size={15} className="spin" /> : <Save size={15} />}
        <span>{isTh ? "บันทึกการตั้งค่าระบบ" : "Save Settings"}</span>
      </button>
    </div>
  );
}
