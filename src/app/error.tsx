"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {}, []);
  return <main className="page-wrap" style={{ paddingTop: 80 }}><div className="empty-card"><div><div className="empty-icon"><AlertTriangle size={27} /></div><h2>Something went wrong · ระบบขัดข้อง</h2><p>Please try again. Error details are not exposed to other users.</p><button className="primary-button" style={{ marginTop: 18 }} onClick={() => reset()}>Try again · ลองใหม่</button></div></div></main>;
}
