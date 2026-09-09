"use client";

import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { projectInfo } from "@/lib/project-info";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

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
};

const fields = "id, display_order, name_th, name_en, student_id, major_th, major_en, faculty_th, faculty_en, role_th, role_en, avatar_path";
const teamAvatarBucket = "team-avatars";

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
};

function textOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeMembers(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const id = textOrNull(row.id);
    const nameTh = textOrNull(row.name_th);
    const nameEn = textOrNull(row.name_en);
    if (!id || !nameTh || !nameEn) return [];
    return [{
      id,
      display_order: typeof row.display_order === "number" ? row.display_order : index + 1,
      name_th: nameTh,
      name_en: nameEn,
      student_id: textOrNull(row.student_id),
      major_th: textOrNull(row.major_th),
      major_en: textOrNull(row.major_en),
      faculty_th: textOrNull(row.faculty_th),
      faculty_en: textOrNull(row.faculty_en),
      role_th: textOrNull(row.role_th),
      role_en: textOrNull(row.role_en),
      avatar_path: textOrNull(row.avatar_path),
    } satisfies TeamMember];
  }).sort((first, second) => first.display_order - second.display_order);
}

function avatarSource(path: string | null) {
  const value = path?.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || value.startsWith("/")) return value;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!baseUrl) return null;
  if (value.startsWith(`${teamAvatarBucket}/`)) {
    const storagePath = value.slice(`${teamAvatarBucket}/`.length).split("/").map(encodeURIComponent).join("/");
    return `${baseUrl}/storage/v1/object/public/${teamAvatarBucket}/${storagePath}`;
  }
  if (value.startsWith("storage/v1/")) return `${baseUrl}/${value}`;
  return null;
}

function TeamAvatar({ path }: { path: string | null }) {
  const [failed, setFailed] = useState(false);
  const source = avatarSource(path);
  return <span className="team-avatar" aria-hidden={source && !failed ? undefined : true}>{source && !failed ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={source} alt="" onError={() => setFailed(true)} />
  ) : <UserRound size={20} aria-hidden="true" />}</span>;
}

export function ProjectTeamPreview({ locale }: { locale: Locale }) {
  const t = getCopy(locale);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!isSupabaseConfigured()) {
        if (active) setLoading(false);
        return;
      }
      try {
        const request = createSupabaseBrowserClient().from("project_team_members").select(fields).order("display_order", { ascending: true });
        const result = await Promise.race([
          request,
          new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("Team request timed out")), 6000)),
        ]);
        if (result.error) throw result.error;
        if (active) setMembers(normalizeMembers(result.data));
      } catch {
        if (active) setMembers([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  const displayMembers = members.length ? members : [fallbackMember];
  return <div aria-busy={loading}>
    <p className="team-preview-count" aria-live="polite">{loading ? "…" : displayMembers.length}</p>
    <div className="team-grid team-grid-single">
    {displayMembers.map((member) => {
      const name = locale === "th" ? member.name_th : member.name_en;
      const study = [locale === "th" ? member.major_th : member.major_en, locale === "th" ? member.faculty_th : member.faculty_en].filter(Boolean).join(" · ");
      const role = (locale === "th" ? member.role_th : member.role_en) ?? (locale === "th" ? "สมาชิกทีม" : "Team member");
      return <article className="team-card team-member-card" key={member.id}>
        <div className="team-member-heading"><TeamAvatar path={member.avatar_path} /><div><strong>{name}</strong><span>{member.student_id ?? "—"}</span></div></div>
        {study ? <span>{study}</span> : null}
        <div className="data-badge team-role-badge">{role}</div>
      </article>;
    })}
    {loading ? <span className="field-hint team-live-hint">{locale === "th" ? "กำลังตรวจสอบข้อมูลทีมจากระบบ…" : "Checking the live team directory…"}</span> : null}
    {!members.length && !loading ? <span className="field-hint team-live-hint">{t.noPrivateData}</span> : null}
    </div>
  </div>;
}
