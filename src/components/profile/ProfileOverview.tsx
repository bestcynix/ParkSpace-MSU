"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  Camera,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Crop,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  Info,
  LockKeyhole,
  LogOut,
  MailCheck,
  MapPin,
  Navigation,
  QrCode,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useNotifications } from "@/components/layout/NotificationProvider";
import { ImageCropperModal } from "@/components/ui/ImageCropperModal";
import { resolveImageSource, uploadOrFallbackImage } from "@/lib/image-helpers";

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

type Role = "admin" | "staff" | "student" | "personnel" | "visitor";

type UserBooking = {
  id: string;
  reference: string;
  status: string;
  booking_date: string;
  starts_at: string;
  ends_at: string;
  booking_mode?: string;
  parking_area_id: string;
  parking_slot_id: string | null;
  vehicle_snapshot?: { plate?: string; plate_number?: string; province?: string } | null;
  parking_areas?: { code: string; name_th: string; name_en: string; latitude?: number | null; longitude?: number | null } | null;
  parking_slots?: { slot_code: string; row_label: string } | null;
  created_at: string;
};

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
  const [cropperSrc, setCropperSrc] = useState<string | null>(null);
  const [draft, setDraft] = useState({ full_name: "", university_id: "", faculty: "", major: "", department: "", phone: "" });
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  // Deletion request state
  const [deletionPending, setDeletionPending] = useState(false);

  // Booking history state
  const [bookings, setBookings] = useState<UserBooking[]>([]);
  const [bookingQuery, setBookingQuery] = useState("");
  const [bookingFilter, setBookingFilter] = useState("ALL");
  const [bookingPage, setBookingPage] = useState(1);
  const [viewingBooking, setViewingBooking] = useState<UserBooking | null>(null);
  const bookingsPerPage = 5;

  const loadProfile = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) throw sessionError ?? new Error(t.signInRequired);
      const user = sessionData.session.user;

      const [profileResult, roleResult, deletionResult, bookingsResult] = await Promise.allSettled([
        supabase.from("profiles").select(profileFields).eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("account_deletion_requests").select("status").eq("user_id", user.id).eq("status", "PENDING").maybeSingle(),
        supabase.from("bookings").select("id, reference, status, booking_date, starts_at, ends_at, booking_mode, parking_area_id, parking_slot_id, vehicle_snapshot, parking_areas:parking_area_id(code, name_th, name_en, latitude, longitude), parking_slots:parking_slot_id(slot_code, row_label), created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);

      const profileData = profileResult.status === "fulfilled" && !profileResult.value.error
        ? (profileResult.value.data as Profile)
        : { id: user.id, email: user.email ?? null } as Profile;

      setProfile(profileData);
      setDraft({
        full_name: profileData.full_name ?? "",
        university_id: profileData.university_id ?? "",
        faculty: profileData.faculty ?? "",
        major: profileData.major ?? "",
        department: profileData.department ?? "",
        phone: profileData.phone ?? "",
      });

      let loadedRoles: Role[] = [];
      if (roleResult.status === "fulfilled" && !roleResult.value.error) {
        loadedRoles = ((roleResult.value.data ?? []) as Array<{ role: string }>).map((item) => {
          const r = String(item.role).toLowerCase();
          return (r === "developer" ? "admin" : r) as Role;
        });
      }
      setRoles(loadedRoles);

      if (deletionResult.status === "fulfilled" && !deletionResult.value.error && deletionResult.value.data) {
        setDeletionPending(true);
      } else {
        setDeletionPending(false);
      }

      if (bookingsResult.status === "fulfilled" && !bookingsResult.value.error) {
        setBookings((bookingsResult.value.data ?? []) as unknown as UserBooking[]);
      }

      setEmailVerified(Boolean(user.email_confirmed_at) || Boolean(user.identities?.some((identity: { provider?: string }) => identity.provider === "google")));

      if (profileData.avatar_path) {
        const resolved = resolveImageSource(profileData.avatar_path, "profile-avatars");
        if (resolved && (resolved.startsWith("data:") || resolved.startsWith("blob:") || /^https?:\/\//i.test(resolved) || resolved.startsWith("/"))) {
          setAvatarUrl(resolved);
        } else {
          try {
            const { data: signed } = await supabase.storage.from("profile-avatars").createSignedUrl(profileData.avatar_path, 3600);
            setAvatarUrl(signed?.signedUrl || resolved || "");
          } catch {
            setAvatarUrl(resolved || "");
          }
        }
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
        const objectPath = `${profile.id}/${crypto.randomUUID()}.${extension}`;
        const { pathOrUrl } = await uploadOrFallbackImage({
          fileOrBlob: pendingAvatar,
          bucket: "profile-avatars",
          objectPath,
        });
        nextAvatarPath = pathOrUrl;
        uploadedAvatarPath = pathOrUrl;
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
      if (profile.avatar_path && profile.avatar_path !== nextAvatarPath && !profile.avatar_path.startsWith("data:")) {
        try {
          await supabase.storage.from("profile-avatars").remove([profile.avatar_path]);
        } catch {
          // ignore storage cleanup
        }
      }
      setProfile(data as Profile);
      if (nextAvatarPath) {
        const resolved = resolveImageSource(nextAvatarPath, "profile-avatars");
        setAvatarUrl(resolved || nextAvatarPath);
      } else {
        setAvatarUrl("");
      }
      setPendingAvatar(null);
      setRemoveCurrentAvatar(false);
      setEditing(false);
      notify({ title: t.saveProfile, kind: "success" });
    } catch (error) {
      if (uploadedAvatarPath && !uploadedAvatarPath.startsWith("data:")) {
        try {
          await createSupabaseBrowserClient().storage.from("profile-avatars").remove([uploadedAvatarPath]);
        } catch {
          // ignore
        }
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
      event.target.value = "";
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setCropperSrc(objectUrl);
    event.target.value = "";
  }

  function handleCropperConfirm(dataUrl: string, blob: Blob) {
    setCropperSrc(null);
    const file = new File([blob], "profile-avatar.jpg", { type: "image/jpeg" });
    setPendingAvatar(file);
    setAvatarUrl(dataUrl);
    setRemoveCurrentAvatar(false);
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
    const accepted = await confirm({
      title: locale === "th" ? "ส่งคำขอลบบัญชีผู้ใช้" : "Request Account Deletion",
      message: locale === "th"
        ? "ระบบจะส่งคำขอไปยังผู้ดูแลระบบ (Admin) เพื่อยืนยันการลบข้อมูล บัญชีจะยังไม่ถูกลบทันที"
        : "A secure request will be sent to the administrators; the account will wait for admin approval.",
      confirmLabel: locale === "th" ? "ส่งคำขอลบ" : "Submit Request",
      cancelLabel: t.close,
      danger: true,
    });
    if (!accepted) return;

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch("/api/admin/users/deletion-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "request", reason: "USER_REQUEST" }),
      });
      if (!res.ok) throw new Error("Failed to submit deletion request");

      setDeletionPending(true);
      notify({
        title: locale === "th" ? "ส่งคำขอลบบัญชีเรียบร้อยแล้ว" : "Deletion Request Sent",
        message: locale === "th" ? "บัญชีกำลังรอ Admin ลบข้อมูล" : "Your account is awaiting Admin approval.",
        kind: "warning",
        duration: 8000,
      });
    } catch (err) {
      notify({ title: t.operationalData, message: err instanceof Error ? err.message : "Error", kind: "error" });
    }
  }

  async function cancelDeletionRequest() {
    const accepted = await confirm({
      title: locale === "th" ? "ยกเลิกคำขอลบบัญชี" : "Cancel Deletion Request",
      message: locale === "th" ? "คุณต้องการยกเลิกคำขอลบบัญชีใช่หรือไม่?" : "Do you want to cancel the pending deletion request?",
      confirmLabel: locale === "th" ? "ยกเลิกคำขอ" : "Cancel Request",
      cancelLabel: t.close,
    });
    if (!accepted) return;

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch("/api/admin/users/deletion-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (!res.ok) throw new Error("Failed to cancel deletion request");

      setDeletionPending(false);
      notify({
        title: locale === "th" ? "ยกเลิกคำขอลบแล้ว" : "Deletion Request Cancelled",
        kind: "success",
      });
    } catch (err) {
      notify({ title: t.operationalData, message: err instanceof Error ? err.message : "Error", kind: "error" });
    }
  }

  async function signOut() {
    const accepted = await confirm({
      title: locale === "th" ? "ออกจากระบบ" : "Log out",
      message: locale === "th" ? "ต้องการออกจากระบบหรือไม่?" : "Do you want to log out?",
      confirmLabel: locale === "th" ? "ออกจากระบบ" : "Log out",
      cancelLabel: t.close,
    });
    if (!accepted) return;
    await createSupabaseBrowserClient().auth.signOut();
    router.push(`/${locale}/login`);
  }

  // Filter and paginate user bookings
  const filteredBookings = useMemo(() => {
    const q = bookingQuery.trim().toLowerCase();
    return bookings.filter((b) => {
      if (bookingFilter !== "ALL") {
        if (bookingFilter === "CONFIRMED") {
          if (b.status !== "CONFIRMED" && b.status !== "RESERVED") return false;
        } else if (b.status !== bookingFilter) {
          return false;
        }
      }
      if (!q) return true;
      const ref = (b.reference || "").toLowerCase();
      const slot = (b.parking_slots?.slot_code || "").toLowerCase();
      const area = (b.parking_areas?.name_th || b.parking_areas?.name_en || b.parking_areas?.code || "").toLowerCase();
      const plate = (b.vehicle_snapshot?.plate || b.vehicle_snapshot?.plate_number || "").toLowerCase();
      return ref.includes(q) || slot.includes(q) || area.includes(q) || plate.includes(q);
    });
  }, [bookingFilter, bookingQuery, bookings]);

  const totalBookingPages = Math.max(1, Math.ceil(filteredBookings.length / bookingsPerPage));
  const paginatedBookings = useMemo(() => {
    const start = (bookingPage - 1) * bookingsPerPage;
    return filteredBookings.slice(start, start + bookingsPerPage);
  }, [bookingPage, bookingsPerPage, filteredBookings]);

  if (loading) return <div className="empty-card"><div><p>{locale === "th" ? "กำลังโหลดข้อมูลโปรไฟล์..." : "Loading profile..."}</p></div></div>;
  if (!profile) return <div className="empty-card"><div><ShieldAlert size={27} /><h2>{t.signInRequired}</h2></div></div>;

  const displayName = profile.full_name || profile.email || t.userRole;
  const displayedAvatarUrl = removeCurrentAvatar ? "" : avatarPreview || avatarUrl;

  return (
    <div className="profile-overview">
      {/* Account Deletion Pending Warning */}
      {deletionPending ? (
        <div className="alert-card warning" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "16px 20px", borderRadius: 16, background: "#fef3c7", border: "1px solid #f59e0b" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <AlertTriangle size={24} color="#d97706" />
            <div>
              <strong style={{ color: "#92400e", fontSize: 14, display: "block" }}>
                {locale === "th" ? "บัญชีกำลังรอ Admin ลบข้อมูล" : "Account Deletion Pending"}
              </strong>
              <span style={{ color: "#78350f", fontSize: 12 }}>
                {locale === "th" ? "คุณได้ส่งคำขอลบบัญชีแล้ว อยู่ระหว่างรอผู้ดูแลระบบดำเนินการอนุมัติ" : "Your request is awaiting admin approval."}
              </span>
            </div>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void cancelDeletionRequest()}
            style={{ fontSize: 12, padding: "6px 14px", whiteSpace: "nowrap" }}
          >
            {locale === "th" ? "ยกเลิกคำขอ" : "Cancel Request"}
          </button>
        </div>
      ) : null}

      {/* Hero Card */}
      <section className="profile-card profile-hero-card">
        <div className="profile-avatar-wrap">
          {displayedAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="profile-avatar-image" src={displayedAvatarUrl} alt={t.profileImage} />
          ) : (
            <span className="profile-avatar"><UserRound size={32} /></span>
          )}
          <div className="profile-avatar-actions">
            <label className={`avatar-upload-button ${!editing ? "is-disabled" : ""}`} aria-label={t.uploadImage} title={t.uploadImage}>
              <Camera size={14} />
              <input type="file" accept="image/*" onChange={chooseAvatar} disabled={!editing || saving} />
            </label>
            {editing && displayedAvatarUrl ? (
              <button
                className="avatar-action-button"
                type="button"
                onClick={() => setCropperSrc(displayedAvatarUrl)}
                disabled={saving}
                aria-label={locale === "th" ? "ครอบและปรับขนาดภาพ" : "Crop & adjust image"}
                title={locale === "th" ? "ครอบและปรับขนาดภาพ" : "Crop & adjust image"}
              >
                <Crop size={13} />
              </button>
            ) : null}
            {editing && (profile.avatar_path || pendingAvatar) ? (
              <button className="avatar-remove-button" type="button" onClick={removeAvatar} disabled={saving} aria-label={t.removeImage} title={t.removeImage}>
                <Trash2 size={13} />
              </button>
            ) : null}
          </div>
        </div>

        <div className="profile-hero-copy">
          <div className="profile-hero-title-row">
            <strong>{displayName}</strong>
            <button className="secondary-button profile-edit-button" type="button" onClick={editing ? cancelEditing : startEditing} disabled={saving}>
              {editing ? <><X size={14} />{t.close}</> : <><Edit3 size={14} />{t.editProfile}</>}
            </button>
          </div>
          <span>{profile.email ?? "—"}</span>
          <div className="role-chip-list">
            <span className="role-chip active">
              {roles.length ? roles.map((role) => roleLabel(t, role)).join(" · ") : t.userRole}
            </span>
          </div>
          <span className={emailVerified ? "verification-status verified" : "verification-status pending"}>
            {emailVerified ? <CheckCircle2 size={13} /> : <MailCheck size={13} />}
            {emailVerified ? t.emailVerified : t.emailNotVerified}
          </span>
          {!emailVerified && profile.email ? (
            <button className="text-link verification-button" type="button" onClick={() => void resendVerification()}>{t.verifyEmail}</button>
          ) : null}
        </div>
      </section>

      {/* Grid: Personal Info Form + Security / Actions */}
      <div className="profile-overview-grid">
        <form className={`form-card profile-editor-card ${editing ? "is-editing" : ""}`} onSubmit={(event) => void saveProfile(event)}>
          <div className="form-section-title">
            <UserRound size={22} />
            <div>
              <h2>{t.personalInfo}</h2>
              <p>{editing ? t.unsavedChanges : t.editProfileHint}</p>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="profile-name">{t.name}</label>
            <input id="profile-name" className="form-control" value={draft.full_name} onChange={(event) => updateField("full_name", event.target.value)} disabled={!editing || saving} required />
          </div>
          <div className="profile-two-columns">
            <div className="form-group">
              <label htmlFor="profile-id">{t.studentId}</label>
              <input id="profile-id" className="form-control" value={draft.university_id} onChange={(event) => updateField("university_id", event.target.value)} disabled={!editing || saving} />
            </div>
            <div className="form-group">
              <label htmlFor="profile-phone">{t.phone}</label>
              <input
                id="profile-phone"
                className="form-control"
                type="tel"
                maxLength={10}
                placeholder="08XXXXXXXX"
                value={draft.phone}
                onChange={(event) => updateField("phone", event.target.value.replace(/\D/g, "").slice(0, 10))}
                disabled={!editing || saving}
              />
              <small className="field-hint" style={{ fontSize: 11 }}>
                {locale === "th" ? "ตัวเลขไม่เกิน 10 หลัก" : "Maximum 10 digits"}
              </small>
            </div>
          </div>
          <div className="profile-two-columns">
            <div className="form-group">
              <label htmlFor="profile-faculty">{locale === "th" ? "คณะ" : "Faculty"}</label>
              <input id="profile-faculty" className="form-control" value={draft.faculty} onChange={(event) => updateField("faculty", event.target.value)} disabled={!editing || saving} />
            </div>
            <div className="form-group">
              <label htmlFor="profile-major">{locale === "th" ? "สาขา" : "Major"}</label>
              <input id="profile-major" className="form-control" value={draft.major} onChange={(event) => updateField("major", event.target.value)} disabled={!editing || saving} />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="profile-department">{locale === "th" ? "หน่วยงาน" : "Department"}</label>
            <input id="profile-department" className="form-control" value={draft.department} onChange={(event) => updateField("department", event.target.value)} disabled={!editing || saving} />
          </div>
          {editing ? (
            <div className="profile-form-actions">
              <button className="secondary-button" type="button" onClick={cancelEditing} disabled={saving}>
                <X size={15} />{t.close}
              </button>
              <button className="primary-button" type="submit" disabled={saving}>
                <Save size={15} />{saving ? "…" : t.saveProfile}
              </button>
            </div>
          ) : (
            <button className="secondary-button profile-form-edit" type="button" onClick={startEditing}>
              <Edit3 size={15} />{t.editProfile}
            </button>
          )}
        </form>

        <div className="profile-security-stack">
          {/* Change Password Card */}
          <form className="form-card profile-editor-card" onSubmit={(event) => void changePassword(event)}>
            <div className="form-section-title">
              <LockKeyhole size={22} />
              <div>
                <h2>{t.accountSecurity}</h2>
                <p>{t.updatePassword}</p>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="profile-new-password">{t.newPassword}</label>
              <div className="password-control">
                <input
                  id="profile-new-password"
                  className="form-control"
                  type={showNewPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowNewPassword((value) => !value)}
                  aria-label={showNewPassword ? (locale === "th" ? "ซ่อนรหัสผ่าน" : "Hide password") : (locale === "th" ? "แสดงรหัสผ่าน" : "Show password")}
                >
                  {showNewPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="profile-confirm-password">{t.confirmPassword}</label>
              <div className="password-control">
                <input
                  id="profile-confirm-password"
                  className="form-control"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  aria-label={showConfirmPassword ? (locale === "th" ? "ซ่อนรหัสผ่าน" : "Hide password") : (locale === "th" ? "แสดงรหัสผ่าน" : "Show password")}
                >
                  {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            <button className="secondary-button" type="submit" disabled={saving}>
              {t.updatePassword}
            </button>
          </form>

          {/* Navigation and Account Actions */}
          <div className="profile-actions-card">
            <Link className="secondary-button" href={`/${locale}/app/profile/vehicles`}>
              {t.myVehicles}
            </Link>
            <Link className="secondary-button" href={`/${locale}/app/notifications`}>
              {t.notifications}
            </Link>

            {/* Admin Console Shortcut */}
            {roles.includes("admin") ? (
              <Link className="secondary-button role-console-button admin-console" href={`/${locale}/admin/dashboard`}>
                <ShieldCheck size={16} />
                <span>{t.adminConsole}</span>
              </Link>
            ) : null}

            {/* Staff Console Shortcut */}
            {roles.includes("staff") ? (
              <Link className="secondary-button role-console-button staff-console" href={`/${locale}/staff/dashboard`}>
                <ClipboardList size={16} />
                <span>{t.staffConsole}</span>
              </Link>
            ) : null}

            {/* Deletion Request Action */}
            {!deletionPending ? (
              <button className="secondary-button" type="button" onClick={() => void requestDeletion()}>
                <Trash2 size={15} />
                <span>{t.deleteAccountRequest}</span>
              </button>
            ) : (
              <button className="secondary-button warning" type="button" onClick={() => void cancelDeletionRequest()}>
                <AlertTriangle size={15} color="#d97706" />
                <span>{locale === "th" ? "ยกเลิกคำขอลบบัญชี" : "Cancel Deletion Request"}</span>
              </button>
            )}

            <button className="secondary-button danger" type="button" onClick={() => void signOut()}>
              <LogOut size={15} />
              <span>{locale === "th" ? "ออกจากระบบ" : "Log out"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* User's Detailed Personal Booking History */}
      <section className="review-panel" style={{ marginTop: 24 }}>
        <div className="section-heading">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2>{locale === "th" ? "ประวัติการจองของฉัน" : "My Booking History"}</h2>
              <span className="count-pill">({filteredBookings.length})</span>
            </div>
            <p className="page-subtitle">
              {locale === "th"
                ? "รายการการจองช่องจอดรถ ประวัติวันเวลา ช่องจอด และสถานะการใช้งานจริง"
                : "Your personal parking reservations, time slots, and check-in status records."}
            </p>
          </div>
          <Link className="primary-button small-button" href={`/${locale}/parking`}>
            <Calendar size={14} />
            <span>{locale === "th" ? "จองช่องจอดใหม่" : "Book New Slot"}</span>
          </Link>
        </div>

        {/* Filter & Search Bar */}
        <div className="inline-actions" style={{ marginTop: 14, gap: 10, flexWrap: "wrap" }}>
          <div className="user-search-box" style={{ flex: "1 1 240px", margin: 0 }}>
            <Search size={16} />
            <input
              aria-label={locale === "th" ? "ค้นหาการจอง (รหัสอ้างอิง, ช่องจอด, พื้นที่)..." : "Search bookings (ref, slot, area)..."}
              placeholder={locale === "th" ? "ค้นหาการจอง (รหัสอ้างอิง, ช่องจอด, พื้นที่)..." : "Search bookings (ref, slot, area)..."}
              value={bookingQuery}
              onChange={(e) => { setBookingQuery(e.target.value); setBookingPage(1); }}
            />
          </div>
          <label className="user-search-box" style={{ flex: "0 1 180px", margin: 0 }}>
            <Filter size={16} />
            <select
              value={bookingFilter}
              onChange={(e) => { setBookingFilter(e.target.value); setBookingPage(1); }}
              style={{ width: "100%", border: 0, outline: 0, background: "transparent", color: "inherit", font: "inherit" }}
              aria-label="Filter status"
            >
              <option value="ALL">{locale === "th" ? "สถานะทั้งหมด" : "All Status"}</option>
              <option value="PENDING">{locale === "th" ? "รอดำเนินการ (Pending)" : "Pending"}</option>
              <option value="CONFIRMED">{locale === "th" ? "ยืนยันแล้ว / จองแล้ว" : "Confirmed / Reserved"}</option>
              <option value="CHECKED_IN">{locale === "th" ? "กำลังใช้งาน" : "Checked In"}</option>
              <option value="COMPLETED">{locale === "th" ? "เสร็จสิ้น" : "Completed"}</option>
              <option value="CANCELLED">{locale === "th" ? "ยกเลิกแล้ว" : "Cancelled"}</option>
            </select>
          </label>
        </div>

        {/* Bookings List */}
        {paginatedBookings.length === 0 ? (
          <div className="empty-card compact-empty" style={{ padding: 30, textAlign: "center" }}>
            <Calendar size={32} color="#9ca3af" style={{ margin: "0 auto 8px" }} />
            <p>{bookings.length ? t.noResults : (locale === "th" ? "ยังไม่มีประวัติการจอง" : "No bookings found.")}</p>
          </div>
        ) : (
          <div className="data-list" style={{ marginTop: 14 }}>
            {paginatedBookings.map((b) => {
              const areaName = locale === "th"
                ? b.parking_areas?.name_th || b.parking_areas?.code || b.parking_area_id
                : b.parking_areas?.name_en || b.parking_areas?.code || b.parking_area_id;

              const slotCode = b.parking_slots?.slot_code || b.parking_slot_id || (locale === "th" ? "พื้นที่รวม" : "Area Only");
              const timeRange = `${formatTime(b.starts_at)} – ${formatTime(b.ends_at)}`;
              const plate = b.vehicle_snapshot?.plate || b.vehicle_snapshot?.plate_number;
              const lat = b.parking_areas?.latitude ?? 16.2425;
              const lng = b.parking_areas?.longitude ?? 103.247;

              return (
                <article
                  className="data-list-item"
                  key={b.id}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 14 }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 14 }}>{b.reference}</strong>
                      <span className={`status-badge ${bookingStatusClass(b.status)}`}>
                        {bookingStatusLabel(b.status, locale)}
                      </span>
                      {plate ? (
                        <span className="data-badge" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                          <Car size={12} />
                          {plate}
                        </span>
                      ) : null}
                    </div>

                    <div style={{ display: "flex", gap: 14, marginTop: 6, flexWrap: "wrap", fontSize: 12, color: "var(--muted)" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <MapPin size={13} />
                        {areaName}
                      </span>
                      <span>
                        <strong>{locale === "th" ? "ช่องจอด:" : "Slot:"}</strong> {slotCode}
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Clock size={13} />
                        {b.booking_date} ({timeRange})
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      className="secondary-button small-button"
                      type="button"
                      onClick={() => setViewingBooking(b)}
                      style={{ fontSize: 12, padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 5 }}
                      title={locale === "th" ? "ดูลายละเอียดการจอง" : "View Details"}
                    >
                      <Info size={13} />
                      <span>{locale === "th" ? "รายละเอียด" : "Details"}</span>
                    </button>
                    <a
                      className="secondary-button small-button"
                      href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12, padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 5 }}
                      title={locale === "th" ? "นำทางผ่าน Google Maps" : "Navigate"}
                    >
                      <Navigation size={13} />
                      <span>{locale === "th" ? "นำทาง" : "Navigate"}</span>
                    </a>
                    <Link
                      className="primary-button small-button"
                      href={`/${locale}/app/bookings`}
                      style={{ fontSize: 12, padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 5 }}
                      title={locale === "th" ? "เปิดบัตรผ่าน QR Pass" : "QR Pass"}
                    >
                      <QrCode size={13} />
                      <span>QR Pass</span>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Booking Detail Modal */}
        {viewingBooking ? (
          <div className="modal-backdrop" role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div className="form-card" style={{ maxWidth: 500, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: 12, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Calendar size={20} color="#e5ae00" />
                  <strong style={{ fontSize: 16 }}>{locale === "th" ? "รายละเอียดการจอง" : "Booking Details"}</strong>
                </div>
                <button className="icon-button" type="button" onClick={() => setViewingBooking(null)} aria-label="Close">
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13, marginBottom: 16 }}>
                <div style={{ background: "var(--card-subtle, #f9fafb)", padding: 10, borderRadius: 10 }}>
                  <span style={{ color: "var(--muted)", display: "block", fontSize: 11 }}>{locale === "th" ? "รหัสการจอง" : "Reference"}</span>
                  <strong style={{ fontSize: 13 }}>{viewingBooking.reference}</strong>
                </div>
                <div style={{ background: "var(--card-subtle, #f9fafb)", padding: 10, borderRadius: 10 }}>
                  <span style={{ color: "var(--muted)", display: "block", fontSize: 11 }}>{locale === "th" ? "สถานะ" : "Status"}</span>
                  <span className={`status-badge ${bookingStatusClass(viewingBooking.status)}`} style={{ marginTop: 2 }}>
                    {bookingStatusLabel(viewingBooking.status, locale)}
                  </span>
                </div>
                <div style={{ background: "var(--card-subtle, #f9fafb)", padding: 10, borderRadius: 10 }}>
                  <span style={{ color: "var(--muted)", display: "block", fontSize: 11 }}>{locale === "th" ? "พื้นที่จอด" : "Parking Area"}</span>
                  <strong style={{ fontSize: 13 }}>
                    {viewingBooking.parking_areas?.code} · {locale === "th" ? viewingBooking.parking_areas?.name_th : viewingBooking.parking_areas?.name_en}
                  </strong>
                </div>
                <div style={{ background: "var(--card-subtle, #f9fafb)", padding: 10, borderRadius: 10 }}>
                  <span style={{ color: "var(--muted)", display: "block", fontSize: 11 }}>{locale === "th" ? "ช่องจอด" : "Parking Slot"}</span>
                  <strong style={{ fontSize: 13 }}>
                    {viewingBooking.parking_slots?.slot_code || viewingBooking.parking_slot_id || (locale === "th" ? "พื้นที่รวม (ไม่ระบุช่อง)" : "Area Only")}
                  </strong>
                </div>
                <div style={{ background: "var(--card-subtle, #f9fafb)", padding: 10, borderRadius: 10 }}>
                  <span style={{ color: "var(--muted)", display: "block", fontSize: 11 }}>{locale === "th" ? "วันที่จอง" : "Booking Date"}</span>
                  <strong style={{ fontSize: 13 }}>{viewingBooking.booking_date}</strong>
                </div>
                <div style={{ background: "var(--card-subtle, #f9fafb)", padding: 10, borderRadius: 10 }}>
                  <span style={{ color: "var(--muted)", display: "block", fontSize: 11 }}>{locale === "th" ? "ช่วงเวลา" : "Time Window"}</span>
                  <strong style={{ fontSize: 13 }}>
                    {formatTime(viewingBooking.starts_at)} – {formatTime(viewingBooking.ends_at)}
                  </strong>
                </div>
                <div style={{ background: "var(--card-subtle, #f9fafb)", padding: 10, borderRadius: 10, gridColumn: "span 2" }}>
                  <span style={{ color: "var(--muted)", display: "block", fontSize: 11 }}>{locale === "th" ? "ทะเบียนรถที่ใช้" : "Vehicle Plate"}</span>
                  <strong style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                    <Car size={14} />
                    {viewingBooking.vehicle_snapshot?.plate || viewingBooking.vehicle_snapshot?.plate_number || (locale === "th" ? "ไม่ระบุทะเบียน" : "Not specified")}
                  </strong>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                <a
                  className="secondary-button"
                  href={`https://www.google.com/maps/search/?api=1&query=${viewingBooking.parking_areas?.latitude || 16.2425},${viewingBooking.parking_areas?.longitude || 103.247}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <Navigation size={14} />
                  <span>{locale === "th" ? "นำทาง" : "Navigate"}</span>
                </a>
                <div style={{ display: "flex", gap: 8 }}>
                  <Link
                    className="primary-button"
                    href={`/${locale}/app/bookings`}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <QrCode size={14} />
                    <span>{locale === "th" ? "ดู QR Pass" : "Open QR Pass"}</span>
                  </Link>
                  <button className="secondary-button" type="button" onClick={() => setViewingBooking(null)}>
                    {locale === "th" ? "ปิด" : "Close"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Pagination Bar */}
        {totalBookingPages > 1 ? (
          <div className="pagination-bar" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
            <button
              className="secondary-button small-button"
              type="button"
              disabled={bookingPage <= 1}
              onClick={() => setBookingPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              {locale === "th" ? `หน้า ${bookingPage} / ${totalBookingPages}` : `Page ${bookingPage} of ${totalBookingPages}`} ({filteredBookings.length} {locale === "th" ? "รายการ" : "items"})
            </span>
            <button
              className="secondary-button small-button"
              type="button"
              disabled={bookingPage >= totalBookingPages}
              onClick={() => setBookingPage((p) => Math.min(totalBookingPages, p + 1))}
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        ) : null}
      </section>

      {cropperSrc ? (
        <ImageCropperModal
          imageSrc={cropperSrc}
          aspectRatio={1}
          circularCrop={true}
          locale={locale}
          onConfirm={handleCropperConfirm}
          onCancel={() => setCropperSrc(null)}
        />
      ) : null}
    </div>
  );
}

function roleLabel(t: ReturnType<typeof getCopy>, role: Role) {
  if (role === "admin") return t.admin;
  if (role === "staff") return t.staff;
  return t.userRole;
}

function bookingStatusLabel(status: string, locale: Locale) {
  const s = status.toUpperCase();
  if (locale === "th") {
    switch (s) {
      case "PENDING":
        return "รอดำเนินการ";
      case "CONFIRMED":
        return "ยืนยันแล้ว";
      case "RESERVED":
        return "จองแล้ว";
      case "CHECKED_IN":
        return "กำลังใช้งาน";
      case "COMPLETED":
        return "เสร็จสิ้น";
      case "CANCELLED":
        return "ยกเลิกแล้ว";
      case "NO_SHOW":
        return "ไม่มาใช้บริการ";
      case "OVERSTAY":
        return "จอดเกินเวลา";
      default:
        return status;
    }
  }
  switch (s) {
    case "PENDING":
      return "Pending";
    case "CONFIRMED":
      return "Confirmed";
    case "RESERVED":
      return "Reserved";
    case "CHECKED_IN":
      return "Checked In";
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
    case "NO_SHOW":
      return "No Show";
    case "OVERSTAY":
      return "Overstay";
    default:
      return status;
  }
}

function bookingStatusClass(status: string): string {
  const s = status.toUpperCase();
  if (s === "PENDING") return "pending";
  if (s === "CONFIRMED" || s === "RESERVED") return "reserved";
  if (s === "CHECKED_IN") return "occupied";
  if (s === "COMPLETED") return "available";
  return "closed";
}

function formatTime(isoStr: string) {
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return isoStr;
  }
}

function avatarExtension(file: File) {
  const fromType = file.type.split("/")[1]?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return fromType || file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
}
