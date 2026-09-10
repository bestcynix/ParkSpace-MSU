"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LoaderCircle, ShieldAlert } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type ProtectedRole = "staff" | "admin" | "developer";

const ROLE_HIERARCHY: Record<ProtectedRole, string[]> = {
  staff: ["staff", "admin", "developer"],
  admin: ["admin", "developer"],
  developer: ["developer"],
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
        const { data: roleData, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", sessionData.session.user.id);
        if (error) {
          if (mounted) setState("blocked");
          return;
        }
        const userRoles = ((roleData ?? []) as Array<{ role?: unknown }>).map((item) => String(item.role ?? "").toLowerCase().trim());
        const satisfyingRoles: string[] = ROLE_HIERARCHY[role] ?? [role];
        const hasAccess = userRoles.some((userRole: string) => satisfyingRoles.includes(userRole));
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
