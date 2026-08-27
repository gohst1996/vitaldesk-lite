"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { issueLoginCode, normalizeEmail, verifyLoginCode } from "@/lib/auth-codes";
import { zonedToUtc } from "@/lib/dates";
import {
  acceptProposal,
  cancelByPatient,
  createAppointment,
  rejectProposal,
  upsertPatient,
} from "@/lib/appointment-service";
import {
  getClinicBySlug,
  getPatientByEmail,
} from "@/lib/queries";
import { clearSession, requirePatient, setSession } from "@/lib/session";
import { mensajeDeFallo } from "@/lib/mensajes";

export type FormState = {
  error?: string;
  notice?: string;
  devCode?: string;
};

const bookingSchema = z.object({
  slug: z.string().min(1),
  name: z.string().trim().min(2, "Escribí tu nombre completo").max(120),
  email: z.string().trim().email("Ese correo no se ve bien"),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí una fecha"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Elegí una hora"),
  reason: z.string().trim().max(1000).optional().or(z.literal("")),
});

/**
 * Paso 1 del paciente: manda el formulario corto. NO se crea la cita todavia —
 * queda en borrador dentro del codigo hasta que verifique el correo, para que
 * una solicitud falsa nunca llegue a la bandeja del doctor.
 */
export async function requestBooking(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = bookingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisá los datos" };
  }
  const v = parsed.data;

  const clinic = await getClinicBySlug(v.slug);
  if (!clinic) return { error: "No encontramos esa clínica" };

  const requestedAt = zonedToUtc(v.date, v.time, clinic.timezone);
  if (requestedAt.getTime() < Date.now() - 60_000) {
    return { error: "Esa fecha ya pasó, elegí otra" };
  }

  const issued = await issueLoginCode({
    email: v.email,
    clinicId: clinic.id,
    clinicName: clinic.name,
    purpose: "booking",
    payload: {
      clinicId: clinic.id,
      name: v.name,
      phone: v.phone || null,
      reason: v.reason || null,
      requestedAt: requestedAt.toISOString(),
    },
  });

  if (!issued.ok) {
    return { error: mensajeDeFallo(issued) };
  }

  const params = new URLSearchParams({ email: normalizeEmail(v.email) });
  if (issued.devCode) params.set("dev", issued.devCode);
  redirect(`/c/${clinic.slug}/verificar?${params}`);
}

const loginSchema = z.object({
  slug: z.string().min(1),
  email: z.string().trim().email("Ese correo no se ve bien"),
});

/** Login del paciente que ya tiene citas: solo correo. */
export async function requestPatientLogin(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisá el correo" };
  }

  const clinic = await getClinicBySlug(parsed.data.slug);
  if (!clinic) return { error: "No encontramos esa clínica" };

  const patient = await getPatientByEmail(clinic.id, parsed.data.email);
  if (!patient) {
    return {
      error: "Ese correo no tiene citas en esta clínica. Pedí una cita nueva.",
    };
  }

  const issued = await issueLoginCode({
    email: parsed.data.email,
    clinicId: clinic.id,
    clinicName: clinic.name,
    purpose: "login",
  });
  if (!issued.ok) {
    return { error: mensajeDeFallo(issued) };
  }

  const params = new URLSearchParams({ email: normalizeEmail(parsed.data.email) });
  if (issued.devCode) params.set("dev", issued.devCode);
  redirect(`/c/${clinic.slug}/verificar?${params}`);
}

const verifySchema = z.object({
  slug: z.string().min(1),
  email: z.string().trim().email(),
  code: z.string().trim().min(4).max(10),
});

/** Paso 2: verifica el codigo. Si traia borrador de cita, la crea aca. */
export async function verifyPatientCode(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = verifySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Escribí el código de 6 dígitos" };

  const clinic = await getClinicBySlug(parsed.data.slug);
  if (!clinic) return { error: "No encontramos esa clínica" };

  const result = await verifyLoginCode(parsed.data.email, parsed.data.code);
  if (!result.ok) {
    const msg = {
      invalid: "Código incorrecto. Revisá el correo.",
      expired: "Ese código venció. Pedí uno nuevo.",
      too_many_attempts: "Demasiados intentos. Pedí un código nuevo.",
    }[result.error];
    return { error: msg };
  }

  let redirectTo: string;

  if (result.payload) {
    const draft = result.payload;
    const patient = await upsertPatient({
      clinicId: clinic.id,
      email: result.email,
      name: draft.name,
      phone: draft.phone,
    });
    const appt = await createAppointment({
      clinic,
      patient,
      requestedAt: new Date(draft.requestedAt),
      reason: draft.reason,
      origin: "PATIENT",
    });
    await setSession({
      kind: "patient",
      patientId: patient.id,
      clinicId: clinic.id,
      clinicSlug: clinic.slug,
      email: patient.email,
      name: patient.name,
    });
    redirectTo = `/c/${clinic.slug}/citas/${appt.id}?nueva=1`;
  } else {
    const patient = await getPatientByEmail(clinic.id, result.email);
    if (!patient) return { error: "Ese correo no tiene citas en esta clínica" };
    await setSession({
      kind: "patient",
      patientId: patient.id,
      clinicId: clinic.id,
      clinicSlug: clinic.slug,
      email: patient.email,
      name: patient.name,
    });
    redirectTo = `/c/${clinic.slug}/citas`;
  }

  redirect(redirectTo);
}

/** Reenviar el codigo cuando el paciente dice que no le llegó. */
export async function resendPatientCode(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const slug = String(formData.get("slug") ?? "");
  const email = String(formData.get("email") ?? "");
  const clinic = await getClinicBySlug(slug);
  if (!clinic) return { error: "No encontramos esa clínica" };

  const issued = await issueLoginCode({
    email,
    clinicId: clinic.id,
    clinicName: clinic.name,
    purpose: "login",
  });
  if (!issued.ok) {
    return { error: mensajeDeFallo(issued) };
  }
  return {
    notice: "Te mandamos un código nuevo.",
    devCode: issued.devCode,
  };
}

/* ------------------------------------------- respuestas del paciente a la cita */

export async function acceptProposedDate(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const id = String(formData.get("id") ?? "");
  const session = await requirePatient(slug);
  if (!session) redirect(`/c/${slug}/entrar`);

  await acceptProposal(id, session.patientId);
  revalidatePath(`/c/${slug}/citas/${id}`);
  revalidatePath(`/c/${slug}/citas`);
}

export async function rejectProposedDate(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const slug = String(formData.get("slug") ?? "");
  const id = String(formData.get("id") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const note = String(formData.get("note") ?? "");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return { error: "Elegí la fecha y la hora que te sirven" };
  }

  const session = await requirePatient(slug);
  if (!session) redirect(`/c/${slug}/entrar`);

  const clinic = await getClinicBySlug(slug);
  if (!clinic) return { error: "No encontramos esa clínica" };

  const when = zonedToUtc(date, time, clinic.timezone);
  if (when.getTime() < Date.now()) return { error: "Esa fecha ya pasó" };

  await rejectProposal(id, session.patientId, when, note || null);
  revalidatePath(`/c/${slug}/citas/${id}`);
  revalidatePath(`/c/${slug}/citas`);
  return { notice: "Listo, le mandamos tu nueva propuesta a la clínica." };
}

export async function cancelAppointment(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const id = String(formData.get("id") ?? "");
  const session = await requirePatient(slug);
  if (!session) redirect(`/c/${slug}/entrar`);

  await cancelByPatient(id, session.patientId);
  revalidatePath(`/c/${slug}/citas/${id}`);
  revalidatePath(`/c/${slug}/citas`);
}

export async function logout(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  await clearSession();
  redirect(slug ? `/c/${slug}` : "/");
}
