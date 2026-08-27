"use client";

import { useActionState } from "react";
import { createAppointmentForPatient, type FormState } from "@/actions/staff";
import { SlotPicker } from "@/components/slot-picker";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field } from "@/components/ui";

export function StaffBookingForm({
  days,
  slots,
  takenByDay,
  now,
  doctors,
  canConfirmNow,
}: {
  days: { value: string; label: string }[];
  slots: string[];
  takenByDay: Record<string, string[]>;
  now: { date: string; time: string };
  doctors: { id: string; name: string }[];
  canConfirmNow: boolean;
}) {
  const [state, action] = useActionState<FormState, FormData>(
    createAppointmentForPatient,
    {},
  );

  return (
    <form action={action} className="space-y-5">
      <section className="card animate-in-up space-y-4 p-5">
        <div>
          <h2 className="font-bold text-slate-900">Datos del paciente</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Si ya existe con ese correo, se usa su ficha.
          </p>
        </div>

        <Field label="Nombre completo">
          <input
            name="name"
            required
            placeholder="María Rodríguez"
            className="field"
          />
        </Field>

        <Field label="Correo" hint="Ahí le llega el aviso de la cita.">
          <input
            name="email"
            type="email"
            required
            inputMode="email"
            placeholder="maria@correo.com"
            className="field"
          />
        </Field>

        <Field label="Teléfono" optional>
          <input name="phone" type="tel" inputMode="tel" placeholder="8888 8888" className="field" />
        </Field>
      </section>

      <section className="card animate-in-up space-y-4 p-5">
        <h2 className="font-bold text-slate-900">Fecha y hora</h2>
        <SlotPicker days={days} slots={slots} takenByDay={takenByDay} now={now} />

        {doctors.length > 0 && (
          <Field label="Doctor" optional>
            <select name="doctorId" className="field" defaultValue="">
              <option value="">Sin asignar</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {canConfirmNow && (
          <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-3.5">
            <input
              type="checkbox"
              name="confirmNow"
              defaultChecked
              className="mt-0.5 size-5 shrink-0 rounded accent-teal-600"
            />
            <span className="text-sm leading-relaxed text-slate-700">
              <strong className="font-semibold">Dejarla confirmada ya.</strong>{" "}
              Desmarcá esto si el doctor todavía tiene que revisarla.
            </span>
          </label>
        )}
      </section>

      <section className="card animate-in-up space-y-4 p-5">
        <Field label="Motivo de la consulta" optional>
          <textarea
            name="reason"
            rows={3}
            maxLength={1000}
            placeholder="Control de ortodoncia"
            className="field resize-none"
          />
        </Field>

        <Field label="Nota interna" optional hint="Esto el paciente no lo ve.">
          <input
            name="staffNote"
            maxLength={1000}
            placeholder="Llamó la mamá, paga en efectivo"
            className="field"
          />
        </Field>
      </section>

      {state.error && <Alert tone="error">{state.error}</Alert>}

      <SubmitButton pendingText="Agendando…">Agendar la cita</SubmitButton>
    </form>
  );
}
