"use client";

import { Camera, Edit3, Eye, EyeOff, Plus, Save, Trash2, UserRound, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
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
const teamAvatarBucket = "team-avatars";
const maxAvatarBytes = 5 * 1024 * 1024;
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
  if (value.startsWith(`${teamAvatarBucket}/`)) {
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
    const storagePath = value.slice(`${teamAvatarBucket}/`.length).split("/").map(encodeURIComponent).join("/");
    return baseUrl ? `${baseUrl}/storage/v1/object/public/${teamAvatarBucket}/${storagePath}` : null;
  }
  if (value.startsWith("storage/v1/")) {
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
    return baseUrl ? `${baseUrl}/${value}` : null;
  }
  return null;
}

function storageObjectPath(path: string | null) {
  const value = path?.trim();
  const prefix = `${teamAvatarBucket}/`;
  return value?.startsWith(prefix) ? value.slice(prefix.length) : null;
}

function TeamAvatar({ path, preview }: { path: string | null; preview?: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const source = preview || avatarSource(path);

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

function avatarExtension(file: File) {
  const fromType = file.type.split("/")[1]?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return fromType || file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
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
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [removeCurrentAvatar, setRemoveCurrentAvatar] = useState(false);

  const avatarPreview = useMemo(() => pendingAvatar ? URL.createObjectURL(pendingAvatar) : "", [pendingAvatar]);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const visibleMembers = useMemo(
    () => editorRole ? members : members.filter((member) => member.visible),
    [editorRole, members],
  );
  const displayMembers = useMemo(
    () => dataState === "fallback" || loading
      ? [fallbackMember]
      : visibleMembers,
    [dataState, loading, visibleMembers],
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
      const request = supabase
        .from("project_team_members")
        .select(fields)
        .order("display_order", { ascending: true });
      const { data, error } = await Promise.race([
        request,
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("Team request timed out")), 8000)),
      ]);
      if (error) throw error;

      const nextMembers = normalizeMembers(data);
      setMembers(nextMembers);
      setDataState(nextMembers.length ? "supabase" : "fallback");
      setEditorRole(null);

      // Public team content should not wait for the optional auth lock. This
      // keeps the directory usable for signed-out visitors while the role
      // check runs in the background and enables editor controls when ready.
      void (async () => {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData.session) return;
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", sessionData.session.user.id);
          const roleValues = (roles ?? [])
            .map((item: { role?: unknown }) => item.role)
            .filter((role: unknown): role is EditorRole => role === "admin" || role === "developer");
          setEditorRole(roleValues.includes("admin") ? "admin" : roleValues.includes("developer") ? "developer" : null);
        } catch {
          // The public directory does not depend on the optional role check.
        }
      })();
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
    setPendingAvatar(null);
    setRemoveCurrentAvatar(false);
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

  function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > maxAvatarBytes) {
      notify({ title: t.uploadAvatar, message: t.avatarUploadHint, kind: "warning" });
      event.target.value = "";
      return;
    }
    setPendingAvatar(file);
    setRemoveCurrentAvatar(false);
    event.target.value = "";
    notify({ title: t.uploadAvatar, message: t.imageReadyToSave, kind: "info" });
  }

  function removeAvatar() {
    if (!editingId && !pendingAvatar && !draft.avatar_path) return;
    setPendingAvatar(null);
    setRemoveCurrentAvatar(true);
    setDraft((current) => ({ ...current, avatar_path: "" }));
    notify({ title: t.removeImage, message: t.unsavedChanges, kind: "info" });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editorRole || !isSupabaseConfigured()) return;
    if (!draft.name_th.trim() || !draft.name_en.trim()) {
      notify({ title: t.name, message: locale === "th" ? "กรุณากรอกชื่อทั้งสองภาษา" : "Enter the member name in both languages.", kind: "error" });
      return;
    }

    const previousAvatarPath = editingId ? members.find((member) => member.id === editingId)?.avatar_path ?? null : null;
    const payload = Object.fromEntries(
      Object.entries(draft).map(([key, value]) => [key, typeof value === "string" ? value.trim() || null : value]),
    );
    if (removeCurrentAvatar) payload.avatar_path = null;
    let uploadedAvatarPath: string | null = null;
    let savedMemberId: string | null = null;
    try {
      const supabase = createSupabaseBrowserClient();
      const result = editingId
        ? await supabase.from("project_team_members").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editingId).select(fields).single()
        : await supabase.from("project_team_members").insert({ ...payload, display_order: members.length ? Math.max(...members.map((member) => member.display_order)) + 1 : 1 }).select(fields).single();
      if (result.error) throw result.error;
      const savedMember = result.data as TeamMember;
      savedMemberId = savedMember.id;

      let nextAvatarPath = removeCurrentAvatar ? null : nullableText(payload.avatar_path);
      if (pendingAvatar) {
        const extension = avatarExtension(pendingAvatar);
        const objectPath = `members/${savedMember.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from(teamAvatarBucket).upload(objectPath, pendingAvatar, {
          contentType: pendingAvatar.type,
          cacheControl: "3600",
          upsert: false,
        });
        if (uploadError) throw uploadError;
        uploadedAvatarPath = objectPath;
        nextAvatarPath = `${teamAvatarBucket}/${objectPath}`;
      }

      if (nextAvatarPath !== savedMember.avatar_path) {
        const avatarResult = await supabase
          .from("project_team_members")
          .update({ avatar_path: nextAvatarPath, updated_at: new Date().toISOString() })
          .eq("id", savedMember.id)
          .select(fields)
          .single();
        if (avatarResult.error) throw avatarResult.error;
      }

      const oldStoragePath = storageObjectPath(previousAvatarPath);
      if (oldStoragePath && oldStoragePath !== storageObjectPath(nextAvatarPath)) {
        await supabase.storage.from(teamAvatarBucket).remove([oldStoragePath]);
      }
      setEditingId(null);
      setDraft(emptyDraft);
      setPendingAvatar(null);
      setRemoveCurrentAvatar(false);
      await load();
      notify({ title: t.save, kind: "success" });
    } catch (error) {
      if (uploadedAvatarPath) {
        await createSupabaseBrowserClient().storage.from(teamAvatarBucket).remove([uploadedAvatarPath]);
      }
      if (savedMemberId && !editingId) {
        await createSupabaseBrowserClient().from("project_team_members").delete().eq("id", savedMemberId);
      }
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
  const count = dataState === "fallback" ? 1 : loading ? "…" : visibleMembers.length;

  return (
    <section className="team-directory" aria-labelledby="team-directory-heading" aria-busy={loading} data-source={dataState}>
      <div className="section-heading">
        <div>
          <h2 id="team-directory-heading">{t.teamMembersLabel}</h2>
          <p aria-live="polite">{count}</p>
        </div>
        {editorRole ? <span className="data-badge">{t.teamEditor} · {editorRoleLabel}</span> : null}
      </div>

      {displayMembers.length ? (
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
          {loading ? <p className="field-hint team-live-hint" role="status">{loadingCopy}</p> : null}
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
            <div className="form-group team-avatar-editor"><label htmlFor="team-avatar-upload">{t.uploadAvatar}</label><div className="team-avatar-upload-row"><TeamAvatar key={removeCurrentAvatar ? "removed" : avatarPreview || draft.avatar_path || "placeholder"} path={removeCurrentAvatar ? null : draft.avatar_path || null} preview={removeCurrentAvatar ? undefined : avatarPreview || undefined} /><label className="secondary-button team-avatar-file-button" htmlFor="team-avatar-upload"><Camera size={15} />{t.uploadAvatar}<input id="team-avatar-upload" type="file" accept="image/*" onChange={chooseAvatar} /></label>{(draft.avatar_path || pendingAvatar) ? <button className="icon-button danger" type="button" onClick={removeAvatar} aria-label={t.removeImage}><Trash2 size={15} /></button> : null}</div><small className="field-hint">{t.avatarUploadHint}</small><label className="team-avatar-url-label" htmlFor="team-avatar-path">{t.avatarUrl} · {locale === "th" ? "สำรอง" : "Fallback"}</label><input id="team-avatar-path" className="form-control" value={draft.avatar_path ?? ""} onChange={(event) => { updateDraft("avatar_path", event.target.value); setRemoveCurrentAvatar(false); setPendingAvatar(null); }} /></div>
          </div>
          <label className="inline-checkbox"><input type="checkbox" checked={draft.visible} onChange={(event) => updateDraft("visible", event.target.checked)} />{t.visible}</label>
          <div className="support-form-actions">
            <button className="primary-button" type="submit"><Save size={15} />{t.save}</button>
            {editingId ? <button className="secondary-button" type="button" onClick={() => { setEditingId(null); setDraft(emptyDraft); setPendingAvatar(null); setRemoveCurrentAvatar(false); }}><X size={15} />{t.close}</button> : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}
