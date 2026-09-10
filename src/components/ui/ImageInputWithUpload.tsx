"use client";

import { useState, useRef, useId, type ChangeEvent, type DragEvent } from "react";
import { Upload, Trash2, Image as ImageIcon, LoaderCircle, Check, Link as LinkIcon, AlertCircle } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export interface ImageInputWithUploadProps {
  value: string;
  onChange: (url: string) => void;
  label: string;
  placeholder?: string;
  hint?: string;
  locale: Locale;
  bucketName?: string;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("FileReader did not return a string"));
      }
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read file as Data URL"));
    reader.readAsDataURL(file);
  });
}

export function ImageInputWithUpload({
  value,
  onChange,
  label,
  placeholder,
  hint,
  locale,
  bucketName = "parking-images",
}: ImageInputWithUploadProps) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [imgLoadError, setImgLoadError] = useState(false);

  const t = {
    uploadImage: locale === "th" ? "อัปโหลดภาพ" : "Upload image",
    dragDropOrClick: locale === "th" ? "ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์" : "Drag & drop image here or click to browse",
    dragDropActive: locale === "th" ? "ปล่อยไฟล์ที่นี่เพื่ออัปโหลด" : "Drop image file here to upload",
    supportedFormats: locale === "th" ? "รองรับ JPG, PNG, WEBP, GIF" : "Supports JPG, PNG, WEBP, GIF",
    imageUrl: locale === "th" ? "ลิงก์รูปภาพโดยตรง" : "Direct image URL",
    defaultPlaceholder: locale === "th" ? "https://... หรือวางลิงก์รูปภาพ" : "https://... or paste image URL",
    removeImage: locale === "th" ? "ลบรูปภาพ" : "Remove image",
    clear: locale === "th" ? "ลบ" : "Clear",
    uploadingText: locale === "th" ? "กำลังอัปโหลด..." : "Uploading...",
    uploadSuccessText: locale === "th" ? "อัปโหลดเรียบร้อยแล้ว" : "Uploaded successfully",
    imagePreview: locale === "th" ? "ตัวอย่างรูปภาพ" : "Image preview",
    invalidFormat: locale === "th" ? "กรุณาเลือกไฟล์รูปภาพเท่านั้น" : "Please select an image file only",
    unableToLoad: locale === "th" ? "ไม่สามารถโหลดรูปภาพได้" : "Unable to load image",
    dataUrlBadge: locale === "th" ? "บันทึกในระบบ" : "Embedded",
    storageBadge: locale === "th" ? "คลาวด์สตอเรจ" : "Cloud Storage",
    externalBadge: locale === "th" ? "ลิงก์ภายนอก" : "External URL",
  };

  async function processFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setErrorMessage(t.invalidFormat);
      return;
    }

    setErrorMessage(null);
    setImgLoadError(false);
    setUploading(true);

    let supabaseUrl: string | null = null;

    // 1. Attempt upload to Supabase Storage if configured
    if (isSupabaseConfigured()) {
      try {
        const supabase = createSupabaseBrowserClient();
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const cleanName = file.name
          .replace(/\.[^/.]+$/, "")
          .replace(/[^a-zA-Z0-9_-]/g, "_")
          .slice(0, 30);
        const fileName = `${Date.now()}_${cleanName}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const filePath = `uploads/${fileName}`;

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from(bucketName)
          .upload(filePath, file, {
            contentType: file.type || "image/jpeg",
            upsert: true,
          });

        if (!uploadErr && uploadData) {
          const { data: pubData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
          if (pubData?.publicUrl) {
            supabaseUrl = pubData.publicUrl;
          }
        }
      } catch (err) {
        // Log warning and gracefully fall back to base64 Data URL
        console.warn("Supabase bucket upload failed or skipped, falling back to base64 Data URL:", err);
      }
    }

    // 2. If Supabase upload succeeded, use the public URL; otherwise convert to base64 Data URL
    if (supabaseUrl) {
      onChange(supabaseUrl);
      setUploading(false);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 2500);
    } else {
      try {
        const dataUrl = await fileToDataUrl(file);
        onChange(dataUrl);
      } catch {
        // Ultimate fallback to object URL blob so it NEVER fails
        const blobUrl = URL.createObjectURL(file);
        onChange(blobUrl);
      } finally {
        setUploading(false);
        setUploadSuccess(true);
        setTimeout(() => setUploadSuccess(false), 2500);
      }
    }
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      void processFile(file);
    }
    event.target.value = "";
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void processFile(file);
    }
  }

  function handleClear() {
    onChange("");
    setImgLoadError(false);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const hasImage = Boolean(value && value.trim());
  const isDataUrl = value.startsWith("data:");
  const isBlobUrl = value.startsWith("blob:");
  const isStorageUrl = value.includes("/storage/v1/object/public/");

  return (
    <div className="form-group image-input-with-upload">
      <label htmlFor={inputId}>{label}</label>

      <div className="image-uploader-card">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          aria-label={t.uploadImage}
          style={{ display: "none" }}
          onChange={handleFileInputChange}
          disabled={uploading}
        />

        {/* Current Image Preview & Management */}
        {hasImage ? (
          <div className="image-uploader-preview-wrap">
            <div className="image-uploader-thumbnail-container">
              {!imgLoadError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={value}
                  alt={label}
                  className="image-uploader-thumbnail"
                  onError={() => setImgLoadError(true)}
                />
              ) : (
                <div className="image-uploader-thumbnail-fallback">
                  <AlertCircle size={24} color="#d43c45" />
                  <span>{t.unableToLoad}</span>
                </div>
              )}
            </div>

            <div className="image-uploader-preview-meta">
              <div className="image-uploader-badges">
                <span className="image-source-badge">
                  {isDataUrl || isBlobUrl ? t.dataUrlBadge : isStorageUrl ? t.storageBadge : t.externalBadge}
                </span>
                {uploadSuccess ? (
                  <span className="image-source-badge success">
                    <Check size={12} /> {t.uploadSuccessText}
                  </span>
                ) : null}
              </div>
              <span className="preview-url-text" title={value}>
                {isDataUrl ? `${value.slice(0, 48)}... (base64 data)` : value}
              </span>

              <div className="image-uploader-preview-actions">
                <button
                  type="button"
                  className="secondary-button compact-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload size={13} />
                  <span>{t.uploadImage}</span>
                </button>
                <button
                  type="button"
                  className="icon-button danger compact-btn"
                  onClick={handleClear}
                  title={t.removeImage}
                  aria-label={t.removeImage}
                >
                  <Trash2 size={14} />
                  <span>{t.clear}</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Drag & drop / click upload zone */
          <div
            className={`image-uploader-dropzone ${isDragging ? "dragging" : ""} ${uploading ? "uploading" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            {uploading ? (
              <div className="image-uploader-loading">
                <LoaderCircle size={22} className="spin" />
                <span>{t.uploadingText}</span>
              </div>
            ) : (
              <>
                <div className="image-uploader-dropzone-icon">
                  <ImageIcon size={22} />
                  <Upload size={14} className="badge-icon" />
                </div>
                <strong>{isDragging ? t.dragDropActive : t.dragDropOrClick}</strong>
                <small>{t.supportedFormats}</small>
              </>
            )}
          </div>
        )}

        {/* Direct URL input row */}
        <div className="image-uploader-url-row">
          <div className="image-uploader-url-input-wrap">
            <LinkIcon size={14} className="url-prefix-icon" aria-hidden="true" />
            <input
              id={inputId}
              type="url"
              className="form-control image-url-input"
              value={value}
              placeholder={placeholder || t.defaultPlaceholder}
              onChange={(e) => {
                setImgLoadError(false);
                setErrorMessage(null);
                onChange(e.target.value);
              }}
              disabled={uploading}
            />
          </div>
          {hasImage && !uploading ? (
            <button
              type="button"
              className="icon-button danger"
              onClick={handleClear}
              title={t.removeImage}
              aria-label={t.removeImage}
            >
              <Trash2 size={14} />
            </button>
          ) : null}
        </div>

        {/* Messages & hints */}
        {errorMessage ? <div className="form-note form-note-error">{errorMessage}</div> : null}
        {hint ? <small className="field-hint">{hint}</small> : null}
      </div>
    </div>
  );
}
