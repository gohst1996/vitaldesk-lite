import { notFound, redirect } from "next/navigation";
import { AppHeader, Screen } from "@/components/ui";
import { getClinicBySlug } from "@/lib/queries";
import { VerifyForm } from "./verify-form";

export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ email?: string; dev?: string }>;
}) {
  const { slug } = await params;
  const { email, dev } = await searchParams;

  const clinic = await getClinicBySlug(slug);
  if (!clinic) notFound();
  if (!email) redirect(`/c/${slug}/pedir`);

  return (
    <>
      <AppHeader
        title="Confirmá tu correo"
        subtitle={clinic.name}
        back={`/c/${clinic.slug}/pedir`}
      />
      <Screen>
        <VerifyForm slug={clinic.slug} email={email} devCode={dev} />
      </Screen>
    </>
  );
}
