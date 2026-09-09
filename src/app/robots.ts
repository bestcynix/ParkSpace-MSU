import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/th", "/en"],
        disallow: ["/th/app/", "/en/app/", "/th/staff/", "/en/staff/", "/th/admin/", "/en/admin/", "/th/developer/", "/en/developer/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
