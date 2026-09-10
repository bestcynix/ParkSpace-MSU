"use client";

import { useState, useRef, useId, type ChangeEvent, type DragEvent } from "react";
import { Upload, Trash2, Image as ImageIcon, LoaderCircle, Check, Link as LinkIcon, AlertCircle, Crop } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { resolveImageSource, uploadOrFallbackImage } from "@/lib/image-helpers";
import { ImageCropperModal } from "./ImageCropperModal";

export interface ImageInputWithUploadProps {
  value: string;
  onChange: (url: string) => void;
  label: string;
  placeholder?: string;
  hint?: string;
  locale: Locale;
  bucketName?: string;
  aspectRatio?: number; // e.g. 16/9 for parking area, 1 for avatar
}

export function ImageInputWithUpload({
  value,
  onChange,
  label,
  placeholder,
  hint,
  locale,
  bucketName = "parking-images",
  aspectRatio = 16 / 9,
}: ImageInputWithUploadProps) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [imgLoadError, setImgLoadError] = useState(false);
  const [cropperSource, setCropperSource] = useState<string | null>(null);

  const t = {
    uploadImage: locale === "th" ? "อัปโหลดภาพ" : "Upload image",
    dragDropOrClick: locale === "th" ? "ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์" : "Drag & drop image here or click to browse",
    dragDropActive: locale === "th" ? "ปล่อยไฟล์ที่นี่เพื่ออัปโหลด" : "Drop image file here to upload",
    supportedFormats: locale === "th" ? "รองรับ JPG, PNG, WEBP, GIF" : "Supports JPG, PNG, WEBP, GIF",
    imageUrl: locale === "th" ? "ลิงก์รูปภาพโดยตรง" : "Direct image URL",
    defaultPlaceholder: locale === "th" ? "https://... หรือวางลิงก์รูปภาพ" : "https://... or paste image URL",
    removeImage: locale === "th" ? "ลบรูปภาพ" : "Remove image",
    cropImage: locale === "th" ? "ครอบ / ปรับภาพ" : "Crop / Adjust",
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

  async function handleFileSelected(file: File) {
    if (!file.type.startsWith("image/")) {
      setErrorMessage(t.invalidFormat);
      return;
    }

    setErrorMessage(null);
    setImgLoadError(false);

    // Open cropper immediately with the selected file as object URL
    const objectUrl = URL.createObjectURL(file);
    setCropperSource(objectUrl);
  }

  async function handleCroppedConfirm(croppedDataUrl: string, blob: Blob) {
    setCropperSource(null);
    setUploading(true);

    try {
      const fileName = `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`;
      const objectPath = `uploads/${fileName}`;

      const { pathOrUrl } = await uploadOrFallbackImage({
        fileOrBlob: blob,
        bucket: bucketName,
        objectPath,
      });

      onChange(pathOrUrl);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 2500);
    } catch {
      // Fallback directly to croppedDataUrl
      onChange(croppedDataUrl);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 2500);
    } finally {
      setUploading(false);
    }
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      void handleFileSelected(file);
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
      void handleFileSelected(file);
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

  function openCropperForCurrent() {
    if (displaySrc) {
      setCropperSource(displaySrc);
    }
  }

  const hasImage = Boolean(value && value.trim());
  const displaySrc = resolveImageSource(value, bucketName);
  const isDataUrl = Boolean(value?.startsWith("data:") || value?.startsWith("blob:"));
  const isStorageUrl = Boolean(value?.includes("/storage/v1/object/public/"));

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
        {hasImage && displaySrc ? (
          <div className="image-uploader-preview-wrap">
            <div className="image-uploader-thumbnail-container" style={{ aspectRatio: `${aspectRatio} / 1` }}>
              {!imgLoadError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displaySrc}
                  alt={label}
                  className="image-uploader-thumbnail"
                  onError={() => setImgLoadError(true)}
                  style={{ objectFit: "cover", width: "100%", height: "100%" }}
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
                  {isDataUrl ? t.dataUrlBadge : isStorageUrl ? t.storageBadge : t.externalBadge}
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
                  onClick={openCropperForCurrent}
                  title={t.cropImage}
                  disabled={uploading}
                >
                  <Crop size={13} />
                  <span>{t.cropImage}</span>
                </button>
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

      {/* Cropper Modal */}
      {cropperSource ? (
        <ImageCropperModal
          imageSrc={cropperSource}
          aspectRatio={aspectRatio}
          circularCrop={false}
          locale={locale}
          onConfirm={handleCroppedConfirm}
          onCancel={() => setCropperSource(null)}
        />
      ) : null}
    </div>
  );
}
