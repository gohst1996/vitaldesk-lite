"use client";

import { useActionState } from "react";
import { requestStaffLogin, type FormState } from "@/actions/staff";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field } from "@/components/ui";

export function StaffLoginForm() {
  const [state, action] = useActionState<FormState, FormData>(
    requestStaffLogin,
    {},
  );

  return (
    <form action={action} className="card animate-in-up space-y-5 p-5">
      <div>
        <h2 className="font-bold text-slate-900">Entrá con tu correo</h2>
        <p className="mt-1 text-sm text-slate-500">
          Sin contraseña. Te mandamos un código de 6 dígitos que vence en 10
          minutos.
        </p>
      </div>

      <Field label="Correo de la clínica">
        <input
          name="email"
          type="email"
          required
          inputMode="email"
          autoComplete="email"
          autoFocus
          placeholder="doctor@clinica.com"
          className="field"
        />
      </Field>

      {state.error && <Alert tone="error">{state.error}</Alert>}

      <SubmitButton pendingText="Mandando el código…">
        Mandame el código
      </SubmitButton>
    </form>
  );
}
