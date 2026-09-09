"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Edit3, History, LoaderCircle, Save, Search, ShieldCheck, UserRound, UserRoundPlus, X } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useNotifications } from "@/components/layout/NotificationProvider";

type ManagerRole = "admin" | "developer";
type AppRole = "admin" | "developer" | "staff" | "student" | "personnel" | "visitor";

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  university_id: string | null;
  faculty: string | null;
  major: string | null;
  department: string | null;
  phone: string | null;
  user_type: string | null;
  preferred_locale: string;
  created_at: string;
};

type RoleRow = { user_id: string; role: AppRole };
type UserRecord = ProfileRow & { roles: AppRole[] };
type AuditHistoryRow = { id: string; action: string; actor_type: string | null; entity_type: string | null; result: string | null; created_at: string };
type BookingHistoryRow = { id: string; reference: string; status: string; booking_date: string; starts_at: string; ends_at: string; created_at: string };
type SessionHistoryRow = { id: string; status: string; check_in_at: string | null; check_out_at: string | null; created_at: string };
type AccountHistory = { audits: AuditHistoryRow[]; bookings: BookingHistoryRow[]; sessions: SessionHistoryRow[] };

const profileFields = "id, email, full_name, university_id, faculty, major, department, phone, user_type, preferred_locale, created_at";

export function UserManager({ locale, role }: { locale: Locale; role: ManagerRole }) {
  const t = getCopy(locale);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState({ full_name: "", university_id: "", faculty: "", major: "", department: "", phone: "" });
  const [roleToGrant, setRoleToGrant] = useState<AppRole>("developer");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [history, setHistory] = useState<AccountHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const { confirm, notify } = useNotifications();

  const selectedUser = useMemo(() => users.find((user) => user.id === selectedId) ?? null, [selectedId, users]);
  const filteredUsers = useMemo(() => {
    const normalizedQuery = userQuery.trim().toLowerCase();
    if (!normalizedQuery) return users;
    return users.filter((user) => [
      user.full_name,
      user.email,
      user.university_id,
      user.faculty,
      user.major,
      user.department,
      user.phone,
      user.user_type,
      ...user.roles,
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedQuery)));
  }, [userQuery, users]);

  const loadUsers = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setMessage(`${t.accountNotConfigured} / ${t.accountNotConfiguredEn}`);
      return;
    }
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const [profilesResult, rolesResult] = await Promise.all([
        supabase.from("profiles").select(profileFields).order("created_at", { ascending: false }).limit(500),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (profilesResult.error) throw profilesResult.error;
      if (rolesResult.error) throw rolesResult.error;
      const rolesByUser = new Map<string, AppRole[]>();
      for (const item of (rolesResult.data ?? []) as RoleRow[]) rolesByUser.set(item.user_id, [...(rolesByUser.get(item.user_id) ?? []), item.role]);
      setUsers(((profilesResult.data ?? []) as ProfileRow[]).map((profile) => ({ ...profile, roles: rolesByUser.get(profile.id) ?? [] })));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.operationalData);
    } finally {
      setLoading(false);
    }
  }, [t.accountNotConfigured, t.accountNotConfiguredEn, t.operationalData]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadUsers(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  const loadHistory = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured()) return;
    setHistoryLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const [auditResult, bookingResult, sessionResult] = await Promise.all([
        supabase.from("audit_logs").select("id, action, actor_type, entity_type, result, created_at").or(`actor_id.eq.${userId},entity_id.eq.${userId}`).order("created_at", { ascending: false }).limit(25),
        supabase.from("bookings").select("id, reference, status, booking_date, starts_at, ends_at, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(25),
        supabase.from("parking_sessions").select("id, status, check_in_at, check_out_at, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(25),
      ]);
      if (auditResult.error) throw auditResult.error;
      if (bookingResult.error) throw bookingResult.error;
      if (sessionResult.error) throw sessionResult.error;
      setHistory({
        audits: (auditResult.data ?? []) as AuditHistoryRow[],
        bookings: (bookingResult.data ?? []) as BookingHistoryRow[],
        sessions: (sessionResult.data ?? []) as SessionHistoryRow[],
      });
    } catch (error) {
      setHistory(null);
      setMessage(error instanceof Error ? error.message : t.operationalData);
    } finally {
      setHistoryLoading(false);
    }
  }, [t.operationalData]);

  function editUser(user: UserRecord) {
    setSelectedId(user.id);
    setProfileDraft({
      full_name: user.full_name ?? "",
      university_id: user.university_id ?? "",
      faculty: user.faculty ?? "",
      major: user.major ?? "",
      department: user.department ?? "",
      phone: user.phone ?? "",
    });
    setHistory(null);
    void loadHistory(user.id);
    setMessage("");
  }

  function updateDraft(key: keyof typeof profileDraft, value: string) {
    setProfileDraft((current) => ({ ...current, [key]: value }));
  }

  async function audit(action: string, userId: string, metadata: Record<string, unknown>) {
    if (role !== "admin") return;
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    const traceId = crypto.randomUUID();
    await supabase.from("audit_logs").insert({
      event_id: `admin-user-${traceId}`,
      trace_id: traceId,
      actor_type: "ADMIN",
      actor_id: data.session?.user.id ?? null,
      action,
      entity_type: "profile",
      entity_id: userId,
      metadata,
      result: "SUCCESS",
    });
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUser || !isSupabaseConfigured()) return;
    setSaving(true);
    setMessage("");
    try {
      const payload = Object.fromEntries(Object.entries(profileDraft).map(([key, value]) => [key, value.trim() || null]));
      const { data, error } = await createSupabaseBrowserClient().from("profiles").update(payload).eq("id", selectedUser.id).select(profileFields).single();
      if (error) throw error;
      const nextProfile = data as ProfileRow;
      setUsers((current) => current.map((user) => user.id === nextProfile.id ? { ...user, ...nextProfile } : user));
      await audit("UPDATE_PROFILE", selectedUser.id, { fields: Object.keys(profileDraft) });
      setMessage(t.save);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.operationalData);
    } finally {
      setSaving(false);
    }
  }

  async function grantRole(user: UserRecord) {
    if (role !== "admin" || user.roles.includes(roleToGrant) || !isSupabaseConfigured()) return;
    setSaving(true);
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: actor } = await supabase.auth.getSession();
      const { error } = await supabase.from("user_roles").insert({ user_id: user.id, role: roleToGrant, granted_by: actor.session?.user.id ?? null });
      if (error) throw error;
      setUsers((current) => current.map((item) => item.id === user.id ? { ...item, roles: [...item.roles, roleToGrant] } : item));
      await audit("GRANT_ROLE", user.id, { role: roleToGrant });
      setMessage(t.grantRole);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.operationalData);
    } finally {
      setSaving(false);
    }
  }

  async function revokeRole(user: UserRecord, revokedRole: AppRole) {
    if (role !== "admin" || !isSupabaseConfigured()) return;
    if (revokedRole === "admin" && users.filter((item) => item.roles.includes("admin")).length <= 1) {
      setMessage(locale === "th" ? "ต้องมี Admin อย่างน้อยหนึ่งบัญชี" : "At least one Admin account must remain.");
      return;
    }
    const confirmed = await confirm({ title: t.confirmDelete, message: `${revokedRole} · ${user.email ?? user.id}`, confirmLabel: t.delete, cancelLabel: t.close, danger: true });
    if (!confirmed) return;
    setSaving(true);
    setMessage("");
    try {
      const { error } = await createSupabaseBrowserClient().from("user_roles").delete().eq("user_id", user.id).eq("role", revokedRole);
      if (error) throw error;
      setUsers((current) => current.map((item) => item.id === user.id ? { ...item, roles: item.roles.filter((itemRole) => itemRole !== revokedRole) } : item));
      await audit("REVOKE_ROLE", user.id, { role: revokedRole });
      setMessage(t.delete);
      notify({ title: t.delete, kind: "success" });
    } catch (error) {
      const detail = error instanceof Error ? error.message : t.operationalData;
      setMessage(detail);
      notify({ title: t.operationalData, message: detail, kind: "error" });
    } finally {
      setSaving(false);
    }
  }

  return <div className="data-manager">
    <div className="data-manager-heading"><div><p className="eyebrow">{role === "admin" ? t.admin : t.developer}</p><h2>{t.manageUsers}</h2><p className="page-subtitle">{t.noPrivateData} · {role === "admin" ? t.grantRole : t.systemHealth}</p></div><span className="data-badge"><ShieldCheck size={13} />{role === "admin" ? t.admin : t.developer}</span></div>
    {message ? <div className="form-note" role="status">{message}</div> : null}
    <div className="user-manager-layout">
      <section className="review-panel data-list-panel"><div className="section-heading"><div><h2>{t.users}</h2><p>{filteredUsers.length}/{users.length} · {t.noPrivateData}</p></div><UserRoundPlus size={20} color="#a27e00" /></div><div className="user-search-box"><Search size={16} /><input aria-label={t.searchAccounts} placeholder={t.searchAccounts} value={userQuery} onChange={(event) => setUserQuery(event.target.value)} /></div>{loading ? <div className="inline-loading"><LoaderCircle size={18} className="spin" />Loading</div> : filteredUsers.length ? <div className="data-list">{filteredUsers.map((user) => <article className={`data-list-item ${selectedId === user.id ? "selected" : ""}`} key={user.id}><div><strong>{user.full_name || user.email || user.university_id || user.id}</strong><small>{user.email || user.university_id || "—"}</small><div className="role-chip-list">{user.roles.length ? user.roles.map((userRole) => <button className={`role-chip ${userRole}`} type="button" key={userRole} onClick={() => void revokeRole(user, userRole)} disabled={role !== "admin"}>{userRole}</button>) : <span className="role-chip">{user.user_type || "user"}</span>}</div></div><button className="icon-button" type="button" onClick={() => editUser(user)} aria-label={`${t.edit} ${user.email ?? user.id}`}><Edit3 size={15} /></button></article>)}</div> : <div className="empty-card compact-empty"><div><UserRound size={24} /><h2>{users.length ? t.noResults : t.noRecords}</h2></div></div>}</section>
      <section className="data-editor-card">
        {selectedUser ? <><div className="form-section-title"><UserRound size={22} /><div><h2>{t.edit}</h2><p>{selectedUser.email || selectedUser.id}</p></div><button className="icon-button" type="button" onClick={() => { setSelectedId(null); setHistory(null); }} aria-label={t.cancel}><X size={16} /></button></div><form className="support-form" onSubmit={(event) => void saveProfile(event)}><div className="support-form-grid"><div className="form-group"><label htmlFor="user-name">{t.name}</label><input id="user-name" className="form-control" value={profileDraft.full_name} onChange={(event) => updateDraft("full_name", event.target.value)} /></div><div className="form-group"><label htmlFor="user-id">{t.studentId}</label><input id="user-id" className="form-control" value={profileDraft.university_id} onChange={(event) => updateDraft("university_id", event.target.value)} /></div><div className="form-group"><label htmlFor="user-faculty">{locale === "th" ? "คณะ" : "Faculty"}</label><input id="user-faculty" className="form-control" value={profileDraft.faculty} onChange={(event) => updateDraft("faculty", event.target.value)} /></div><div className="form-group"><label htmlFor="user-major">{locale === "th" ? "สาขา" : "Major"}</label><input id="user-major" className="form-control" value={profileDraft.major} onChange={(event) => updateDraft("major", event.target.value)} /></div><div className="form-group"><label htmlFor="user-department">{locale === "th" ? "หน่วยงาน" : "Department"}</label><input id="user-department" className="form-control" value={profileDraft.department} onChange={(event) => updateDraft("department", event.target.value)} /></div><div className="form-group"><label htmlFor="user-phone">{t.phone}</label><input id="user-phone" className="form-control" type="tel" value={profileDraft.phone} onChange={(event) => updateDraft("phone", event.target.value)} /></div></div><button className="primary-button" type="submit" disabled={saving}>{saving ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}{t.save}</button></form>{role === "admin" ? <div className="role-grant-box"><h3>{t.grantRole}</h3><div className="inline-actions"><select className="form-control" value={roleToGrant} onChange={(event) => setRoleToGrant(event.target.value as AppRole)} aria-label={t.role}><option value="admin">admin</option><option value="developer">developer</option><option value="staff">staff</option><option value="student">student</option><option value="personnel">personnel</option><option value="visitor">visitor</option></select><button className="secondary-button" type="button" onClick={() => void grantRole(selectedUser)} disabled={saving || selectedUser.roles.includes(roleToGrant)}>{t.grantRole}</button></div></div> : <p className="form-note">{t.developer} · {locale === "th" ? "ดูและแก้ไขข้อมูลโปรไฟล์ได้ แต่เพิ่ม/ถอนสิทธิ์ไม่ได้" : "Can inspect and update profile data, but cannot grant or revoke roles."}</p>}<AccountHistoryPanel locale={locale} history={history} loading={historyLoading} copy={t} /></> : <div className="empty-card compact-empty"><div><div className="empty-icon"><UserRound size={24} /></div><h2>{t.edit}</h2><p>{locale === "th" ? "เลือกผู้ใช้งานเพื่อดูหรือแก้ไขข้อมูล" : "Select a user to inspect or edit profile data."}</p></div></div>}
      </section>
    </div>
  </div>;
}

function AccountHistoryPanel({ locale, history, loading, copy }: { locale: Locale; history: AccountHistory | null; loading: boolean; copy: ReturnType<typeof getCopy> }) {
  const total = history ? history.audits.length + history.bookings.length + history.sessions.length : 0;
  return <section className="account-history" aria-label={copy.accountHistory}><div className="form-section-title"><History size={19} /><div><h3>{copy.accountHistory}</h3><p>{total} {locale === "th" ? "รายการจากระบบจริง" : "live system records"}</p></div></div>{loading ? <div className="inline-loading"><LoaderCircle size={16} className="spin" />Loading</div> : history && total ? <div className="history-list">{history.audits.slice(0, 8).map((item) => <div className="history-item" key={`audit-${item.id}`}><strong>{item.action}</strong><span>{item.entity_type || "—"} · {item.result || "—"} · {formatDate(item.created_at, locale)}</span></div>)}{history.bookings.slice(0, 8).map((item) => <div className="history-item" key={`booking-${item.id}`}><strong>{item.reference}</strong><span>{item.status} · {item.booking_date} · {formatDate(item.created_at, locale)}</span></div>)}{history.sessions.slice(0, 8).map((item) => <div className="history-item" key={`session-${item.id}`}><strong>{item.status}</strong><span>{item.check_in_at ? formatDate(item.check_in_at, locale) : "—"} → {item.check_out_at ? formatDate(item.check_out_at, locale) : "—"}</span></div>)}</div> : <p className="form-note">{copy.noHistory}</p>}</section>;
}

function formatDate(value: string, locale: Locale) {
  return new Date(value).toLocaleString(locale === "th" ? "th-TH" : "en-US", { dateStyle: "medium", timeStyle: "short" });
}
