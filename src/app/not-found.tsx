import Link from "next/link";

export default function NotFound() {
  return <main className="page-wrap" style={{ paddingTop: 80 }}><div className="empty-card"><div><div className="empty-icon">404</div><h2>Page not found · ไม่พบหน้านี้</h2><p>The page may have moved or is not available yet.</p><Link className="primary-button" style={{ marginTop: 18 }} href="/th">Back to ParkSpace MSU</Link></div></div></main>;
}
