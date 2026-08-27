"use client";

import { useActionState, useState } from "react";
import { decideAppointment, type FormState } from "@/actions/staff";
import { SlotPicker } from "@/components/slot-picker";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field } from "@/components/ui";

type Mode = "menu" | "confirm" | "reschedule" | "decline";

export function DecisionPanel({
  id,
  days,
  slots,
  takenByDay,
  now,
  defaultDate,
  defaultTime,
  doctors,
  defaultDoctorId,
  patientName,
}: {
  id: string;
  days: { value: string; label: string }[];
  slots: string[];
  takenByDay: Record<string, string[]>;
  now: { date: string; time: string };
  defaultDate: string;
  defaultTime: string;
  doctors: { id: string; name: string }[];
  defaultDoctorId: string;
  patientName: string;
}) {
  const [mode, setMode] = useState<Mode>("menu");
  const [state, action] = useActionState<FormState, FormData>(
    decideAppointment,
    {},
  );

  if (mode === "menu") {
    return (
      <div className="card animate-in-up space-y-2.5 p-5">
        <h2 className="font-bold text-slate-900">¿Qué hacemos con esta cita?</h2>
        <p className="mb-1 text-sm text-slate-500">
          {patientName.split(" ")[0]} recibe un correo con lo que decidas.
        </p>
        <button
          type="button"
          onClick={() => setMode("confirm")}
          className="btn-primary"
        >
          Confirmar la cita
        </button>
        <button
          type="button"
          onClick={() => setMode("reschedule")}
          className="btn-ghost"
        >
          Proponer otra fecha
        </button>
        <button
          type="button"
          onClick={() => setMode("decline")}
          className="btn-ghost text-rose-700"
        >
          Rechazar la solicitud
        </button>
      </div>
    );
  }

  if (mode === "decline") {
    return (
      <form
        action={action}
        className="card animate-in-up space-y-4 border-rose-200 bg-rose-50/40 p-5"
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="intent" value="decline" />

        <div>
          <h2 className="font-bold text-slate-900">Rechazar la solicitud</h2>
          <p className="mt-1 text-sm text-slate-500">
            Contale el motivo para que pueda pedir otra.
          </p>
        </div>

        <Field label="Motivo" optional>
          <textarea
            name="message"
            rows={3}
            maxLength={1000}
            placeholder="Esta semana estamos llenos. Escribinos la próxima…"
            className="field resize-none"
          />
        </Field>

        {state.error && <Alert tone="error">{state.error}</Alert>}

        <SubmitButton className="btn-danger" pendingText="Rechazando…">
          Rechazar y avisar
        </SubmitButton>
        <button type="button" onClick={() => setMode("menu")} className="btn-ghost">
          Volver
        </button>
      </form>
    );
  }

  const isConfirm = mode === "confirm";

  return (
    <form action={action} className="card animate-in-up space-y-4 p-5">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="intent" value={isConfirm ? "confirm" : "reschedule"} />

      <div>
        <h2 className="font-bold text-slate-900">
          {isConfirm ? "Confirmar la cita" : "Proponer otra fecha"}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {isConfirm
            ? "Podés ajustar el horario antes de dejarlo en firme."
            : "El paciente la acepta o te propone otra."}
        </p>
      </div>

      <SlotPicker
        days={days}
        slots={slots}
        takenByDay={takenByDay}
        now={now}
        defaultDate={defaultDate}
        defaultTime={isConfirm ? defaultTime : ""}
      />

      {doctors.length > 0 && (
        <Field label="Doctor" optional>
          <select name="doctorId" defaultValue={defaultDoctorId} className="field">
            <option value="">Sin asignar</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Mensaje para el paciente" optional>
        <textarea
          name="message"
          rows={3}
          maxLength={1000}
          placeholder={
            isConfirm
              ? "Llegá 10 minutos antes con tu cédula."
              : "A esa hora tengo cirugía. ¿Te sirve más tarde?"
          }
          className="field resize-none"
        />
      </Field>

      <Field label="Nota interna" optional hint="Esto el paciente no lo ve.">
        <input
          name="staffNote"
          maxLength={1000}
          placeholder="Paciente nuevo, revisar radiografías"
          className="field"
        />
      </Field>

      {state.error && <Alert tone="error">{state.error}</Alert>}

      <SubmitButton pendingText="Guardando…">
        {isConfirm ? "Confirmar y avisar" : "Mandar la propuesta"}
      </SubmitButton>
      <button type="button" onClick={() => setMode("menu")} className="btn-ghost">
        Volver
      </button>
    </form>
  );
}
