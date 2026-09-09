import { redirect } from "next/navigation";
export default async function StaffRoot({ params }: { params: Promise<{ locale: string }> }) { const { locale } = await params; redirect(`/${locale}/staff/dashboard`); }
