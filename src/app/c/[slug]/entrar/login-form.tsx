"use client";

import { useActionState } from "react";
import { requestPatientLogin, type FormState } from "@/actions/patient";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field } from "@/components/ui";

export function LoginForm({ slug }: { slug: string }) {
  const [state, action] = useActionState<FormState, FormData>(
    requestPatientLogin,
    {},
  );

  return (
    <form action={action} className="card animate-in-up space-y-5 p-5">
      <input type="hidden" name="slug" value={slug} />

      <div>
        <h2 className="font-bold text-slate-900">Entrá con tu correo</h2>
        <p className="mt-1 text-sm text-slate-500">
          Sin contraseña. Te mandamos un código de 6 dígitos.
        </p>
      </div>

      <Field label="Correo">
        <input
          name="email"
          type="email"
          required
          inputMode="email"
          autoComplete="email"
          autoFocus
          placeholder="maria@correo.com"
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
