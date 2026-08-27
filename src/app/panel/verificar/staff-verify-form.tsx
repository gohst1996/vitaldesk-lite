"use client";

import { useActionState } from "react";
import { resendStaffCode, verifyStaffCode, type FormState } from "@/actions/staff";
import { CodeInput } from "@/components/code-input";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";

export function StaffVerifyForm({
  email,
  devCode,
}: {
  email: string;
  devCode?: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(verifyStaffCode, {});
  const [resend, resendAction] = useActionState<FormState, FormData>(
    resendStaffCode,
    {},
  );

  const shownDevCode = resend.devCode ?? devCode;

  return (
    <div className="space-y-4">
      <form action={action} className="card animate-in-up space-y-5 p-5">
        <input type="hidden" name="email" value={email} />
        <p className="text-sm text-slate-500">
          Código de 6 dígitos enviado a{" "}
          <span className="font-medium text-slate-700">{email}</span>.
        </p>

        <CodeInput />

        {state.error && <Alert tone="error">{state.error}</Alert>}
        {resend.notice && <Alert tone="success">{resend.notice}</Alert>}
        {resend.error && <Alert tone="error">{resend.error}</Alert>}

        <SubmitButton pendingText="Verificando…">Entrar</SubmitButton>
      </form>

      {shownDevCode && (
        <Alert tone="warn">
          <strong className="font-semibold">Modo demo:</strong> el código es{" "}
          <span className="font-mono text-base font-bold tracking-widest">
            {shownDevCode}
          </span>
          .
        </Alert>
      )}

      <form action={resendAction} className="text-center">
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
