"use client";

import { Edit3, Eye, EyeOff, Plus, Save, Trash2, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { projectInfo } from "@/lib/project-info";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useNotifications } from "@/components/layout/NotificationProvider";

type TeamMember = {
  id: string;
  display_order: number;
  name_th: string;
  name_en: string;
  student_id: string | null;
  major_th: string | null;
  major_en: string | null;
  faculty_th: string | null;
  faculty_en: string | null;
  role_th: string | null;
  role_en: string | null;
  avatar_path: string | null;
  visible: boolean;
};

type TeamDraft = Omit<TeamMember, "id" | "display_order">;
type EditorRole = "admin" | "developer";
type DataState = "loading" | "supabase" | "fallback";

const fields = "id, display_order, name_th, name_en, student_id, major_th, major_en, faculty_th, faculty_en, role_th, role_en, avatar_path, visible";
const emptyDraft: TeamDraft = {
  name_th: "",
  name_en: "",
  student_id: "",
  major_th: "",
  major_en: "",
  faculty_th: "",
  faculty_en: "",
  role_th: "",
  role_en: "",
  avatar_path: "",
  visible: true,
};

const fallbackMember: TeamMember = {
  id: "fallback-team-member",
  display_order: 1,
  name_th: projectInfo.teamMember.name,
  name_en: "Natthaphon Phankon",
  student_id: projectInfo.teamMember.studentId,
  major_th: "วิทยาศาสตร์การกีฬา",
  major_en: "Sports Science",
  faculty_th: "คณะศึกษาศาสตร์",
  faculty_en: "Faculty of Education",
  role_th: "สมาชิกทีม",
  role_en: "Team member",
  avatar_path: null,
  visible: true,
};

function nullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeMembers(data: unknown): TeamMember[] {
  if (!Array.isArray(data)) return [];

  return data
    .flatMap((item: unknown, index: number) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      const id = nullableText(row.id);
      const nameTh = nullableText(row.name_th);
      const nameEn = nullableText(row.name_en);
      if (!id || !nameTh || !nameEn) return [];

      const order = typeof row.display_order === "number" && Number.isFinite(row.display_order)
        ? row.display_order
        : index + 1;

      return [{
        id,
        display_order: order,
        name_th: nameTh,
        name_en: nameEn,
        student_id: nullableText(row.student_id),
        major_th: nullableText(row.major_th),
        major_en: nullableText(row.major_en),
        faculty_th: nullableText(row.faculty_th),
        faculty_en: nullableText(row.faculty_en),
        role_th: nullableText(row.role_th),
        role_en: nullableText(row.role_en),
        avatar_path: nullableText(row.avatar_path),
        visible: row.visible !== false,
      } satisfies TeamMember];
    })
    .sort((first, second) => first.display_order - second.display_order);
}

function avatarSource(path: string | null) {
  const value = path?.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || value.startsWith("/")) return value;
  if (value.startsWith("storage/v1/")) {
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
    return baseUrl ? `${baseUrl}/${value}` : null;
  }
  return null;
}

function TeamAvatar({ path }: { path: string | null }) {
  const [imageFailed, setImageFailed] = useState(false);
  const source = avatarSource(path);

  return (
    <span className="team-avatar" aria-hidden={source && !imageFailed ? undefined : true}>
      {source && !imageFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={source} alt="" onError={() => setImageFailed(true)} />
      ) : (
        <UserRound size={20} aria-hidden="true" />
      )}
    </span>
  );
}

export function TeamDirectory({ locale }: { locale: Locale }) {
  const t = getCopy(locale);
  const { confirm, notify } = useNotifications();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TeamDraft>(emptyDraft);
  const [editorRole, setEditorRole] = useState<EditorRole | null>(null);
  const [dataState, setDataState] = useState<DataState>("loading");
  const [loading, setLoading] = useState(true);

  const visibleMembers = useMemo(
    () => editorRole ? members : members.filter((member) => member.visible),
    [editorRole, members],
  );
  const displayMembers = useMemo(
    () => dataState === "fallback"
      ? [fallbackMember]
      : visibleMembers,
    [dataState, visibleMembers],
  );
  const loadingCopy = locale === "th" ? "กำลังโหลดสมาชิกทีม…" : "Loading team members…";
  const emptyCopy = locale === "th" ? "ยังไม่มีสมาชิกทีมที่เผยแพร่" : "No team members are currently published";

  const load = useCallback(async () => {
    setLoading(true);
    if (!isSupabaseConfigured()) {
      setMembers([]);
      setEditorRole(null);
      setDataState("fallback");
      setLoading(false);
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("project_team_members")
        .select(fields)
        .order("display_order", { ascending: true });
      if (error) throw error;

      const nextMembers = normalizeMembers(data);
      setMembers(nextMembers);
      setDataState(nextMembers.length ? "supabase" : "fallback");
      setEditorRole(null);

      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userData.user.id);
        const roleValues = (roles ?? [])
          .map((item: { role?: unknown }) => item.role)
          .filter((role: unknown): role is EditorRole => role === "admin" || role === "developer");
        setEditorRole(roleValues.includes("admin") ? "admin" : roleValues.includes("developer") ? "developer" : null);
      }
    } catch {
      // Keep the course-project record visible if the public team table is
      // unavailable, while retaining the live table as the source of truth.
      setMembers([]);
      setEditorRole(null);
      setDataState("fallback");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function edit(member: TeamMember) {
    setEditingId(member.id);
    setDraft({
      name_th: member.name_th,
      name_en: member.name_en,
      student_id: member.student_id ?? "",
      major_th: member.major_th ?? "",
      major_en: member.major_en ?? "",
      faculty_th: member.faculty_th ?? "",
      faculty_en: member.faculty_en ?? "",
      role_th: member.role_th ?? "",
      role_en: member.role_en ?? "",
      avatar_path: member.avatar_path ?? "",
      visible: member.visible,
    });
  }

  function updateDraft(key: keyof TeamDraft, value: string | boolean) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editorRole || !isSupabaseConfigured()) return;
    if (!draft.name_th.trim() || !draft.name_en.trim()) {
      notify({ title: t.name, message: locale === "th" ? "กรุณากรอกชื่อทั้งสองภาษา" : "Enter the member name in both languages.", kind: "error" });
      return;
    }

    const payload = Object.fromEntries(
      Object.entries(draft).map(([key, value]) => [key, typeof value === "string" ? value.trim() || null : value]),
    );
    try {
      const supabase = createSupabaseBrowserClient();
      const result = editingId
        ? await supabase.from("project_team_members").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editingId).select(fields).single()
        : await supabase.from("project_team_members").insert({ ...payload, display_order: members.length ? Math.max(...members.map((member) => member.display_order)) + 1 : 1 }).select(fields).single();
      if (result.error) throw result.error;
      setEditingId(null);
      setDraft(emptyDraft);
      await load();
      notify({ title: t.save, kind: "success" });
    } catch (error) {
      notify({ title: t.teamEditor, message: error instanceof Error ? error.message : t.operationalData, kind: "error" });
    }
  }

  async function remove(member: TeamMember) {
    if (!editorRole || member.id === fallbackMember.id) return;
    const accepted = await confirm({
      title: t.confirmDelete,
      message: locale === "th" ? member.name_th : member.name_en,
      confirmLabel: t.delete,
      cancelLabel: t.close,
      danger: true,
    });
    if (!accepted) return;

    const { error } = await createSupabaseBrowserClient().from("project_team_members").delete().eq("id", member.id);
    if (error) {
      notify({ title: t.delete, message: error.message, kind: "error" });
      return;
    }
    setMembers((current) => current.filter((item) => item.id !== member.id));
    notify({ title: t.delete, kind: "success" });
  }

  async function move(member: TeamMember, direction: -1 | 1) {
    if (!editorRole || member.id === fallbackMember.id) return;
    const index = members.findIndex((item) => item.id === member.id);
    if (index < 0) return;
    const other = members[index + direction];
    if (!other) return;

    const supabase = createSupabaseBrowserClient();
    const first = await supabase.from("project_team_members").update({ display_order: other.display_order, updated_at: new Date().toISOString() }).eq("id", member.id);
    const second = await supabase.from("project_team_members").update({ display_order: member.display_order, updated_at: new Date().toISOString() }).eq("id", other.id);
    if (first.error || second.error) {
      notify({ title: t.teamEditor, message: first.error?.message ?? second.error?.message, kind: "error" });
      return;
    }
    await load();
  }

  const editorRoleLabel = editorRole === "admin" ? t.admin : t.developer;
  const count = loading ? "…" : dataState === "fallback" ? 1 : visibleMembers.length;

  return (
    <section className="team-directory" aria-labelledby="team-directory-heading" aria-busy={loading} data-source={dataState}>
      <div className="section-heading">
        <div>
          <h2 id="team-directory-heading">{t.teamMembersLabel}</h2>
          <p aria-live="polite">{count}</p>
        </div>
        {editorRole ? <span className="data-badge">{t.teamEditor} · {editorRoleLabel}</span> : null}
      </div>

      {loading ? (
        <div className="empty-card" role="status">
          <p>{loadingCopy}</p>
        </div>
      ) : displayMembers.length ? (
        <div className="team-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))" }}>
          {displayMembers.map((member, index) => {
            const name = locale === "th" ? member.name_th : member.name_en;
            const study = [
              locale === "th" ? member.major_th : member.major_en,
              locale === "th" ? member.faculty_th : member.faculty_en,
            ].filter(Boolean).join(" · ");
            const role = (locale === "th" ? member.role_th : member.role_en) ?? (locale === "th" ? "สมาชิกทีม" : "Team member");

            return (
              <article className={`team-card team-member-card ${member.visible ? "" : "hidden-member"}`} key={member.id}>
                <div className="team-member-heading">
                  <TeamAvatar key={`${member.id}:${member.avatar_path ?? "placeholder"}`} path={member.avatar_path} />
                  <div>
                    <strong>{name}</strong>
                    <span>{member.student_id ?? "—"}</span>
                  </div>
                </div>
                {study ? <span>{study}</span> : null}
                <div className="data-badge" aria-label={role}>{role}</div>
                {editorRole && member.id !== fallbackMember.id ? (
                  <div className="team-editor-actions">
                    <button className="icon-button" type="button" onClick={() => void move(member, -1)} disabled={index === 0} aria-label={t.moveUp}>↑</button>
                    <button className="icon-button" type="button" onClick={() => void move(member, 1)} disabled={index === displayMembers.length - 1} aria-label={t.moveDown}>↓</button>
                    <button className="icon-button" type="button" onClick={() => edit(member)} aria-label={t.edit}><Edit3 size={15} /></button>
                    <button className="icon-button danger" type="button" onClick={() => void remove(member)} aria-label={t.delete}><Trash2 size={15} /></button>
                    <span className="team-visibility" aria-label={member.visible ? t.visible : t.disabled}>{member.visible ? <Eye size={14} /> : <EyeOff size={14} />}</span>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-card" role="status">
          <p>{emptyCopy}</p>
        </div>
      )}

      {editorRole ? (
        <form className="form-card team-editor-form" onSubmit={(event) => void save(event)}>
          <div className="form-section-title">
            <Plus size={20} />
            <div>
              <h2>{editingId ? t.edit : t.addMember}</h2>
              <p>{t.teamEditor}</p>
            </div>
          </div>
          <div className="support-form-grid">
            <div className="form-group"><label htmlFor="team-name-th">{t.nameThai}</label><input id="team-name-th" className="form-control" value={draft.name_th} onChange={(event) => updateDraft("name_th", event.target.value)} required /></div>
            <div className="form-group"><label htmlFor="team-name-en">{t.nameEnglish}</label><input id="team-name-en" className="form-control" value={draft.name_en} onChange={(event) => updateDraft("name_en", event.target.value)} required /></div>
            <div className="form-group"><label htmlFor="team-student-id">{t.studentId}</label><input id="team-student-id" className="form-control" value={draft.student_id ?? ""} onChange={(event) => updateDraft("student_id", event.target.value)} /></div>
            <div className="form-group"><label htmlFor="team-role-th">{t.memberRole} · TH</label><input id="team-role-th" className="form-control" value={draft.role_th ?? ""} onChange={(event) => updateDraft("role_th", event.target.value)} /></div>
            <div className="form-group"><label htmlFor="team-role-en">{t.memberRole} · EN</label><input id="team-role-en" className="form-control" value={draft.role_en ?? ""} onChange={(event) => updateDraft("role_en", event.target.value)} /></div>
            <div className="form-group"><label htmlFor="team-major-th">{t.major} · TH</label><input id="team-major-th" className="form-control" value={draft.major_th ?? ""} onChange={(event) => updateDraft("major_th", event.target.value)} /></div>
            <div className="form-group"><label htmlFor="team-major-en">{t.major} · EN</label><input id="team-major-en" className="form-control" value={draft.major_en ?? ""} onChange={(event) => updateDraft("major_en", event.target.value)} /></div>
            <div className="form-group"><label htmlFor="team-faculty-th">{t.faculty} · TH</label><input id="team-faculty-th" className="form-control" value={draft.faculty_th ?? ""} onChange={(event) => updateDraft("faculty_th", event.target.value)} /></div>
            <div className="form-group"><label htmlFor="team-faculty-en">{t.faculty} · EN</label><input id="team-faculty-en" className="form-control" value={draft.faculty_en ?? ""} onChange={(event) => updateDraft("faculty_en", event.target.value)} /></div>
            <div className="form-group"><label htmlFor="team-avatar-path">{t.avatarUrl}</label><input id="team-avatar-path" className="form-control" value={draft.avatar_path ?? ""} onChange={(event) => updateDraft("avatar_path", event.target.value)} /></div>
          </div>
          <label className="inline-checkbox"><input type="checkbox" checked={draft.visible} onChange={(event) => updateDraft("visible", event.target.checked)} />{t.visible}</label>
          <div className="support-form-actions">
            <button className="primary-button" type="submit"><Save size={15} />{t.save}</button>
            {editingId ? <button className="secondary-button" type="button" onClick={() => { setEditingId(null); setDraft(emptyDraft); }}>{t.close}</button> : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}
