"use client";

import { useActionState, useState } from "react";
import {
  acceptProposedDate,
  rejectProposedDate,
  type FormState,
} from "@/actions/patient";
import { SubmitButton } from "@/components/submit-button";
import { SlotPicker, type DayOption } from "@/components/slot-picker";
import { Alert, Field } from "@/components/ui";

export function ProposalActions({
  slug,
  id,
  proposedLabel,
  days,
  slots,
  now,
}: {
  slug: string;
  id: string;
  proposedLabel: string;
  days: DayOption[];
  slots: string[];
  now: { date: string; time: string };
}) {
  const [showCounter, setShowCounter] = useState(false);
  const [state, action] = useActionState<FormState, FormData>(
    rejectProposedDate,
    {},
  );

  return (
    <div className="card animate-in-up space-y-4 border-blue-200 bg-blue-50/40 p-5">
      <div>
        <h2 className="font-bold text-slate-900">Te proponen esta fecha</h2>
        <p className="mt-1 text-lg font-bold text-blue-700">{proposedLabel}</p>
      </div>

      {!showCounter ? (
        <>
          <form action={acceptProposedDate}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={id} />
            <SubmitButton pendingText="Confirmando…">
              Sí, me sirve
            </SubmitButton>
          </form>
          <button
            type="button"
            onClick={() => setShowCounter(true)}
            className="btn-ghost"
          >
            No puedo — proponer otra
          </button>
        </>
      ) : (
        <form action={action} className="space-y-4">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="id" value={id} />

          <SlotPicker days={days} slots={slots} now={now} />

          <Field label="¿Querés agregar algo?" optional>
            <textarea
              name="note"
              rows={3}
              maxLength={500}
              placeholder="Solo puedo en las tardes…"
              className="field resize-none"
            />
          </Field>

          {state.error && <Alert tone="error">{state.error}</Alert>}
          {state.notice && <Alert tone="success">{state.notice}</Alert>}

          <SubmitButton pendingText="Mandando…">
            Mandar mi propuesta
          </SubmitButton>
          <button
            type="button"
            onClick={() => setShowCounter(false)}
            className="btn-ghost"
          >
            Volver
          </button>
        </form>
      )}
    </div>
  );
}
