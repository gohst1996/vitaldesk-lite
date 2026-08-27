import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader, EmptyState, Screen } from "@/components/ui";
import { formatDay, formatTime, partsInTz } from "@/lib/dates";
import { getClinicById, listHistory, listUpcoming } from "@/lib/queries";
import { requireStaff } from "@/lib/session";
import { STATUS } from "@/lib/appointment-status";

export default async function Agenda() {
  const session = await requireStaff();
  if (!session) redirect("/panel/entrar");

  const clinic = await getClinicById(session.clinicId);
  if (!clinic) redirect("/panel/entrar");

  const [upcoming, history] = await Promise.all([
    listUpcoming(clinic.id),
    listHistory(clinic.id, 20),
  ]);

  // Agrupamos por dia en la zona de la clinica
  const groups = new Map<string, typeof upcoming>();
  for (const row of upcoming) {
    const key = partsInTz(row.appt.scheduledAt!, clinic.timezone).date;
    const arr = groups.get(key) ?? [];
    arr.push(row);
    groups.set(key, arr);
  }

  return (
    <>
      <AppHeader title="Agenda" subtitle={`${clinic.name} · confirmadas`} />

      <Screen>
        {upcoming.length === 0 ? (
          <EmptyState
            title="No hay citas confirmadas"
            body="Confirmá una solicitud de la bandeja y va a aparecer acá."
            action={
              <Link href="/panel" className="btn-ghost">
                Ir a la bandeja
              </Link>
            }
          />
        ) : (
          <div className="space-y-6">
            {[...groups.entries()].map(([day, rows]) => (
              <section key={day}>
                <h2 className="mb-2.5 px-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  {formatDay(rows[0].appt.scheduledAt!, clinic.timezone)}
                </h2>
                <div className="card divide-y divide-slate-100">
                  {rows.map(({ appt, patient, doctor }) => (
                    <Link
                      key={appt.id}
                      href={`/panel/cita/${appt.id}`}
                      className="flex items-center gap-4 px-4 py-3.5 transition active:bg-slate-50"
                    >
                      <div className="w-20 shrink-0 text-right">
                        <p className="text-sm font-bold whitespace-nowrap text-brand-700">
                          {formatTime(appt.scheduledAt!, clinic.timezone)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {appt.durationMins} min
                        </p>
                      </div>
                      <div className="min-w-0 flex-1 border-l border-slate-100 pl-4">
                        <p className="truncate font-semibold text-slate-900">
                          {patient.name}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {doctor ? doctor.name : "Sin doctor asignado"}
                          {appt.reason ? ` · ${appt.reason}` : ""}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {history.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-2.5 px-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Cerradas
            </h2>
            <div className="card divide-y divide-slate-100">
              {history.map(({ appt, patient }) => (
                <Link
                  key={appt.id}
                  href={`/panel/cita/${appt.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition active:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-700">
                      {patient.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDay(
                        appt.scheduledAt ?? appt.requestedAt,
                        clinic.timezone,
                      )}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${STATUS[appt.status].badge}`}
                  >
                    {STATUS[appt.status].label}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </Screen>
    </>
  );
}
