import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ParkSpace MSU | จองง่าย จอดสะดวก",
    template: "%s | ParkSpace MSU",
  },
  description: "ระบบจองที่จอดรถมหาวิทยาลัยมหาสารคาม / Smart parking for Mahasarakham University.",
  applicationName: "ParkSpace MSU",
  keywords: ["ParkSpace MSU", "จองที่จอดรถ", "มหาวิทยาลัยมหาสารคาม", "Mahasarakham University parking"],
  icons: {
    icon: "/brand/favicon.svg",
    apple: "/brand/app-icon.svg",
  },
  openGraph: {
    title: "ParkSpace MSU",
    description: "จองง่าย จอดสะดวก / Easy to Book, Easy to Park",
    siteName: "ParkSpace MSU",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f8c928",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
