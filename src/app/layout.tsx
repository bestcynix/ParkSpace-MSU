import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SystemConsoleNotice } from "@/components/layout/SystemConsoleNotice";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ParkSpace MSU | จองง่าย จอดสะดวก",
    template: "%s | ParkSpace MSU",
  },
  description: "ระบบจองที่จอดรถมหาวิทยาลัยมหาสารคาม / Smart parking for Mahasarakham University.",
  applicationName: "ParkSpace MSU",
  verification: {
    google: "PR6C3gK2h6W23zGl3nkyZJJOobDSNhpYihE9gPDAVaI",
  },
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
    <html lang="th" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              function isIgnored(err){
                if (!err) return false;
                var str = typeof err === 'string' ? err : ((err && (err.message || err.stack || err.name)) ? (err.message + ' ' + (err.stack || '')) : ('' + err));
                return str.indexOf('startTime') !== -1 || str.indexOf('reportAllChanges') !== -1;
              }
              try {
                var origErr = console.error;
                console.error = function(){
                  for (var i = 0; i < arguments.length; i++) {
                    if (isIgnored(arguments[i])) return;
                  }
                  origErr.apply(console, arguments);
                };
                var origWarn = console.warn;
                console.warn = function(){
                  for (var j = 0; j < arguments.length; j++) {
                    if (isIgnored(arguments[j])) return;
                  }
                  origWarn.apply(console, arguments);
                };
              } catch(e){}
              window.addEventListener('error', function(e){
                if (isIgnored(e.error) || isIgnored(e.message) || (e.filename && e.filename.indexOf('VM') !== -1 && isIgnored(e.message))) {
                  e.preventDefault();
                  e.stopImmediatePropagation();
                  return true;
                }
              }, true);
              window.addEventListener('unhandledrejection', function(e){
                if (isIgnored(e.reason)) {
                  e.preventDefault();
                  e.stopImmediatePropagation();
                }
              }, true);
            })();`,
          }}
        />
      </head>
      <body><SystemConsoleNotice />{children}</body>
    </html>
  );
}
