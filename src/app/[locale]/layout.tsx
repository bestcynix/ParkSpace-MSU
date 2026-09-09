import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale, locales, type Locale } from "@/lib/i18n";
import { LocaleDocument } from "@/components/layout/LocaleDocument";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const validLocale: Locale = isLocale(locale) ? locale : "th";
  return {
    alternates: {
      languages: {
        th: `/th`,
        en: `/en`,
      },
    },
    other: {
      "content-language": validLocale,
    },
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <LocaleDocument locale={locale}>{children}</LocaleDocument>;
}
