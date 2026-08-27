"use client";

import { useActionState } from "react";
import {
  resendPatientCode,
  verifyPatientCode,
  type FormState,
} from "@/actions/patient";
import { CodeInput } from "@/components/code-input";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";

export function VerifyForm({
  slug,
  email,
  devCode,
}: {
  slug: string;
  email: string;
  devCode?: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(
    verifyPatientCode,
    {},
  );
  const [resend, resendAction] = useActionState<FormState, FormData>(
    resendPatientCode,
    {},
  );

  const shownDevCode = resend.devCode ?? devCode;

  return (
    <div className="space-y-4">
      <form action={action} className="card animate-in-up space-y-5 p-5">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="email" value={email} />

        <div>
          <h2 className="font-bold text-slate-900">Revisá tu correo</h2>
          <p className="mt-1 text-sm text-slate-500">
            Le mandamos un código de 6 dígitos a{" "}
            <span className="font-medium text-slate-700">{email}</span>. Vence en
            10 minutos.
          </p>
        </div>

        <CodeInput />

        {state.error && <Alert tone="error">{state.error}</Alert>}
        {resend.notice && <Alert tone="success">{resend.notice}</Alert>}
        {resend.error && <Alert tone="error">{resend.error}</Alert>}

        <SubmitButton pendingText="Verificando…">Confirmar</SubmitButton>
      </form>

      {shownDevCode && (
        <Alert tone="warn">
          <strong className="font-semibold">Modo demo:</strong> el código es{" "}
          <span className="font-mono text-base font-bold tracking-widest">
            {shownDevCode}
          </span>
          . En producción solo llega al correo.
        </Alert>
      )}

      <form action={resendAction} className="text-center">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="email" value={email} />
        <SubmitButton
          className="py-3 text-sm font-semibold text-brand-700"
          pendingText="Mandando…"
        >
          No me llegó — mandame otro
        </SubmitButton>
      </form>
    </div>
  );
}
