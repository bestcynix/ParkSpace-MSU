"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, ClipboardList, Edit3, Eye, EyeOff, LockKeyhole, LogOut, MailCheck, Save, ShieldAlert, ShieldCheck, Trash2, UserRound, Wrench, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useNotifications } from "@/components/layout/NotificationProvider";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  university_id: string | null;
  faculty: string | null;
  major: string | null;
  department: string | null;
  phone: string | null;
  avatar_path: string | null;
};

type Role = "admin" | "developer" | "staff" | "student" | "personnel" | "visitor";

const profileFields = "id, email, full_name, university_id, faculty, major, department, phone, avatar_path";

export function ProfileOverview({ locale }: { locale: Locale }) {
  const t = getCopy(locale);
  const router = useRouter();
  const { confirm, notify } = useNotifications();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [emailVerified, setEmailVerified] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [removeCurrentAvatar, setRemoveCurrentAvatar] = useState(false);
  const [draft, setDraft] = useState({ full_name: "", university_id: "", faculty: "", major: "", department: "", phone: "" });
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) throw sessionError ?? new Error(t.signInRequired);
      const user = sessionData.session.user;
      const [profileResult, roleResult] = await Promise.all([
        supabase.from("profiles").select(profileFields).eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      if (profileResult.error) throw profileResult.error;
      if (roleResult.error) throw roleResult.error;
      const nextProfile = (profileResult.data ?? { id: user.id, email: user.email ?? null }) as Profile;
      setProfile(nextProfile);
      setDraft({ full_name: nextProfile.full_name ?? "", university_id: nextProfile.university_id ?? "", faculty: nextProfile.faculty ?? "", major: nextProfile.major ?? "", department: nextProfile.department ?? "", phone: nextProfile.phone ?? "" });
      setRoles(((roleResult.data ?? []) as Array<{ role: Role }>).map((item) => item.role));
      setEmailVerified(Boolean(user.email_confirmed_at) || Boolean(user.identities?.some((identity: { provider?: string }) => identity.provider === "google")));
      if (nextProfile.avatar_path) {
        const { data: signed } = await supabase.storage.from("profile-avatars").createSignedUrl(nextProfile.avatar_path, 3600);
        setAvatarUrl(signed?.signedUrl ?? "");
      } else {
        setAvatarUrl("");
      }
      setPendingAvatar(null);
      setRemoveCurrentAvatar(false);
      setEditing(false);
    } catch (error) {
      notify({ title: t.operationalData, message: error instanceof Error ? error.message : t.signInRequired, kind: "error" });
    } finally {
      setLoading(false);
    }
  }, [notify, t.operationalData, t.signInRequired]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadProfile(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadProfile]);

  const avatarPreview = useMemo(() => pendingAvatar ? URL.createObjectURL(pendingAvatar) : "", [pendingAvatar]);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  function updateField(key: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !editing) return;
    setSaving(true);
    let uploadedAvatarPath: string | null = null;
    try {
      const supabase = createSupabaseBrowserClient();
      let nextAvatarPath = profile.avatar_path;
      if (pendingAvatar) {
        const extension = avatarExtension(pendingAvatar);
        uploadedAvatarPath = `${profile.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("profile-avatars").upload(uploadedAvatarPath, pendingAvatar, {
          contentType: pendingAvatar.type,
          cacheControl: "3600",
          upsert: false,
        });
        if (uploadError) throw uploadError;
        nextAvatarPath = uploadedAvatarPath;
      } else if (removeCurrentAvatar) {
        nextAvatarPath = null;
      }
      const payload = {
        ...Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim() || null])),
        avatar_path: nextAvatarPath,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from("profiles").update(payload).eq("id", profile.id).select(profileFields).single();
      if (error) throw error;
      if (profile.avatar_path && profile.avatar_path !== nextAvatarPath) {
        await supabase.storage.from("profile-avatars").remove([profile.avatar_path]);
      }
      setProfile(data as Profile);
      if (nextAvatarPath) {
        const { data: signed } = await supabase.storage.from("profile-avatars").createSignedUrl(nextAvatarPath, 3600);
        setAvatarUrl(signed?.signedUrl ?? "");
      } else {
        setAvatarUrl("");
      }
      setPendingAvatar(null);
      setRemoveCurrentAvatar(false);
      setEditing(false);
      notify({ title: t.saveProfile, kind: "success" });
    } catch (error) {
      if (uploadedAvatarPath) {
        await createSupabaseBrowserClient().storage.from("profile-avatars").remove([uploadedAvatarPath]);
      }
      notify({ title: t.saveProfile, message: error instanceof Error ? error.message : t.operationalData, kind: "error" });
    } finally {
      setSaving(false);
    }
  }

  function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !profile || !editing) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      notify({ title: t.profileImage, message: locale === "th" ? "ใช้ไฟล์รูปภาพขนาดไม่เกิน 5 MB" : "Choose an image file up to 5 MB.", kind: "warning" });
      return;
    }
    setPendingAvatar(file);
    setRemoveCurrentAvatar(false);
    event.target.value = "";
    notify({ title: t.profileImage, message: t.imageReadyToSave, kind: "info" });
  }

  function startEditing() {
    if (!profile) return;
    setDraft({ full_name: profile.full_name ?? "", university_id: profile.university_id ?? "", faculty: profile.faculty ?? "", major: profile.major ?? "", department: profile.department ?? "", phone: profile.phone ?? "" });
    setEditing(true);
  }

  function cancelEditing() {
    if (!profile || saving) return;
    setDraft({ full_name: profile.full_name ?? "", university_id: profile.university_id ?? "", faculty: profile.faculty ?? "", major: profile.major ?? "", department: profile.department ?? "", phone: profile.phone ?? "" });
    setPendingAvatar(null);
    setRemoveCurrentAvatar(false);
    setEditing(false);
  }

  function removeAvatar() {
    if (!editing || saving) return;
    setPendingAvatar(null);
    setRemoveCurrentAvatar(true);
    notify({ title: t.removeImage, message: t.unsavedChanges, kind: "info" });
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 8) {
      notify({ title: t.passwordMin, kind: "warning" });
      return;
    }
    if (newPassword !== confirmPassword) {
      notify({ title: t.passwordMismatch, kind: "warning" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await createSupabaseBrowserClient().auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      notify({ title: t.updatePassword, message: t.passwordUpdated, kind: "success" });
    } catch (error) {
      notify({ title: t.updatePassword, message: error instanceof Error ? error.message : t.operationalData, kind: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function resendVerification() {
    if (!profile?.email) return;
    const { error } = await createSupabaseBrowserClient().auth.resend({ type: "signup", email: profile.email, options: { emailRedirectTo: `${window.location.origin}/${locale}/verify-email` } });
    notify({ title: error ? t.emailNotVerified : t.verifyEmail, message: error?.message, kind: error ? "error" : "success" });
  }

  async function requestDeletion() {
    if (!profile) return;
    const accepted = await confirm({ title: t.deleteAccountRequest, message: locale === "th" ? "ระบบจะส่งคำขอให้ผู้ดูแลตรวจสอบ และจะไม่ลบบัญชีทันที" : "A secure request will be sent to the administrators; the account is not deleted immediately.", confirmLabel: t.deleteAccountRequest, cancelLabel: t.close, danger: true });
    if (!accepted) return;
    const { error } = await createSupabaseBrowserClient().from("account_deletion_requests").upsert({ user_id: profile.id, reason: "USER_REQUEST" }, { onConflict: "user_id" });
    notify({ title: error ? t.deleteAccount : t.deleteAccountRequest, message: error?.message ?? (error ? t.operationalData : t.deleteAccountRequestSent), kind: error ? "error" : "success", duration: 8000 });
  }

  async function signOut() {
    const accepted = await confirm({ title: locale === "th" ? "ออกจากระบบ" : "Log out", message: locale === "th" ? "ต้องการออกจากระบบหรือไม่?" : "Do you want to log out?", confirmLabel: locale === "th" ? "ออกจากระบบ" : "Log out", cancelLabel: t.close });
    if (!accepted) return;
    await createSupabaseBrowserClient().auth.signOut();
    router.push(`/${locale}/login`);
  }

  if (loading) return <div className="empty-card"><div><p>Loading · กำลังโหลด</p></div></div>;
  if (!profile) return <div className="empty-card"><div><ShieldAlert size={27} /><h2>{t.signInRequired}</h2></div></div>;

  const displayName = profile.full_name || profile.email || t.userRole;
  const displayedAvatarUrl = removeCurrentAvatar ? "" : avatarPreview || avatarUrl;
  return <div className="profile-overview">
    <section className="profile-card profile-hero-card"><div className="profile-avatar-wrap">{displayedAvatarUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="profile-avatar-image" src={displayedAvatarUrl} alt={t.profileImage} />
    ) : <span className="profile-avatar"><UserRound size={29} /> </span>}<div className="profile-avatar-actions"><label className={`avatar-upload-button ${!editing ? "is-disabled" : ""}`} aria-label={t.uploadImage}><Camera size={14} /><input type="file" accept="image/*" onChange={chooseAvatar} disabled={!editing || saving} /></label>{editing && (profile.avatar_path || pendingAvatar) ? <button className="avatar-remove-button" type="button" onClick={removeAvatar} disabled={saving} aria-label={t.removeImage}><Trash2 size={13} /></button> : null}</div></div><div className="profile-hero-copy"><div className="profile-hero-title-row"><strong>{displayName}</strong><button className="secondary-button profile-edit-button" type="button" onClick={editing ? cancelEditing : startEditing} disabled={saving}>{editing ? <><X size={14} />{t.close}</> : <><Edit3 size={14} />{t.editProfile}</>}</button></div><span>{profile.email ?? "—"}</span><div className="role-chip-list"><span className="role-chip active">{roles.length ? roles.map((role) => roleLabel(t, role)).join(" · ") : t.userRole}</span></div><span className={emailVerified ? "verification-status verified" : "verification-status pending"}>{emailVerified ? <CheckCircle2 size={13} /> : <MailCheck size={13} />}{emailVerified ? t.emailVerified : t.emailNotVerified}</span>{!emailVerified && profile.email ? <button className="text-link verification-button" type="button" onClick={() => void resendVerification()}>{t.verifyEmail}</button> : null}</div></section>
    <div className="profile-overview-grid"><form className={`form-card profile-editor-card ${editing ? "is-editing" : ""}`} onSubmit={(event) => void saveProfile(event)}><div className="form-section-title"><UserRound size={21} /><div><h2>{t.personalInfo}</h2><p>{editing ? t.unsavedChanges : t.editProfileHint}</p></div></div><div className="form-group"><label htmlFor="profile-name">{t.name}</label><input id="profile-name" className="form-control" value={draft.full_name} onChange={(event) => updateField("full_name", event.target.value)} disabled={!editing || saving} required /></div><div className="profile-two-columns"><div className="form-group"><label htmlFor="profile-id">{t.studentId}</label><input id="profile-id" className="form-control" value={draft.university_id} onChange={(event) => updateField("university_id", event.target.value)} disabled={!editing || saving} /></div><div className="form-group"><label htmlFor="profile-phone">{t.phone}</label><input id="profile-phone" className="form-control" type="tel" value={draft.phone} onChange={(event) => updateField("phone", event.target.value)} disabled={!editing || saving} /></div></div><div className="profile-two-columns"><div className="form-group"><label htmlFor="profile-faculty">{locale === "th" ? "คณะ" : "Faculty"}</label><input id="profile-faculty" className="form-control" value={draft.faculty} onChange={(event) => updateField("faculty", event.target.value)} disabled={!editing || saving} /></div><div className="form-group"><label htmlFor="profile-major">{locale === "th" ? "สาขา" : "Major"}</label><input id="profile-major" className="form-control" value={draft.major} onChange={(event) => updateField("major", event.target.value)} disabled={!editing || saving} /></div></div><div className="form-group"><label htmlFor="profile-department">{locale === "th" ? "หน่วยงาน" : "Department"}</label><input id="profile-department" className="form-control" value={draft.department} onChange={(event) => updateField("department", event.target.value)} disabled={!editing || saving} /></div>{editing ? <div className="profile-form-actions"><button className="secondary-button" type="button" onClick={cancelEditing} disabled={saving}><X size={15} />{t.close}</button><button className="primary-button" type="submit" disabled={saving}><Save size={15} />{saving ? "…" : t.saveProfile}</button></div> : <button className="secondary-button profile-form-edit" type="button" onClick={startEditing}><Edit3 size={15} />{t.editProfile}</button>}</form>
      <div className="profile-security-stack"><form className="form-card profile-editor-card" onSubmit={(event) => void changePassword(event)}><div className="form-section-title"><LockKeyhole size={21} /><div><h2>{t.accountSecurity}</h2><p>{t.updatePassword}</p></div></div><div className="form-group"><label htmlFor="profile-new-password">{t.newPassword}</label><div className="password-control"><input id="profile-new-password" className="form-control" type={showNewPassword ? "text" : "password"} autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /><button className="password-toggle" type="button" onClick={() => setShowNewPassword((value) => !value)} aria-label={showNewPassword ? (locale === "th" ? "ซ่อนรหัสผ่าน" : "Hide password") : (locale === "th" ? "แสดงรหัสผ่าน" : "Show password")}><>{showNewPassword ? <EyeOff size={17} /> : <Eye size={17} />}</></button></div></div><div className="form-group"><label htmlFor="profile-confirm-password">{t.confirmPassword}</label><div className="password-control"><input id="profile-confirm-password" className="form-control" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /><button className="password-toggle" type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? (locale === "th" ? "ซ่อนรหัสผ่าน" : "Hide password") : (locale === "th" ? "แสดงรหัสผ่าน" : "Show password")}><>{showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}</></button></div></div><button className="secondary-button" type="submit" disabled={saving}>{t.updatePassword}</button></form><div className="profile-actions-card"><Link className="secondary-button" href={`/${locale}/app/profile/vehicles`}>{t.myVehicles}</Link><Link className="secondary-button" href={`/${locale}/app/notifications`}>{t.notifications}</Link>{roles.includes("developer") ? <Link className="secondary-button role-console-button developer-console" href={`/${locale}/developer/health`}><Wrench size={15} />{t.developerConsole}</Link> : null}{roles.includes("admin") ? <Link className="secondary-button role-console-button admin-console" href={`/${locale}/admin/dashboard`}><ShieldCheck size={15} />{t.adminConsole}</Link> : null}{roles.includes("staff") ? <Link className="secondary-button role-console-button staff-console" href={`/${locale}/staff/dashboard`}><ClipboardList size={15} />{t.staffConsole}</Link> : null}<button className="secondary-button" type="button" onClick={() => void requestDeletion()}><Trash2 size={15} />{t.deleteAccountRequest}</button><button className="secondary-button" type="button" onClick={() => void signOut()}><LogOut size={15} />{locale === "th" ? "ออกจากระบบ" : "Log out"}</button></div></div>
    </div>
  </div>;
}

function roleLabel(t: ReturnType<typeof getCopy>, role: Role) {
  if (role === "admin") return t.admin;
  if (role === "developer") return t.developer;
  if (role === "staff") return t.staff;
  return t.userRole;
}

function avatarExtension(file: File) {
  const fromType = file.type.split("/")[1]?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return fromType || file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
}
