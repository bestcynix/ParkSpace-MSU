"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Flashlight,
  LoaderCircle,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type StaffRole = "staff" | "admin" | "developer";

type ScanResult = {
  booking_id: string;
  booking_reference: string;
  booking_status: string;
  starts_at: string;
  ends_at: string;
  area_code: string | null;
  area_name_th: string | null;
  slot_code: string | null;
  vehicle_plate: string | null;
  scan_result: "VALID" | "EXPIRED" | "USED" | "CANCELLED" | "INVALID_REFERENCE" | "ERROR";
  qr_status?: string;
  message?: string;
};

type ScanHistoryItem = {
  id: string;
  reference: string;
  timestamp: string;
  result: "VALID" | "ERROR" | "CANCELLED" | "USED";
  plate: string | null;
  area: string | null;
};

function playSuccessBeep() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // AudioContext not supported
  }
}

export function StaffScanner({ locale, role = "staff" }: { locale: Locale; role?: StaffRole }) {
  const t = getCopy(locale);
  const isTh = locale === "th";
  const [manualCode, setManualCode] = useState("");
  const [areaCodeFilter, setAreaCodeFilter] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [transitioning, setTransitioning] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isStaffOnly = role === "staff";

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        void html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);
  const handleScanSuccess = useCallback(
    async (decodedText: string) => {
      if (transitioning) return;
      playSuccessBeep();

      let targetRef = decodedText.trim();
      let targetToken = "";

      if (targetRef.startsWith("{") && targetRef.endsWith("}")) {
        try {
          const parsed = JSON.parse(targetRef);
          if (parsed.reference) targetRef = parsed.reference;
          if (parsed.token) targetToken = parsed.token;
          if (parsed.booking_reference) targetRef = parsed.booking_reference;
        } catch {
          // keep as string
        }
      }

      await validateReference(targetRef, targetToken);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [areaCodeFilter, transitioning]
  );

  async function startScanner() {
    setCameraError(null);
    setNotice(null);

    const container = document.getElementById("staff-qr-reader");
    if (!container) {
      setCameraError(isTh ? "ไม่พบองค์ประกอบแสดงกล้อง" : "Scanner element not found");
      return;
    }

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("staff-qr-reader");
      }

      const qr = html5QrCodeRef.current;
      if (qr.isScanning) {
        await qr.stop();
      }

      await qr.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          void handleScanSuccess(decodedText);
        },
        () => {}
      );

      setScanning(true);

      try {
        const track = (qr as unknown as { getRunningTrackCameraCapabilities?: () => { torchFeature?: () => { isSupported?: () => boolean } } })
          .getRunningTrackCameraCapabilities?.()
          ?.torchFeature?.();
        setHasTorch(Boolean(track?.isSupported?.()));
      } catch {
        setHasTorch(false);
      }
    } catch (err) {
      setScanning(false);
      setCameraError(
        err instanceof Error
          ? err.message
          : isTh
          ? "ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการเข้าถึงกล้องบนเบราว์เซอร์"
          : "Could not start camera. Please allow camera permissions."
      );
    }
  }

  async function stopScanner() {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch {
        // ignore
      }
    }
    setScanning(false);
    setTorchOn(false);
  }

  async function toggleTorch() {
    if (!html5QrCodeRef.current || !scanning) return;
    try {
      const qr = html5QrCodeRef.current as unknown as {
        applyVideoConstraints: (constraints: { advanced: Array<{ torch: boolean }> }) => Promise<void>;
      };
      const nextTorch = !torchOn;
      await qr.applyVideoConstraints({ advanced: [{ torch: nextTorch }] });
      setTorchOn(nextTorch);
    } catch {
      // Torch not supported
    }
  }

  async function validateReference(referenceStr: string, tokenStr = "") {
    if (!referenceStr.trim()) {
      setNotice({ text: isTh ? "กรุณากรอกรหัสการจองหรือ QR Reference" : "Please provide a booking or QR reference", type: "error" });
      return;
    }

    setTransitioning("VALIDATING");
    setNotice(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData.session?.access_token;

      const res = await fetch("/api/staff/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          reference: referenceStr.trim(),
          token: tokenStr.trim(),
          area_code: areaCodeFilter.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.result) {
        const errorMsg = data.error || (isTh ? "ไม่พบข้อมูลการจองหรือบัตรไม่ถูกต้อง" : "Booking not found or invalid pass");
        setResult({
          booking_id: "",
          booking_reference: referenceStr,
          booking_status: "INVALID",
          starts_at: "",
          ends_at: "",
          area_code: null,
          area_name_th: null,
          slot_code: null,
          vehicle_plate: null,
          scan_result: "INVALID_REFERENCE",
          message: errorMsg,
        });
        setNotice({ text: errorMsg, type: "error" });
        return;
      }

      const scanRes: ScanResult = data.result;
      setResult(scanRes);

      setHistory((prev) => [
        {
          id: scanRes.booking_id || `${Date.now()}`,
          reference: scanRes.booking_reference,
          timestamp: new Date().toLocaleTimeString(),
          result: scanRes.scan_result === "VALID" ? "VALID" : "ERROR",
          plate: scanRes.vehicle_plate,
          area: scanRes.area_code,
        },
        ...prev.slice(0, 7),
      ]);

      setNotice({
        text: isTh
          ? `ตรวจสอบสิทธิ์สำเร็จ: ${scanRes.booking_reference} (${scanRes.booking_status})`
          : `Valid Pass: ${scanRes.booking_reference} (${scanRes.booking_status})`,
        type: "success",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : isTh ? "เกิดข้อผิดพลาดในการตรวจสอบ" : "Validation error";
      setNotice({ text: msg, type: "error" });
    } finally {
      setTransitioning(null);
    }
  }

  async function handleTransition(action: "CHECK_IN" | "CHECK_OUT" | "CANCEL" | "NO_SHOW" | "OVERRIDE", overrideStatus?: string) {
    if (!result?.booking_id) return;

    setTransitioning(action);
    setNotice(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData.session?.access_token;

      const res = await fetch("/api/staff/transition", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          booking_id: result.booking_id,
          action,
          override_status: overrideStatus,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to transition status");
      }

      const updatedStatus = data.current_status;
      setResult((prev) => (prev ? { ...prev, booking_status: updatedStatus } : null));

      setNotice({
        text: isTh
          ? `เปลี่ยนสถานะเป็น ${updatedStatus} สำเร็จ`
          : `Status changed to ${updatedStatus} successfully`,
        type: "success",
      });
    } catch (err) {
      setNotice({
        text: err instanceof Error ? err.message : isTh ? "ไม่สามารถเปลี่ยนสถานะได้" : "Action failed",
        type: "error",
      });
    } finally {
      setTransitioning(null);
    }
  }
  const canCheckIn = result?.booking_status === "CONFIRMED" || result?.booking_status === "RESERVED";
  const canCheckOut = result?.booking_status === "CHECKED_IN" || result?.booking_status === "OVERSTAY";
  const isCompleted = result?.booking_status === "COMPLETED";
  const isCancelled = result?.booking_status === "CANCELLED";

  return (
    <div className="staff-scanner-container" style={{ maxWidth: 680, margin: "0 auto", display: "grid", gap: 16 }}>
      {/* Header Card */}
      <div className="review-panel" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <QrCode size={24} color="#e5ae00" />
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>
                {isTh ? "สแกนบัตรผ่านและจัดการสิทธิ์หน้างาน" : "Gate Scanner & Access Control"}
              </h2>
              <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: 11 }}>
                {isTh
                  ? "รองรับกล้องอุปกรณ์จริง · ตรวจสอบ QR Pass ทันที"
                  : "Live Device Camera QR Scanner · Instant Pass Verification"}
              </p>
            </div>
          </div>
          <span
            className="data-badge"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: isStaffOnly ? "#eef2ff" : "#fef3c7",
              color: isStaffOnly ? "#3730a3" : "#92400e",
              padding: "4px 10px",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 11,
            }}
          >
            {isStaffOnly ? <UserCheck size={13} /> : <ShieldCheck size={13} />}
            {role.toUpperCase()}
          </span>
        </div>

        {/* Role Capability Hint */}
        <div
          style={{
            marginTop: 12,
            padding: "8px 12px",
            borderRadius: 8,
            background: isStaffOnly ? "#f8fafc" : "#fbf7ee",
            border: "1px solid var(--line)",
            fontSize: 11,
            color: "var(--muted)",
          }}
        >
          {isStaffOnly ? (
            <span>
              🔒 {isTh ? "สิทธิ์ Staff จำกัด:" : "Staff Role Boundary:"}{" "}
              <strong>{isTh ? "เช็คอิน (Check-in) และ เช็คเอาท์ (Check-out) เท่านั้น" : "Check-in and Check-out only"}</strong>.{" "}
              {isTh ? "การยกเลิกหรือ override สถานะต้องดำเนินการโดย Admin/Dev" : "Cancellations and overrides require Admin/Dev."}
            </span>
          ) : (
            <span>
              ⚡ {isTh ? "สิทธิ์ Admin/Developer:" : "Admin/Dev Role:"}{" "}
              <strong>{isTh ? "อำนาจเต็ม (Check-in, Check-out, ยกเลิก, No-Show, และ Override สถานะ)" : "Full Control (Check-in, Check-out, Cancel, No-Show, Override)"}</strong>.
            </span>
          )}
        </div>
      </div>

      {/* Notice Message */}
      {notice && (
        <div
          role="alert"
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: notice.type === "success" ? "#f0fdf4" : notice.type === "error" ? "#fef2f2" : "#eff6ff",
            color: notice.type === "success" ? "#166534" : notice.type === "error" ? "#991b1b" : "#1e40af",
            border: `1px solid ${notice.type === "success" ? "#bbf7d0" : notice.type === "error" ? "#fecaca" : "#bfdbfe"}`,
          }}
        >
          {notice.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Camera Viewport Section */}
      <div className="review-panel" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <Camera size={16} color="#e5ae00" />
            {isTh ? "กล้องสแกน QR Code" : "Camera QR Scanner"}
          </h3>
          <div style={{ display: "flex", gap: 8 }}>
            {hasTorch && scanning && (
              <button
                className="secondary-button small-button"
                type="button"
                onClick={() => void toggleTorch()}
                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <Flashlight size={14} color={torchOn ? "#e5ae00" : "currentColor"} />
                <span>{torchOn ? "Flash ON" : "Flash OFF"}</span>
              </button>
            )}
            <button
              className={scanning ? "secondary-button danger small-button" : "primary-button small-button"}
              type="button"
              onClick={() => (scanning ? void stopScanner() : void startScanner())}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Camera size={14} />
              <span>{scanning ? (isTh ? "ปิดกล้อง" : "Stop Camera") : isTh ? "เปิดกล้องสแกน" : "Start Scanner"}</span>
            </button>
          </div>
        </div>

        {/* Viewport Element */}
        <div
          style={{
            position: "relative",
            minHeight: 280,
            borderRadius: 14,
            overflow: "hidden",
            background: "#111827",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div id="staff-qr-reader" style={{ width: "100%", maxHeight: 360 }} />

          {!scanning && (
            <div
              style={{
                position: "absolute",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                color: "#9ca3af",
                padding: 24,
                textAlign: "center",
              }}
            >
              <QrCode size={48} opacity={0.5} />
              <div>
                <p style={{ margin: 0, fontWeight: 600, color: "#f3f4f6", fontSize: 13 }}>
                  {isTh ? "กล้องยังไม่ได้เปิดใช้งาน" : "Camera is currently inactive"}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 11 }}>
                  {isTh
                    ? "กดปุ่ม 'เปิดกล้องสแกน' เพื่อเปิดใช้งานกล้องมือถือหรือเว็บแคม"
                    : "Click 'Start Scanner' to use device camera"}
                </p>
              </div>
              <button
                className="primary-button small-button"
                type="button"
                onClick={() => void startScanner()}
                style={{ marginTop: 6 }}
              >
                <Camera size={14} />
                <span>{isTh ? "เปิดกล้องสแกน" : "Start Scanner"}</span>
              </button>
            </div>
          )}
        </div>

        {cameraError && (
          <p style={{ margin: "10px 0 0", color: "var(--red)", fontSize: 11, textAlign: "center" }}>
            {cameraError}
          </p>
        )}
      </div>

      {/* Manual Reference Input Accordion */}
      <div className="review-panel" style={{ padding: "14px 20px" }}>
        <button
          type="button"
          onClick={() => setShowManual((prev) => !prev)}
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            color: "var(--ink)",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Search size={15} color="#e5ae00" />
            {isTh ? "ค้นหาด้วยรหัสการจอง / กรอกรหัสด้วยตนเอง" : "Manual Reference Lookup"}
          </span>
          {showManual ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showManual && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void validateReference(manualCode);
            }}
            style={{ marginTop: 14, display: "grid", gap: 10 }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="form-control"
                placeholder={isTh ? "เช่น MSUPK-202609-XXXXX หรือ QR Reference" : "e.g. MSUPK-202609-XXXXX or QR Ref"}
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                className="primary-button"
                type="submit"
                disabled={Boolean(transitioning) || !manualCode.trim()}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {transitioning === "VALIDATING" ? <LoaderCircle size={15} className="spin" /> : <Search size={15} />}
                <span>{isTh ? "ตรวจสอบ" : "Verify"}</span>
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                className="form-control"
                placeholder={isTh ? "กรองรหัสลาน เช่น P1, P2 (ไม่บังคับ)" : "Filter area code e.g. P1 (Optional)"}
                value={areaCodeFilter}
                onChange={(e) => setAreaCodeFilter(e.target.value.toUpperCase())}
                style={{ maxWidth: 200, fontSize: 11 }}
              />
              <span style={{ fontSize: 10, color: "var(--muted)" }}>
                {isTh ? "ตรวจสอบเฉพาะลานที่ตนเองประจำอยู่ได้" : "Optional gate area filter"}
              </span>
            </div>
          </form>
        )}
      </div>
      {/* Scanned Result Card & Action Transitions */}
      {result && (
        <div className="review-panel" style={{ padding: 20, border: "2px solid #f8c928" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
            <div>
              <span
                className="data-badge"
                style={{
                  background: result.scan_result === "VALID" ? "#f0fdf4" : "#fef2f2",
                  color: result.scan_result === "VALID" ? "#166534" : "#991b1b",
                  fontWeight: 800,
                  fontSize: 11,
                  padding: "4px 8px",
                  borderRadius: 6,
                }}
              >
                {result.scan_result === "VALID" ? "PASS VALIDATED" : "INVALID / EXPIRED"}
              </span>
              <h3 style={{ margin: "8px 0 2px", fontSize: 17, fontFamily: "monospace" }}>
                {result.booking_reference}
              </h3>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 11 }}>
                {result.area_code ? `${result.area_code} · ${result.area_name_th ?? ""}` : "Unassigned Area"}
                {result.slot_code ? ` · ช่อง ${result.slot_code}` : ""}
              </p>
            </div>

            <span
              className="data-badge"
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "6px 12px",
                borderRadius: 8,
                background:
                  result.booking_status === "CHECKED_IN"
                    ? "#eff6ff"
                    : result.booking_status === "COMPLETED"
                    ? "#f0fdf4"
                    : result.booking_status === "CONFIRMED" || result.booking_status === "RESERVED"
                    ? "#fefce8"
                    : "#fef2f2",
                color:
                  result.booking_status === "CHECKED_IN"
                    ? "#1e40af"
                    : result.booking_status === "COMPLETED"
                    ? "#166534"
                    : result.booking_status === "CONFIRMED" || result.booking_status === "RESERVED"
                    ? "#854d0e"
                    : "#991b1b",
              }}
            >
              {result.booking_status}
            </span>
          </div>

          {/* Details Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 10,
              marginTop: 14,
              padding: 12,
              background: "#f8fafc",
              borderRadius: 10,
              fontSize: 11,
            }}
          >
            <div>
              <span style={{ color: "var(--muted)", display: "block" }}>{isTh ? "ทะเบียนรถ" : "Vehicle Plate"}</span>
              <strong style={{ fontSize: 13 }}>{result.vehicle_plate || "—"}</strong>
            </div>
            <div>
              <span style={{ color: "var(--muted)", display: "block" }}>{isTh ? "ช่องจอด" : "Parking Slot"}</span>
              <strong style={{ fontSize: 13 }}>{result.slot_code || (isTh ? "พื้นที่รวม (ไม่ระบุช่อง)" : "Area Level")}</strong>
            </div>
            <div>
              <span style={{ color: "var(--muted)", display: "block" }}>{isTh ? "เริ่มจอง" : "Starts"}</span>
              <strong>{result.starts_at ? new Date(result.starts_at).toLocaleTimeString() : "—"}</strong>
            </div>
            <div>
              <span style={{ color: "var(--muted)", display: "block" }}>{isTh ? "สิ้นสุด" : "Ends"}</span>
              <strong>{result.ends_at ? new Date(result.ends_at).toLocaleTimeString() : "—"}</strong>
            </div>
          </div>

          {/* Role Transitions Action Buttons */}
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
            {isStaffOnly ? (
              /* Staff Role: STRICT permissions */
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                {canCheckIn && (
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => void handleTransition("CHECK_IN")}
                    disabled={Boolean(transitioning)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    {transitioning === "CHECK_IN" ? <RefreshCw size={15} className="spin" /> : <CheckCircle2 size={15} />}
                    <span>{t.checkIn} (Staff)</span>
                  </button>
                )}

                {canCheckOut && (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void handleTransition("CHECK_OUT")}
                    disabled={Boolean(transitioning)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    {transitioning === "CHECK_OUT" ? <RefreshCw size={15} className="spin" /> : <CheckCircle2 size={15} />}
                    <span>{t.checkOut} (Staff)</span>
                  </button>
                )}

                {isCompleted && (
                  <span style={{ color: "#166534", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                    <CheckCircle2 size={16} /> {isTh ? "การจอดเสร็จสิ้นเรียบร้อยแล้ว" : "Parking Session Completed"}
                  </span>
                )}

                {isCancelled && (
                  <span style={{ color: "#991b1b", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                    <AlertTriangle size={16} /> {isTh ? "รายการนี้ถูกยกเลิกแล้ว" : "Booking Cancelled"}
                  </span>
                )}
              </div>
            ) : (
              /* Admin & Developer: Full Transition Authority */
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    className="primary-button small-button"
                    type="button"
                    onClick={() => void handleTransition("CHECK_IN")}
                    disabled={Boolean(transitioning)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    {transitioning === "CHECK_IN" ? <RefreshCw size={13} className="spin" /> : <CheckCircle2 size={13} />}
                    <span>{t.checkIn}</span>
                  </button>

                  <button
                    className="secondary-button small-button"
                    type="button"
                    onClick={() => void handleTransition("CHECK_OUT")}
                    disabled={Boolean(transitioning)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    {transitioning === "CHECK_OUT" ? <RefreshCw size={13} className="spin" /> : <CheckCircle2 size={13} />}
                    <span>{t.checkOut}</span>
                  </button>

                  <button
                    className="secondary-button small-button danger"
                    type="button"
                    onClick={() => void handleTransition("CANCEL")}
                    disabled={Boolean(transitioning)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    <AlertTriangle size={13} />
                    <span>{isTh ? "ยกเลิก (Cancel)" : "Cancel"}</span>
                  </button>

                  <button
                    className="secondary-button small-button"
                    type="button"
                    onClick={() => void handleTransition("NO_SHOW")}
                    disabled={Boolean(transitioning)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    <Clock3 size={13} />
                    <span>No Show</span>
                  </button>
                </div>

                {/* Status Override Select for Admin / Dev */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    {isTh ? "Override สถานะ:" : "Status Override:"}
                  </span>
                  <select
                    className="review-status-select"
                    onChange={(e) => {
                      if (e.target.value) {
                        void handleTransition("OVERRIDE", e.target.value);
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      {isTh ? "-- เลือกสถานะ override --" : "-- Select override status --"}
                    </option>
                    <option value="CONFIRMED">CONFIRMED</option>
                    <option value="RESERVED">RESERVED</option>
                    <option value="CHECKED_IN">CHECKED_IN</option>
                    <option value="OVERSTAY">OVERSTAY</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="CANCELLED">CANCELLED</option>
                    <option value="NO_SHOW">NO_SHOW</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Scans History */}
      {history.length > 0 && (
        <div className="review-panel" style={{ padding: 18 }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
            {isTh ? "ประวัติการสแกนล่าสุดรอบนี้" : "Recent Scans This Session"} ({history.length})
          </h3>
          <div style={{ display: "grid", gap: 6 }}>
            {history.map((h, idx) => (
              <div
                key={`${h.id}-${idx}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 12px",
                  background: "#fbfcfc",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  fontSize: 11,
                }}
              >
                <div>
                  <strong style={{ fontFamily: "monospace" }}>{h.reference}</strong>
                  <span style={{ marginLeft: 8, color: "var(--muted)" }}>
                    {h.plate ? `ทะเบียน: ${h.plate}` : ""} {h.area ? `(${h.area})` : ""}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "var(--muted)", fontSize: 10 }}>{h.timestamp}</span>
                  <span
                    className="data-badge"
                    style={{
                      fontSize: 9,
                      padding: "2px 6px",
                      background: h.result === "VALID" ? "#f0fdf4" : "#fef2f2",
                      color: h.result === "VALID" ? "#166534" : "#991b1b",
                    }}
                  >
                    {h.result}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}