import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader, Logo, Screen } from "@/components/ui";
import { getClinicBySlug } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { buildSlots, weekdayName } from "@/lib/dates";

export default async function ClinicHome({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const clinic = await getClinicBySlug(slug);
  if (!clinic) notFound();

  const session = await getSession();
  const isPatientHere =
    session?.kind === "patient" && session.clinicSlug === clinic.slug;

  const slots = buildSlots(clinic.openHour, clinic.closeHour, clinic.slotMins);
  const dayList = [...clinic.workDays]
    .sort((a, b) => a - b)
    .map((d) => weekdayName(d))
    .join(", ");

  return (
    <>
      <AppHeader
        title={clinic.name}
        subtitle={kindLabel(clinic.kind)}
        action={
          isPatientHere ? (
            <Link
              href={`/c/${clinic.slug}/citas`}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
            >
              Mis citas
            </Link>
          ) : null
        }
      />

      <Screen>
        <section className="card animate-in-up overflow-hidden">
          <div className="bg-linear-to-br from-brand-600 to-brand-700 px-5 py-7 text-white">
            <Logo className="mb-4 size-9 opacity-90" />
            <h2 className="text-2xl leading-tight font-bold">
              Pedí tu cita en menos de un minuto
            </h2>
            <p className="mt-2 text-sm text-brand-50/90">
              Solo tu nombre y tu correo. Sin contraseñas, sin instalar nada.
            </p>
          </div>
          <div className="p-5">
            <Link href={`/c/${clinic.slug}/pedir`} className="btn-primary">
              Pedir una cita
            </Link>
            <Link
              href={`/c/${clinic.slug}/entrar`}
              className="mt-2 block py-3 text-center text-sm font-semibold text-brand-700"
            >
              Ya pedí una — ver el estado
            </Link>
          </div>
        </section>

        <section className="card mt-4 divide-y divide-slate-100 animate-in-up">
          <Row
            icon="clock"
            title="Horario"
            body={`${fmtHour(clinic.openHour)} a ${fmtHour(clinic.closeHour)} · ${dayList}`}
          />
          <Row
            icon="calendar"
            title="Citas de"
            body={`${clinic.slotMins} minutos · ${slots.length} espacios por día`}
          />
          {clinic.phone && (
            <Row icon="phone" title="Teléfono" body={clinic.phone} />
          )}
          {clinic.address && (
            <Row icon="pin" title="Dirección" body={clinic.address} />
          )}
        </section>

        <section className="mt-4 rounded-2xl bg-slate-200/50 px-5 py-4">
          <p className="text-sm leading-relaxed text-slate-600">
            <strong className="font-semibold text-slate-800">
              ¿Cómo funciona?
            </strong>{" "}
            Pedís el día y la hora que te sirven. La solicitud queda{" "}
            <em className="not-italic font-medium text-amber-700">en espera</em>{" "}
            hasta que {clinic.kind === "DENTAL" ? "el dentista" : "el doctor"} la
            revise: la confirma o te propone otra fecha. Te avisamos por correo.
          </p>
        </section>

        <p className="mt-6 text-center text-xs text-slate-400">
          ¿Trabajás en esta clínica?{" "}
          <Link href="/panel/entrar" className="font-semibold text-slate-500 underline">
            Entrar al panel
          </Link>
        </p>
      </Screen>
    </>
  );
}

function Row({
  icon,
  title,
  body,
}: {
  icon: "clock" | "calendar" | "phone" | "pin";
  title: string;
  body: string;
}) {
  const paths = {
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
    phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1.1 1A16 16 0 0 1 4 5.1 1 1 0 0 1 5 4Z" />,
    pin: <><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></>,
  };
  return (
    <div className="flex items-start gap-3 px-5 py-3.5">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 size-5 shrink-0 text-brand-600"
      >
        {paths[icon]}
      </svg>
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
          {title}
        </p>
        <p className="text-sm text-slate-700">{body}</p>
      </div>
    </div>
  );
}

function kindLabel(kind: string) {
  return kind === "DENTAL"
    ? "Clínica dental"
    : kind === "MEDICAL"
      ? "Clínica médica"
      : "Clínica";
}

function fmtHour(h: number) {
  const suffix = h < 12 ? "a.m." : "p.m.";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour} ${suffix}`;
}
