"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Edit3, Layers3, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import type { Locale, Copy } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useNotifications } from "@/components/layout/NotificationProvider";
import { logAdminAudit } from "@/lib/admin/audit";

type ManagerRole = "admin";
type SlotType = "CAR" | "MOTORCYCLE" | "PICKUP" | "VAN" | "EV" | "OTHER" | "ANY";
type RowStatus = "AVAILABLE" | "CLOSED";
type SlotStatus = "AVAILABLE" | "RESERVED" | "OCCUPIED" | "CLOSED";

type ParkingRow = {
  id: string;
  row_label: string;
  display_order: number;
  status: RowStatus;
  slot_type: SlotType;
  allowed_vehicle_types: unknown;
  data_status: string;
};

type ParkingSlot = {
  id: string;
  row_id: string | null;
  slot_code: string;
  row_label: string;
  position: number;
  slot_type: SlotType;
  status: SlotStatus;
  data_status: string;
};

const slotTypes: SlotType[] = ["CAR", "MOTORCYCLE", "PICKUP", "VAN", "EV", "OTHER", "ANY"];
const rowFields = "id, row_label, display_order, status, slot_type, allowed_vehicle_types, data_status";
const slotFields = "id, row_id, slot_code, row_label, position, slot_type, status, data_status";

function typeLabel(t: Copy, value: string) {
  switch (value) {
    case "CAR": return t.car;
    case "MOTORCYCLE": return t.motorcycle;
    case "PICKUP": return t.pickup;
    case "VAN": return t.van;
    case "EV": return t.ev;
    case "ANY": return t.otherVehicle;
    default: return t.otherVehicle;
  }
}

function nextRowLabel(rows: ParkingRow[]) {
  for (let index = 0; index < 26; index += 1) {
    const label = String.fromCharCode(65 + index);
    if (!rows.some((row) => row.row_label === label)) return label;
  }
  return "NEW";
}

export function SlotLayoutManager({ locale, role, areaId, areaCode }: { locale: Locale; role: ManagerRole; areaId: string | null; areaCode: string | null }) {
  const t = getCopy(locale);
  const [rows, setRows] = useState<ParkingRow[]>([]);
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [slotPage, setSlotPage] = useState(1);
  const [rowDraft, setRowDraft] = useState({ label: "A", slotType: "CAR" as SlotType, status: "AVAILABLE" as RowStatus, initialSlots: "14" });
  const [newSlotCount, setNewSlotCount] = useState("1");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const { confirm, notify } = useNotifications();

  const selectedRow = useMemo(() => rows.find((row) => row.id === selectedRowId) ?? null, [rows, selectedRowId]);
  const selectedSlots = useMemo(() => slots.filter((slot) => slot.row_id === selectedRowId || (!slot.row_id && selectedRow && slot.row_label === selectedRow.row_label)), [selectedRow, selectedRowId, slots]);

  const SLOTS_PER_PAGE = 12;
  const totalSlotPages = Math.max(1, Math.ceil(selectedSlots.length / SLOTS_PER_PAGE));
  const paginatedSlots = useMemo(() => {
    const start = (slotPage - 1) * SLOTS_PER_PAGE;
    return selectedSlots.slice(start, start + SLOTS_PER_PAGE);
  }, [selectedSlots, slotPage]);

  const loadLayout = useCallback(async () => {
    if (!areaId || !isSupabaseConfigured()) return;
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const [rowsResult, slotsResult] = await Promise.all([
        supabase.from("parking_rows").select(rowFields).eq("parking_area_id", areaId).order("display_order"),
        supabase.from("parking_slots").select(slotFields).eq("parking_area_id", areaId).order("row_label").order("position"),
      ]);
      if (rowsResult.error) throw rowsResult.error;
      if (slotsResult.error) throw slotsResult.error;
      const nextRows = (rowsResult.data ?? []) as ParkingRow[];
      setRows(nextRows);
      setSlots((slotsResult.data ?? []) as ParkingSlot[]);
      setSelectedRowId((current) => current && nextRows.some((row) => row.id === current) ? current : nextRows[0]?.id ?? null);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.operationalData);
    } finally {
      setLoading(false);
    }
  }, [areaId, t.operationalData]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadLayout(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadLayout]);

  function startNewRow() {
    setEditingRowId(null);
    setRowDraft({ label: nextRowLabel(rows), slotType: "CAR", status: "AVAILABLE", initialSlots: "14" });
    setMessage("");
  }

  function startEditRow(row: ParkingRow) {
    setEditingRowId(row.id);
    setSelectedRowId(row.id);
    setRowDraft({ label: row.row_label, slotType: row.slot_type, status: row.status, initialSlots: "0" });
    setMessage("");
  }

  async function audit(action: string, entityId: string, beforeData: unknown, afterData: unknown) {
    await logAdminAudit({
      action,
      entity_type: "parking_layout",
      entity_id: entityId,
      before_data: beforeData,
      after_data: afterData,
      reason: "Parking row and slot maintenance from the authorized console",
      metadata: { parking_area_id: areaId },
      result: "SUCCESS",
    });
  }

  async function saveRow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!areaId || !areaCode || !isSupabaseConfigured()) return;
    const label = rowDraft.label.trim().toUpperCase();
    const count = Number(rowDraft.initialSlots);
    if (!/^[A-Z0-9_-]{1,12}$/.test(label)) {
      setMessage(locale === "th" ? "ชื่อแถวต้องเป็น A–Z ตัวเลข _ หรือ - ไม่เกิน 12 ตัว" : "Row labels may use A–Z, numbers, _ or - (up to 12 characters).");
      return;
    }
    if (!editingRowId && (!Number.isInteger(count) || count < 0 || count > 500)) {
      setMessage(locale === "th" ? "จำนวนช่องเริ่มต้นต้องอยู่ระหว่าง 0–500" : "Initial slot count must be between 0 and 500.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      if (editingRowId) {
        const before = rows.find((row) => row.id === editingRowId) ?? null;
        const { data, error } = await supabase.from("parking_rows").update({ status: rowDraft.status, slot_type: rowDraft.slotType, allowed_vehicle_types: [rowDraft.slotType], updated_at: new Date().toISOString() }).eq("id", editingRowId).select(rowFields).single();
        if (error) throw error;
        await audit("UPDATE_PARKING_ROW", editingRowId, before, data);
      } else {
        const { data: row, error } = await supabase.from("parking_rows").insert({ parking_area_id: areaId, row_label: label, display_order: rows.length ? Math.max(...rows.map((item) => item.display_order)) + 1 : 1, status: rowDraft.status, slot_type: rowDraft.slotType, allowed_vehicle_types: [rowDraft.slotType], data_status: "VERIFIED", source_reference: `OFFICIAL_LAYOUT:${areaCode}` }).select(rowFields).single();
        if (error) throw error;
        if (count > 0 && row) {
          const newSlots = Array.from({ length: count }, (_, index) => ({ parking_area_id: areaId, row_id: row.id, slot_code: `${areaCode}-${label}-${String(index + 1).padStart(2, "0")}`, row_label: label, position: index + 1, slot_type: rowDraft.slotType, status: rowDraft.status === "CLOSED" ? "CLOSED" : "AVAILABLE", source_reference: `OFFICIAL_LAYOUT:${areaCode}`, data_status: "VERIFIED" }));
          const { error: slotError } = await supabase.from("parking_slots").insert(newSlots);
          if (slotError) throw slotError;
        }
        await audit("CREATE_PARKING_ROW", row.id, null, { ...row, initial_slots: count });
        setSelectedRowId(row.id);
      }
      await loadLayout();
      setMessage(t.layoutSaved);
      notify({ title: t.layoutSaved, kind: "success" });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.operationalData);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(row: ParkingRow) {
    if (!isSupabaseConfigured()) return;
    const confirmed = await confirm({ title: t.deleteRow, message: `${row.row_label} · ${locale === "th" ? "ช่องจอดในแถวนี้จะถูกลบด้วย" : "Slots in this row will also be deleted."}`, confirmLabel: t.delete, cancelLabel: t.close, danger: true });
    if (!confirmed) return;
    setSaving(true);
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("parking_rows").delete().eq("id", row.id);
      if (error) throw error;
      await audit("DELETE_PARKING_ROW", row.id, row, null);
      if (selectedRowId === row.id) setSelectedRowId(null);
      await loadLayout();
      setMessage(t.layoutSaved);
      notify({ title: t.layoutSaved, kind: "success" });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.operationalData);
    } finally {
      setSaving(false);
    }
  }

  async function addSlots(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!areaId || !areaCode || !selectedRow || !isSupabaseConfigured()) return;
    const count = Number(newSlotCount);
    if (!Number.isInteger(count) || count < 1 || count > 500) {
      setMessage(locale === "th" ? "จำนวนช่องที่เพิ่มต้องอยู่ระหว่าง 1–500" : "Added slot count must be between 1 and 500.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const startPosition = selectedSlots.length ? Math.max(...selectedSlots.map((slot) => slot.position)) + 1 : 1;
      const newSlots = Array.from({ length: count }, (_, index) => ({ parking_area_id: areaId, row_id: selectedRow.id, slot_code: `${areaCode}-${selectedRow.row_label}-${String(startPosition + index).padStart(2, "0")}`, row_label: selectedRow.row_label, position: startPosition + index, slot_type: selectedRow.slot_type, status: selectedRow.status === "CLOSED" ? "CLOSED" : "AVAILABLE", source_reference: `OFFICIAL_LAYOUT:${areaCode}`, data_status: "VERIFIED" }));
      const { data, error } = await createSupabaseBrowserClient().from("parking_slots").insert(newSlots).select(slotFields);
      if (error) throw error;
      await audit("CREATE_PARKING_SLOTS", selectedRow.id, null, { row: selectedRow.row_label, count, slots: data });
      await loadLayout();
      setNewSlotCount("1");
      setMessage(t.layoutSaved);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.operationalData);
    } finally {
      setSaving(false);
    }
  }

  async function updateSlot(slot: ParkingSlot, field: "status" | "slot_type", value: SlotStatus | SlotType) {
    if (!isSupabaseConfigured()) return;
    const next = { ...slot, [field]: value } as ParkingSlot;
    setSlots((current) => current.map((item) => item.id === slot.id ? next : item));
    const { error } = await createSupabaseBrowserClient().from("parking_slots").update({ [field]: value, updated_at: new Date().toISOString() }).eq("id", slot.id);
    if (error) {
      setMessage(error.message);
      setSlots((current) => current.map((item) => item.id === slot.id ? slot : item));
      return;
    }
    await audit("UPDATE_PARKING_SLOT", slot.id, slot, next);
    setMessage(t.layoutSaved);
  }

  async function deleteSlot(slot: ParkingSlot) {
    if (!isSupabaseConfigured()) return;
    const confirmed = await confirm({ title: t.deleteSlot, message: slot.slot_code, confirmLabel: t.delete, cancelLabel: t.close, danger: true });
    if (!confirmed) return;
    try {
      const { error } = await createSupabaseBrowserClient().from("parking_slots").delete().eq("id", slot.id);
      if (error) throw error;
      await audit("DELETE_PARKING_SLOT", slot.id, slot, null);
      setSlots((current) => current.filter((item) => item.id !== slot.id));
      setMessage(t.layoutSaved);
      notify({ title: t.layoutSaved, kind: "success" });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.operationalData);
    }
  }

  if (!areaId || !areaCode) return <section className="layout-manager empty-card"><div><Layers3 size={25} /><h2>{t.manageLayout}</h2><p>{t.selectArea}</p></div></section>;

  return (
    <section className="layout-manager" aria-label={t.manageLayout}>
      <div className="data-manager-heading"><div><p className="eyebrow">{t.admin}</p><h2>{t.manageLayout} · {areaCode}</h2><p className="page-subtitle">{t.manageLayout}</p></div><span className="data-badge">{rows.length} {t.manageRows} · {slots.length} {t.slotCount}</span></div>
      {message ? <div className="form-note" role="status">{message}</div> : null}
      <div className="layout-manager-grid">
        <form className="form-card layout-row-form" onSubmit={(event) => void saveRow(event)}>
          <div className="form-section-title"><Layers3 size={21} /><div><h2>{editingRowId ? t.edit : t.addRow}</h2><p>{t.manageLayout}</p></div></div>
          <div className="support-form-grid">
            <div className="form-group"><label htmlFor="row-label">{t.rowLabel}</label><input id="row-label" className="form-control" value={rowDraft.label} onChange={(event) => setRowDraft((current) => ({ ...current, label: event.target.value }))} disabled={Boolean(editingRowId)} required /></div>
            <div className="form-group"><label htmlFor="row-type">{t.slotType}</label><select id="row-type" className="form-control" value={rowDraft.slotType} onChange={(event) => setRowDraft((current) => ({ ...current, slotType: event.target.value as SlotType }))}>{slotTypes.map((value) => <option value={value} key={value}>{typeLabel(t, value)}</option>)}</select></div>
            <div className="form-group"><label htmlFor="row-status">{t.rowStatus}</label><select id="row-status" className="form-control" value={rowDraft.status} onChange={(event) => setRowDraft((current) => ({ ...current, status: event.target.value as RowStatus }))}><option value="AVAILABLE">{t.enabled}</option><option value="CLOSED">{t.disabled}</option></select></div>
            {!editingRowId ? <div className="form-group"><label htmlFor="row-initial-slots">{t.slotCount}</label><input id="row-initial-slots" className="form-control" type="number" min="0" max="500" value={rowDraft.initialSlots} onChange={(event) => setRowDraft((current) => ({ ...current, initialSlots: event.target.value }))} /></div> : null}
          </div>
          <div className="support-form-actions"><button className="primary-button" type="submit" disabled={saving}>{saving ? <LoaderCircle size={16} className="spin" /> : editingRowId ? <Save size={16} /> : <Plus size={16} />}{editingRowId ? t.save : t.addRow}</button>{editingRowId ? <button className="secondary-button" type="button" onClick={startNewRow}>{t.cancel}</button> : null}</div>
          <p className="form-note">{locale === "th" ? "จัดการแถวและช่องจอดพร้อมบันทึกข้อมูลเรียบร้อย" : "Manage rows and slot layout."}</p>
        </form>
        <section className="review-panel data-list-panel"><div className="section-heading"><div><h2>{t.manageRows}</h2><p>{rows.length} · {t.liveCounts}</p></div><button className="secondary-button" type="button" onClick={startNewRow}><Plus size={15} />{t.addRow}</button></div>{loading ? <div className="inline-loading"><LoaderCircle size={18} className="spin" />Loading</div> : rows.length ? <div className="layout-row-list">{rows.map((row) => { const rowSlots = slots.filter((slot) => slot.row_id === row.id || (!slot.row_id && slot.row_label === row.row_label)); return <article className={`layout-row-card ${selectedRowId === row.id ? "selected" : ""}`} key={row.id}><button className="layout-row-select" type="button" onClick={() => { setSelectedRowId(row.id); setSlotPage(1); }}><strong>{row.row_label}</strong><span>{typeLabel(t, row.slot_type)} · {rowSlots.length} {t.slotCount}</span><small>{row.status === "AVAILABLE" ? t.enabled : t.disabled} · {row.data_status === "MOCKUP" || row.data_status === "VERIFIED" ? (locale === "th" ? "อนุมัติแล้ว" : "Verified") : row.data_status}</small></button><div className="data-list-actions"><button className="icon-button" type="button" onClick={() => startEditRow(row)} aria-label={`${t.edit} ${row.row_label}`}><Edit3 size={15} /></button><button className="icon-button danger" type="button" onClick={() => void deleteRow(row)} aria-label={`${t.deleteRow} ${row.row_label}`}><Trash2 size={15} /></button></div></article>; })}</div> : <div className="empty-card compact-empty"><div><Layers3 size={24} /><h2>{t.noRows}</h2></div></div>}</section>
      </div>
      {selectedRow ? <section className="review-panel layout-slot-panel"><div className="section-heading"><div><h2>{t.addSlots} · {selectedRow.row_label}</h2><p>{typeLabel(t, selectedRow.slot_type)} · {selectedSlots.length} {t.slotCount} · {selectedRow.status === "AVAILABLE" ? t.enabled : t.disabled}</p></div><form className="inline-actions" onSubmit={(event) => void addSlots(event)}><input className="form-control compact-number-input" aria-label={t.slotCount} type="number" min="1" max="500" value={newSlotCount} onChange={(event) => setNewSlotCount(event.target.value)} /><button className="secondary-button" type="submit" disabled={saving} style={{ whiteSpace: "nowrap" }}><Plus size={15} />{t.addSlots}</button></form></div><div className="layout-slot-grid">{paginatedSlots.map((slot) => <article className="layout-slot-item" key={slot.id}><strong><span>{slot.slot_code}</span><span className={`slot-status-pill ${slot.status.toLowerCase()}`}>{slot.status === "AVAILABLE" ? t.enabled : slot.status === "RESERVED" ? t.reserved : slot.status === "OCCUPIED" ? t.occupied : t.disabled}</span></strong><label><span>{t.slotType}</span><select value={slot.slot_type} onChange={(event) => void updateSlot(slot, "slot_type", event.target.value as SlotType)}>{slotTypes.map((value) => <option value={value} key={value}>{typeLabel(t, value)}</option>)}</select></label><label><span>{t.slotStatus}</span><select value={slot.status} onChange={(event) => void updateSlot(slot, "status", event.target.value as SlotStatus)}><option value="AVAILABLE">{t.enabled}</option><option value="RESERVED">{t.reserved}</option><option value="OCCUPIED">{t.occupied}</option><option value="CLOSED">{t.disabled}</option></select></label><button className="icon-button danger" type="button" onClick={() => void deleteSlot(slot)} aria-label={`${t.deleteSlot} ${slot.slot_code}`}><Trash2 size={14} /></button></article>)}</div>{totalSlotPages > 1 ? <div className="pagination-bar" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--line)" }}><button className="secondary-button small-button" type="button" disabled={slotPage <= 1} onClick={() => setSlotPage((p) => Math.max(1, p - 1))} aria-label="Previous page"><ChevronLeft size={16} /></button><span style={{ fontSize: 12, fontWeight: 600 }}>{locale === "th" ? `หน้า ${slotPage} / ${totalSlotPages}` : `Page ${slotPage} of ${totalSlotPages}`} ({selectedSlots.length} {t.slotCount})</span><button className="secondary-button small-button" type="button" disabled={slotPage >= totalSlotPages} onClick={() => setSlotPage((p) => Math.min(totalSlotPages, p + 1))} aria-label="Next page"><ChevronRight size={16} /></button></div> : null}</section> : null}
    </section>
  );
}
