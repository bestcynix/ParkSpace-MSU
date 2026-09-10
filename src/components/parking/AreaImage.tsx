"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { resolveImageSource } from "@/lib/image-helpers";

const placeholderPath = "/parking/parking-placeholder.svg";

type AreaImageProps = {
  areaCode: string;
  title: string;
  locale: Locale;
  className?: string;
  loading?: "eager" | "lazy";
};

export function AreaImage({ areaCode, title, locale, className = "parking-image", loading = "lazy" }: AreaImageProps) {
  const t = getCopy(locale);
  const [src, setSrc] = useState(placeholderPath);
  const [isPlaceholder, setIsPlaceholder] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadAreaImage() {
      if (!isSupabaseConfigured()) return;
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: area } = await supabase.from("parking_areas").select("id, cover_image_path").eq("code", areaCode).maybeSingle();
        let imagePath = area?.cover_image_path as string | null | undefined;
        if (!imagePath && area?.id) {
          const { data: image } = await supabase.from("parking_images").select("storage_path").eq("parking_area_id", area.id).eq("image_type", "COVER").eq("data_status", "VERIFIED").order("created_at", { ascending: false }).limit(1).maybeSingle();
          imagePath = image?.storage_path as string | null | undefined;
        }
        if (active && imagePath) {
          const resolved = resolveImageSource(imagePath, "parking-images") || resolveImageSource(imagePath, "parking-media");
          if (resolved) {
            setSrc(resolved);
            setIsPlaceholder(false);
          }
        }
      } catch {
        // The local placeholder is the safe fallback when the public catalog is offline.
      }
    }
    void loadAreaImage();
    return () => { active = false; };
  }, [areaCode]);

  return (
    <div className={className} style={{ position: "relative", overflow: "hidden", aspectRatio: "16 / 9" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={isPlaceholder ? `${locale === "th" ? "ผังลานจอด" : "Parking Layout"} · ${title}` : title}
        loading={loading}
        onError={() => { setSrc(placeholderPath); setIsPlaceholder(true); }}
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }}
      />
      <span className="image-label">{isPlaceholder ? (locale === "th" ? "ผังลานจอด มมส." : "MSU Car Park") : t.customImage}</span>
    </div>
  );
}
