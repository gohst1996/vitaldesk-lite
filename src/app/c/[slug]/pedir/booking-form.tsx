"use client";

import { useActionState } from "react";
import { requestBooking, type FormState } from "@/actions/patient";
import { SubmitButton } from "@/components/submit-button";
import { SlotPicker, type DayOption } from "@/components/slot-picker";
import { Alert, Field } from "@/components/ui";

export function BookingForm({
  slug,
  days,
  slots,
  takenByDay,
  now,
  patient,
}: {
  slug: string;
  days: DayOption[];
  slots: string[];
  takenByDay: Record<string, string[]>;
  now: { date: string; time: string };
  patient?: { name: string; email: string; phone: string | null } | null;
}) {
  const [state, action] = useActionState<FormState, FormData>(requestBooking, {});

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="slug" value={slug} />

      <section className="card animate-in-up space-y-4 p-5">
        <div>
          <h2 className="font-bold text-slate-900">Tus datos</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Con el nombre y el correo basta.
          </p>
        </div>

        <Field label="Nombre completo">
          <input
            name="name"
            required
            autoComplete="name"
            defaultValue={patient?.name ?? ""}
            placeholder="María Rodríguez"
            className="field"
          />
        </Field>

        <Field
          label="Correo"
          hint="Ahí te mandamos el código para entrar y los avisos de la cita."
        >
          <input
            name="email"
            type="email"
            required
            inputMode="email"
            autoComplete="email"
            defaultValue={patient?.email ?? ""}
            placeholder="maria@correo.com"
            className="field"
          />
        </Field>

        <Field label="Teléfono" optional>
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            defaultValue={patient?.phone ?? ""}
            placeholder="8888 8888"
            className="field"
          />
        </Field>
      </section>

      <section className="card animate-in-up space-y-4 p-5">
        <div>
          <h2 className="font-bold text-slate-900">¿Cuándo te sirve?</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Es una preferencia. La clínica la confirma o te propone otra.
          </p>
        </div>
        <SlotPicker days={days} slots={slots} takenByDay={takenByDay} now={now} />
      </section>

      <section className="card animate-in-up space-y-4 p-5">
        <Field
          label="¿Algo que quieras aclarar?"
          optional
          hint="Un dolor puntual, una urgencia, si venís por control, lo que sea."
        >
          <textarea
            name="reason"
            rows={4}
            maxLength={1000}
            placeholder="Me duele una muela de abajo del lado derecho desde el lunes…"
            className="field resize-none"
          />
        </Field>
      </section>

      {state.error && <Alert tone="error">{state.error}</Alert>}

      <SubmitButton pendingText="Mandando el código…">
        Continuar
      </SubmitButton>

      <p className="px-2 text-center text-xs leading-relaxed text-slate-500">
        Te mandamos un código de 6 dígitos al correo para confirmar que es tuyo.
        La cita se crea cuando lo escribas.
      </p>
    </form>
  );
}
