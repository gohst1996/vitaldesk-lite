import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader, Alert, EmptyState, Screen, StatusBadge } from "@/components/ui";
import { staffLogout } from "@/actions/staff";
import { effectiveDate } from "@/lib/appointment-status";
import { formatLong, relative } from "@/lib/dates";
import {
  clinicCounts,
  getClinicById,
  listInbox,
  listToClose,
} from "@/lib/queries";
import { requireStaff } from "@/lib/session";

const DONE_MESSAGES: Record<string, string> = {
  confirmada: "Cita confirmada. Al paciente ya le llegó el correo.",
  reprogramada: "Le propusiste otra fecha al paciente.",
  rechazada: "Solicitud rechazada. El paciente fue notificado.",
};

export default async function Inbox({
  searchParams,
}: {
  searchParams: Promise<{ hecho?: string }>;
}) {
  const { hecho } = await searchParams;
  const session = await requireStaff();
  if (!session) redirect("/panel/entrar");

  const clinic = await getClinicById(session.clinicId);
  if (!clinic) redirect("/panel/entrar");

  const [inbox, toClose, counts] = await Promise.all([
    listInbox(clinic.id),
    listToClose(clinic.id),
    clinicCounts(clinic.id),
  ]);

  return (
    <>
      <AppHeader
        title="Bandeja"
        subtitle={`${clinic.name} · ${session.name}`}
        action={
          <form action={staffLogout}>
            <button className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100">
              Salir
            </button>
          </form>
        }
      />

      <Screen>
        {hecho && DONE_MESSAGES[hecho] && (
          <div className="mb-4">
            <Alert tone="success">{DONE_MESSAGES[hecho]}</Alert>
          </div>
        )}

        <div className="mb-5 grid grid-cols-3 gap-2">
          <Stat label="En espera" value={counts.pending} tone="amber" />
          <Stat label="Propuestas" value={counts.proposed} tone="blue" />
          <Stat label="Confirmadas" value={counts.confirmed} tone="teal" />
        </div>

        {inbox.length === 0 ? (
          <EmptyState
            title="Nada pendiente"
            body="Cuando entre una solicitud nueva la vas a ver acá."
            action={
              <Link href="/panel/agenda" className="btn-ghost">
                Ver la agenda
              </Link>
            }
          />
        ) : (
          <section className="space-y-3">
            <h2 className="px-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Esperan tu respuesta
            </h2>
            {inbox.map(({ appt, patient, doctor }) => {
              const when = effectiveDate(appt);
              return (
                <Link
                  key={appt.id}
                  href={`/panel/cita/${appt.id}`}
                  className="card animate-in-up block p-4 transition active:scale-[.99]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900">
                        {patient.name}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-600">
                        {formatLong(when, clinic.timezone)}
                      </p>
                    </div>
                    <StatusBadge status={appt.status} />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>{relative(when)}</span>
                    {doctor && <span>· {doctor.name}</span>}
                    {appt.origin === "STAFF" && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                        agendada por la clínica
                      </span>
                    )}
                  </div>

                  {appt.reason && (
                    <p className="mt-3 line-clamp-2 border-t border-slate-100 pt-3 text-sm text-slate-600">
                      {appt.reason}
                    </p>
                  )}
                </Link>
              );
            })}
          </section>
        )}

        {toClose.length > 0 && (
          <section className="mt-7 space-y-3">
            <h2 className="px-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Ya pasaron — cerralas
            </h2>
            {toClose.map(({ appt, patient }) => (
              <Link
                key={appt.id}
                href={`/panel/cita/${appt.id}`}
                className="card block p-4 opacity-80 transition active:scale-[.99]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-800">
                      {patient.name}
                    </p>
                    <p className="text-sm text-slate-500">
                      {formatLong(appt.scheduledAt!, clinic.timezone)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-brand-700">
                    Cerrar →
                  </span>
                </div>
              </Link>
            ))}
          </section>
        )}
      </Screen>
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "amber" | "blue" | "teal";
}) {
  const tones = {
    amber: "text-amber-700 bg-amber-50 ring-amber-200",
    blue: "text-blue-700 bg-blue-50 ring-blue-200",
    teal: "text-teal-700 bg-teal-50 ring-teal-200",
  } as const;
  return (
    <div className={`rounded-2xl px-3 py-3 ring-1 ring-inset ${tones[tone]}`}>
      <p className="text-2xl leading-none font-bold">{value}</p>
      <p className="mt-1.5 text-[11px] font-semibold tracking-wide uppercase opacity-80">
        {label}
      </p>
    </div>
  );
}
