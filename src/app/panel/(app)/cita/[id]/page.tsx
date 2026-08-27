import { notFound, redirect } from "next/navigation";
import { AppHeader, Alert, Screen, StatusBadge } from "@/components/ui";
import { canStaffDecide, effectiveDate } from "@/lib/appointment-status";
import {
  buildSlots,
  formatLong,
  nextWorkDays,
  nowInTz,
  partsInTz,
  relative,
} from "@/lib/dates";
import {
  findConflicts,
  getAppointmentForStaff,
  getClinicById,
  listDoctors,
  listEvents,
  takenSlotsByDay,
} from "@/lib/queries";
import { requireStaff } from "@/lib/session";
import { DecisionPanel } from "./decision-panel";
import { ClosePanel } from "./close-panel";

export default async function StaffAppointment({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creada?: string }>;
}) {
  const { id } = await params;
  const { creada } = await searchParams;

  const session = await requireStaff();
  if (!session) redirect("/panel/entrar");

  const clinic = await getClinicById(session.clinicId);
  if (!clinic) redirect("/panel/entrar");

  const row = await getAppointmentForStaff(id, clinic.id);
  if (!row) notFound();

  const { appt, patient, doctor } = row;
  const when = effectiveDate(appt);

  const [doctors, events, takenByDay] = await Promise.all([
    listDoctors(clinic.id),
    listEvents(appt.id),
    takenSlotsByDay(clinic.id, clinic.timezone),
  ]);

  const conflicts = await findConflicts(
    clinic.id,
    appt.doctorId,
    appt.requestedAt,
    appt.durationMins,
    appt.id,
  );

  const days = nextWorkDays(clinic.workDays, 14, clinic.timezone);
  const slots = buildSlots(clinic.openHour, clinic.closeHour, clinic.slotMins);
  const requested = partsInTz(appt.requestedAt, clinic.timezone);

  return (
    <>
      <AppHeader title={patient.name} subtitle="Solicitud de cita" back="/panel" />

      <Screen>
        {creada && (
          <div className="mb-4">
            <Alert tone="success">Cita creada a nombre de {patient.name}.</Alert>
          </div>
        )}

        <section className="card animate-in-up overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-5">
            <StatusBadge status={appt.status} />
            <p className="mt-3 text-xl leading-tight font-bold text-slate-900">
              {formatLong(when, clinic.timezone)}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {relative(when)} · {appt.durationMins} min ·{" "}
              {appt.origin === "PATIENT"
                ? "la pidió el paciente"
                : "la agendó la clínica"}
            </p>
          </div>

          <dl className="divide-y divide-slate-100 text-sm">
            <Row label="Correo" value={patient.email} />
            {patient.phone && <Row label="Teléfono" value={patient.phone} />}
            {doctor && <Row label="Doctor" value={doctor.name} />}
            {appt.reason && (
              <Row label="Lo que contó el paciente" value={appt.reason} />
            )}
            {appt.staffNote && (
              <Row label="Nota interna" value={appt.staffNote} internal />
            )}
            {appt.replyMessage && (
              <Row label="Mensaje que le mandaste" value={appt.replyMessage} />
            )}
          </dl>
        </section>

        {conflicts.length > 0 && (
          <div className="mt-4">
            <Alert tone="warn">
              <strong className="font-semibold">Ojo:</strong> ese horario choca
              con {conflicts.length === 1 ? "otra cita" : `${conflicts.length} citas`}{" "}
              del mismo doctor ({conflicts.map((c) => c.patient.name).join(", ")}).
            </Alert>
          </div>
        )}

        {canStaffDecide(appt.status) && (
          <div className="mt-4">
            <DecisionPanel
              id={appt.id}
              days={days}
              slots={slots}
              takenByDay={takenByDay}
              now={nowInTz(clinic.timezone)}
              defaultDate={requested.date}
              defaultTime={requested.time}
              doctors={doctors.map((d) => ({ id: d.id, name: d.name }))}
              defaultDoctorId={appt.doctorId ?? ""}
              patientName={patient.name}
            />
          </div>
        )}

        {appt.status === "CONFIRMED" && (
          <div className="mt-4">
            <ClosePanel id={appt.id} isPast={when.getTime() < Date.now()} />
          </div>
        )}

        <section className="mt-6">
          <h2 className="mb-3 px-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Bitácora
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
  internal,
}: {
  label: string;
  value: string;
  internal?: boolean;
}) {
  return (
    <div className="px-5 py-3.5">
      <dt className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
        {label}
        {internal && (
          <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] normal-case">
            no la ve el paciente
          </span>
        )}
      </dt>
      <dd className="mt-1 leading-relaxed whitespace-pre-line text-slate-700">
        {value}
      </dd>
    </div>
  );
}
