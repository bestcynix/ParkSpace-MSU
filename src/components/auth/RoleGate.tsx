"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LoaderCircle, ShieldAlert } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type ProtectedRole = "staff" | "admin";

const ROLE_HIERARCHY: Record<string, string[]> = {
  staff: ["staff", "admin"],
  admin: ["admin"],
};

export function RoleGate({ locale, role, children }: { locale: Locale; role: ProtectedRole; children: React.ReactNode }) {
  const t = getCopy(locale);
  const [state, setState] = useState<"checking" | "allowed" | "blocked" | "setup">("checking");

  useEffect(() => {
    let mounted = true;
    async function check() {
      if (!isSupabaseConfigured()) {
        if (mounted) setState("setup");
        return;
      }
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          if (mounted) setState("blocked");
          return;
        }
        const user = sessionData.session.user;
        const userId = user.id;
        const userEmail = (user.email || "").toLowerCase().trim();

        let hasAccess = false;

        // Layer 1: Core MSU Super Admin / Admin / Staff email bypass
        if (role === "admin" && (userEmail === "68011211206@msu.ac.th" || userEmail === "69010518004@msu.ac.th" || userEmail === "admin@msu.ac.th")) {
          hasAccess = true;
        } else if (role === "staff" && (userEmail === "68011211206@msu.ac.th" || userEmail === "69010518004@msu.ac.th" || userEmail === "staff@msu.ac.th" || userEmail === "admin@msu.ac.th")) {
          hasAccess = true;
        }

        // Layer 2: user_roles table
        if (!hasAccess) {
          const { data: roleData, error } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId);

          let userRoles: string[] = [];
          if (!error && roleData && roleData.length > 0) {
            userRoles = roleData.map((item: { role?: unknown }) => {
              const r = String(item.role ?? "").toLowerCase().trim();
              return r === "developer" ? "admin" : r;
            });
          }

          // Layer 3: profiles.user_type
          if (userRoles.length === 0) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("user_type")
              .eq("id", userId)
              .maybeSingle();
            if (profile?.user_type) {
              const ut = String(profile.user_type).toLowerCase().trim();
              userRoles = [ut === "developer" ? "admin" : ut];
            }
          }

          // Layer 4: user_metadata
          if (userRoles.length === 0 && user.user_metadata) {
            const metaType = String(user.user_metadata.user_type || user.user_metadata.role || "").toLowerCase().trim();
            if (metaType) {
              userRoles = [metaType === "developer" ? "admin" : metaType];
            }
          }

          const satisfyingRoles: string[] = ROLE_HIERARCHY[role] ?? [role];
          hasAccess = userRoles.some((userRole: string) => satisfyingRoles.includes(userRole));
        }

        if (mounted) setState(hasAccess ? "allowed" : "blocked");
      } catch {
        if (mounted) setState("blocked");
      }
    }
    void check();
    return () => { mounted = false; };
  }, [role]);

  if (state === "checking") return <div className="empty-card"><div><div className="empty-icon"><LoaderCircle size={26} /></div><h2>Loading · กำลังตรวจสอบ</h2><p>{t.setupRequired}</p></div></div>;
  if (state === "setup") return <div className="empty-card"><div><div className="empty-icon"><ShieldAlert size={27} /></div><h2>{t.setupRequired}</h2><p>{t.accountNotConfigured} / {t.accountNotConfiguredEn}</p><Link className="primary-button" style={{ marginTop: 18 }} href={`/${locale}/login`}>{t.login}</Link></div></div>;
  if (state === "blocked") return <div className="empty-card"><div><div className="empty-icon"><ShieldAlert size={27} /></div><h2>{t.accessDenied}</h2><p>{t.signInRequired}</p><Link className="primary-button" style={{ marginTop: 18 }} href={`/${locale}/login`}>{t.login}</Link></div></div>;
  return <>{children}</>;
}
