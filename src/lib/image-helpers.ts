/**
 * Image helpers for ParkSpace MSU
 * Handles image URL resolution, canvas-based resizing/compression,
 * and resilient uploading with automatic base64 fallback.
 */

import { createSupabaseBrowserClient, isSupabaseConfigured } from "./supabase/client";

/**
 * Resolves an image path/URL from any source format into a valid displayable URL:
 * - Data URLs (data:image/...)
 * - Blob URLs (blob:...)
 * - External URLs (https://...)
 * - Local static paths (/...)
 * - Supabase storage object paths (team-avatars/..., parking-images/..., etc.)
 */
export function resolveImageSource(
  path: string | null | undefined,
  defaultBucket?: string
): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (!trimmed) return null;

  // Direct data URL, blob, absolute URL, or root-relative path
  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:") ||
    /^https?:\/\//i.test(trimmed) ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!baseUrl) return null;

  // Check known bucket prefixes
  const knownBuckets = ["team-avatars", "profile-avatars", "parking-images", "parking-media"];
  for (const bucket of knownBuckets) {
    if (trimmed.startsWith(`${bucket}/`)) {
      const storagePath = trimmed.slice(bucket.length + 1).split("/").map(encodeURIComponent).join("/");
      return `${baseUrl}/storage/v1/object/public/${bucket}/${storagePath}`;
    }
  }

  // If starts with storage/v1/
  if (trimmed.startsWith("storage/v1/")) {
    return `${baseUrl}/${trimmed}`;
  }

  // Use default bucket if provided
  if (defaultBucket) {
    const cleanPath = trimmed.replace(/^\/+/, "");
    const encoded = cleanPath.split("/").map(encodeURIComponent).join("/");
    return `${baseUrl}/storage/v1/object/public/${defaultBucket}/${encoded}`;
  }

  return null;
}

/**
 * Loads an image from a URL or File/Blob into an HTMLImageElement.
 */
export function loadImageElement(source: string | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error("Failed to load image element: " + String(err)));

    if (typeof source === "string") {
      img.src = source;
    } else {
      img.src = URL.createObjectURL(source);
    }
  });
}

/**
 * Resizes and compresses an image using HTML Canvas.
 * Produces an optimized JPEG/WebP data URL and Blob.
 */
export async function compressAndResizeImage(
  source: string | Blob,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.85
): Promise<{ dataUrl: string; blob: Blob }> {
  const img = await loadImageElement(source);

  let { width, height } = img;
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas 2d context");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  const format = "image/jpeg";
  const dataUrl = canvas.toDataURL(format, quality);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Canvas toBlob returned null"));
      },
      format,
      quality
    );
  });

  return { dataUrl, blob };
}

/**
 * Resilient image upload strategy:
 * 1. Tries to upload Blob to Supabase Storage.
 * 2. If storage upload fails (bucket missing, RLS 403, network, etc.),
 *    gracefully falls back to the compressed base64 data URL.
 * 3. Never throws; returns a valid string that can be saved directly in DB!
 */
export async function uploadOrFallbackImage({
  fileOrBlob,
  bucket,
  objectPath,
}: {
  fileOrBlob: File | Blob;
  bucket: string;
  objectPath: string;
}): Promise<{ pathOrUrl: string; isStorage: boolean }> {
  // Always create an optimized fallback first
  let fallbackDataUrl = "";
  try {
    const compressed = await compressAndResizeImage(fileOrBlob, 600, 600, 0.82);
    fallbackDataUrl = compressed.dataUrl;
  } catch {
    // If canvas fails, read as raw data URL
    fallbackDataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => resolve("");
      reader.readAsDataURL(fileOrBlob);
    });
  }

  // Attempt Supabase Storage upload if configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = createSupabaseBrowserClient();
      const contentType = fileOrBlob.type || "image/jpeg";

      const { data, error } = await supabase.storage.from(bucket).upload(objectPath, fileOrBlob, {
        contentType,
        cacheControl: "3600",
        upsert: true,
      });

      if (!error && data) {
        // Try getting public URL
        const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
        if (pubData?.publicUrl) {
          return { pathOrUrl: pubData.publicUrl, isStorage: true };
        }
        return { pathOrUrl: `${bucket}/${objectPath}`, isStorage: true };
      }
      console.warn(`Supabase storage upload to bucket "${bucket}" failed, falling back to data URL:`, error);
    } catch (err) {
      console.warn(`Supabase storage exception for bucket "${bucket}":`, err);
    }
  }

  // Graceful fallback to data URL
  return { pathOrUrl: fallbackDataUrl, isStorage: false };
}
