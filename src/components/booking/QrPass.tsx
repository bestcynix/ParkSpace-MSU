"use client";

/* QRCode.toDataURL returns a local data URI; next/image is not appropriate here. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode, ShieldCheck } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";

export function QrPass({ locale, payload, reference, expiresAt }: { locale: Locale; payload: string | null; reference: string; expiresAt: string | null }) {
  const t = getCopy(locale);
  const [image, setImage] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setError(false);
      if (!payload) {
        setImage("");
        return;
      }
      void QRCode.toDataURL(payload, { width: 220, margin: 2, errorCorrectionLevel: "M", color: { dark: "#1f2937", light: "#ffffff" } })
        .then((dataUrl) => { if (active) setImage(dataUrl); })
        .catch(() => { if (active) setError(true); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [payload]);

  return (
    <div className="qr-pass-card">
      <div className="qr-pass-heading">
        <span
          className="qr-pass-icon"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            minWidth: 44,
            minHeight: 44,
            borderRadius: 12,
            background: "var(--gold-soft, #fef3c7)",
            color: "#9a7800",
            flexShrink: 0,
            margin: 0,
            padding: 0,
            lineHeight: 1,
            boxSizing: "border-box",
          }}
        >
          <QrCode size={22} style={{ display: "block", margin: "auto" }} />
        </span>
        <div>
          <strong>{t.qrPass}</strong>
          <span>{payload && !error ? t.qrReady : t.qrUnavailable}</span>
        </div>
      </div>
      {image ? (
        <img className="qr-pass-image" src={image} alt={`${t.qrPass} ${reference}`} />
      ) : (
        <div className="qr-pass-placeholder">
          <ShieldCheck size={26} />
          <span>{t.qrUnavailable}</span>
        </div>
      )}
      <div className="qr-pass-reference">
        <strong>{reference}</strong>
        <span>{t.qrInstruction}</span>
        {expiresAt ? <small>{t.qrExpires}: {formatDate(expiresAt, locale)}</small> : null}
      </div>
    </div>
  );
}

function formatDate(value: string, locale: Locale) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(locale === "th" ? "th-TH" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
}
