"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { issueLoginCode, normalizeEmail, verifyLoginCode } from "@/lib/auth-codes";
import { zonedToUtc } from "@/lib/dates";
import {
  closeAppointment,
  confirmAppointment,
  createAppointment,
  declineAppointment,
  proposeReschedule,
  upsertPatient,
} from "@/lib/appointment-service";
import {
  findStaffAnywhere,
  getAppointmentForStaff,
  getClinicById,
} from "@/lib/queries";
import { clearSession, requireStaff, setSession } from "@/lib/session";
import type { FormState } from "./patient";
import { mensajeDeFallo } from "@/lib/mensajes";

export type { FormState };

/* ------------------------------------------------------------------ login */

export async function requestStaffLogin(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!z.string().email().safeParse(email).success) {
    return { error: "Ese correo no se ve bien" };
  }

  const found = await findStaffAnywhere(email);
  if (!found) {
    return {
      error: "Ese correo no está registrado como parte de ninguna clínica.",
    };
  }

  const issued = await issueLoginCode({
    email,
    clinicId: found.c.id,
    clinicName: found.c.name,
    purpose: "login",
  });
  if (!issued.ok) {
    return { error: mensajeDeFallo(issued) };
  }

  const params = new URLSearchParams({ email: normalizeEmail(email) });
  if (issued.devCode) params.set("dev", issued.devCode);
  redirect(`/panel/verificar?${params}`);
}

export async function verifyStaffCode(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const code = String(formData.get("code") ?? "");

  const result = await verifyLoginCode(email, code);
  if (!result.ok) {
    return {
      error: {
        invalid: "Código incorrecto. Revisá el correo.",
        expired: "Ese código venció. Pedí uno nuevo.",
        too_many_attempts: "Demasiados intentos. Pedí un código nuevo.",
      }[result.error],
    };
  }

  const found = await findStaffAnywhere(result.email);
  if (!found) return { error: "Ese correo ya no tiene acceso" };

  await setSession({
    kind: "staff",
    staffId: found.s.id,
    clinicId: found.c.id,
    clinicSlug: found.c.slug,
    email: found.s.email,
    name: found.s.name,
    role: found.s.role,
  });

  redirect("/panel");
}

export async function resendStaffCode(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const found = await findStaffAnywhere(email);
  if (!found) return { error: "Ese correo no está registrado" };

  const issued = await issueLoginCode({
    email,
    clinicId: found.c.id,
    clinicName: found.c.name,
  });
  if (!issued.ok) {
    return { error: mensajeDeFallo(issued) };
  }
  return { notice: "Te mandamos un código nuevo.", devCode: issued.devCode };
}

export async function staffLogout() {
  await clearSession();
  redirect("/panel/entrar");
}

/* ------------------------------------------------ decisiones sobre la cita */

const decisionSchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  doctorId: z.string().optional(),
  message: z.string().max(1000).optional(),
  staffNote: z.string().max(1000).optional(),
});

export async function decideAppointment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireStaff();
  if (!session) redirect("/panel/entrar");

  const intent = String(formData.get("intent") ?? "");

  if (intent === "decline") {
    const id = String(formData.get("id") ?? "");
    const row = await getAppointmentForStaff(id, session.clinicId);
    if (!row) return { error: "No encontramos esa cita" };

    await declineAppointment({
      appointmentId: id,
      staffId: session.staffId,
      message: String(formData.get("message") ?? "") || null,
    });
    revalidatePath("/panel");
    redirect("/panel?hecho=rechazada");
  }

  const parsed = decisionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Elegí la fecha y la hora" };
  const v = parsed.data;

  const row = await getAppointmentForStaff(v.id, session.clinicId);
  if (!row) return { error: "No encontramos esa cita" };

  const clinic = await getClinicById(session.clinicId);
  if (!clinic) return { error: "Clínica no encontrada" };

  const when = zonedToUtc(v.date, v.time, clinic.timezone);

  if (intent === "confirm") {
    await confirmAppointment({
      appointmentId: v.id,
      clinicId: session.clinicId,
      staffId: session.staffId,
      scheduledAt: when,
      doctorId: v.doctorId || null,
      message: v.message || null,
      staffNote: v.staffNote || null,
    });
    revalidatePath("/panel");
    redirect("/panel?hecho=confirmada");
  }

  if (intent === "reschedule") {
    if (when.getTime() < Date.now()) return { error: "Esa fecha ya pasó" };
    await proposeReschedule({
      appointmentId: v.id,
      clinicId: session.clinicId,
      staffId: session.staffId,
      proposedAt: when,
      doctorId: v.doctorId || null,
      message: v.message || null,
      staffNote: v.staffNote || null,
    });
    revalidatePath("/panel");
    redirect("/panel?hecho=reprogramada");
  }

  return { error: "Acción no reconocida" };
}

export async function closeAppointmentAction(formData: FormData) {
  const session = await requireStaff();
  if (!session) redirect("/panel/entrar");

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as
    | "COMPLETED"
    | "NO_SHOW"
    | "CANCELLED";

  const row = await getAppointmentForStaff(id, session.clinicId);
  if (!row) return;

  await closeAppointment({
    appointmentId: id,
    staffId: session.staffId,
    status,
  });
  revalidatePath("/panel");
  revalidatePath(`/panel/cita/${id}`);
}

/* ---------------------------------------- la asistente agenda por el paciente */

const newApptSchema = z.object({
  name: z.string().trim().min(2, "Escribí el nombre del paciente").max(120),
  email: z.string().trim().email("Ese correo no se ve bien"),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí una fecha"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Elegí una hora"),
  reason: z.string().trim().max(1000).optional().or(z.literal("")),
  staffNote: z.string().trim().max(1000).optional().or(z.literal("")),
  doctorId: z.string().optional().or(z.literal("")),
  confirmNow: z.string().optional(),
});

export async function createAppointmentForPatient(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireStaff();
  if (!session) redirect("/panel/entrar");

  const parsed = newApptSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisá los datos" };
  }
  const v = parsed.data;

  const clinic = await getClinicById(session.clinicId);
  if (!clinic) return { error: "Clínica no encontrada" };

  const when = zonedToUtc(v.date, v.time, clinic.timezone);
  if (when.getTime() < Date.now() - 60_000) {
    return { error: "Esa fecha ya pasó" };
  }

  const patient = await upsertPatient({
    clinicId: clinic.id,
    email: v.email,
    name: v.name,
    phone: v.phone || null,
  });

  const appt = await createAppointment({
    clinic,
    patient,
    requestedAt: when,
    reason: v.reason || null,
    staffNote: v.staffNote || null,
    doctorId: v.doctorId || null,
    origin: "STAFF",
    createdByStaffId: session.staffId,
    // Si la asistente ya la deja en firme, el correo que sale es el de confirmada.
    notifyPatient: v.confirmNow !== "on",
  });

  if (v.confirmNow === "on") {
    await confirmAppointment({
      appointmentId: appt.id,
      clinicId: clinic.id,
      staffId: session.staffId,
      scheduledAt: when,
      doctorId: v.doctorId || null,
      message: v.reason ? null : null,
    });
  }

  revalidatePath("/panel");
  redirect(`/panel/cita/${appt.id}?creada=1`);
}
