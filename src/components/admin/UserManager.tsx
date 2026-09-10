"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  EyeOff,
  Filter,
  History,
  KeyRound,
  LoaderCircle,
  Lock,
  Mail,
  Save,
  Search,
  Send,
  Shield,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserRound,
  UserX,
  X,
} from "lucide-react";
import { useNotifications } from "@/components/layout/NotificationProvider";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { logAdminAudit } from "@/lib/admin/audit";

type ManagerRole = "admin";
type ManagedRole = "admin" | "staff" | "user";
type DatabaseRole = "admin" | "staff" | "student" | "personnel" | "visitor" | "guest";
type RoleFilter = "all" | ManagedRole;

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

type RoleRow = { user_id: string; role: DatabaseRole };
type UserRecord = ProfileRow & { roles: DatabaseRole[] };
type AuditHistoryRow = { id: string; action: string; actor_type: string | null; entity_type: string | null; result: string | null; created_at: string };
type BookingHistoryRow = { id: string; reference: string; status: string; booking_date: string; starts_at: string; ends_at: string; created_at: string };
type SessionHistoryRow = { id: string; status: string; check_in_at: string | null; check_out_at: string | null; created_at: string };
type AccountHistory = { audits: AuditHistoryRow[]; bookings: BookingHistoryRow[]; sessions: SessionHistoryRow[] };

type DeletionRequestRow = {
  id: string;
  user_id: string;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  created_at: string;
  profiles?: { id: string; email: string | null; full_name: string | null; user_type: string | null };
};

const profileFields = "id, email, full_name, university_id, faculty, major, department, phone, user_type, preferred_locale, created_at";
const managedRoleOrder: ManagedRole[] = ["admin", "staff", "user"];
const quickRoles: ManagedRole[] = ["admin", "staff", "user"];

export const SUPER_ADMIN_EMAIL = "68011211206@msu.ac.th";
export function isSuperAdminEmail(email?: string | null): boolean {
  return (email || "").trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}

function getManagedRoles(user: Pick<UserRecord, "roles" | "user_type">): ManagedRole[] {
  const elevated = managedRoleOrder.filter(
    (candidate): candidate is Exclude<ManagedRole, "user"> =>
      candidate !== "user" && user.roles.includes(candidate as DatabaseRole),
  );
  if (elevated.length) return elevated;
  if (user.user_type === "admin") return ["admin"];
  if (user.user_type === "staff") return ["staff"];
  return ["user"];
}

function toDatabaseRoles(roles: ManagedRole[]): DatabaseRole[] {
  return roles.filter((item): item is Exclude<ManagedRole, "user"> => item !== "user");
}

function roleLabel(role: ManagedRole, locale: Locale) {
  if (locale === "en") return role === "user" ? "User" : `${role.charAt(0).toUpperCase()}${role.slice(1)}`;
  return {
    admin: "ผู้ดูแลระบบ",
    staff: "เจ้าหน้าที่",
    user: "ผู้ใช้",
  }[role];
}

function roleFullLabel(role: ManagedRole, locale: Locale) {
  if (locale === "en") {
    return {
      admin: "Administrator",
      staff: "Staff",
      user: "User",
    }[role];
  }
  return {
    admin: "ผู้ดูแลระบบ (Admin)",
    staff: "เจ้าหน้าที่ (Staff)",
    user: "ผู้ใช้ทั่วไป (User)",
  }[role];
}

export function UserManager({ locale, role = "admin" }: { locale: Locale; role?: "admin" }) {
  const t = getCopy(locale);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState({ full_name: "", university_id: "", faculty: "", major: "", department: "", phone: "" });
  const [roleToGrant, setRoleToGrant] = useState<ManagedRole>("staff");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [activeTab, setActiveTab] = useState<"users" | "deletions">("users");
  const [deletionRequests, setDeletionRequests] = useState<DeletionRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [userPage, setUserPage] = useState(1);
  const pageSize = 15;
  const [history, setHistory] = useState<AccountHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [adminNewPassword, setAdminNewPassword] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [passwordManaging, setPasswordManaging] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [demoStaffEnabled, setDemoStaffEnabled] = useState(true);
  const [demoAdminEnabled, setDemoAdminEnabled] = useState(true);
  const [demoTogglingStaff, setDemoTogglingStaff] = useState(false);
  const [demoTogglingAdmin, setDemoTogglingAdmin] = useState(false);
  const { confirm, notify } = useNotifications();

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedId) ?? null,
    [selectedId, users],
  );
  const selectedRoles = useMemo(
    () => (selectedUser ? getManagedRoles(selectedUser) : []),
    [selectedUser],
  );
  const roleCounts = useMemo(
    () => Object.fromEntries(managedRoleOrder.map((item) => [item, users.filter((user) => getManagedRoles(user).includes(item)).length])) as Record<ManagedRole, number>,
    [users],
  );
  const filteredUsers = useMemo(() => {
    const normalizedQuery = userQuery.trim().toLowerCase();
    return users.filter((user) => {
      const roles = getManagedRoles(user);
      if (roleFilter !== "all" && !roles.includes(roleFilter)) return false;
      if (!normalizedQuery) return true;
      return [
        user.full_name,
        user.email,
        user.university_id,
        user.faculty,
        user.major,
        user.department,
        user.phone,
        user.user_type,
        ...roles,
        ...roles.map((item) => roleLabel(item, locale)),
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [locale, roleFilter, userQuery, users]);

  const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, userPage]);

  const loadUsers = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setMessage(`${t.accountNotConfigured} / ${t.accountNotConfiguredEn}`);
      return;
    }
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const [profilesResult, rolesResult] = await Promise.allSettled([
        supabase.from("profiles").select(profileFields).order("created_at", { ascending: false }).limit(500),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      let profileData: ProfileRow[] = [];
      if (profilesResult.status === "fulfilled" && !profilesResult.value.error) {
        profileData = (profilesResult.value.data ?? []) as ProfileRow[];
      }

      const rolesByUser = new Map<string, DatabaseRole[]>();
      if (rolesResult.status === "fulfilled" && !rolesResult.value.error) {
        for (const item of (rolesResult.value.data ?? []) as RoleRow[]) {
          const rawRole = String(item.role).toLowerCase();
          const cleanRole = (rawRole === "developer" ? "admin" : item.role) as DatabaseRole;
          rolesByUser.set(item.user_id, [...(rolesByUser.get(item.user_id) ?? []), cleanRole]);
        }
      }

      setUsers(profileData.map((profile) => {
        let assigned = rolesByUser.get(profile.id) ?? [];
        if (assigned.length === 0 && profile.user_type) {
          const ut = profile.user_type.toLowerCase();
          if (ut === "admin" || ut === "developer") assigned = ["admin"];
          else if (ut === "staff") assigned = ["staff"];
        }
        return {
          ...profile,
          roles: assigned,
        };
      }));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.operationalData);
    } finally {
      setLoading(false);
    }
  }, [t.accountNotConfigured, t.accountNotConfiguredEn, t.operationalData]);

  const loadDeletionRequests = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const res = await fetch("/api/admin/users/deletion-requests");
      if (res.ok) {
        const data = await res.json();
        setDeletionRequests(data.requests ?? []);
      }
    } catch {
      // Safe fallback
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadUsers();
      void loadDeletionRequests();
      // Load demo account config
      void fetch("/api/admin/demo-accounts")
        .then((r) => r.json())
        .then((cfg: { staffEnabled?: boolean; adminEnabled?: boolean }) => {
          if (typeof cfg.staffEnabled === "boolean") setDemoStaffEnabled(cfg.staffEnabled);
          if (typeof cfg.adminEnabled === "boolean") setDemoAdminEnabled(cfg.adminEnabled);
        })
        .catch(() => {});
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadUsers, loadDeletionRequests]);

  const loadHistory = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured()) return;
    setHistoryLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      // Fetch bookings and sessions in parallel with audit logs via server API
      const [auditRes, bookingResult, sessionResult] = await Promise.all([
        fetch(`/api/admin/audit-logs?q=${encodeURIComponent(userId)}&pageSize=25`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).catch(() => null),
        supabase.from("bookings").select("id, reference, status, booking_date, starts_at, ends_at, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(25),
        supabase.from("parking_sessions").select("id, status, check_in_at, check_out_at, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(25),
      ]);

      let auditsData: AuditHistoryRow[] = [];
      if (auditRes && auditRes.ok) {
        try {
          const auditJson = await auditRes.json();
          auditsData = (auditJson.logs ?? []) as AuditHistoryRow[];
        } catch {
          // ignore
        }
      }

      setHistory({
        audits: auditsData,
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

  async function handleDeleteUserDirect(targetUser: UserRecord) {
    if (isSuperAdminEmail(targetUser.email)) {
      notify({
        title: locale === "th" ? "ไม่อนุญาตให้ลบบัญชี" : "Cannot Delete",
        message: locale === "th" ? "บัญชีผู้ดูแลระบบหลัก (Super Admin) ได้รับการคุ้มครองถาวร ไม่สามารถลบได้" : "Primary Super Admin account is protected from deletion.",
        kind: "error",
      });
      return;
    }

    const emailLower = (targetUser.email || "").toLowerCase();
    if (emailLower === "staff@msu.ac.th" || emailLower === "admin@msu.ac.th") {
      notify({
        title: locale === "th" ? "ไม่อนุญาตให้ลบบัญชี" : "Cannot Delete",
        message: locale === "th"
          ? `บัญชี ${emailLower} เป็นบัญชีระบบส่วนกลาง ได้รับการคุ้มครองถาวร ไม่สามารถลบได้`
          : `${emailLower} is a protected system account and cannot be deleted.`,
        kind: "error",
      });
      return;
    }

    if (getManagedRoles(targetUser).includes("admin") && roleCounts.admin <= 1) {
      notify({
        title: locale === "th" ? "ไม่สามารถลบได้" : "Cannot delete",
        message: locale === "th" ? "ต้องมี Admin อย่างน้อยหนึ่งคนในระบบ" : "At least one Admin must remain.",
        kind: "warning",
      });
      return;
    }

    const confirmed = await confirm({
      title: locale === "th" ? `ยืนยันการลบบัญชีผู้ใช้` : `Confirm Account Deletion`,
      message: locale === "th"
        ? `คุณต้องการลบบัญชี ${targetUser.full_name || targetUser.email || targetUser.id} ออกจากระบบอย่างถาวรหรือไม่?`
        : `Permanently delete account ${targetUser.email || targetUser.full_name || targetUser.id}?`,
      confirmLabel: locale === "th" ? "ยืนยันลบบัญชี" : "Delete Account",
      cancelLabel: t.close,
      danger: true,
    });
    if (!confirmed) return;

    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch("/api/admin/users/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          target_user_id: targetUser.id,
        }),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to delete user");

      notify({
        title: locale === "th" ? "ลบบัญชีผู้ใช้สำเร็จ" : "User Deleted",
        message: targetUser.email || targetUser.full_name || targetUser.id,
        kind: "success",
      });

      if (selectedId === targetUser.id) {
        setSelectedId(null);
      }
      await loadUsers();
    } catch (err) {
      notify({
        title: locale === "th" ? "เกิดข้อผิดพลาดในการลบ" : "Delete Error",
        message: err instanceof Error ? err.message : "Failed to delete user",
        kind: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleAdminSetPassword(userId: string) {
    if (!adminNewPassword || adminNewPassword.length < 8) {
      notify({
        title: locale === "th" ? "รหัสผ่านสั้นเกินไป" : "Password too short",
        message: locale === "th" ? "รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร" : "Password must be at least 8 characters",
        kind: "warning",
      });
      return;
    }

    setPasswordManaging(true);
    setPasswordMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch("/api/admin/users/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          target_user_id: userId,
          action: "set_password",
          password: adminNewPassword,
        }),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to set password");

      notify({
        title: locale === "th" ? "เปลี่ยนรหัสผ่านให้ผู้ใช้เรียบร้อยแล้ว" : "Password Updated",
        message: locale === "th" ? "ผู้ใช้สามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่นี้ได้ทันที" : "User can now sign in with this new password.",
        kind: "success",
      });
      setPasswordMessage(locale === "th" ? "เปลี่ยนรหัสผ่านใหม่เรียบร้อยแล้ว" : "Password updated successfully.");
      setAdminNewPassword("");
      await loadHistory(userId);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Failed to update password";
      notify({
        title: locale === "th" ? "เปลี่ยนรหัสผ่านไม่สำเร็จ" : "Failed to update password",
        message: detail,
        kind: "error",
      });
      setPasswordMessage(detail);
    } finally {
      setPasswordManaging(false);
    }
  }

  async function handleAdminSendResetEmail(user: UserRecord) {
    if (!user.email) {
      notify({
        title: locale === "th" ? "ไม่พบอีเมล" : "No email found",
        message: locale === "th" ? "ผู้ใช้รายนี้ไม่มีอีเมลในระบบ" : "User has no email associated",
        kind: "warning",
      });
      return;
    }

    const confirmed = await confirm({
      title: locale === "th" ? "ส่งอีเมลรีเซ็ตรหัสผ่าน" : "Send Password Reset Email",
      message: locale === "th"
        ? `ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ไปยังอีเมล ${user.email}`
        : `A password reset link will be dispatched to ${user.email}`,
      confirmLabel: locale === "th" ? "ส่งอีเมลทันที" : "Send Email",
      cancelLabel: t.close,
    });
    if (!confirmed) return;

    setPasswordManaging(true);
    setPasswordMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch("/api/admin/users/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          target_user_id: user.id,
          action: "send_reset_email",
          email: user.email,
        }),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to send reset email");

      notify({
        title: locale === "th" ? "ส่งอีเมลรีเซ็ตรหัสผ่านแล้ว" : "Reset Email Sent",
        message: user.email,
        kind: "success",
      });
      setPasswordMessage(locale === "th" ? `ส่งลิงก์รีเซ็ตรหัสผ่านไปยัง ${user.email} เรียบร้อยแล้ว` : `Reset link sent to ${user.email}`);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Failed to send email";
      notify({
        title: locale === "th" ? "ส่งอีเมลไม่สำเร็จ" : "Failed to send email",
        message: detail,
        kind: "error",
      });
      setPasswordMessage(detail);
    } finally {
      setPasswordManaging(false);
    }
  }

  async function audit(action: string, userId: string, metadata: Record<string, unknown>) {
    await logAdminAudit({
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
      setMessage(locale === "th" ? "บันทึกข้อมูลผู้ใช้แล้ว" : "User profile saved.");
      notify({ title: t.save, kind: "success" });
      await loadHistory(selectedUser.id);
    } catch (error) {
      const detail = error instanceof Error ? error.message : t.operationalData;
      setMessage(detail);
      notify({ title: t.operationalData, message: detail, kind: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function applyRoles(user: UserRecord, requestedRoles: ManagedRole[], successMessage: string) {
    if (!isSupabaseConfigured()) return;
    if (isSuperAdminEmail(user.email)) {
      notify({
        title: locale === "th" ? "ไม่อนุญาตให้เปลี่ยนยศ" : "Cannot Change Role",
        message: locale === "th" ? `บัญชี ${SUPER_ADMIN_EMAIL} เป็น Admin หลัก (Super Admin) ได้รับการคุ้มครองถาวร ไม่สามารถปลดหรือเปลี่ยนยศได้` : "Primary Super Admin role cannot be modified.",
        kind: "error",
      });
      return;
    }

    const normalizedRoles = managedRoleOrder.filter((item) => requestedRoles.includes(item));
    const currentRoles = getManagedRoles(user);
    const removesAdmin = currentRoles.includes("admin") && !normalizedRoles.includes("admin");
    if (removesAdmin && roleCounts.admin <= 1) {
      setMessage(locale === "th" ? "ต้องมี Admin อย่างน้อยหนึ่งบัญชี" : "At least one Admin account must remain.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      let saved = false;
      if (token) {
        try {
          const res = await fetch("/api/admin/users/roles", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              target_user_id: user.id,
              roles: normalizedRoles,
            }),
          });
          if (res.ok) {
            saved = true;
          }
        } catch {
          // fallback
        }
      }

      if (!saved) {
        // Fallback: direct Supabase RPC or table update
        const { error: rpcErr } = await supabase.rpc("manage_user_roles", {
          p_user_id: user.id,
          p_roles: normalizedRoles,
        });
        if (rpcErr) {
          const dbRoles = toDatabaseRoles(normalizedRoles);
          await supabase.from("user_roles").delete().eq("user_id", user.id);
          if (dbRoles.length > 0) {
            const rowsToInsert = dbRoles.map((r) => ({ user_id: user.id, role: r }));
            await supabase.from("user_roles").insert(rowsToInsert);
          }
        }
        await supabase.from("profiles").update({ user_type: normalizedRoles[0] || "user" }).eq("id", user.id);
      }

      setUsers((current) => current.map((item) => item.id === user.id ? {
        ...item,
        roles: toDatabaseRoles(normalizedRoles),
        user_type: normalizedRoles[0] || "user",
      } : item));

      setMessage(successMessage);
      notify({ title: successMessage, kind: "success" });
      if (selectedId === user.id) await loadHistory(user.id);
    } catch (error) {
      const detail = error instanceof Error ? error.message : t.operationalData;
      setMessage(detail);
      notify({ title: t.operationalData, message: detail, kind: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickRole(user: UserRecord, targetRole: ManagedRole) {
    if (getManagedRoles(user).includes(targetRole) && getManagedRoles(user).length === 1) return;
    await applyRoles(
      user,
      [targetRole],
      locale === "th" ? `เปลี่ยนยศเป็น ${roleFullLabel(targetRole, locale)} แล้ว` : `Role set to ${roleFullLabel(targetRole, locale)}.`,
    );
  }

  async function grantRole(user: UserRecord) {
    const currentRoles = getManagedRoles(user);
    if (currentRoles.includes(roleToGrant)) return;
    if (roleToGrant === "user") {
      const confirmed = await confirm({
        title: locale === "th" ? "เปลี่ยนเป็น User" : "Replace with User",
        message: locale === "th" ? "สิทธิ์ยกระดับเดิมทั้งหมดจะถูกถอน" : "All existing elevated roles will be revoked.",
        confirmLabel: locale === "th" ? "ยืนยัน" : "Confirm",
        cancelLabel: t.close,
        danger: true,
      });
      if (!confirmed) return;
      await applyRoles(user, ["user"], locale === "th" ? "เปลี่ยนเป็น User แล้ว" : "Replaced with User.");
      return;
    }
    const nextRoles = [...currentRoles.filter((item) => item !== "user"), roleToGrant];
    await applyRoles(user, nextRoles, locale === "th" ? `เพิ่มยศ ${roleLabel(roleToGrant, locale)} แล้ว` : `${roleLabel(roleToGrant, locale)} granted.`);
  }

  async function replaceRole(user: UserRecord) {
    const currentRoles = getManagedRoles(user);
    if (currentRoles.length === 1 && currentRoles[0] === roleToGrant) return;
    const confirmed = await confirm({
      title: locale === "th" ? "แทนที่ยศทั้งหมด" : "Replace all roles",
      message: `${user.email ?? user.id} → ${roleLabel(roleToGrant, locale)}`,
      confirmLabel: locale === "th" ? "แทนที่ยศ" : "Replace roles",
      cancelLabel: t.close,
      danger: currentRoles.includes("admin") && roleToGrant !== "admin",
    });
    if (!confirmed) return;
    await applyRoles(user, [roleToGrant], locale === "th" ? "แทนที่ยศแล้ว" : "Roles replaced.");
  }

  async function revokeRole(user: UserRecord, revokedRole: ManagedRole) {
    if (revokedRole === "user") {
      setMessage(locale === "th" ? "User เป็นสิทธิ์พื้นฐาน กรุณาเพิ่มหรือแทนที่ด้วยยศอื่น" : "User is the baseline role. Grant or replace it with another role.");
      return;
    }
    const confirmed = await confirm({
      title: locale === "th" ? "ถอนยศ" : "Revoke role",
      message: `${roleLabel(revokedRole, locale)} · ${user.email ?? user.id}`,
      confirmLabel: locale === "th" ? "ถอนยศ" : "Revoke",
      cancelLabel: t.close,
      danger: true,
    });
    if (!confirmed) return;
    const remainingRoles = getManagedRoles(user).filter((item) => item !== revokedRole);
    await applyRoles(user, remainingRoles.length ? remainingRoles : ["user"], locale === "th" ? `ถอนยศ ${roleLabel(revokedRole, locale)} แล้ว` : `${roleLabel(revokedRole, locale)} revoked.`);
  }

  async function handleDeletionRequest(userId: string, action: "approve" | "reject") {
    const isApprove = action === "approve";
    const confirmed = await confirm({
      title: isApprove ? (locale === "th" ? "ยืนยันการลบบัญชีผู้ใช้" : "Confirm Account Deletion") : (locale === "th" ? "ปฏิเสธคำขอลบบัญชี" : "Reject Deletion Request"),
      message: isApprove
        ? (locale === "th" ? "ข้อมูลโปรไฟล์และสิทธิ์ของผู้ใช้จะถูกลบและยกเลิกอย่างถาวร" : "Profile and access will be permanently wiped.")
        : (locale === "th" ? "ปฏิเสธคำขอลบ บัญชีจะยังคงใช้งานได้ตามปกติ" : "Request will be rejected and account retained."),
      confirmLabel: isApprove ? (locale === "th" ? "อนุมัติการลบ" : "Approve Delete") : (locale === "th" ? "ปฏิเสธ" : "Reject"),
      cancelLabel: t.close,
      danger: isApprove,
    });
    if (!confirmed) return;

    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch("/api/admin/users/deletion-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          user_id: userId,
        }),
      });

      if (!res.ok) throw new Error("Failed to process deletion request");

      notify({
        title: isApprove ? (locale === "th" ? "ลบบัญชีเรียบร้อยแล้ว" : "Account Deleted") : (locale === "th" ? "ปฏิเสธคำขอแล้ว" : "Request Rejected"),
        kind: "success",
      });

      await loadDeletionRequests();
      await loadUsers();
      if (selectedId === userId) {
        setSelectedId(null);
      }
    } catch (err) {
      notify({
        title: t.operationalData,
        message: err instanceof Error ? err.message : "Error",
        kind: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  const pendingDeletions = deletionRequests.filter((r) => r.status === "PENDING");

  return (
    <div className="user-manager-page">
      <div className="section-heading">
        <div>
          <h2>{t.manageUsers}</h2>
          <p className="page-subtitle">
            {locale === "th"
              ? "จัดการบัญชีผู้ใช้งาน สิทธิ์การเข้าถึง (Admin, Staff, User) และคำขอลบบัญชี"
              : "Manage user accounts, RBAC permissions (Admin, Staff, User), and account deletion requests."}
          </p>
        </div>
        <span className="data-badge"><ShieldCheck size={13} />{t.admin}</span>
      </div>

      {/* Demo Accounts Access Control Panel */}
      <div
        style={{
          margin: "14px 0",
          padding: "14px 18px",
          borderRadius: 16,
          border: "1.5px solid #e2e8f0",
          background: "linear-gradient(135deg, #f8fafc, #f1f5f9)",
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 14, color: "#334155" }}>
          🎛️ {locale === "th" ? "ควบคุมการเข้าถึงบัญชีสาธิต" : "Demo Accounts Access Control"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {/* Staff toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              borderRadius: 12,
              background: demoStaffEnabled ? "#dcfce7" : "#fee2e2",
              border: `1px solid ${demoStaffEnabled ? "#86efac" : "#fca5a5"}`,
              transition: "all 0.3s ease",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: demoStaffEnabled ? "#166534" : "#991b1b" }}>
              <div>📋 staff@msu.ac.th</div>
              <div style={{ fontWeight: 600, fontSize: 11, opacity: 0.8 }}>
                {demoStaffEnabled
                  ? (locale === "th" ? "🟢 เปิดใช้งาน" : "🟢 Enabled")
                  : (locale === "th" ? "🔴 ปิดการเข้าสู่ระบบ" : "🔴 Disabled")}
              </div>
            </div>
            <button
              type="button"
              disabled={demoTogglingStaff}
              onClick={async () => {
                setDemoTogglingStaff(true);
                try {
                  const supabase = createSupabaseBrowserClient();
                  const { data: sd } = await supabase.auth.getSession();
                  const token = sd.session?.access_token;
                  const res = await fetch("/api/admin/demo-accounts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ staffEnabled: !demoStaffEnabled }),
                  });
                  if (res.ok) {
                    setDemoStaffEnabled(!demoStaffEnabled);
                    notify({ title: locale === "th" ? "อัปเดตการเข้าถึงสำเร็จ" : "Access Updated", kind: "success" });
                  } else {
                    const d = await res.json().catch(() => ({}));
                    notify({ title: locale === "th" ? "ไม่สำเร็จ" : "Failed", message: (d as { error?: string }).error || "", kind: "error" });
                  }
                } catch {
                  notify({ title: locale === "th" ? "เกิดข้อผิดพลาด" : "Error", kind: "error" });
                } finally {
                  setDemoTogglingStaff(false);
                }
              }}
              style={{
                width: 48,
                height: 26,
                borderRadius: 13,
                border: "none",
                background: demoStaffEnabled ? "#22c55e" : "#d1d5db",
                position: "relative",
                cursor: demoTogglingStaff ? "not-allowed" : "pointer",
                transition: "background 0.3s ease",
                opacity: demoTogglingStaff ? 0.6 : 1,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 3,
                  left: demoStaffEnabled ? 24 : 3,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "#fff",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                  transition: "left 0.3s ease",
                }}
              />
            </button>
          </div>

          {/* Admin toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              borderRadius: 12,
              background: demoAdminEnabled ? "#dbeafe" : "#fee2e2",
              border: `1px solid ${demoAdminEnabled ? "#93c5fd" : "#fca5a5"}`,
              transition: "all 0.3s ease",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: demoAdminEnabled ? "#1e40af" : "#991b1b" }}>
              <div>🎭 admin@msu.ac.th</div>
              <div style={{ fontWeight: 600, fontSize: 11, opacity: 0.8 }}>
                {demoAdminEnabled
                  ? (locale === "th" ? "🟢 เปิดใช้งาน" : "🟢 Enabled")
                  : (locale === "th" ? "🔴 ปิดการเข้าสู่ระบบ" : "🔴 Disabled")}
              </div>
            </div>
            <button
              type="button"
              disabled={demoTogglingAdmin}
              onClick={async () => {
                setDemoTogglingAdmin(true);
                try {
                  const supabase = createSupabaseBrowserClient();
                  const { data: sd } = await supabase.auth.getSession();
                  const token = sd.session?.access_token;
                  const res = await fetch("/api/admin/demo-accounts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ adminEnabled: !demoAdminEnabled }),
                  });
                  if (res.ok) {
                    setDemoAdminEnabled(!demoAdminEnabled);
                    notify({ title: locale === "th" ? "อัปเดตการเข้าถึงสำเร็จ" : "Access Updated", kind: "success" });
                  } else {
                    const d = await res.json().catch(() => ({}));
                    notify({ title: locale === "th" ? "ไม่สำเร็จ" : "Failed", message: (d as { error?: string }).error || "", kind: "error" });
                  }
                } catch {
                  notify({ title: locale === "th" ? "เกิดข้อผิดพลาด" : "Error", kind: "error" });
                } finally {
                  setDemoTogglingAdmin(false);
                }
              }}
              style={{
                width: 48,
                height: 26,
                borderRadius: 13,
                border: "none",
                background: demoAdminEnabled ? "#3b82f6" : "#d1d5db",
                position: "relative",
                cursor: demoTogglingAdmin ? "not-allowed" : "pointer",
                transition: "background 0.3s ease",
                opacity: demoTogglingAdmin ? 0.6 : 1,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 3,
                  left: demoAdminEnabled ? 24 : 3,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "#fff",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                  transition: "left 0.3s ease",
                }}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="tab-row" style={{ display: "flex", gap: 10, margin: "16px 0", borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
        <button
          type="button"
          className={`chip ${activeTab === "users" ? "active" : ""}`}
          onClick={() => setActiveTab("users")}
          style={{ cursor: "pointer", fontWeight: 700 }}
        >
          <UserRound size={14} />
          <span>{locale === "th" ? "ผู้ใช้งานทั้งหมด" : "All Users"} ({users.length})</span>
        </button>
        <button
          type="button"
          className={`chip ${activeTab === "deletions" ? "active" : ""}`}
          onClick={() => setActiveTab("deletions")}
          style={{ cursor: "pointer", fontWeight: 700 }}
        >
          <UserX size={14} />
          <span>{locale === "th" ? "คำขอลบบัญชี" : "Deletion Requests"}</span>
          {pendingDeletions.length > 0 ? (
            <span style={{ background: "var(--red)", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 11, fontWeight: 800 }}>
              {pendingDeletions.length}
            </span>
          ) : null}
        </button>
      </div>

      {message ? <div className="form-note" role="status">{message}</div> : null}

      {activeTab === "deletions" ? (
        <section className="review-panel" style={{ marginTop: 12 }}>
          <div className="section-heading">
            <div>
              <h3>{locale === "th" ? "รายการคำขอลบบัญชีจากผู้ใช้" : "Account Deletion Requests"}</h3>
              <p className="page-subtitle">
                {locale === "th"
                  ? "เมื่อผู้ใช้งานส่งคำขอลบ จะมาปรากฏที่นี่เพื่อให้ Admin ตรวจสอบและยืนยันการลบ"
                  : "Requests submitted by users for admin approval."}
              </p>
            </div>
            <span className="count-pill">({deletionRequests.length})</span>
          </div>

          {deletionRequests.length === 0 ? (
            <div className="empty-card compact-empty" style={{ padding: 24, textAlign: "center" }}>
              <UserCheck size={32} color="#16a34a" style={{ margin: "0 auto 8px" }} />
              <p>{locale === "th" ? "ไม่มีคำขอลบบัญชีที่รอดำเนินการ" : "No pending deletion requests."}</p>
            </div>
          ) : (
            <div className="data-list" style={{ marginTop: 12 }}>
              {deletionRequests.map((req) => (
                <article className="data-list-item" key={req.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{req.profiles?.full_name || req.profiles?.email || req.user_id}</strong>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4, flexWrap: "wrap", fontSize: 12, color: "var(--muted)" }}>
                      <span>{req.profiles?.email || "—"}</span>
                      <span>· {locale === "th" ? "ส่งเมื่อ" : "Submitted"}: {formatDate(req.created_at, locale)}</span>
                      <span className={`status-badge ${req.status === "PENDING" ? "reserved" : req.status === "APPROVED" ? "closed" : "available"}`}>
                        {req.status === "PENDING" ? (locale === "th" ? "รอการอนุมัติ" : "Pending") : req.status}
                      </span>
                    </div>
                  </div>
                  {req.status === "PENDING" ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => void handleDeletionRequest(req.user_id, "reject")}
                        disabled={saving}
                        style={{ fontSize: 12, padding: "4px 10px" }}
                      >
                        {locale === "th" ? "ปฏิเสธ" : "Reject"}
                      </button>
                      <button
                        className="primary-button danger"
                        type="button"
                        onClick={() => void handleDeletionRequest(req.user_id, "approve")}
                        disabled={saving}
                        style={{ fontSize: 12, padding: "4px 12px", background: "var(--red)", borderColor: "var(--red)" }}
                      >
                        <Trash2 size={13} />
                        {locale === "th" ? "อนุมัติลบบัญชี" : "Approve Delete"}
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      ) : (
        <div className="user-manager-layout">
          <section className="review-panel data-list-panel">
            <div className="section-heading">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h2>{t.users}</h2>
                  <span className="count-pill">({filteredUsers.length})</span>
                </div>
                <p>{filteredUsers.length}/{users.length} · {t.noPrivateData}</p>
              </div>
            </div>

            <div className="inline-actions" style={{ marginTop: 12 }}>
              <div className="user-search-box" style={{ flex: "1 1 230px", margin: 0 }}>
                <Search size={16} />
                <input aria-label={t.searchAccounts} placeholder={t.searchAccounts} value={userQuery} onChange={(event) => { setUserQuery(event.target.value); setUserPage(1); }} />
              </div>
              <label className="user-search-box" style={{ flex: "0 1 185px", margin: 0 }}>
                <Filter size={16} />
                <select
                  aria-label={locale === "th" ? "กรองตามยศ" : "Filter by role"}
                  value={roleFilter}
                  onChange={(event) => { setRoleFilter(event.target.value as RoleFilter); setUserPage(1); }}
                  style={{ width: "100%", border: 0, outline: 0, background: "transparent", color: "inherit", font: "inherit" }}
                >
                  <option value="all">{locale === "th" ? "ทุกยศ" : "All roles"} ({users.length})</option>
                  {managedRoleOrder.map((item) => <option value={item} key={item}>{roleLabel(item, locale)} ({roleCounts[item]})</option>)}
                </select>
              </label>
            </div>

            {loading ? (
              <div className="inline-loading"><LoaderCircle size={18} className="spin" />{locale === "th" ? "กำลังโหลด" : "Loading"}</div>
            ) : paginatedUsers.length ? (
              <>
                <div className="data-list" style={{ marginTop: 12 }}>
                  {paginatedUsers.map((user) => (
                    <article
                      className={`data-list-item ${selectedId === user.id ? "selected" : ""}`}
                      key={user.id}
                      onClick={() => editUser(user)}
                      style={{ cursor: "pointer" }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong>{user.full_name || user.email || user.university_id || user.id}</strong>
                        <small>
                          {user.email || user.university_id || "—"}
                          {user.user_type ? ` · ${user.user_type}` : ""}
                        </small>
                        <div className="role-chip-list">
                          {isSuperAdminEmail(user.email) ? (
                            <span
                              className="role-chip admin"
                              style={{
                                background: "linear-gradient(135deg, #fef3c7, #fde68a)",
                                color: "#78350f",
                                border: "1px solid #f59e0b",
                                fontWeight: 800,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                              title="Admin หลัก (Super Admin) - คุ้มครองถาวร"
                            >
                              👑 Admin หลัก (Super Admin)
                            </span>
                          ) : (
                            getManagedRoles(user).map((userRole) => (
                              <span
                                className={`role-chip ${userRole}`}
                                key={userRole}
                                title={roleFullLabel(userRole, locale)}
                              >
                                {roleLabel(userRole, locale)}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="data-list-actions">
                        <button
                          className="icon-button"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            editUser(user);
                          }}
                          aria-label={`${t.edit} ${user.email ?? user.id}`}
                          title={t.edit}
                        >
                          <Edit3 size={15} />
                        </button>
                        {isSuperAdminEmail(user.email) ? (
                          <span
                            title={locale === "th" ? "Admin หลัก ไม่สามารถลบได้" : "Super Admin cannot be deleted"}
                            style={{ opacity: 0.3, cursor: "not-allowed", display: "inline-flex", padding: 6 }}
                          >
                            <Trash2 size={15} />
                          </span>
                        ) : (
                          <button
                            className="icon-button"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDeleteUserDirect(user);
                            }}
                            aria-label={`Delete ${user.email ?? user.id}`}
                            title={locale === "th" ? "ลบบัญชีผู้ใช้นี้" : "Delete user"}
                            style={{ color: "var(--red)" }}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>

                {totalUserPages > 1 ? (
                  <div className="pagination-bar" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                    <button
                      className="secondary-button small-button"
                      type="button"
                      disabled={userPage <= 1}
                      onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>
                      {locale === "th" ? `หน้า ${userPage} / ${totalUserPages}` : `Page ${userPage} of ${totalUserPages}`} ({filteredUsers.length} {t.users})
                    </span>
                    <button
                      className="secondary-button small-button"
                      type="button"
                      disabled={userPage >= totalUserPages}
                      onClick={() => setUserPage((p) => Math.min(totalUserPages, p + 1))}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="empty-card compact-empty"><div><UserRound size={24} /><h2>{users.length ? t.noResults : t.noRecords}</h2></div></div>
            )}
          </section>

          <section className="data-editor-card">
            {selectedUser ? (
              <>
                <div className="form-section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                    <UserRound size={22} />
                    <div style={{ minWidth: 0 }}>
                      <h2>{t.edit}</h2>
                      <p style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {selectedUser.full_name ? `${selectedUser.full_name} · ${selectedUser.email || selectedUser.id}` : selectedUser.email || selectedUser.id}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {isSuperAdminEmail(selectedUser.email) ? (
                      <span
                        title={locale === "th" ? "Admin หลัก ไม่สามารถลบได้" : "Super Admin cannot be deleted"}
                        style={{ opacity: 0.85, cursor: "not-allowed", fontSize: 11, padding: "5px 11px", display: "flex", alignItems: "center", gap: 5, border: "1px solid #f59e0b", borderRadius: 8, background: "#fef3c7", color: "#92400e", fontWeight: 700 }}
                      >
                        👑 Super Admin
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="secondary-button danger-button compact-btn"
                        onClick={() => void handleDeleteUserDirect(selectedUser)}
                        disabled={saving}
                        title={locale === "th" ? "ลบบัญชีผู้ใช้นี้" : "Delete user"}
                        style={{ fontSize: 11, padding: "5px 11px", display: "flex", alignItems: "center", gap: 5, border: "1px solid #fca5a5", color: "#dc2626" }}
                      >
                        <Trash2 size={13} />
                        <span>{locale === "th" ? "ลบบัญชีนี้" : "Delete"}</span>
                      </button>
                    )}
                    <button className="icon-button" type="button" onClick={() => { setSelectedId(null); setHistory(null); }} aria-label={t.cancel}><X size={16} /></button>
                  </div>
                </div>

                <div className="role-grant-box" style={{ borderTop: 0, paddingTop: 0 }}>
                  {isSuperAdminEmail(selectedUser.email) ? (
                    <div style={{ padding: "12px 16px", borderRadius: 12, background: "linear-gradient(135deg, #fef3c7, #fde68a)", border: "1px solid #f59e0b", color: "#78350f", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 10, margin: "12px 0" }}>
                      <span style={{ fontSize: 20 }}>👑</span>
                      <div>
                        <div>{locale === "th" ? "Admin หลัก (Super Admin) - คุ้มครองความปลอดภัยสูงสุด" : "Primary Super Admin Account"}</div>
                        <small style={{ fontWeight: 500, opacity: 0.9 }}>
                          {locale === "th" ? "บัญชีผู้ดูแลระบบหลักได้รับการคุ้มครองถาวร ไม่สามารถลบบัญชี หรือปลด/เปลี่ยนยศได้" : "This primary admin account is permanently protected from deletion and role modifications."}
                        </small>
                      </div>
                    </div>
                  ) : null}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <h3>{locale === "th" ? "ยศและสิทธิ์การใช้งาน" : "Roles and access"}</h3>
                      <p className="page-subtitle">{locale === "th" ? "สลับยศทันทีด้วยปุ่มด่วน หรือเพิ่ม/ถอนยศตามต้องการ" : "Switch roles quickly or manage role combinations below."}</p>
                    </div>
                    <div className="role-chip-list" aria-label={locale === "th" ? "ยศปัจจุบัน" : "Current roles"}>
                      {isSuperAdminEmail(selectedUser.email) ? (
                        <span className="role-chip admin" style={{ background: "linear-gradient(135deg, #fef3c7, #fde68a)", color: "#78350f", border: "1px solid #f59e0b", fontWeight: 800 }}>
                          👑 Super Admin
                        </span>
                      ) : (
                        selectedRoles.map((userRole) => (
                          <span className={`role-chip ${userRole}`} key={userRole}>
                            {roleLabel(userRole, locale)}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {!isSuperAdminEmail(selectedUser.email) ? (
                    <>
                      <div className="quick-role-section">
                    <span className="quick-role-label">
                      {locale === "th" ? "เปลี่ยนยศด่วน (Quick Role Assignment):" : "Quick Role Assignment:"}
                    </span>
                    <div className="quick-role-buttons" role="group" aria-label={locale === "th" ? "เปลี่ยนยศด่วน" : "Quick Role Buttons"}>
                      {quickRoles.map((targetRole) => {
                        const isCurrent = selectedRoles.includes(targetRole);
                        return (
                          <button
                            key={targetRole}
                            type="button"
                            className={`quick-role-button role-${targetRole} ${isCurrent ? "active" : ""}`}
                            onClick={() => void handleQuickRole(selectedUser, targetRole)}
                            disabled={saving}
                            aria-pressed={isCurrent}
                            title={isCurrent ? (locale === "th" ? "ยศปัจจุบัน" : "Current role") : (locale === "th" ? `สลับยศเป็น ${roleFullLabel(targetRole, locale)}` : `Switch role to ${roleFullLabel(targetRole, locale)}`)}
                          >
                            {targetRole === "admin" ? <ShieldCheck size={14} />
                              : targetRole === "staff" ? <Shield size={14} />
                              : <UserRound size={14} />}
                            <span>{roleFullLabel(targetRole, locale)}</span>
                            {isCurrent ? <span className="current-indicator"><Check size={11} strokeWidth={3} /> {locale === "th" ? "ปัจจุบัน" : "Active"}</span> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 6, marginTop: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                      <span className="quick-role-label">{locale === "th" ? "ยศที่มอบให้แล้ว (คลิก × เพื่อถอน):" : "Assigned roles (click × to revoke):"}</span>
                      <div className="role-chip-list">
                        {selectedRoles.map((userRole) => (
                          <button
                            className={`role-chip ${userRole}`}
                            type="button"
                            key={userRole}
                            onClick={() => void revokeRole(selectedUser, userRole)}
                            disabled={saving}
                            title={userRole === "user" ? (locale === "th" ? "สิทธิ์พื้นฐาน" : "Baseline role") : (locale === "th" ? "คลิกเพื่อถอนยศ" : "Click to revoke")}
                          >
                            {roleLabel(userRole, locale)}{userRole === "user" ? "" : " ×"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="inline-actions" style={{ marginTop: 4 }}>
                      <select className="form-control" value={roleToGrant} onChange={(event) => setRoleToGrant(event.target.value as ManagedRole)} aria-label={t.role}>
                        {managedRoleOrder.map((item) => <option value={item} key={item}>{roleFullLabel(item, locale)}</option>)}
                      </select>
                      <button className="secondary-button" type="button" onClick={() => void grantRole(selectedUser)} disabled={saving || selectedRoles.includes(roleToGrant)}>
                        {locale === "th" ? "เพิ่มยศรอง" : "Grant role"}
                      </button>
                      <button className="secondary-button" type="button" onClick={() => void replaceRole(selectedUser)} disabled={saving || (selectedRoles.length === 1 && selectedRoles[0] === roleToGrant)}>
                        {locale === "th" ? "แทนที่ทั้งหมด" : "Replace all"}
                      </button>
                    </div>
                  </div>

                  <p className="form-note" style={{ margin: "6px 0 0" }}>
                    {locale === "th"
                      ? "User คือสิทธิ์พื้นฐานและไม่รวมกับยศที่สูงกว่า ระบบจะไม่อนุญาตให้ถอน Admin คนสุดท้าย"
                      : "User is the baseline role and cannot be combined with elevated roles. The final Admin cannot be removed."}
                  </p>
                    </>
                  ) : null}
                </div>

                <form className="support-form" onSubmit={(event) => void saveProfile(event)} style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                  <div className="support-form-grid">
                    <div className="form-group"><label htmlFor="user-name">{t.name}</label><input id="user-name" className="form-control" value={profileDraft.full_name} onChange={(event) => updateDraft("full_name", event.target.value)} /></div>
                    <div className="form-group"><label htmlFor="user-id">{t.studentId}</label><input id="user-id" className="form-control" value={profileDraft.university_id} onChange={(event) => updateDraft("university_id", event.target.value)} /></div>
                    <div className="form-group"><label htmlFor="user-faculty">{locale === "th" ? "คณะ" : "Faculty"}</label><input id="user-faculty" className="form-control" value={profileDraft.faculty} onChange={(event) => updateDraft("faculty", event.target.value)} /></div>
                    <div className="form-group"><label htmlFor="user-major">{locale === "th" ? "สาขา" : "Major"}</label><input id="user-major" className="form-control" value={profileDraft.major} onChange={(event) => updateDraft("major", event.target.value)} /></div>
                    <div className="form-group"><label htmlFor="user-department">{locale === "th" ? "หน่วยงาน" : "Department"}</label><input id="user-department" className="form-control" value={profileDraft.department} onChange={(event) => updateDraft("department", event.target.value)} /></div>
                    <div className="form-group">
                      <label htmlFor="user-phone">{t.phone}</label>
                      <input
                        id="user-phone"
                        className="form-control"
                        type="tel"
                        maxLength={10}
                        placeholder="08XXXXXXXX"
                        value={profileDraft.phone}
                        onChange={(event) => updateDraft("phone", event.target.value.replace(/\D/g, "").slice(0, 10))}
                      />
                      <small className="field-hint" style={{ fontSize: 11 }}>
                        {locale === "th" ? "ตัวเลขไม่เกิน 10 หลัก" : "Maximum 10 digits"}
                      </small>
                    </div>
                  </div>
                  <button className="primary-button" type="submit" disabled={saving}>{saving ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}{t.save}</button>
                </form>

                {/* Password Management Section */}
                <section style={{ borderTop: "1px solid var(--line)", paddingTop: 16, marginTop: 8 }}>
                  <div className="form-section-title" style={{ marginBottom: 12 }}>
                    <KeyRound size={18} />
                    <div>
                      <h3>{locale === "th" ? "จัดการรหัสผ่าน" : "Password Management"}</h3>
                      <p className="page-subtitle">{locale === "th" ? "รหัสผ่านถูกเข้ารหัสทางเดียว — Admin ไม่สามารถดูรหัสผ่านจริงได้" : "Passwords are one-way hashed — admins cannot read actual passwords."}</p>
                    </div>
                  </div>
                  {passwordMessage ? (
                    <div className="form-note" style={{ marginBottom: 12 }}>{passwordMessage}</div>
                  ) : null}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                      <div className="form-group" style={{ flex: "1 1 200px", margin: 0 }}>
                        <label htmlFor="admin-new-password">
                          {locale === "th" ? "ตั้งรหัสผ่านใหม่ให้ผู้ใช้" : "Set new password for user"}
                        </label>
                        <div style={{ position: "relative" }}>
                          <input
                            id="admin-new-password"
                            className="form-control"
                            type={showAdminPassword ? "text" : "password"}
                            placeholder={locale === "th" ? "รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)" : "New password (min. 8 chars)"}
                            value={adminNewPassword}
                            onChange={(e) => setAdminNewPassword(e.target.value)}
                            style={{ paddingRight: 38 }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowAdminPassword((v) => !v)}
                            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: 0, background: "none", cursor: "pointer", color: "var(--muted)" }}
                            aria-label={showAdminPassword ? "Hide password" : "Show password"}
                          >
                            {showAdminPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => void handleAdminSetPassword(selectedUser.id)}
                        disabled={passwordManaging || !adminNewPassword}
                        style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
                      >
                        {passwordManaging ? <LoaderCircle size={15} className="spin" /> : <Lock size={15} />}
                        {locale === "th" ? "บันทึกรหัสผ่าน" : "Save Password"}
                      </button>
                    </div>
                    {selectedUser.email ? (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => void handleAdminSendResetEmail(selectedUser)}
                        disabled={passwordManaging}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start" }}
                      >
                        {passwordManaging ? <LoaderCircle size={15} className="spin" /> : <Send size={15} />}
                        {locale === "th" ? "ส่งอีเมลรีเซ็ตรหัสผ่าน" : "Send Reset Email"}
                        <small style={{ opacity: 0.65, marginLeft: 4 }}>→ {selectedUser.email}</small>
                      </button>
                    ) : null}
                  </div>
                </section>

                <AccountHistoryPanel locale={locale} history={history} loading={historyLoading} copy={t} />
              </>
            ) : (
              <div className="empty-card compact-empty"><div><div className="empty-icon"><UserRound size={24} /></div><h2>{t.edit}</h2><p>{locale === "th" ? "เลือกผู้ใช้งานเพื่อดู แก้ไข หรือจัดการยศ" : "Select a user to inspect, edit, or manage roles."}</p></div></div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function AccountHistoryPanel({ locale, history, loading, copy }: { locale: Locale; history: AccountHistory | null; loading: boolean; copy: ReturnType<typeof getCopy> }) {
  const total = history ? history.audits.length + history.bookings.length + history.sessions.length : 0;
  return (
    <section className="account-history" aria-label={copy.accountHistory}>
      <div className="form-section-title"><History size={19} /><div><h3>{copy.accountHistory}</h3><p>{total} {locale === "th" ? "รายการจากระบบจริง" : "live system records"}</p></div></div>
      {loading ? (
        <div className="inline-loading"><LoaderCircle size={16} className="spin" />{locale === "th" ? "กำลังโหลด" : "Loading"}</div>
      ) : history && total ? (
        <div className="history-list">
          {history.audits.slice(0, 8).map((item) => (
            <div className="history-item" key={`audit-${item.id}`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                <strong>{item.action}</strong>
                <span className={`status-badge ${item.result?.toLowerCase() === "success" ? "available" : "closed"}`}>
                  {item.result || "LOG"}
                </span>
              </div>
              <span>{item.actor_type || "—"} · {item.entity_type || "—"} · {formatDate(item.created_at, locale)}</span>
            </div>
          ))}
          {history.bookings.slice(0, 8).map((item) => (
            <div className="history-item" key={`booking-${item.id}`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                <strong>{item.reference}</strong>
                <span className={`status-badge ${item.status.toLowerCase() === "confirmed" ? "available" : item.status.toLowerCase() === "pending" ? "reserved" : "occupied"}`}>
                  {item.status}
                </span>
              </div>
              <span>{item.booking_date} · {formatDate(item.created_at, locale)}</span>
            </div>
          ))}
          {history.sessions.slice(0, 8).map((item) => (
            <div className="history-item" key={`session-${item.id}`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                <strong>{item.status}</strong>
                <span className={`status-badge ${item.status.toLowerCase() === "active" ? "available" : "occupied"}`}>
                  {item.status}
                </span>
              </div>
              <span>{item.check_in_at ? formatDate(item.check_in_at, locale) : "—"} → {item.check_out_at ? formatDate(item.check_out_at, locale) : "—"}</span>
            </div>
          ))}
        </div>
      ) : <p className="form-note">{copy.noHistory}</p>}
    </section>
  );
}

function formatDate(value: string, locale: Locale) {
  return new Date(value).toLocaleString(locale === "th" ? "th-TH" : "en-US", { dateStyle: "medium", timeStyle: "short" });
}
