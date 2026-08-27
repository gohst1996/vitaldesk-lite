import { notFound, redirect } from "next/navigation";
import { AppHeader, Alert, Screen, StatusBadge } from "@/components/ui";
import { STATUS, canPatientCancel, effectiveDate } from "@/lib/appointment-status";
import { buildSlots, formatLong, nextWorkDays, nowInTz, relative } from "@/lib/dates";
import { getAppointmentForPatient, getClinicBySlug, listEvents } from "@/lib/queries";
import { requirePatient } from "@/lib/session";
import { ProposalActions } from "./proposal-actions";
import { CancelButton } from "./cancel-button";

export default async function AppointmentDetail({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ nueva?: string }>;
}) {
  const { slug, id } = await params;
  const { nueva } = await searchParams;

  const clinic = await getClinicBySlug(slug);
  if (!clinic) notFound();

  const session = await requirePatient(slug);
  if (!session) redirect(`/c/${slug}/entrar`);

  const row = await getAppointmentForPatient(id, session.patientId);
  if (!row) notFound();

  const { appt, doctor } = row;
  const meta = STATUS[appt.status];
  const when = effectiveDate(appt);
  const events = await listEvents(appt.id);

  const days = nextWorkDays(clinic.workDays, 10, clinic.timezone);
  const slots = buildSlots(clinic.openHour, clinic.closeHour, clinic.slotMins);

  return (
    <>
      <AppHeader
        title="Tu cita"
        subtitle={clinic.name}
        back={`/c/${slug}/citas`}
      />

      <Screen>
        {/* Solo tiene sentido justo después de crearla; si la clínica ya
            respondió, el estado de abajo cuenta la historia. */}
        {nueva && appt.status === "PENDING" && (
          <div className="mb-4">
            <Alert tone="success">
              ¡Listo! Tu solicitud quedó registrada. Te avisamos por correo apenas
              la clínica responda.
            </Alert>
          </div>
        )}

        <section className="card animate-in-up overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-5">
            <StatusBadge status={appt.status} forPatient />
            <p className="mt-3 text-xl leading-tight font-bold text-slate-900">
              {formatLong(when, clinic.timezone)}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {relative(when)} · {appt.durationMins} minutos
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              {meta.hint}
            </p>
          </div>

          <dl className="divide-y divide-slate-100 text-sm">
            {doctor && (
              <Row label="Te atiende" value={doctor.name} />
            )}
            {appt.status === "RESCHEDULE_PROPOSED" && (
              <Row
                label="Vos pediste"
                value={formatLong(appt.requestedAt, clinic.timezone)}
                muted
              />
            )}
            {appt.reason && <Row label="Lo que contaste" value={appt.reason} />}
            {appt.replyMessage && (
              <Row label="Mensaje de la clínica" value={appt.replyMessage} accent />
            )}
          </dl>
        </section>

        {appt.status === "RESCHEDULE_PROPOSED" && appt.proposedAt && (
          <div className="mt-4">
            <ProposalActions
              slug={slug}
              id={appt.id}
              proposedLabel={formatLong(appt.proposedAt, clinic.timezone)}
              days={days}
              slots={slots}
              now={nowInTz(clinic.timezone)}
            />
          </div>
        )}

        {canPatientCancel(appt.status) && (
          <div className="mt-4">
            <CancelButton slug={slug} id={appt.id} />
          </div>
        )}

        <section className="mt-6">
          <h2 className="mb-3 px-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Historial
          </h2>
          <ol className="card divide-y divide-slate-100">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3 px-5 py-3.5">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500" />
                <div className="min-w-0">
                  <p className="text-sm text-slate-700">{e.message ?? e.type}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {formatLong(e.createdAt, clinic.timezone)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </Screen>
    </>
  );
}

function Row({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: string;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="px-5 py-3.5">
      <dt className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
        {label}
      </dt>
      <dd
        className={`mt-1 leading-relaxed whitespace-pre-line ${
          accent
            ? "rounded-lg border-l-3 border-brand-500 bg-slate-50 px-3 py-2 text-slate-700"
            : muted
              ? "text-slate-400 line-through"
              : "text-slate-700"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
