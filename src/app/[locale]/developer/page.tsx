import { redirect } from "next/navigation";
export default async function DeveloperRoot({ params }: { params: Promise<{ locale: string }> }) { const { locale } = await params; redirect(`/${locale}/admin/dashboard`); }
