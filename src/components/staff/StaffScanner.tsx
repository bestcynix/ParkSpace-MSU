"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Clock3,
  Edit3,
  ExternalLink,
  Flashlight,
  LoaderCircle,
  MapPin,
  Navigation,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  User,
  UserCheck,
  Trash2,
  X,
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { parkingAreas, getGoogleMapsNavigationUrl } from "@/lib/parking/demo-data";

type StaffRole = "staff" | "admin";

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
  booker_name?: string | null;
  booker_phone?: string | null;
  scan_result: string;
  message?: string;
  is_overstay?: boolean;
  overdue_minutes?: number;
};

type ScanHistoryItem = {
  id: string;
  reference: string;
  timestamp: string;
  result: "VALID" | "ERROR" | "CANCELLED" | "USED";
  plate: string | null;
  area: string | null;
  shift?: string;
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
  const [editingField, setEditingField] = useState(false);
  const [overridePlate, setOverridePlate] = useState("");
  const [staffNote, setStaffNote] = useState("");

  // Staff Duty Context & Shift State
  const [staffZone, setStaffZone] = useState<string>("P01");
  const [staffShift, setStaffShift] = useState<string>("morning");
  const [staffAccountName, setStaffAccountName] = useState<string>("Staff Member");
  const [showReslotModal, setShowReslotModal] = useState(false);
  const [reslotLoading, setReslotLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<Array<{ id: string; slot_code: string }>>([]);
  const [targetSlotCode, setTargetSlotCode] = useState<string>("");
  const [reslotTargetAreaId, setReslotTargetAreaId] = useState<string>("");

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isStaffOnly = role === "staff";

  // Load persistent shift context & staff info on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("parkspace_staff_shift_context");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.zone) {
          setStaffZone(parsed.zone);
          setAreaCodeFilter(parsed.zone);
        }
        if (parsed.shift) setStaffShift(parsed.shift);
      } else {
        setAreaCodeFilter("P01");
      }
      const supabase = createSupabaseBrowserClient();
      void supabase.auth.getSession().then((sessionRes: { data: { session: { user?: { email?: string; user_metadata?: Record<string, any> } } | null } }) => {
        const session = sessionRes?.data?.session;
        if (session?.user?.email) {
          setStaffAccountName(
            session.user.user_metadata?.full_name ||
            session.user.email.split("@")[0] ||
            "Staff Member"
          );
        }
      });
    } catch {
      // ignore
    }
  }, []);

  function handleUpdateDutyZone(newZone: string) {
    setStaffZone(newZone);
    setAreaCodeFilter(newZone);
    try {
      localStorage.setItem("parkspace_staff_shift_context", JSON.stringify({ zone: newZone, shift: staffShift }));
    } catch {
      // ignore
    }
  }

  function handleUpdateDutyShift(newShift: string) {
    setStaffShift(newShift);
    try {
      localStorage.setItem("parkspace_staff_shift_context", JSON.stringify({ zone: staffZone, shift: newShift }));
    } catch {
      // ignore
    }
  }

  const SHIFT_OPTIONS = [
    { value: "morning", labelTh: "กะเช้า (07:00 – 12:00)", labelEn: "Morning (07:00 – 12:00)" },
    { value: "afternoon", labelTh: "กะบ่าย (12:00 – 17:00)", labelEn: "Afternoon (12:00 – 17:00)" },
    { value: "evening", labelTh: "กะค่ำ (17:00 – 22:00)", labelEn: "Evening (17:00 – 22:00)" },
    { value: "all_day", labelTh: "ตลอดวัน (07:00 – 22:00)", labelEn: "All Day (07:00 – 22:00)" },
  ];

  async function openReslotModal() {
    if (!result?.booking_id) return;
    setReslotLoading(true);
    setShowReslotModal(true);
    setAvailableSlots([]);
    setTargetSlotCode("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: areaData } = await supabase
        .from("parking_areas")
        .select("id, code, name_th")
        .ilike("code", staffZone)
        .maybeSingle();

      if (areaData?.id) {
        setReslotTargetAreaId(areaData.id);
        const { data: slotsData } = await supabase
          .from("parking_slots")
          .select("id, slot_code, status")
          .eq("parking_area_id", areaData.id)
          .eq("status", "AVAILABLE")
          .order("slot_code")
          .limit(20);

        if (slotsData && slotsData.length > 0) {
          setAvailableSlots(slotsData);
          setTargetSlotCode(slotsData[0].slot_code);
        } else {
          setAvailableSlots([
            { id: "fallback-A01", slot_code: "A01" },
            { id: "fallback-A02", slot_code: "A02" },
            { id: "fallback-A03", slot_code: "A03" },
            { id: "fallback-B01", slot_code: "B01" },
          ]);
          setTargetSlotCode("A01");
        }
      } else {
        setReslotTargetAreaId(`area-${staffZone.toLowerCase()}`);
        setAvailableSlots([
          { id: "slot-A01", slot_code: "A01" },
          { id: "slot-A02", slot_code: "A02" },
          { id: "slot-A03", slot_code: "A03" },
        ]);
        setTargetSlotCode("A01");
      }
    } catch {
      setAvailableSlots([
        { id: "slot-A01", slot_code: "A01" },
        { id: "slot-A02", slot_code: "A02" },
      ]);
      setTargetSlotCode("A01");
    } finally {
      setReslotLoading(false);
    }
  }

  async function handleConfirmReslotAndCheckIn() {
    if (!result?.booking_id) return;
    setTransitioning("REASSIGN_AND_CHECKIN");
    setNotice(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData.session?.access_token;

      const chosenSlot = availableSlots.find((s) => s.slot_code === targetSlotCode);
      const chosenSlotId = chosenSlot && !chosenSlot.id.startsWith("fallback") && !chosenSlot.id.startsWith("slot-") ? chosenSlot.id : undefined;

      const res = await fetch("/api/staff/transition", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          booking_id: result.booking_id,
          action: "REASSIGN_AND_CHECKIN",
          updated_area_id: reslotTargetAreaId || undefined,
          updated_slot_id: chosenSlotId,
          staff_zone: staffZone,
          staff_shift: staffShift,
          note: `[โซนไม่ตรง] เจ้าหน้าที่ ${staffAccountName} ย้ายเข้าโซน ${staffZone} ช่อง ${targetSlotCode} และเช็คอินหน้างาน`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reassign and check in");
      }

      const targetAreaObj = parkingAreas.find((a) => a.code.toUpperCase() === staffZone.toUpperCase());
      setResult((prev) =>
        prev
          ? {
              ...prev,
              booking_status: "CHECKED_IN",
              area_code: staffZone,
              area_name_th: targetAreaObj?.th || prev.area_name_th,
              slot_code: targetSlotCode,
            }
          : null
      );

      setShowReslotModal(false);
      setNotice({
        text: isTh
          ? `จัดสรรช่อง ${targetSlotCode} ในโซน ${staffZone} และเช็คอินสำเร็จเรียบร้อยแล้ว!`
          : `Reassigned to slot ${targetSlotCode} in zone ${staffZone} and checked in successfully!`,
        type: "success",
      });
    } catch (err) {
      setNotice({
        text: err instanceof Error ? err.message : isTh ? "เกิดข้อผิดพลาดในการย้ายโซน" : "Reassignment failed",
        type: "error",
      });
    } finally {
      setTransitioning(null);
    }
  }

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
        credentials: "include",
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
        if (res.status === 401 || res.status === 403) {
          const roleMsg = isTh
            ? "จำเป็นต้องเข้าสู่ระบบด้วยบัญชีเจ้าหน้าที่ (Staff) หรือผู้ดูแลระบบ (Admin) เพื่อสแกนและตรวจสอบข้อมูล"
            : "Staff or Admin role required to scan and verify bookings.";
          setResult(null);
          setNotice({ text: roleMsg, type: "error" });
          return;
        }

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
      setOverridePlate(scanRes.vehicle_plate || "");
      setStaffNote("");
      setEditingField(false);

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

      if (scanRes.scan_result !== "VALID") {
        setNotice({
          text: scanRes.message || (isTh ? "ไม่พบข้อมูลการจองหรือบัตรไม่ถูกต้อง" : "Invalid booking or pass"),
          type: "error",
        });
        return;
      }

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

  function handleClearResult() {
    setResult(null);
    setManualCode("");
    setNotice(null);
    setEditingField(false);
    setOverridePlate("");
    setStaffNote("");
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
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          booking_id: result.booking_id,
          action,
          override_status: overrideStatus,
          updated_plate: overridePlate && overridePlate.trim() !== result.vehicle_plate ? overridePlate.trim() : undefined,
          note: staffNote.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to transition status");
      }

      const updatedStatus = data.current_status;
      setResult((prev) => (prev ? { ...prev, booking_status: updatedStatus, vehicle_plate: overridePlate || prev.vehicle_plate } : null));

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

  async function handleDeleteBooking() {
    if (!result?.booking_id) return;
    if (!window.confirm(isTh ? `คุณต้องการลบรายการจอง ${result.booking_reference} ออกจากระบบอย่างถาวรใช่หรือไม่?` : `Are you sure you want to permanently delete booking ${result.booking_reference}?`)) {
      return;
    }
    setTransitioning("DELETING");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData.session?.access_token;

      const res = await fetch("/api/admin/bookings", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ id: result.booking_id }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to delete booking");
      }

      setNotice({
        text: isTh ? `ลบรายการจอง ${result.booking_reference} ออกจากระบบเรียบร้อยแล้ว` : `Booking ${result.booking_reference} deleted successfully`,
        type: "success",
      });
      handleClearResult();
    } catch (err) {
      setNotice({
        text: err instanceof Error ? err.message : "Deletion failed",
        type: "error",
      });
    } finally {
      setTransitioning(null);
    }
  }
  const canCheckIn = result?.booking_status === "PENDING" || result?.booking_status === "CONFIRMED" || result?.booking_status === "RESERVED";
  const canCheckOut = result?.booking_status === "CHECKED_IN" || result?.booking_status === "OVERSTAY";
  const isCompleted = result?.booking_status === "COMPLETED";
  const isCancelled = result?.booking_status === "CANCELLED";

  const isZoneMatch = !result?.area_code || result.area_code.toUpperCase() === staffZone.toUpperCase();
  const bookedArea = result?.area_code
    ? parkingAreas.find((a) => a.code.toUpperCase() === result.area_code?.toUpperCase())
    : null;
  const bookedAreaNavUrl = bookedArea ? getGoogleMapsNavigationUrl(bookedArea) : null;

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
              {isTh ? "การยกเลิกหรือ override สถานะต้องดำเนินการโดย Admin" : "Cancellations and overrides require Admin."}
            </span>
          ) : (
            <span>
              ⚡ {isTh ? "สิทธิ์ Admin:" : "Admin Role:"}{" "}
              <strong>{isTh ? "อำนาจเต็ม (Check-in, Check-out, ยกเลิก, No-Show, และ Override สถานะ)" : "Full Control (Check-in, Check-out, Cancel, No-Show, Override)"}</strong>.
            </span>
          )}
        </div>
      </div>

      {/* Duty Station & Shift Banner */}
      <div
        className="review-panel"
        style={{
          padding: 16,
          background: "var(--surface)",
          border: "1px solid rgba(229, 174, 0, 0.35)",
          borderRadius: 14,
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.04)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: "#fef3c7",
                color: "#92400e",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MapPin size={16} />
            </span>
            <div>
              <strong style={{ fontSize: 13, display: "block" }}>
                {isTh ? "จุดเวรปฏิบัติงานเจ้าหน้าที่ (Duty Station)" : "Staff Duty Station"}
              </strong>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                {isTh ? `ผู้ปฏิบัติงาน: ${staffAccountName}` : `Officer on duty: ${staffAccountName}`}
              </span>
            </div>
          </div>
          <span
            className="data-badge"
            style={{
              fontSize: 10,
              padding: "3px 8px",
              background: "#ecfdf5",
              color: "#065f46",
              borderRadius: 6,
              fontWeight: 700,
            }}
          >
            ● {isTh ? "บันทึกข้อมูลเวรในระบบ" : "Duty Tracking Active"}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          {/* Duty Zone Selector */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, display: "block", marginBottom: 4, color: "var(--ink)" }}>
              📍 {isTh ? "โซนเวรที่ประจำการ" : "Assigned Zone"}
            </label>
            <select
              className="form-control"
              value={staffZone}
              onChange={(e) => handleUpdateDutyZone(e.target.value)}
              style={{ fontWeight: 700, fontSize: 13 }}
            >
              {parkingAreas.map((area) => (
                <option key={area.code} value={area.code}>
                  {area.code} · {isTh ? area.th : area.en}
                </option>
              ))}
            </select>
          </div>

          {/* Duty Shift Selector */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, display: "block", marginBottom: 4, color: "var(--ink)" }}>
              ⏰ {isTh ? "ช่วงเวลากะเวร" : "Duty Shift"}
            </label>
            <select
              className="form-control"
              value={staffShift}
              onChange={(e) => handleUpdateDutyShift(e.target.value)}
              style={{ fontSize: 12 }}
            >
              {SHIFT_OPTIONS.map((shift) => (
                <option key={shift.value} value={shift.value}>
                  {isTh ? shift.labelTh : shift.labelEn}
                </option>
              ))}
            </select>
          </div>
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
              className={`booking-status ${result.booking_status.toLowerCase()}`}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "6px 14px",
                borderRadius: 8,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {result.booking_status === "CHECKED_IN"
                ? isTh ? "🟢 เช็คอินแล้ว / กำลังจอด" : "🟢 Checked-in / Parked"
                : result.booking_status === "OVERSTAY"
                ? isTh ? "🚨 เลยเวลาจอด (OVERSTAY)" : "🚨 Overstay"
                : result.booking_status === "CONFIRMED"
                ? isTh ? "🟡 ยืนยันแล้ว" : "🟡 Confirmed"
                : result.booking_status === "RESERVED"
                ? isTh ? "🟡 จองแล้ว" : "🟡 Reserved"
                : result.booking_status === "COMPLETED"
                ? isTh ? "🏁 เช็คเอาท์แล้ว / เสร็จสิ้น" : "🏁 Completed"
                : result.booking_status === "CANCELLED"
                ? isTh ? "❌ ยกเลิกแล้ว" : "❌ Cancelled"
                : result.booking_status === "NO_SHOW"
                ? isTh ? "⚠️ ไม่มาตามนัด (No-Show)" : "⚠️ No-Show"
                : isTh ? "⏳ รอดำเนินการ" : "⏳ Pending"}
            </span>
          </div>

          {/* Zone Match / Mismatch Verification Banner */}
          {isZoneMatch ? (
            <div
              style={{
                marginTop: 12,
                padding: "10px 14px",
                borderRadius: 10,
                background: "#f0fdf4",
                border: "1px solid #86efac",
                color: "#166534",
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 600,
              }}
            >
              <CheckCircle2 size={18} color="#16a34a" />
              <span>
                {isTh
                  ? `✅ บัตรผ่านตรงโซนเวรประจำการ (${staffZone}) — ตรวจสอบแล้ว อนุญาตให้เช็คอินเข้าจอดได้ตามปกติ`
                  : `✅ Zone Verified: Matches duty zone (${staffZone}) — Ready for check-in`}
              </span>
            </div>
          ) : (
            <div
              style={{
                marginTop: 12,
                padding: "14px 16px",
                borderRadius: 12,
                background: "#fffbeb",
                border: "2px solid #f59e0b",
                color: "#92400e",
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <AlertTriangle size={22} color="#d97706" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong style={{ fontSize: 13, display: "block" }}>
                    ⚠️ {isTh ? "แจ้งเตือน: รถจองพื้นที่อื่น (โซนไม่ตรงกับเวรประจำการ)!" : "Warning: Booked for different zone!"}
                  </strong>
                  <span style={{ fontSize: 11, lineHeight: 1.5, display: "block", marginTop: 2 }}>
                    {isTh
                      ? `บัตรใบนี้จองไว้ที่พื้นที่ ${result.area_code ?? "ไม่ระบุ"} (${result.area_name_th ?? ""}) แต่มาถึงโซนเวรประจำการของคุณ (${staffZone})`
                      : `Booked for ${result.area_code ?? "unknown"} (${result.area_name_th ?? ""}), but arrived at your duty station (${staffZone}).`}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {bookedAreaNavUrl && (
                  <a
                    href={bookedAreaNavUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="secondary-button small-button"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", fontSize: 11 }}
                  >
                    <Navigation size={13} />
                    <span>{isTh ? `🗺️ นำทางไปพื้นที่ ${result.area_code}` : `🗺️ Navigate to ${result.area_code}`}</span>
                    <ExternalLink size={11} />
                  </a>
                )}

                {canCheckIn && (
                  <button
                    type="button"
                    className="primary-button small-button"
                    onClick={() => void openReslotModal()}
                    disabled={Boolean(transitioning) || reslotLoading}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      background: "#d97706",
                      borderColor: "#b45309",
                      fontSize: 11,
                    }}
                  >
                    <ArrowRightLeft size={13} />
                    <span>
                      {reslotLoading
                        ? (isTh ? "กำลังดึงช่องว่าง..." : "Loading slots...")
                        : isTh
                        ? `⚡ ย้ายเข้าโซนนี้ (${staffZone}) & จัดสรรช่องให้ทันที`
                        : `⚡ Re-slot to ${staffZone} & Check-in`}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Overstay Alert Banner */}
          {(result.is_overstay || (result.booking_status === "CHECKED_IN" && new Date().getTime() > new Date(result.ends_at).getTime())) && (
            <div
              style={{
                marginTop: 12,
                padding: "12px 16px",
                borderRadius: 12,
                background: "#fef2f2",
                border: "2px solid #ef4444",
                color: "#991b1b",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <AlertTriangle size={24} color="#dc2626" />
              <div>
                <strong style={{ fontSize: 13, display: "block" }}>
                  🚨 {isTh ? "แจ้งเตือน: รถจอดเกินเวลาที่กำหนด (OVERSTAY)!" : "ALERT: VEHICLE OVERSTAY!"}
                </strong>
                <span style={{ fontSize: 11, color: "#7f1d1d" }}>
                  {isTh
                    ? `หมดเวลาตั้งแต่ ${result.ends_at ? new Date(result.ends_at).toLocaleTimeString() : ""} (เกินเวลาแล้ว ${result.overdue_minutes || 0} นาที) · ติดต่อผู้จอง: ${result.booker_name || "—"} (${result.booker_phone || "ไม่มีเบอร์"})`
                    : `Expired at ${result.ends_at ? new Date(result.ends_at).toLocaleTimeString() : ""} (${result.overdue_minutes || 0} min overdue) · Contact: ${result.booker_name || "—"}`}
                </span>
              </div>
            </div>
          )}

          {/* Details Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
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
              <strong style={{ fontSize: 13, color: overridePlate !== result.vehicle_plate ? "#0284c7" : "inherit" }}>
                {overridePlate || result.vehicle_plate || "—"}
                {overridePlate !== result.vehicle_plate ? " (แก้ไขแล้ว)" : ""}
              </strong>
            </div>
            <div>
              <span style={{ color: "var(--muted)", display: "block" }}>{isTh ? "ผู้จอง" : "Booker"}</span>
              <strong style={{ fontSize: 13 }}>{result.booker_name || "—"}</strong>
              {result.booker_phone ? (
                <small style={{ display: "block", color: "var(--muted)" }}>📞 {result.booker_phone}</small>
              ) : null}
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

          {/* On-Site Editing & Clear Controls */}
          <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              className="text-link"
              onClick={() => setEditingField((prev) => !prev)}
              style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <Edit3 size={13} />
              <span>{editingField ? (isTh ? "▲ ปิดกล่องแก้ไข" : "▲ Close Edit") : (isTh ? "✏️ แก้ไขทะเบียน / บันทึกหน้างาน" : "✏️ Edit Plate / Staff Note")}</span>
            </button>
            <button
              type="button"
              className="secondary-button small-button"
              onClick={handleClearResult}
              style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <RefreshCw size={12} />
              <span>{isTh ? "สแกนคันต่อไป / ล้างข้อมูล" : "Next Car / Clear"}</span>
            </button>
          </div>

          {editingField && (
            <div style={{ marginTop: 8, padding: 12, background: "#f1f5f9", borderRadius: 8, display: "grid", gap: 8 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, display: "block", marginBottom: 2 }}>{isTh ? "ทะเบียนรถจริงหน้างาน" : "Actual Vehicle Plate"}</label>
                <input
                  className="form-control"
                  value={overridePlate}
                  onChange={(e) => setOverridePlate(e.target.value)}
                  placeholder={result.vehicle_plate || (isTh ? "เช่น กข 1234" : "e.g. 1AB 1234")}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, display: "block", marginBottom: 2 }}>{isTh ? "บันทึกเจ้าหน้าที่ (Staff Note)" : "Staff Note"}</label>
                <input
                  className="form-control"
                  value={staffNote}
                  onChange={(e) => setStaffNote(e.target.value)}
                  placeholder={isTh ? "ระบุหมายเหตุ เช่น รถไม่ตรงกับที่จอง, เปลี่ยนช่องจอด ฯลฯ" : "e.g. plate mismatch verified"}
                />
              </div>
            </div>
          )}

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
                    <span>🟢 {isTh ? "เช็คอิน (ยืนยันเข้าจอด)" : "Check In (Confirm Entry)"}</span>
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
                    <span>🔵 {isTh ? "เช็คเอาท์ (ยืนยันออก / เสร็จสิ้น)" : "Check Out (Confirm Exit)"}</span>
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
              /* Admin: Full Transition Authority - Conditionally Switched by Status */
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {canCheckIn && (
                    <button
                      className="primary-button small-button"
                      type="button"
                      onClick={() => void handleTransition("CHECK_IN")}
                      disabled={Boolean(transitioning)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      {transitioning === "CHECK_IN" ? <RefreshCw size={13} className="spin" /> : <CheckCircle2 size={13} />}
                      <span>🟢 {isTh ? "เช็คอิน (เข้าจอด)" : "Check In"}</span>
                    </button>
                  )}

                  {canCheckOut && (
                    <button
                      className="secondary-button small-button"
                      type="button"
                      onClick={() => void handleTransition("CHECK_OUT")}
                      disabled={Boolean(transitioning)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#eff6ff", borderColor: "#bfdbfe", color: "#1d4ed8" }}
                    >
                      {transitioning === "CHECK_OUT" ? <RefreshCw size={13} className="spin" /> : <CheckCircle2 size={13} />}
                      <span>🔵 {isTh ? "เช็คเอาท์ (ออก)" : "Check Out"}</span>
                    </button>
                  )}

                  {canCheckIn && (
                    <>
                      <button
                        className="secondary-button small-button danger"
                        type="button"
                        onClick={() => void handleTransition("CANCEL")}
                        disabled={Boolean(transitioning)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        <AlertTriangle size={13} />
                        <span>❌ {isTh ? "ยกเลิกการจอง" : "Cancel"}</span>
                      </button>

                      <button
                        className="secondary-button small-button"
                        type="button"
                        onClick={() => void handleTransition("NO_SHOW")}
                        disabled={Boolean(transitioning)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        <Clock3 size={13} />
                        <span>⏳ {isTh ? "ไม่มาตามนัด (No-show)" : "No Show"}</span>
                      </button>
                    </>
                  )}

                  {isCompleted && (
                    <span style={{ color: "#166534", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                      <CheckCircle2 size={15} /> {isTh ? "เสร็จสิ้นแล้ว" : "Completed"}
                    </span>
                  )}

                  {isCancelled && (
                    <span style={{ color: "#991b1b", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                      <AlertTriangle size={15} /> {isTh ? "ยกเลิกแล้ว" : "Cancelled"}
                    </span>
                  )}

                  <button
                    className="secondary-button small-button danger"
                    type="button"
                    onClick={() => void handleDeleteBooking()}
                    disabled={Boolean(transitioning)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      background: "#fef2f2",
                      borderColor: "#fecaca",
                      color: "#dc2626",
                    }}
                  >
                    {transitioning === "DELETING" ? <RefreshCw size={13} className="spin" /> : <Trash2 size={13} />}
                    <span>{isTh ? "ลบรายการ (Delete)" : "Delete"}</span>
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

      {/* Re-slotting Modal to Current Duty Zone */}
      {showReslotModal && result && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            className="review-panel"
            style={{
              maxWidth: 480,
              width: "100%",
              padding: 22,
              boxShadow: "0 20px 48px rgba(0,0,0,0.35)",
              border: "2px solid #f59e0b",
              borderRadius: 16,
              background: "var(--surface)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                <ArrowRightLeft size={18} color="#d97706" />
                {isTh ? "จัดสรรช่องจอดในโซนเวร & เช็คอิน" : "Re-slot to Current Zone & Check-in"}
              </h3>
              <button
                type="button"
                onClick={() => setShowReslotModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ padding: 12, background: "#f8fafc", borderRadius: 10, fontSize: 12, border: "1px solid var(--line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "var(--muted)" }}>{isTh ? "รหัสการจอง:" : "Ref:"}</span>
                  <strong style={{ fontFamily: "monospace" }}>{result.booking_reference}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "var(--muted)" }}>{isTh ? "ทะเบียนรถ:" : "Plate:"}</span>
                  <strong>{result.vehicle_plate || "—"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--muted)" }}>{isTh ? "โซนเดิมที่จอง:" : "Original Zone:"}</span>
                  <span style={{ color: "#b91c1c", fontWeight: 700 }}>
                    {result.area_code} · {result.area_name_th ?? ""}
                  </span>
                </div>
              </div>

              <div style={{ padding: 12, background: "#fef3c7", borderRadius: 10, border: "1px solid #fde68a" }}>
                <strong style={{ fontSize: 12, color: "#92400e", display: "block", marginBottom: 4 }}>
                  🎯 {isTh ? `ย้ายเข้าโซนเวรประจำการ: ${staffZone}` : `Reassigning to Duty Zone: ${staffZone}`}
                </strong>
                <span style={{ fontSize: 11, color: "#78350f", lineHeight: 1.4, display: "block" }}>
                  {isTh
                    ? "ระบบจะอัปเดตพื้นที่การจองเป็นโซนนี้ บันทึกผู้รับผิดชอบ และทำการเช็คอินเข้าจอดให้ทันที"
                    : "Booking area will be updated to this zone, logged in audit trail, and checked in immediately."}
                </span>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6, color: "var(--ink)" }}>
                  {isTh ? "เลือกช่องจอดว่างในโซนนี้:" : "Select Available Slot:"}
                </label>
                {reslotLoading ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", color: "var(--muted)", fontSize: 12 }}>
                    <LoaderCircle size={16} className="spin" />
                    <span>{isTh ? "กำลังดึงข้อมูลช่องจอด..." : "Fetching slots..."}</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 130, overflowY: "auto", padding: 2 }}>
                    {availableSlots.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setTargetSlotCode(slot.slot_code)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          border: "1px solid",
                          cursor: "pointer",
                          background: targetSlotCode === slot.slot_code ? "#f59e0b" : "var(--surface)",
                          color: targetSlotCode === slot.slot_code ? "#fff" : "var(--ink)",
                          borderColor: targetSlotCode === slot.slot_code ? "#d97706" : "var(--line)",
                        }}
                      >
                        {slot.slot_code}
                      </button>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 2 }}>
                    {isTh ? "หรือพิมพ์ระบุช่องจอดด้วยตนเอง:" : "Or enter custom slot code:"}
                  </span>
                  <input
                    className="form-control"
                    value={targetSlotCode}
                    onChange={(e) => setTargetSlotCode(e.target.value.toUpperCase())}
                    placeholder={isTh ? "เช่น A01, B05" : "e.g. A01, B05"}
                    style={{ fontWeight: 700, fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowReslotModal(false)}
                  disabled={transitioning === "REASSIGN_AND_CHECKIN"}
                >
                  {isTh ? "ยกเลิก" : "Cancel"}
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void handleConfirmReslotAndCheckIn()}
                  disabled={transitioning === "REASSIGN_AND_CHECKIN" || !targetSlotCode.trim()}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#d97706", borderColor: "#b45309" }}
                >
                  {transitioning === "REASSIGN_AND_CHECKIN" ? (
                    <LoaderCircle size={15} className="spin" />
                  ) : (
                    <CheckCircle2 size={15} />
                  )}
                  <span>{isTh ? "⚡ ยืนยันย้ายโซน & เช็คอิน" : "⚡ Confirm & Check-in"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}