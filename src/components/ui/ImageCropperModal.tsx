"use client";

import { useState, useRef, useEffect, useCallback, type MouseEvent, type TouchEvent } from "react";
import { Crop, RotateCw, ZoomIn, ZoomOut, Check, X, RefreshCw } from "lucide-react";
import type { Locale } from "@/lib/i18n";

export interface ImageCropperModalProps {
  imageSrc: string;
  aspectRatio?: number; // e.g. 1 for square (avatar), 16/9 for wide (parking area cover)
  circularCrop?: boolean;
  locale: Locale;
  onConfirm: (croppedDataUrl: string, blob: Blob) => void;
  onCancel: () => void;
}

export function ImageCropperModal({
  imageSrc,
  aspectRatio = 1,
  circularCrop = false,
  locale,
  onConfirm,
  onCancel,
}: ImageCropperModalProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // in degrees: 0, 90, 180, 270
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const t = {
    cropTitle: locale === "th" ? "ครอบและปรับแต่งภาพ" : "Crop & Adjust Image",
    cropHint: locale === "th" ? "ลากเพื่อเลื่อนตำแหน่ง และใช้แถบซูมเพื่อย่อ/ขยาย" : "Drag to reposition and use slider to zoom",
    zoom: locale === "th" ? "ย่อ/ขยาย" : "Zoom",
    rotate: locale === "th" ? "หมุน 90°" : "Rotate 90°",
    reset: locale === "th" ? "รีเซ็ต" : "Reset",
    apply: locale === "th" ? "ใช้ภาพนี้" : "Apply Crop",
    cancel: locale === "th" ? "ยกเลิก" : "Cancel",
  };

  // Reset state when imageSrc changes
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  }, [imageSrc]);

  // Handle Drag Start
  function handleMouseDown(e: MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
  }

  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    if (e.touches.length === 1) {
      setIsDragging(true);
      const touch = e.touches[0];
      dragStartRef.current = { x: touch.clientX, y: touch.clientY };
      panStartRef.current = { ...pan };
    }
  }

  // Handle Drag Move
  const handleMouseMove = useCallback((e: globalThis.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy,
    });
  }, [isDragging]);

  const handleTouchMove = useCallback((e: globalThis.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragStartRef.current.x;
    const dy = touch.clientY - dragStartRef.current.y;
    setPan({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy,
    });
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleDragEnd);
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("touchend", handleDragEnd);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleDragEnd);
    };
  }, [isDragging, handleMouseMove, handleTouchMove, handleDragEnd]);

  function handleRotate() {
    setRotation((r) => (r + 90) % 360);
  }

  function handleReset() {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  }

  // Perform the actual crop to Canvas
  async function handleApply() {
    if (!imageRef.current || !containerRef.current) return;

    const img = imageRef.current;
    const cropBox = containerRef.current.getBoundingClientRect();
    const boxSize = Math.min(cropBox.width, cropBox.height);

    // Target output dimensions
    const outputWidth = aspectRatio >= 1 ? 600 : Math.round(600 * aspectRatio);
    const outputHeight = aspectRatio >= 1 ? Math.round(600 / aspectRatio) : 600;

    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Ratio between output canvas and crop frame on screen
    const frameWidth = aspectRatio >= 1 ? boxSize * 0.8 : (boxSize * 0.8) * aspectRatio;
    const frameHeight = aspectRatio >= 1 ? (boxSize * 0.8) / aspectRatio : boxSize * 0.8;
    const scaleFactor = outputWidth / frameWidth;

    ctx.save();
    // Center of canvas
    ctx.translate(outputWidth / 2, outputHeight / 2);
    // Apply user rotation
    ctx.rotate((rotation * Math.PI) / 180);
    // Apply user pan & zoom
    ctx.scale(zoom, zoom);

    // Determine drawn image dimensions relative to crop frame
    const naturalWidth = img.naturalWidth || 600;
    const naturalHeight = img.naturalHeight || 600;

    // Base display size inside crop frame
    const imgAspect = naturalWidth / naturalHeight;
    let baseDrawW = frameWidth;
    let baseDrawH = frameHeight;

    if (imgAspect > (frameWidth / frameHeight)) {
      baseDrawH = frameHeight;
      baseDrawW = frameHeight * imgAspect;
    } else {
      baseDrawW = frameWidth;
      baseDrawH = frameWidth / imgAspect;
    }

    const drawW = baseDrawW * scaleFactor;
    const drawH = baseDrawH * scaleFactor;

    // Offset based on user pan (rotated back)
    const rad = (-rotation * Math.PI) / 180;
    const unrotatedPanX = pan.x * Math.cos(rad) - pan.y * Math.sin(rad);
    const unrotatedPanY = pan.x * Math.sin(rad) + pan.y * Math.cos(rad);

    ctx.drawImage(
      img,
      -drawW / 2 + unrotatedPanX * scaleFactor / zoom,
      -drawH / 2 + unrotatedPanY * scaleFactor / zoom,
      drawW,
      drawH
    );

    ctx.restore();

    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error("Failed to produce cropped blob"));
        },
        "image/jpeg",
        0.88
      );
    });

    onConfirm(dataUrl, blob);
  }

  // Calculate crop viewport frame size
  const frameStyle = {
    aspectRatio: `${aspectRatio} / 1`,
    borderRadius: circularCrop ? "50%" : "14px",
  };

  return (
    <div className="cropper-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="cropper-title">
      <div className="cropper-modal-card">
        {/* Modal Header */}
        <div className="cropper-header">
          <div className="cropper-header-title">
            <Crop size={18} className="cropper-icon" />
            <h3 id="cropper-title">{t.cropTitle}</h3>
          </div>
          <button type="button" className="icon-button" onClick={onCancel} aria-label={t.cancel}>
            <X size={18} />
          </button>
        </div>

        {/* Viewport / Crop Box */}
        <div
          ref={containerRef}
          className="cropper-viewport"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          style={{ cursor: isDragging ? "grabbing" : "grab" }}
        >
          {/* Active Image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={imageSrc}
            alt="To crop"
            className="cropper-image"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
              transformOrigin: "center center",
              userSelect: "none",
              pointerEvents: "none",
            }}
          />

          {/* Mask overlay */}
          <div className="cropper-mask">
            <div className={`cropper-frame ${circularCrop ? "is-circle" : ""}`} style={frameStyle}>
              <div className="cropper-grid-line h1" />
              <div className="cropper-grid-line h2" />
              <div className="cropper-grid-line v1" />
              <div className="cropper-grid-line v2" />
            </div>
          </div>
        </div>

        <p className="cropper-hint">{t.cropHint}</p>

        {/* Controls Toolbar */}
        <div className="cropper-controls">
          <div className="cropper-control-group zoom-group">
            <button
              type="button"
              className="icon-button"
              onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))))}
              aria-label="Zoom Out"
            >
              <ZoomOut size={16} />
            </button>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="cropper-slider"
              aria-label={t.zoom}
            />
            <button
              type="button"
              className="icon-button"
              onClick={() => setZoom((z) => Math.min(3, Number((z + 0.15).toFixed(2))))}
              aria-label="Zoom In"
            >
              <ZoomIn size={16} />
            </button>
            <span className="cropper-zoom-text">{Math.round(zoom * 100)}%</span>
          </div>

          <div className="cropper-control-group action-group">
            <button
              type="button"
              className="secondary-button compact-btn"
              onClick={handleRotate}
              title={t.rotate}
            >
              <RotateCw size={14} />
              <span>{t.rotate}</span>
            </button>
            <button
              type="button"
              className="secondary-button compact-btn"
              onClick={handleReset}
              title={t.reset}
            >
              <RefreshCw size={14} />
              <span>{t.reset}</span>
            </button>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="cropper-footer">
          <button type="button" className="secondary-button" onClick={onCancel}>
            <X size={15} />
            <span>{t.cancel}</span>
          </button>
          <button type="button" className="primary-button" onClick={() => void handleApply()}>
            <Check size={15} />
            <span>{t.apply}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
