"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CircleUserRound,
  UserRound,
  CalendarDays,
  Car,
  Bell,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  LogIn,
  UserPlus,
  BookOpen,
  MapPin,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { resolveImageSource } from "@/lib/image-helpers";

type HeaderUserDropdownProps = {
  locale: Locale;
};

export function HeaderUserDropdown({ locale }: HeaderUserDropdownProps) {
  const router = useRouter();
  const isTh = locale === "th";
  const [isOpen, setIsOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [userType, setUserType] = useState<string>("");
  const menuRef = useRef<HTMLDivElement>(null);

  const loadUserData = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;

      if (!session?.user) {
        setUserEmail(null);
        setFullName("");
        setAvatarUrl(null);
        setIsAdmin(false);
        setIsStaff(false);
        setUserType("");
        return;
      }

      const user = session.user;
      const email = user.email ?? "";
      setUserEmail(email);

      // Fast role check based on known emails
      const isKnownAdmin =
        email === "68011211206@msu.ac.th" ||
        email === "69010518004@msu.ac.th" ||
        email === "admin@msu.ac.th";
      const isKnownStaff = email === "staff@msu.ac.th";

      if (isKnownAdmin) setIsAdmin(true);
      if (isKnownStaff) setIsStaff(true);

      // Quick fallback values from auth metadata
      const metaAvatar = (user.user_metadata?.avatar_url || user.user_metadata?.picture) as string | undefined;
      const metaName = (user.user_metadata?.full_name || user.user_metadata?.name) as string | undefined;

      if (metaName) {
        setFullName(metaName);
      } else if (email) {
        setFullName(email.split("@")[0]);
      }

      if (metaAvatar) {
        setAvatarUrl(metaAvatar);
      }

      // Fetch profile & roles from Supabase
      const [profileRes, rolesRes] = await Promise.allSettled([
        supabase.from("profiles").select("full_name, avatar_path, user_type").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);

      let effectiveAvatar = metaAvatar || null;
      if (profileRes.status === "fulfilled" && profileRes.value.data) {
        const p = profileRes.value.data;
        if (p.full_name) {
          setFullName(p.full_name);
        }
        if (p.user_type) {
          setUserType(p.user_type);
        }
        if (p.avatar_path) {
          effectiveAvatar = p.avatar_path;
        }
      }

      // Resolve roles
      let roles: string[] = [];
      if (rolesRes.status === "fulfilled" && rolesRes.value.data) {
        roles = rolesRes.value.data.map((r: { role: string }) => String(r.role).toLowerCase());
      }
      const profileRole = (profileRes.status === "fulfilled" && profileRes.value.data?.user_type) || "";
      const metaRole = String(user.user_metadata?.user_type || user.user_metadata?.role || "").toLowerCase();

      const hasAdminRole =
        isKnownAdmin ||
        roles.includes("admin") ||
        roles.includes("developer") ||
        profileRole.toLowerCase() === "admin" ||
        metaRole === "admin";
      const hasStaffRole =
        isKnownStaff ||
        roles.includes("staff") ||
        profileRole.toLowerCase() === "staff" ||
        metaRole === "staff";

      setIsAdmin(hasAdminRole);
      setIsStaff(hasStaffRole);

      // Resolve displayable avatar URL
      if (effectiveAvatar) {
        const resolved = resolveImageSource(effectiveAvatar, "profile-avatars");
        if (
          resolved &&
          (resolved.startsWith("data:") ||
            resolved.startsWith("blob:") ||
            /^https?:\/\//i.test(resolved) ||
            resolved.startsWith("/"))
        ) {
          setAvatarUrl(resolved);
        } else {
          try {
            const { data: signed } = await supabase.storage
              .from("profile-avatars")
              .createSignedUrl(effectiveAvatar, 3600);
            setAvatarUrl(signed?.signedUrl || resolved || effectiveAvatar);
          } catch {
            setAvatarUrl(resolved || effectiveAvatar);
          }
        }
      }
    } catch {
      // Keep fallbacks on failure
    }
  }, []);

  useEffect(() => {
    void loadUserData();

    if (!isSupabaseConfigured()) return;
    const supabase = createSupabaseBrowserClient();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      void loadUserData();
    });

    const handleProfileUpdate = () => {
      void loadUserData();
    };
    window.addEventListener("profile-updated", handleProfileUpdate);

    return () => {
      authListener.subscription.unsubscribe();
      window.removeEventListener("profile-updated", handleProfileUpdate);
    };
  }, [loadUserData]);

  // Handle outside click to close dropdown
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  async function handleSignOut() {
    setIsOpen(false);
    try {
      if (isSupabaseConfigured()) {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
      }
    } catch {
      // Continue with redirect
    }
    window.location.assign(`/${locale}/login`);
  }

  const roleLabel = isAdmin
    ? isTh
      ? "ผู้ดูแลระบบ"
      : "Administrator"
    : isStaff
    ? isTh
      ? "เจ้าหน้าที่"
      : "Staff"
    : userType === "STUDENT"
    ? isTh
      ? "นิสิต"
      : "Student"
    : userType === "PERSONNEL"
    ? isTh
      ? "อาจารย์ / บุคลากร"
      : "Personnel"
    : isTh
    ? "สมาชิกทั่วไป"
    : "Member";

  return (
    <div className="header-user-menu" ref={menuRef}>
      <button
        type="button"
        className={`icon-button header-user-btn ${isOpen ? "active" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={
          userEmail
            ? isTh
              ? "เมนูบัญชีผู้ใช้"
              : "User menu"
            : isTh
            ? "เข้าสู่ระบบ / บัญชี"
            : "Sign in / Account"
        }
        title={userEmail ? fullName || userEmail : isTh ? "เข้าสู่ระบบ" : "Sign in"}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={fullName || "Avatar"}
            className="header-avatar-img"
            onError={() => setAvatarUrl(null)}
          />
        ) : (
          <CircleUserRound size={19} strokeWidth={2.1} />
        )}
      </button>

      {isOpen && (
        <div className="header-dropdown-menu" role="menu" tabIndex={-1}>
          {userEmail ? (
            <>
              {/* Profile summary header */}
              <div className="header-dropdown-header">
                <div className="header-dropdown-avatar">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={fullName || "Avatar"}
                      className="header-avatar-img"
                      onError={() => setAvatarUrl(null)}
                    />
                  ) : (
                    <CircleUserRound size={26} strokeWidth={1.8} />
                  )}
                </div>
                <div className="header-dropdown-user-info">
                  <span className="header-dropdown-name" title={fullName || userEmail}>
                    {fullName || userEmail.split("@")[0]}
                  </span>
                  <span className="header-dropdown-email" title={userEmail}>
                    {userEmail}
                  </span>
                  <span
                    className={`header-dropdown-role-badge ${
                      isAdmin ? "admin" : isStaff ? "staff" : ""
                    }`}
                  >
                    {isAdmin ? "👑 " : isStaff ? "🛡️ " : "🚗 "}
                    {roleLabel}
                  </span>
                </div>
              </div>

              {/* Navigation links */}
              <nav className="header-dropdown-items" aria-label="Account navigation">
                <Link
                  href={`/${locale}/app/profile`}
                  className="header-dropdown-item"
                  onClick={() => setIsOpen(false)}
                >
                  <UserRound size={16} />
                  <span>{isTh ? "ข้อมูลส่วนตัว" : "Profile Overview"}</span>
                </Link>

                <Link
                  href={`/${locale}/app/bookings`}
                  className="header-dropdown-item"
                  onClick={() => setIsOpen(false)}
                >
                  <CalendarDays size={16} />
                  <span>{isTh ? "ประวัติการจอง" : "Booking History"}</span>
                </Link>

                <Link
                  href={`/${locale}/app/profile/vehicles`}
                  className="header-dropdown-item"
                  onClick={() => setIsOpen(false)}
                >
                  <Car size={16} />
                  <span>{isTh ? "ยานพาหนะของฉัน" : "My Vehicles"}</span>
                </Link>

                <Link
                  href={`/${locale}/app/notifications`}
                  className="header-dropdown-item"
                  onClick={() => setIsOpen(false)}
                >
                  <Bell size={16} />
                  <span>{isTh ? "การแจ้งเตือน" : "Notifications"}</span>
                </Link>

                {isAdmin && (
                  <>
                    <div className="header-dropdown-divider" />
                    <Link
                      href={`/${locale}/admin/dashboard`}
                      className="header-dropdown-item"
                      onClick={() => setIsOpen(false)}
                    >
                      <ShieldCheck size={16} style={{ color: "var(--amber, #f59e0b)" }} />
                      <span>{isTh ? "แดชบอร์ดผู้ดูแลระบบ" : "Admin Dashboard"}</span>
                    </Link>
                    <Link
                      href={`/${locale}/admin/parking-areas`}
                      className="header-dropdown-item"
                      onClick={() => setIsOpen(false)}
                    >
                      <MapPin size={16} style={{ color: "var(--amber, #f59e0b)" }} />
                      <span>{isTh ? "จัดการพื้นที่จอดรถ" : "Manage Parking Areas"}</span>
                    </Link>
                  </>
                )}

                {isStaff && !isAdmin && (
                  <>
                    <div className="header-dropdown-divider" />
                    <Link
                      href={`/${locale}/staff/operations`}
                      className="header-dropdown-item"
                      onClick={() => setIsOpen(false)}
                    >
                      <ShieldAlert size={16} style={{ color: "var(--blue, #3b82f6)" }} />
                      <span>{isTh ? "ระบบงานเจ้าหน้าที่" : "Staff Operations"}</span>
                    </Link>
                  </>
                )}

                <div className="header-dropdown-divider" />

                <Link
                  href={`/${locale}/guide`}
                  className="header-dropdown-item"
                  onClick={() => setIsOpen(false)}
                >
                  <BookOpen size={16} style={{ color: "#9a7800" }} />
                  <span>{isTh ? "คู่มือและผังนำเสนอระบบ" : "Guide & Presentation"}</span>
                </Link>

                <button
                  type="button"
                  className="header-dropdown-item danger"
                  onClick={() => void handleSignOut()}
                >
                  <LogOut size={16} />
                  <span>{isTh ? "ออกจากระบบ" : "Sign Out"}</span>
                </button>
              </nav>
            </>
          ) : (
            <>
              {/* Guest state */}
              <div className="header-dropdown-header">
                <div className="header-dropdown-avatar">
                  <CircleUserRound size={26} strokeWidth={1.8} />
                </div>
                <div className="header-dropdown-user-info">
                  <span className="header-dropdown-name">
                    {isTh ? "ผู้เยี่ยมชมระบบ" : "Guest Visitor"}
                  </span>
                  <span className="header-dropdown-email">
                    {isTh ? "ยินดีต้อนรับสู่ ParkSpace MSU" : "Welcome to ParkSpace MSU"}
                  </span>
                </div>
              </div>

              <nav className="header-dropdown-items" aria-label="Guest navigation">
                <Link
                  href={`/${locale}/login`}
                  className="header-dropdown-item"
                  onClick={() => setIsOpen(false)}
                >
                  <LogIn size={16} style={{ color: "var(--blue, #3b82f6)" }} />
                  <span>{isTh ? "เข้าสู่ระบบ" : "Sign In"}</span>
                </Link>

                <Link
                  href={`/${locale}/register`}
                  className="header-dropdown-item"
                  onClick={() => setIsOpen(false)}
                >
                  <UserPlus size={16} style={{ color: "var(--green, #10b981)" }} />
                  <span>{isTh ? "สมัครสมาชิกใหม่" : "Register"}</span>
                </Link>

                <div className="header-dropdown-divider" />

                <Link
                  href={`/${locale}/guide`}
                  className="header-dropdown-item"
                  onClick={() => setIsOpen(false)}
                >
                  <BookOpen size={16} style={{ color: "#9a7800" }} />
                  <span>{isTh ? "คู่มือและผังนำเสนอระบบ" : "Guide & Presentation"}</span>
                </Link>
              </nav>
            </>
          )}
        </div>
      )}
    </div>
  );
}
