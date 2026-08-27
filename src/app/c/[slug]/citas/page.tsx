import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader, EmptyState, Screen, StatusBadge } from "@/components/ui";
import { logout } from "@/actions/patient";
import { effectiveDate, OPEN_STATUSES } from "@/lib/appointment-status";
import { formatLong, relative } from "@/lib/dates";
import { getClinicBySlug, listPatientAppointments } from "@/lib/queries";
import { requirePatient } from "@/lib/session";

export default async function MyAppointments({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const clinic = await getClinicBySlug(slug);
  if (!clinic) notFound();

  const session = await requirePatient(slug);
  if (!session) redirect(`/c/${slug}/entrar`);

  const rows = await listPatientAppointments(session.patientId);
  const open = rows.filter((r) => OPEN_STATUSES.includes(r.appt.status));
  const past = rows.filter((r) => !OPEN_STATUSES.includes(r.appt.status));

  return (
    <>
      <AppHeader
        title="Mis citas"
        subtitle={clinic.name}
        action={
          <form action={logout}>
            <input type="hidden" name="slug" value={slug} />
            <button className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100">
              Salir
            </button>
          </form>
        }
      />

      <Screen>
        <Link href={`/c/${slug}/pedir`} className="btn-primary mb-5">
          <svg viewBox="0 0 20 20" fill="none" className="size-5">
            <path
              d="M10 4v12M4 10h12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Pedir otra cita
        </Link>

        {rows.length === 0 && (
          <EmptyState
            title="Todavía no tenés citas"
            body="Cuando pidas una, va a aparecer acá con su estado."
          />
        )}

        {open.length > 0 && (
          <section className="space-y-3">
            <h2 className="px-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Activas
            </h2>
            {open.map(({ appt }) => (
              <AppointmentCard key={appt.id} slug={slug} appt={appt} tz={clinic.timezone} />
            ))}
          </section>
        )}

        {past.length > 0 && (
          <section className="mt-7 space-y-3">
            <h2 className="px-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Anteriores
            </h2>
            {past.map(({ appt }) => (
              <AppointmentCard
                key={appt.id}
                slug={slug}
                appt={appt}
                tz={clinic.timezone}
                muted
              />
            ))}
          </section>
        )}
      </Screen>
    </>
  );
}

function AppointmentCard({
  slug,
  appt,
  tz,
  muted,
}: {
  slug: string;
  appt: {
    id: string;
    status: (typeof OPEN_STATUSES)[number] | string;
    requestedAt: Date;
    scheduledAt: Date | null;
    proposedAt: Date | null;
    reason: string | null;
  };
  tz: string;
  muted?: boolean;
}) {
  const when = effectiveDate(appt as never);

  return (
    <Link
      href={`/c/${slug}/citas/${appt.id}`}
      className={`card animate-in-up block p-4 transition active:scale-[.99] ${muted ? "opacity-70" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{formatLong(when, tz)}</p>
          <p className="mt-0.5 text-xs text-slate-500">{relative(when)}</p>
        </div>
        <StatusBadge status={appt.status as never} forPatient />
      </div>
      {appt.reason && (
        <p className="mt-3 line-clamp-2 border-t border-slate-100 pt-3 text-sm text-slate-600">
          {appt.reason}
        </p>
      )}
    </Link>
  );
}
