import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader, Screen } from "@/components/ui";
import { getClinicBySlug } from "@/lib/queries";
import { LoginForm } from "./login-form";

export default async function PatientLogin({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const clinic = await getClinicBySlug(slug);
  if (!clinic) notFound();

  return (
    <>
      <AppHeader
        title="Ver mis citas"
        subtitle={clinic.name}
        back={`/c/${clinic.slug}`}
      />
      <Screen>
        <LoginForm slug={clinic.slug} />
        <p className="mt-6 text-center text-sm text-slate-500">
          ¿Primera vez acá?{" "}
          <Link
            href={`/c/${clinic.slug}/pedir`}
            className="font-semibold text-brand-700"
          >
            Pedí tu cita
          </Link>
        </p>
      </Screen>
    </>
  );
}
