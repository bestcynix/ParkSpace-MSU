"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Car, Check, ChevronLeft, CircleAlert, Trash2 } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Vehicle = {
  id: string;
  plate: string;
  province: string | null;
  vehicle_type: string;
  brand: string | null;
  model: string | null;
  color: string | null;
  usage_type: "PERSONAL" | "ONE_DAY";
  is_default: boolean;
};

const emptyForm = { plate: "", province: "", vehicle_type: "CAR", brand: "", model: "", color: "", usage_type: "PERSONAL" as "PERSONAL" | "ONE_DAY" };

export function VehicleManager({ locale }: { locale: Locale }) {
  const t = getCopy(locale);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    let active = true;
    async function loadVehicles() {
      if (!configured) {
        if (active) setLoading(false);
        return;
      }
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          if (active) setMessage(t.signInRequired);
          return;
        }
        const { data, error } = await supabase.from("vehicles").select("id, plate, province, vehicle_type, brand, model, color, usage_type, is_default").order("is_default", { ascending: false }).order("created_at", { ascending: false });
        if (error) throw error;
        if (active) setVehicles((data ?? []) as Vehicle[]);
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : t.operationalData);
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadVehicles();
    return () => { active = false; };
  }, [configured, t.operationalData, t.signInRequired]);

  function updateField(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveVehicle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!configured) {
      setMessage(`${t.accountNotConfigured} / ${t.accountNotConfiguredEn}`);
      return;
    }
    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setMessage(t.signInRequired);
        return;
      }
      const shouldBeDefault = vehicles.length === 0 || form.usage_type === "PERSONAL" && vehicles.every((vehicle) => !vehicle.is_default);
      if (shouldBeDefault) {
        const { error } = await supabase.from("vehicles").update({ is_default: false }).eq("user_id", userData.user.id);
        if (error) throw error;
      }
      const { data, error } = await supabase.from("vehicles").insert({
        user_id: userData.user.id,
        plate: form.plate.trim(),
        province: form.province.trim() || null,
        vehicle_type: form.vehicle_type,
        brand: form.brand.trim() || null,
        model: form.model.trim() || null,
        color: form.color.trim() || null,
        usage_type: form.usage_type,
        is_default: shouldBeDefault,
      }).select("id, plate, province, vehicle_type, brand, model, color, usage_type, is_default").single();
      if (error) throw error;
      setVehicles((current) => [data as Vehicle, ...(shouldBeDefault ? current.map((vehicle) => ({ ...vehicle, is_default: false })) : current)]);
      setForm(emptyForm);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.operationalData);
    } finally {
      setSaving(false);
    }
  }

  async function makeDefault(vehicle: Vehicle) {
    if (!configured || vehicle.is_default) return;
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setMessage(t.signInRequired);
        return;
      }
      const { error: clearError } = await supabase.from("vehicles").update({ is_default: false }).eq("user_id", userData.user.id);
      if (clearError) throw clearError;
      const { error } = await supabase.from("vehicles").update({ is_default: true }).eq("id", vehicle.id).eq("user_id", userData.user.id);
      if (error) throw error;
      setVehicles((current) => current.map((item) => ({ ...item, is_default: item.id === vehicle.id })));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.operationalData);
    }
  }

  async function deleteVehicle(vehicle: Vehicle) {
    if (!configured || !window.confirm(locale === "th" ? "ต้องการลบรถคันนี้หรือไม่?" : "Delete this vehicle?")) return;
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("vehicles").delete().eq("id", vehicle.id);
      if (error) throw error;
      setVehicles((current) => current.filter((item) => item.id !== vehicle.id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.operationalData);
    }
  }

  return (
    <div className="vehicle-page">
      <div className="vehicle-back"><Link className="back-button" href={`/${locale}/app/profile`} aria-label={t.back}><ChevronLeft size={18} /></Link><div><h1>{t.myVehicles}</h1><p>{t.vehicleDataNote}</p></div></div>
      {!configured ? <div className="empty-card"><div><div className="empty-icon"><CircleAlert size={26} /></div><h2>{t.setupRequired}</h2><p>{t.accountNotConfigured} / {t.accountNotConfiguredEn}</p><Link className="primary-button" href={`/${locale}/login`}>{t.login}</Link></div></div> : null}
      {configured && message && !vehicles.length && loading === false ? <div className="form-note" role="alert">{message}</div> : null}
      {configured && loading ? <div className="empty-card"><div><p>Loading · กำลังโหลด</p></div></div> : null}
      {configured && !loading && vehicles.length === 0 && !message ? <div className="empty-card"><div><div className="empty-icon"><Car size={27} /></div><h2>{t.noVehicles}</h2><p>{t.vehicleDataNote}</p></div></div> : null}
      {configured && vehicles.length ? <div className="vehicle-list">{vehicles.map((vehicle) => <article className="vehicle-card" key={vehicle.id}><div className="vehicle-icon"><Car size={21} /></div><div className="vehicle-card-copy"><strong>{vehicle.plate}</strong><span>{[vehicle.brand, vehicle.model, vehicle.color, vehicle.province].filter(Boolean).join(" · ") || (locale === "th" ? "ยังไม่ได้กรอกรายละเอียด" : "No extra details")}</span><small>{vehicle.usage_type === "ONE_DAY" ? t.oneDayVehicle : t.personalVehicle}{vehicle.is_default ? ` · ${t.defaultVehicle}` : ""}</small></div><div className="vehicle-card-actions">{vehicle.is_default ? <span className="default-mark"><Check size={13} />{t.defaultVehicle}</span> : <button type="button" onClick={() => void makeDefault(vehicle)}>{t.setDefault}</button>}<button type="button" className="danger-button" onClick={() => void deleteVehicle(vehicle)} aria-label={`${t.deleteVehicle} ${vehicle.plate}`}><Trash2 size={15} /></button></div></article>)}</div> : null}
      {configured ? <form className="form-card vehicle-form" onSubmit={saveVehicle}><div className="form-section-title"><Car size={18} /><div><h2>{t.addVehicleTitle}</h2><p>{t.vehicleDataNote}</p></div></div><div className="form-group"><label htmlFor="vehicle-plate">{t.vehiclePlate}</label><input className="form-control" id="vehicle-plate" value={form.plate} onChange={(event) => updateField("plate", event.target.value)} required /></div><div className="vehicle-two-columns"><div className="form-group"><label htmlFor="vehicle-province">{t.vehicleProvince}</label><input className="form-control" id="vehicle-province" value={form.province} onChange={(event) => updateField("province", event.target.value)} /></div><div className="form-group"><label htmlFor="vehicle-type">{t.vehicleType}</label><select className="form-control" id="vehicle-type" value={form.vehicle_type} onChange={(event) => updateField("vehicle_type", event.target.value)}><option value="CAR">{t.car}</option><option value="MOTORCYCLE">{t.motorcycle}</option><option value="EV">{t.ev}</option></select></div></div><div className="vehicle-two-columns"><div className="form-group"><label htmlFor="vehicle-brand">{t.vehicleBrand}</label><input className="form-control" id="vehicle-brand" value={form.brand} onChange={(event) => updateField("brand", event.target.value)} /></div><div className="form-group"><label htmlFor="vehicle-model">{t.vehicleModel}</label><input className="form-control" id="vehicle-model" value={form.model} onChange={(event) => updateField("model", event.target.value)} /></div></div><div className="vehicle-two-columns"><div className="form-group"><label htmlFor="vehicle-color">{t.vehicleColor}</label><input className="form-control" id="vehicle-color" value={form.color} onChange={(event) => updateField("color", event.target.value)} /></div><div className="form-group"><label htmlFor="vehicle-usage">{locale === "th" ? "ลักษณะการใช้งาน" : "Usage"}</label><select className="form-control" id="vehicle-usage" value={form.usage_type} onChange={(event) => updateField("usage_type", event.target.value)}><option value="PERSONAL">{t.personalVehicle}</option><option value="ONE_DAY">{t.oneDayVehicle}</option></select></div></div>{message ? <div className="form-note" role="alert">{message}</div> : null}<button className="primary-button" type="submit" disabled={saving}>{saving ? "…" : t.saveVehicle}</button></form> : null}
    </div>
  );
}
