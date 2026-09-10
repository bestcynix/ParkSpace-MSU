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
  const selectedArea = editingId ? areas.find((area) => area.id === editingId) ?? null : null;
  const { confirm, notify } = useNotifications();

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
      setEditingId((current) => current || (loadedAreas.length > 0 ? loadedAreas[0].id : null));
      setDraft((current) => current.code ? current : (loadedAreas.length > 0 ? draftFromArea(loadedAreas[0]) : emptyDraft));
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

  function updateDraft<K extends keyof AreaDraft>(key: K, value: AreaDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function toggleVehicleType(value: VehicleType) {
    setDraft((current) => ({ ...current, vehicle_types: current.vehicle_types.includes(value) ? current.vehicle_types.filter((item) => item !== value) : [...current.vehicle_types, value] }));
  }

  function startEdit(area: AreaRow) {
    setEditingId(area.id);
    setDraft(draftFromArea(area));
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startCreate() {
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
    const confirmed = await confirm({ title: t.confirmDelete, message: `${area.code} · ${area.name_th}`, confirmLabel: t.delete, cancelLabel: t.close, danger: true });
    if (!confirmed) return;
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("parking_areas").delete().eq("id", area.id);
      if (error) throw error;
      await writeAudit("DELETE_PARKING_AREA", area.id, area, null);
      setAreas((current) => current.filter((item) => item.id !== area.id));
      if (editingId === area.id) startCreate();
      setMessage(t.delete);
      notify({ title: t.delete, kind: "success" });
    } catch (error) {
      const detail = error instanceof Error ? error.message : t.operationalData;
      setMessage(detail);
      notify({ title: t.operationalData, message: detail, kind: "error" });
    }
  }

  return <div className="data-manager">
    <div className="data-manager-heading"><div><p className="eyebrow">{t.admin}</p><h2>{t.areas}</h2><p className="page-subtitle">{t.realMetrics} · {t.sourceLabel}</p></div><button className="primary-button" type="button" onClick={startCreate}><Plus size={16} />{t.addArea}</button></div>
    {message ? <div className="form-note" role="status">{message}</div> : null}
    <div className="data-manager-layout">
      <form className="form-card data-editor-card" onSubmit={(event) => void saveArea(event)}>
        <div className="form-section-title"><MapPinned size={22} /><div><h2>{editingId ? t.edit : t.create}</h2><p>{t.admin} · {t.noPrivateData}</p></div></div>
        <div className="support-form-grid">
          <div className="form-group"><label htmlFor="area-code">{t.area} / Code</label><input id="area-code" className="form-control" value={draft.code} onChange={(event) => updateDraft("code", event.target.value)} placeholder="P01" required disabled={Boolean(editingId)} /></div>
          <div className="form-group"><label htmlFor="area-capacity">{t.estimatedCapacity}</label><input id="area-capacity" className="form-control" type="number" min="0" value={draft.capacity} onChange={(event) => updateDraft("capacity", event.target.value)} /></div>
          <div className="form-group"><label htmlFor="area-operational-status">{t.areaOpen}</label><select id="area-operational-status" className="form-control" value={draft.current_status} onChange={(event) => updateDraft("current_status", event.target.value as OperationalStatus)}><option value="AVAILABLE">{t.enabled}</option><option value="CLOSED">{t.areaClosed}</option></select></div>
          <div className="form-group"><label htmlFor="area-name-th">{t.nameThai}</label><input id="area-name-th" className="form-control" value={draft.name_th} onChange={(event) => updateDraft("name_th", event.target.value)} required /></div>
          <div className="form-group"><label htmlFor="area-name-en">{t.nameEnglish}</label><input id="area-name-en" className="form-control" value={draft.name_en} onChange={(event) => updateDraft("name_en", event.target.value)} required /></div>
          <div className="form-group"><label htmlFor="area-source">{t.capacitySource}</label><select id="area-source" className="form-control" value={draft.capacity_source} onChange={(event) => updateDraft("capacity_source", event.target.value as CapacitySource)}><option value="VERIFIED_SURVEY">VERIFIED_SURVEY</option><option value="UNVERIFIED">UNVERIFIED</option></select></div>
          <div className="form-group"><label htmlFor="area-slot-mode">{t.slotMode}</label><select id="area-slot-mode" className="form-control" value={draft.slot_mode} onChange={(event) => updateDraft("slot_mode", event.target.value as SlotMode)}><option value="AREA_ONLY">{t.areaOnly}</option><option value="INDIVIDUAL_SLOT">{t.individualSlot}</option></select></div>
          <div className="form-group"><label htmlFor="area-status">{t.dataStatus}</label><select id="area-status" className="form-control" value={draft.data_status} onChange={(event) => updateDraft("data_status", event.target.value as AreaStatus)}><option value="VERIFIED">VERIFIED</option><option value="AWAITING_VERIFICATION">AWAITING_VERIFICATION</option><option value="DRAFT">DRAFT</option><option value="OUTDATED">OUTDATED</option></select></div>
          <div className="form-group"><label htmlFor="area-lat">{t.latitude}</label><input id="area-lat" className="form-control" type="number" step="any" value={draft.latitude} onChange={(event) => updateDraft("latitude", event.target.value)} /><small className="field-hint">{t.mapPinVerificationNote}</small></div>
          <div className="form-group"><label htmlFor="area-lon">{t.longitude}</label><input id="area-lon" className="form-control" type="number" step="any" value={draft.longitude} onChange={(event) => updateDraft("longitude", event.target.value)} /></div>
        </div>
        <div className="form-group"><label htmlFor="area-source-reference">{t.sourceReference}</label><input id="area-source-reference" className="form-control" type="url" value={draft.source_reference} onChange={(event) => updateDraft("source_reference", event.target.value)} /></div>
        <div className="support-form-grid">
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
        <div className="support-form-actions"><button className="primary-button" type="submit" disabled={saving}>{saving ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}{saving ? "…" : t.save}</button>{editingId ? <button className="secondary-button" type="button" onClick={startCreate}>{t.cancel}</button> : null}</div>
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
                onClick={() => startEdit(area)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    startEdit(area);
                  }
                }}
              >
                <div>
                  <strong>{area.code} · {locale === "th" ? area.name_th : area.name_en}</strong>
                  <small>{area.capacity ?? "—"} · {area.capacity_source} · {area.slot_mode} · {area.data_status}</small>
                  <small>{area.current_status === "CLOSED" ? t.areaClosed : t.areaOpen} · {Array.isArray(area.vehicle_types) ? area.vehicle_types.length : 0} {t.vehicleTypes}</small>
                </div>
                <div className="data-list-actions">
                  <button
                    className="icon-button"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(area);
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
