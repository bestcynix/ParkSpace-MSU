const baseUrl = (process.env.E2E_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const locales = ["th", "en"];
const paths = [
  "", "/parking", "/map", "/about-project", "/team", "/privacy", "/terms", "/cookies", "/help", "/feedback", "/report-bug",
  "/login", "/register", "/forgot-password", "/reset-password", "/verify-email",
  "/app", "/app/bookings", "/app/bookings/new", "/app/notifications", "/app/profile", "/app/profile/vehicles",
  "/admin/dashboard", "/admin/operations", "/admin/parking-areas", "/admin/bookings", "/admin/users", "/admin/analytics", "/admin/feedback", "/admin/audit-logs", "/admin/settings",
  "/staff/dashboard", "/staff/scan", "/staff/operations", "/staff/incidents",
  "/developer/health", "/developer/database", "/developer/parking-areas", "/developer/users", "/developer/analytics", "/developer/audit-logs", "/developer/traces", "/developer/errors", "/developer/feedback", "/developer/feature-flags",
  "/parking/p01", "/parking/p01/slots", "/parking/p28", "/parking/p28/slots",
];

const failures = [];
const redirectOnlyPaths = new Set(["/app", "/admin", "/staff", "/developer"]);
for (const locale of locales) {
  for (const path of paths) {
    const url = `${baseUrl}/${locale}${path}`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      const body = await response.text();
      const visibleBody = body.slice(body.indexOf("<body"), body.lastIndexOf("</body>"));
      if (!response.ok) failures.push(`${response.status} ${url}`);
      if (!body.includes("ParkSpace MSU")) failures.push(`missing brand ${url}`);
      if (!redirectOnlyPaths.has(path)) {
        if (!body.includes("footer-copyright") || !body.includes("© 2026 MSU ParkSpace")) failures.push(`missing unified footer ${url}`);
        if (!body.includes(`/${locale}/about-project`) || !body.includes(`/${locale}/team`) || !body.includes(`/${locale}/privacy`) || !body.includes(`/${locale}/terms`) || !body.includes(`/${locale}/help`) || !body.includes(`/${locale}/report-bug`) || !body.includes(`/${locale}/feedback`)) failures.push(`incomplete footer links ${url}`);
        if (body.includes("Powered by นายพงศ์ภรณ์") || body.includes("Powered by Natthaphon")) failures.push(`visible powered-by credit ${url}`);
      }
      if (path === "/parking/p01/slots" && !body.includes("100")) failures.push(`missing mock layout marker ${url}`);
      if (path === "/map") {
        const mapMarkers = locale === "th" ? ["ทั้ง 28 พื้นที่", "Google Maps", "แผนภาพ 2D"] : ["All 28 areas", "Google Maps", "2D diagram"];
        for (const marker of mapMarkers) if (!body.includes(marker)) failures.push(`missing map marker ${marker} ${url}`);
      }
      if (path === "" || path === "/login") {
        const primaryTagline = locale === "th" ? "จองง่าย จอดสะดวก" : "Easy to Book, Easy to Park";
        const secondaryTagline = locale === "th" ? "Easy to Book, Easy to Park" : "จองง่าย จอดสะดวก";
        const primaryIndex = visibleBody.indexOf(primaryTagline);
        const secondaryIndex = visibleBody.indexOf(secondaryTagline);
        if (primaryIndex < 0 || secondaryIndex < 0 || primaryIndex > secondaryIndex) failures.push(`swapped bilingual tagline ${url}`);
      }
      if (path === "/feedback" && !body.includes(locale === "th" ? "ศูนย์ความคิดเห็น" : "Feedback center")) failures.push(`missing feedback marker ${url}`);
      if (path === "/cookies") {
        const cookieMarker = locale === "th" ? ["นโยบายคุกกี้", "ตั้งค่าคุกกี้"] : ["Cookie policy", "Cookie settings"];
        if (!cookieMarker.some((marker) => body.includes(marker))) failures.push(`missing cookie marker ${url}`);
      }
    } catch (error) {
      failures.push(`${url} · ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

const callbackUrl = `${baseUrl}/auth/callback`;
try {
  const response = await fetch(callbackUrl, { signal: AbortSignal.timeout(10000) });
  const body = await response.text();
  if (!response.ok || !body.includes("ParkSpace MSU")) failures.push(`auth callback route ${response.status} ${callbackUrl}`);
} catch (error) {
  failures.push(`${callbackUrl} · ${error instanceof Error ? error.message : String(error)}`);
}

if (failures.length) {
  console.error(`E2E smoke failed (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`E2E smoke passed: ${locales.length * paths.length} localized routes + auth callback checked at ${baseUrl}`);
}
