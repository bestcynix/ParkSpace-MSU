"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Edit3, Filter, LoaderCircle, MapPinned, Plus, Save, Search, Trash2 } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { SlotLayoutManager } from "@/components/admin/SlotLayoutManager";
import { useNotifications } from "@/components/layout/NotificationProvider";
import { ImageInputWithUpload } from "@/components/ui/ImageInputWithUpload";
import { logAdminAudit } from "@/lib/admin/audit";

type ManagerRole = "admin";
type AreaStatus = "DRAFT" | "AWAITING_VERIFICATION" | "VERIFIED" | "OUTDATED";
type CapacitySource = "UNVERIFIED" | "VERIFIED_SURVEY";
type SlotMode = "AREA_ONLY" | "INDIVIDUAL_SLOT";
type OperationalStatus = "AVAILABLE" | "CLOSED";
type VehicleType = "CAR" | "MOTORCYCLE" | "PICKUP" | "VAN" | "EV" | "OTHER";

type AreaRow = {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  description_th: string | null;
  description_en: string | null;
  latitude: number | null;
  longitude: number | null;
  capacity: number | null;
  capacity_source: CapacitySource | "MOCKUP";
  capacity_verified: boolean;
  slot_mode: SlotMode;
  slot_layout_source: CapacitySource | "MOCKUP";
  slot_layout_verified: boolean;
  current_status: string;
  vehicle_types: unknown;
  cover_image_path: string | null;
  entrance_image_path: string | null;
  data_status: AreaStatus;
  source_reference: string | null;
};

type AreaDraft = {
  code: string;
  name_th: string;
  name_en: string;
  description_th: string;
  description_en: string;
  capacity: string;
  capacity_source: CapacitySource;
  slot_mode: SlotMode;
  data_status: AreaStatus;
  current_status: OperationalStatus;
  vehicle_types: VehicleType[];
  latitude: string;
  longitude: string;
  source_reference: string;
  cover_image_path: string;
  entrance_image_path: string;
};

const supportedVehicleTypes: VehicleType[] = ["CAR", "MOTORCYCLE", "PICKUP", "VAN", "EV", "OTHER"];

const emptyDraft: AreaDraft = {
  code: "",
  name_th: "",
  name_en: "",
  description_th: "",
  description_en: "",
  capacity: "100",
  capacity_source: "VERIFIED_SURVEY",
  slot_mode: "INDIVIDUAL_SLOT",
  data_status: "VERIFIED",
  current_status: "AVAILABLE",
  vehicle_types: supportedVehicleTypes,
  latitude: "",
  longitude: "",
  source_reference: "https://building.msu.ac.th/news-detail.php?id=23",
  cover_image_path: "",
  entrance_image_path: "",
};

function draftFromArea(area: AreaRow): AreaDraft {
  return {
    code: area.code,
    name_th: area.name_th,
    name_en: area.name_en,
    description_th: area.description_th ?? "",
    description_en: area.description_en ?? "",
    capacity: area.capacity == null ? "" : String(area.capacity),
    capacity_source: area.capacity_source === "MOCKUP" ? "VERIFIED_SURVEY" : area.capacity_source,
    slot_mode: area.slot_mode,
    data_status: area.data_status,
    current_status: area.current_status === "CLOSED" ? "CLOSED" : "AVAILABLE",
    vehicle_types: Array.isArray(area.vehicle_types) ? area.vehicle_types.filter((value): value is VehicleType => supportedVehicleTypes.includes(value as VehicleType)) : supportedVehicleTypes,
    latitude: area.latitude == null ? "" : String(area.latitude),
    longitude: area.longitude == null ? "" : String(area.longitude),
    source_reference: area.source_reference ?? "",
    cover_image_path: area.cover_image_path ?? "",
    entrance_image_path: area.entrance_image_path ?? "",
  };
}

const fields = "id, code, name_th, name_en, description_th, description_en, latitude, longitude, capacity, capacity_source, capacity_verified, slot_mode, slot_layout_source, slot_layout_verified, current_status, vehicle_types, cover_image_path, entrance_image_path, data_status, source_reference";

export function AreaManager({ locale, role }: { locale: Locale; role: ManagerRole }) {
  const t = getCopy(locale);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [draft, setDraft] = useState<AreaDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isDemoAdmin, setIsDemoAdmin] = useState(false);
  const selectedArea = editingId ? areas.find((area) => area.id === editingId) ?? null : null;
  const { confirm, notify } = useNotifications();

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    void createSupabaseBrowserClient().auth.getSession().then((res: any) => {
      if (res?.data?.session?.user?.email?.toLowerCase() === "admin@msu.ac.th") {
        setIsDemoAdmin(true);
      }
    });
  }, []);

  const statusCounts = useMemo(() => ({
    open: areas.filter((a) => a.current_status !== "CLOSED").length,
    closed: areas.filter((a) => a.current_status === "CLOSED").length,
    verified: areas.filter((a) => a.data_status === "VERIFIED").length,
    awaiting: areas.filter((a) => a.data_status === "AWAITING_VERIFICATION").length,
    draft: areas.filter((a) => a.data_status === "DRAFT").length,
  }), [areas]);

  const filteredAreas = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return areas.filter((area) => {
      if (q) {
        const matchCode = area.code.toLowerCase().includes(q);
        const matchTh = area.name_th?.toLowerCase().includes(q);
        const matchEn = area.name_en?.toLowerCase().includes(q);
        if (!matchCode && !matchTh && !matchEn) return false;
      }
      if (statusFilter === "OPEN") return area.current_status !== "CLOSED";
      if (statusFilter === "CLOSED") return area.current_status === "CLOSED";
      if (statusFilter === "VERIFIED") return area.data_status === "VERIFIED";
      if (statusFilter === "AWAITING_VERIFICATION") return area.data_status === "AWAITING_VERIFICATION";
      if (statusFilter === "DRAFT") return area.data_status === "DRAFT";
      return true;
    });
  }, [areas, searchQuery, statusFilter]);

  const isDirty = useMemo(() => {
    if (editingId && selectedArea) {
      const initial = draftFromArea(selectedArea);
      return (
        draft.code !== initial.code ||
        draft.name_th !== initial.name_th ||
        draft.name_en !== initial.name_en ||
        draft.description_th !== initial.description_th ||
        draft.description_en !== initial.description_en ||
        draft.capacity !== initial.capacity ||
        draft.capacity_source !== initial.capacity_source ||
        draft.slot_mode !== initial.slot_mode ||
        draft.data_status !== initial.data_status ||
        draft.current_status !== initial.current_status ||
        draft.latitude !== initial.latitude ||
        draft.longitude !== initial.longitude ||
        draft.source_reference !== initial.source_reference ||
        draft.cover_image_path !== initial.cover_image_path ||
        draft.entrance_image_path !== initial.entrance_image_path ||
        draft.vehicle_types.length !== initial.vehicle_types.length ||
        draft.vehicle_types.some((v) => !initial.vehicle_types.includes(v))
      );
    }
    return (
      draft.code !== "" ||
      draft.name_th !== "" ||
      draft.name_en !== "" ||
      draft.description_th !== "" ||
      draft.description_en !== "" ||
      draft.cover_image_path !== "" ||
      draft.entrance_image_path !== "" ||
      draft.latitude !== "" ||
      draft.longitude !== ""
    );
  }, [draft, editingId, selectedArea]);

  const loadAreas = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setMessage(`${t.accountNotConfigured} / ${t.accountNotConfiguredEn}`);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await createSupabaseBrowserClient().from("parking_areas").select(fields).order("code");
      if (error) throw error;
      const loadedAreas = (data ?? []) as AreaRow[];
      setAreas(loadedAreas);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.operationalData);
    } finally {
      setLoading(false);
    }
  }, [t.accountNotConfigured, t.accountNotConfiguredEn, t.operationalData]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAreas(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAreas]);

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  function updateDraft<K extends keyof AreaDraft>(key: K, value: AreaDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function toggleVehicleType(value: VehicleType) {
    setDraft((current) => ({ ...current, vehicle_types: current.vehicle_types.includes(value) ? current.vehicle_types.filter((item) => item !== value) : [...current.vehicle_types, value] }));
  }

  async function confirmDiscardIfDirty(): Promise<boolean> {
    if (!isDirty) return true;
    return await confirm({
      title: locale === "th" ? "ทิ้งการแก้ไขที่ยังไม่ได้บันทึก?" : "Discard unsaved changes?",
      message: locale === "th"
        ? "คุณมีข้อมูลที่มีการเปลี่ยนแปลงแต่ยังไม่ได้บันทึก ต้องการยกเลิกและทิ้งข้อมูลที่แก้ไขหรือไม่?"
        : "You have unsaved changes. Are you sure you want to discard them?",
      confirmLabel: locale === "th" ? "ทิ้งข้อมูล" : "Discard",
      cancelLabel: locale === "th" ? "แก้ไขต่อ" : "Keep editing",
      danger: true,
    });
  }

  async function startEdit(area: AreaRow) {
    if (editingId === area.id) return;
    if (isDirty) {
      const ok = await confirmDiscardIfDirty();
      if (!ok) return;
    }
    setEditingId(area.id);
    setDraft(draftFromArea(area));
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function startCreate() {
    if (isDirty) {
      const ok = await confirmDiscardIfDirty();
      if (!ok) return;
    }
    setEditingId(null);
    setDraft(emptyDraft);
    setMessage("");
  }

  async function writeAudit(action: string, entityId: string | null, beforeData: unknown, afterData: unknown) {
    if (role !== "admin") return;
    await logAdminAudit({
      action,
      entity_type: "parking_area",
      entity_id: entityId || undefined,
      before_data: beforeData,
      after_data: afterData,
      reason: "Parking area maintenance from Admin console",
      result: "SUCCESS",
    });
  }

  async function saveArea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupabaseConfigured()) {
      setMessage(`${t.accountNotConfigured} / ${t.accountNotConfiguredEn}`);
      return;
    }
    if (!draft.name_th.trim() || !draft.name_en.trim()) {
      setMessage(locale === "th" ? "กรุณากรอกชื่อพื้นที่ทั้งสองภาษา" : "Enter the area name in both languages.");
      return;
    }
    const normalizedCode = draft.code.trim().toUpperCase();
    if (!/^P[0-9]{2}$/.test(normalizedCode)) {
      setMessage(locale === "th" ? "รหัสพื้นที่ต้องเป็นรูปแบบ P01" : "Area code must use the P01 format.");
      return;
    }
    setSaving(true);
    setMessage("");

    if (isDemoAdmin) {
      await new Promise((r) => setTimeout(r, 400));
      const simulatedArea: AreaRow = {
        id: editingId || `demo-area-${Date.now()}`,
        code: normalizedCode,
        name_th: draft.name_th.trim(),
        name_en: draft.name_en.trim(),
        description_th: draft.description_th.trim() || null,
        description_en: draft.description_en.trim() || null,
        capacity: draft.capacity.trim() ? Number(draft.capacity) : null,
        capacity_source: draft.capacity_source,
        capacity_verified: true,
        slot_mode: draft.slot_mode,
        slot_layout_source: "VERIFIED_SURVEY",
        slot_layout_verified: true,
        data_status: draft.data_status,
        current_status: draft.current_status,
        vehicle_types: draft.vehicle_types,
        latitude: draft.latitude.trim() ? Number(draft.latitude) : null,
        longitude: draft.longitude.trim() ? Number(draft.longitude) : null,
        source_reference: draft.source_reference.trim() || null,
        cover_image_path: draft.cover_image_path.trim() || null,
        entrance_image_path: draft.entrance_image_path.trim() || null,
      };
      setAreas((current) => editingId ? current.map((area) => area.id === simulatedArea.id ? simulatedArea : area) : [...current, simulatedArea].sort((a, b) => a.code.localeCompare(b.code)));
      setEditingId(simulatedArea.id);
      setDraft(draftFromArea(simulatedArea));
      setSaving(false);
      notify({
        title: locale === "th" ? "จำลองการบันทึกพื้นที่สำเร็จ" : "Simulated Save",
        message: locale === "th" ? "โหมด Demo Admin สำหรับการนำเสนอ (ข้อมูลจริงไม่ถูกเปลี่ยนแปลง)" : "Demo presentation mode (no real changes saved).",
        kind: "info",
      });
      return;
    }

    const payload = {
      code: normalizedCode,
      name_th: draft.name_th.trim(),
      name_en: draft.name_en.trim(),
      description_th: draft.description_th.trim() || null,
      description_en: draft.description_en.trim() || null,
      capacity: draft.capacity.trim() ? Number(draft.capacity) : null,
      capacity_source: draft.capacity_source,
      slot_mode: draft.slot_mode,
      data_status: draft.data_status,
      current_status: draft.current_status,
      vehicle_types: draft.vehicle_types,
      latitude: draft.latitude.trim() ? Number(draft.latitude) : null,
      longitude: draft.longitude.trim() ? Number(draft.longitude) : null,
      source_reference: draft.source_reference.trim() || null,
      cover_image_path: draft.cover_image_path.trim() || null,
      entrance_image_path: draft.entrance_image_path.trim() || null,
    };
    try {
      const supabase = createSupabaseBrowserClient();
      const before = editingId ? areas.find((area) => area.id === editingId) ?? null : null;
      const result = editingId
        ? await supabase.from("parking_areas").update(payload).eq("id", editingId).select(fields).single()
        : await supabase.from("parking_areas").insert(payload).select(fields).single();
      if (result.error) throw result.error;
      const nextArea = result.data as AreaRow;
      await writeAudit(editingId ? "UPDATE_PARKING_AREA" : "CREATE_PARKING_AREA", nextArea.id, before, nextArea);
      setAreas((current) => editingId ? current.map((area) => area.id === nextArea.id ? nextArea : area) : [...current, nextArea].sort((a, b) => a.code.localeCompare(b.code)));
      setEditingId(nextArea.id);
      setDraft(draftFromArea(nextArea));
      setMessage(t.save);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.operationalData);
    } finally {
      setSaving(false);
    }
  }

  async function deleteArea(area: AreaRow) {
    if (role !== "admin") return;
    const confirmed = await confirm({
      title: locale === "th" ? `ยืนยันการลบพื้นที่ ${area.code}?` : `Confirm delete ${area.code}?`,
      message: locale === "th"
        ? `คำเตือนสำคัญ: คุณกำลังจะลบพื้นที่ "${area.code} · ${area.name_th}" ออกจากระบบอย่างถาวร! ผังแถวและช่องจอดทั้งหมดในพื้นที่นี้จะถูกลบออกด้วย และอาจส่งผลกระทบต่อประวัติการจอง การดำเนินการนี้ไม่สามารถย้อนกลับได้`
        : `Warning: You are about to permanently delete "${area.code} · ${area.name_en}". All parking rows and slots in this area will also be deleted. This cannot be undone.`,
      confirmLabel: locale === "th" ? "ยืนยันลบข้อมูลถาวร" : "Permanently Delete",
      cancelLabel: locale === "th" ? "ยกเลิก ไม่ลบ" : "Cancel, Keep Area",
      danger: true,
    });
    if (!confirmed) return;
    setMessage("");

    if (isDemoAdmin) {
      setAreas((current) => current.filter((item) => item.id !== area.id));
      if (editingId === area.id) void startCreate();
      notify({
        title: locale === "th" ? "จำลองการลบสำเร็จ" : "Simulated Delete",
        message: locale === "th" ? "โหมด Demo Admin สำหรับการนำเสนอ (ข้อมูลจริงไม่ถูกเปลี่ยนแปลง)" : "Demo presentation mode (no real changes saved).",
        kind: "info",
      });
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("parking_areas").delete().eq("id", area.id);
      if (error) throw error;
      await writeAudit("DELETE_PARKING_AREA", area.id, area, null);
      setAreas((current) => current.filter((item) => item.id !== area.id));
      if (editingId === area.id) void startCreate();
      setMessage(locale === "th" ? `ลบพื้นที่ ${area.code} สำเร็จ` : `Deleted area ${area.code}`);
      notify({ title: locale === "th" ? `ลบพื้นที่ ${area.code} สำเร็จ` : `Deleted ${area.code}`, kind: "success" });
    } catch (error) {
      let detail = error instanceof Error ? error.message : t.operationalData;
      if (detail.includes("violates foreign key constraint") || detail.includes("foreign key")) {
        detail = locale === "th"
          ? "ไม่สามารถลบพื้นที่นี้ได้ เนื่องจากมีรายการจองหรือช่องจอดผูกอยู่กับพื้นที่นี้ กรุณายกเลิก/ลบรายการจองหรือย้ายช่องจอดก่อนลบพื้นที่"
          : "Cannot delete this area because there are active bookings or parking slots linked to it. Please remove them first.";
      }
      setMessage(detail);
      notify({ title: locale === "th" ? "ไม่สามารถลบพื้นที่ได้" : "Cannot Delete Area", message: detail, kind: "error" });
    }
  }

  return <div className="data-manager">
    <div className="data-manager-heading">
      <div>
        <p className="eyebrow">{t.admin}</p>
        <h2>{t.areas}</h2>
        <p className="page-subtitle">{t.realMetrics} · {t.sourceLabel}</p>
      </div>
      <button className="primary-button" type="button" onClick={() => void startCreate()}>
        <Plus size={16} />{t.addArea}
      </button>
    </div>
    {message ? <div className="form-note" role="status">{message}</div> : null}
    <div className="data-manager-layout">
      <form className="form-card data-editor-card" onSubmit={(event) => void saveArea(event)}>
        <div className="form-section-title">
          <MapPinned size={22} />
          <div>
            <h2>
              {editingId
                ? (locale === "th" ? `กำลังแก้ไขพื้นที่: ${selectedArea?.code ?? ""}` : `Editing Area: ${selectedArea?.code ?? ""}`)
                : (locale === "th" ? "สร้างพื้นที่จอดรถใหม่" : "Create New Parking Area")}
              {isDirty ? (
                <span style={{ fontSize: 13, color: "#d97706", marginLeft: 8, fontWeight: 500 }}>
                  ({locale === "th" ? "มีการแก้ไขที่ยังไม่บันทึก" : "Unsaved changes"})
                </span>
              ) : null}
            </h2>
            <p>
              {editingId
                ? (locale === "th" ? `กำลังแก้ไขข้อมูล ${selectedArea?.name_th ?? ""} (${selectedArea?.code ?? ""})` : `Editing ${selectedArea?.name_en ?? ""} (${selectedArea?.code ?? ""})`)
                : (locale === "th" ? "กรอกข้อมูลเพื่อสร้างพื้นที่จอดรถใหม่ หรือคลิกเลือกพื้นที่จากรายการด้านขวาเพื่อแก้ไข" : "Fill details to create a new area or select an area on the right to edit.")}
            </p>
          </div>
        </div>
        <div className="support-form-grid">
          <div className="form-group"><label htmlFor="area-code">{t.area} / Code</label><input id="area-code" className="form-control" value={draft.code} onChange={(event) => updateDraft("code", event.target.value)} placeholder="P01" required disabled={Boolean(editingId)} /></div>
          <div className="form-group"><label htmlFor="area-capacity">{t.estimatedCapacity}</label><input id="area-capacity" className="form-control" type="number" min="0" value={draft.capacity} onChange={(event) => updateDraft("capacity", event.target.value)} /></div>
          <div className="form-group"><label htmlFor="area-operational-status">{t.areaOpen}</label><select id="area-operational-status" className="form-control" value={draft.current_status} onChange={(event) => updateDraft("current_status", event.target.value as OperationalStatus)}><option value="AVAILABLE">{t.enabled}</option><option value="CLOSED">{t.areaClosed}</option></select></div>
          <div className="form-group"><label htmlFor="area-name-th">{t.nameThai}</label><input id="area-name-th" className="form-control" value={draft.name_th} onChange={(event) => updateDraft("name_th", event.target.value)} required /></div>
          <div className="form-group"><label htmlFor="area-name-en">{t.nameEnglish}</label><input id="area-name-en" className="form-control" value={draft.name_en} onChange={(event) => updateDraft("name_en", event.target.value)} required /></div>
          <div className="form-group"><label htmlFor="area-source">{t.capacitySource}</label><select id="area-source" className="form-control" value={draft.capacity_source} onChange={(event) => updateDraft("capacity_source", event.target.value as CapacitySource)}><option value="VERIFIED_SURVEY">{locale === "th" ? "สำรวจและยืนยันแล้ว (VERIFIED_SURVEY)" : "Verified Survey"}</option><option value="UNVERIFIED">{locale === "th" ? "ยังไม่ยืนยัน (UNVERIFIED)" : "Unverified"}</option></select></div>
          <div className="form-group"><label htmlFor="area-slot-mode">{t.slotMode}</label><select id="area-slot-mode" className="form-control" value={draft.slot_mode} onChange={(event) => updateDraft("slot_mode", event.target.value as SlotMode)}><option value="AREA_ONLY">{t.areaOnly}</option><option value="INDIVIDUAL_SLOT">{t.individualSlot}</option></select></div>
          <div className="form-group"><label htmlFor="area-status">{t.dataStatus}</label><select id="area-status" className="form-control" value={draft.data_status} onChange={(event) => updateDraft("data_status", event.target.value as AreaStatus)}><option value="VERIFIED">{locale === "th" ? "ยืนยันแล้ว (VERIFIED)" : "Verified"}</option><option value="AWAITING_VERIFICATION">{locale === "th" ? "รอตรวจสอบ (AWAITING_VERIFICATION)" : "Awaiting Verification"}</option><option value="DRAFT">{locale === "th" ? "ฉบับร่าง (DRAFT)" : "Draft"}</option><option value="OUTDATED">{locale === "th" ? "ล้าสมัย (OUTDATED)" : "Outdated"}</option></select></div>
          <div className="form-group"><label htmlFor="area-lat">{t.latitude}</label><input id="area-lat" className="form-control" type="number" step="any" value={draft.latitude} onChange={(event) => updateDraft("latitude", event.target.value)} /><small className="field-hint">{t.mapPinVerificationNote}</small></div>
          <div className="form-group"><label htmlFor="area-lon">{t.longitude}</label><input id="area-lon" className="form-control" type="number" step="any" value={draft.longitude} onChange={(event) => updateDraft("longitude", event.target.value)} /></div>
        </div>
        <div className="form-group"><label htmlFor="area-source-reference">{t.sourceReference}</label><input id="area-source-reference" className="form-control" type="url" value={draft.source_reference} onChange={(event) => updateDraft("source_reference", event.target.value)} /></div>
        <div className="area-image-uploaders-grid">
          <ImageInputWithUpload
            label={t.imagePath}
            value={draft.cover_image_path}
            onChange={(url) => updateDraft("cover_image_path", url)}
            placeholder="https://…"
            hint={t.placeholderImageNote}
            locale={locale}
            bucketName="parking-images"
          />
          <ImageInputWithUpload
            label={`${t.imagePath} · Entrance`}
            value={draft.entrance_image_path}
            onChange={(url) => updateDraft("entrance_image_path", url)}
            placeholder="https://…"
            locale={locale}
            bucketName="parking-images"
          />
        </div>
        <fieldset className="vehicle-type-fieldset"><legend>{t.allowedVehicleTypes}</legend><div className="vehicle-type-options">{supportedVehicleTypes.map((value) => <label key={value}><input type="checkbox" checked={draft.vehicle_types.includes(value)} onChange={() => toggleVehicleType(value)} /><span>{value === "CAR" ? t.car : value === "MOTORCYCLE" ? t.motorcycle : value === "PICKUP" ? t.pickup : value === "VAN" ? t.van : value === "EV" ? t.ev : t.otherVehicle}</span></label>)}</div></fieldset>
        <div className="support-form-grid"><div className="form-group"><label htmlFor="area-description-th">{t.description} · TH</label><textarea id="area-description-th" className="form-control" rows={4} value={draft.description_th} onChange={(event) => updateDraft("description_th", event.target.value)} /></div><div className="form-group"><label htmlFor="area-description-en">{t.description} · EN</label><textarea id="area-description-en" className="form-control" rows={4} value={draft.description_en} onChange={(event) => updateDraft("description_en", event.target.value)} /></div></div>
        <div className="support-form-actions">
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}
            {saving ? "…" : editingId ? (locale === "th" ? "บันทึกการแก้ไข" : "Save Changes") : (locale === "th" ? "บันทึกพื้นที่ใหม่" : "Create Area")}
          </button>
          {editingId ? (
            <button className="secondary-button" type="button" onClick={() => void startCreate()}>
              {locale === "th" ? "ยกเลิกการแก้ไข" : "Cancel editing"}
            </button>
          ) : null}
        </div>
      </form>
      <section className="review-panel data-list-panel">
        <div className="section-heading">
          <div>
            <h2>{t.areas}</h2>
            <p>{filteredAreas.length} / {areas.length} · {t.realMetrics}</p>
          </div>
          <div className="inline-actions">
            <span className="count-pill">({filteredAreas.length})</span>
            <span className="data-badge">{t.noPrivateData}</span>
          </div>
        </div>
        <div className="inline-actions" style={{ marginTop: 12, marginBottom: 12, gap: 8 }}>
          <div className="user-search-box" style={{ flex: "1 1 180px", margin: 0 }}>
            <Search size={16} />
            <input
              aria-label={locale === "th" ? "ค้นหาพื้นที่ (รหัส, ชื่อ)..." : "Search areas (code, name)..."}
              placeholder={locale === "th" ? "ค้นหาพื้นที่ (รหัส, ชื่อ)..." : "Search areas (code, name)..."}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <label className="user-search-box" style={{ flex: "0 1 170px", margin: 0 }}>
            <Filter size={16} />
            <select
              aria-label={locale === "th" ? "กรองสถานะ" : "Filter by status"}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              style={{ width: "100%", border: 0, outline: 0, background: "transparent", color: "inherit", font: "inherit", cursor: "pointer" }}
            >
              <option value="ALL">{locale === "th" ? "สถานะทั้งหมด" : "All Statuses"} ({areas.length})</option>
              <option value="OPEN">{t.enabled} / {locale === "th" ? "เปิด" : "Open"} ({statusCounts.open})</option>
              <option value="CLOSED">{t.areaClosed} / {locale === "th" ? "ปิด" : "Closed"} ({statusCounts.closed})</option>
              <option value="VERIFIED">VERIFIED / {locale === "th" ? "ตรวจสอบแล้ว" : "Verified"} ({statusCounts.verified})</option>
              <option value="AWAITING_VERIFICATION">AWAITING_VERIFICATION ({statusCounts.awaiting})</option>
              <option value="DRAFT">DRAFT ({statusCounts.draft})</option>
            </select>
          </label>
        </div>
        {loading ? (
          <div className="inline-loading"><LoaderCircle size={18} className="spin" />Loading</div>
        ) : filteredAreas.length ? (
          <div className="data-list">
            {filteredAreas.map((area) => (
              <article
                className={`data-list-item ${selectedArea?.id === area.id ? "selected" : ""}`}
                key={area.id}
                onClick={() => void startEdit(area)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    void startEdit(area);
                  }
                }}
              >
                <div>
                  <strong>
                    {area.code} · {locale === "th" ? area.name_th : area.name_en}
                    {selectedArea?.id === area.id ? (
                      <span style={{ marginLeft: 8, fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "rgba(59,130,246,0.15)", color: "#3b82f6", fontWeight: 600 }}>
                        {locale === "th" ? "กำลังแก้ไข" : "Editing"}
                      </span>
                    ) : null}
                  </strong>
                  <small>{area.capacity ?? "—"} · {area.capacity_source} · {area.slot_mode} · {area.data_status}</small>
                  <small>{area.current_status === "CLOSED" ? t.areaClosed : t.areaOpen} · {Array.isArray(area.vehicle_types) ? area.vehicle_types.length : 0} {t.vehicleTypes}</small>
                </div>
                <div className="data-list-actions">
                  <button
                    className="icon-button"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void startEdit(area);
                    }}
                    aria-label={`${t.edit} ${area.code}`}
                  >
                    <Edit3 size={15} />
                  </button>
                  {role === "admin" ? (
                    <button
                      className="icon-button danger"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void deleteArea(area);
                      }}
                      aria-label={`${t.delete} ${area.code}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : <Check size={16} color="#2b9d65" />}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-card compact-empty">
            <div>
              <MapPinned size={24} />
              <h2>{areas.length ? (locale === "th" ? "ไม่พบพื้นที่ที่ตรงตามเงื่อนไข" : "No matching areas found") : t.noRecords}</h2>
            </div>
          </div>
        )}
      </section>
    </div>
    <SlotLayoutManager locale={locale} role={role} areaId={selectedArea?.id ?? null} areaCode={selectedArea?.code ?? null} />
  </div>;
}
