const baseUrl = (process.env.E2E_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const locales = ["th", "en"];
const paths = [
  "", "/parking", "/map", "/about-project", "/team", "/privacy", "/terms", "/cookies", "/help", "/feedback", "/report-bug",
  "/login", "/register", "/forgot-password", "/reset-password", "/verify-email",
  "/app", "/app/bookings", "/app/bookings/new", "/app/notifications", "/app/profile", "/app/profile/vehicles",
  "/admin/dashboard", "/admin/operations", "/admin/parking-areas", "/admin/bookings", "/admin/users", "/admin/analytics", "/admin/feedback", "/admin/audit-logs", "/admin/settings",
  "/staff/dashboard", "/staff/scan", "/staff/operations", "/staff/incidents",
  "/developer/health", "/developer/database", "/developer/parking-areas", "/developer/users", "/developer/analytics", "/developer/traces", "/developer/errors", "/developer/feedback", "/developer/feature-flags",
  "/parking/p01", "/parking/p01/slots", "/parking/p28", "/parking/p28/slots",
];

const failures = [];
for (const locale of locales) {
  for (const path of paths) {
    const url = `${baseUrl}/${locale}${path}`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      const body = await response.text();
      if (!response.ok) failures.push(`${response.status} ${url}`);
      if (!body.includes("ParkSpace MSU")) failures.push(`missing brand ${url}`);
      if (path === "/parking/p01/slots" && !body.includes("100")) failures.push(`missing mock layout marker ${url}`);
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

if (failures.length) {
  console.error(`E2E smoke failed (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`E2E smoke passed: ${locales.length * paths.length} localized routes checked at ${baseUrl}`);
}
