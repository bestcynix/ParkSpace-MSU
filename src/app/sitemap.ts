import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const publicPaths = ["", "/parking", "/map", "/about-project", "/team", "/privacy", "/terms", "/cookies", "/help"];
  const areas = Array.from({ length: 28 }, (_, index) => `/parking/p${String(index + 1).padStart(2, "0")}`);

  return ["th", "en"].flatMap((locale) =>
    [...publicPaths, ...areas].map((path) => ({
      url: `${siteUrl}/${locale}${path}`,
      lastModified,
      changeFrequency: path.startsWith("/parking") ? "weekly" as const : "monthly" as const,
      priority: path === "" ? 1 : path.startsWith("/parking") ? 0.8 : 0.5,
    })),
  );
}
