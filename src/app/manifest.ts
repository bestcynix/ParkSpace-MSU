import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ParkSpace MSU",
    short_name: "ParkSpace",
    description: "จองง่าย จอดสะดวก / Easy to Book, Easy to Park",
    start_url: "/th",
    display: "standalone",
    background_color: "#f6f7f9",
    theme_color: "#f8c928",
    lang: "th",
    icons: [
      { src: "/brand/app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
