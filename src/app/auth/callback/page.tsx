import { Suspense } from "react";
import { OAuthCallbackClient } from "@/components/auth/OAuthCallbackClient";
import { PublicFooter } from "@/components/layout/PublicFooter";

export default function OAuthCallbackPage() {
  return <div className="app-frame"><Suspense fallback={<div className="empty-card"><div><p>Connecting account · กำลังเชื่อมต่อบัญชี</p></div></div>}><OAuthCallbackClient /></Suspense><div className="page-wrap"><PublicFooter locale="th" /></div></div>;
}
