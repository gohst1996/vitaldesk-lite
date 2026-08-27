/**
 * VitalDesk Lite — esquema de datos.
 *
 * Los nombres de tabla y los campos clave son compatibles con VitalDesk Full,
 * para poder migrar un cliente de Lite al plan completo con un script.
 */
import {
  pgTable,
  pgEnum,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createId } from "@/lib/id";

/* ------------------------------------------------------------------ enums */

export const clinicKind = pgEnum("clinic_kind", ["DENTAL", "MEDICAL", "OTHER"]);

export const staffRole = pgEnum("staff_role", ["DOCTOR", "ASSISTANT"]);

export const appointmentStatus = pgEnum("appointment_status", [
  "PENDING", // en espera de que el doctor la revise
  "RESCHEDULE_PROPOSED", // el doctor propuso otra fecha
  "CONFIRMED", // fecha en firme
  "DECLINED", // la clinica la rechazo
  "CANCELLED", // el paciente la cancelo
  "COMPLETED", // ya se atendio
  "NO_SHOW", // no se presento
]);

export const appointmentOrigin = pgEnum("appointment_origin", [
  "PATIENT", // la pidio el paciente desde su celular
  "STAFF", // la agendo la asistente con los datos del cliente
]);

/* --------------------------------------------------------------- clinicas */

export const clinics = pgTable("clinics", {
  id: varchar("id", { length: 30 }).primaryKey().$defaultFn(createId),
  slug: varchar("slug", { length: 60 }).notNull().unique(),
  name: text("name").notNull(),
  kind: clinicKind("kind").notNull().default("DENTAL"),
  timezone: varchar("timezone", { length: 60 })
    .notNull()
    .default("America/Costa_Rica"),
  phone: varchar("phone", { length: 40 }),
  address: text("address"),
  // Horario de atencion, para sugerirle franjas al paciente
  openHour: integer("open_hour").notNull().default(8),
  closeHour: integer("close_hour").notNull().default(18),
  // Dias que atiende: 1=lunes ... 7=domingo
  workDays: integer("work_days")
    .array()
    .notNull()
    .default(sql`'{1,2,3,4,5}'::integer[]`),
  slotMins: integer("slot_mins").notNull().default(30),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ----------------------------------------------------------------- staff */

export const staff = pgTable(
  "staff",
  {
    id: varchar("id", { length: 30 }).primaryKey().$defaultFn(createId),
    clinicId: varchar("clinic_id", { length: 30 })
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 254 }).notNull(),
    name: text("name").notNull(),
    role: staffRole("role").notNull().default("DOCTOR"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("staff_clinic_email_idx").on(t.clinicId, t.email),
    index("staff_email_idx").on(t.email),
  ],
);

/* -------------------------------------------------------------- pacientes */

export const patients = pgTable(
  "patients",
  {
    id: varchar("id", { length: 30 }).primaryKey().$defaultFn(createId),
    clinicId: varchar("clinic_id", { length: 30 })
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 254 }).notNull(),
    name: text("name").notNull(),
    phone: varchar("phone", { length: 40 }),
    // Lo que el paciente quiso aclarar en el registro
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("patients_clinic_email_idx").on(t.clinicId, t.email),
    index("patients_email_idx").on(t.email),
  ],
);

/* ------------------------------------------------------------------ citas */

export const appointments = pgTable(
  "appointments",
  {
    id: varchar("id", { length: 30 }).primaryKey().$defaultFn(createId),
    clinicId: varchar("clinic_id", { length: 30 })
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
    patientId: varchar("patient_id", { length: 30 })
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    // Doctor asignado (opcional al crear; la asistente puede asignarlo)
    doctorId: varchar("doctor_id", { length: 30 }).references(() => staff.id, {
      onDelete: "set null",
    }),

    // Fecha que pidio el paciente (o que puso la asistente)
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull(),
    // Fecha final acordada. Se llena al confirmar.
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    // Fecha alterna que propone el doctor. El paciente la acepta o la rechaza.
    proposedAt: timestamp("proposed_at", { withTimezone: true }),

    durationMins: integer("duration_mins").notNull().default(30),

    // Motivo / descripcion que escribio el paciente
    reason: text("reason"),
    // Nota interna de la clinica (el paciente NO la ve)
    staffNote: text("staff_note"),
    // Mensaje de la clinica al paciente al confirmar/reprogramar (SI lo ve)
    replyMessage: text("reply_message"),

    status: appointmentStatus("status").notNull().default("PENDING"),
    origin: appointmentOrigin("origin").notNull().default("PATIENT"),

    createdByStaffId: varchar("created_by_staff_id", {
      length: 30,
    }).references(() => staff.id, { onDelete: "set null" }),
    decidedByStaffId: varchar("decided_by_staff_id", {
      length: 30,
    }).references(() => staff.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("appointments_clinic_status_idx").on(t.clinicId, t.status),
    index("appointments_clinic_scheduled_idx").on(t.clinicId, t.scheduledAt),
    index("appointments_patient_idx").on(t.patientId),
  ],
);

/**
 * Bitacora append-only de la cita. Misma idea que el audit trail de VitalDesk Full:
 * nunca se edita ni se borra una fila, solo se agregan.
 */
export const appointmentEvents = pgTable(
  "appointment_events",
  {
    id: varchar("id", { length: 30 }).primaryKey().$defaultFn(createId),
    appointmentId: varchar("appointment_id", { length: 30 })
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 60 }).notNull(),
    // Quien lo hizo: "patient:<id>", "staff:<id>" o "system"
    actor: varchar("actor", { length: 60 }).notNull(),
    message: text("message"),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("appointment_events_appt_idx").on(t.appointmentId, t.createdAt)],
);

/* -------------------------------------------------- codigos de login (OTP) */

export const loginCodes = pgTable(
  "login_codes",
  {
    id: varchar("id", { length: 30 }).primaryKey().$defaultFn(createId),
    email: varchar("email", { length: 254 }).notNull(),
    // sha256(codigo + AUTH_SECRET). Nunca se guarda el codigo en claro.
    codeHash: varchar("code_hash", { length: 64 }).notNull(),
    clinicId: varchar("clinic_id", { length: 30 }),
    // "login" para entrar, "booking" cuando trae una solicitud de cita pendiente
    // de verificar el correo antes de crearla.
    purpose: varchar("purpose", { length: 20 }).notNull().default("login"),
    // Borrador de la cita mientras el correo no este verificado. Asi una
    // solicitud falsa nunca llega a la bandeja del doctor.
    payload: jsonb("payload"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("login_codes_email_idx").on(t.email, t.createdAt)],
);

/* -------------------------------------------------------------- relaciones */

export const clinicsRelations = relations(clinics, ({ many }) => ({
  staff: many(staff),
  patients: many(patients),
  appointments: many(appointments),
}));

export const staffRelations = relations(staff, ({ one }) => ({
  clinic: one(clinics, {
    fields: [staff.clinicId],
    references: [clinics.id],
  }),
}));

export const patientsRelations = relations(patients, ({ one, many }) => ({
  clinic: one(clinics, {
    fields: [patients.clinicId],
    references: [clinics.id],
  }),
  appointments: many(appointments),
}));

export const appointmentsRelations = relations(
  appointments,
  ({ one, many }) => ({
    clinic: one(clinics, {
      fields: [appointments.clinicId],
      references: [clinics.id],
    }),
    patient: one(patients, {
      fields: [appointments.patientId],
      references: [patients.id],
    }),
    doctor: one(staff, {
      fields: [appointments.doctorId],
      references: [staff.id],
    }),
    events: many(appointmentEvents),
  }),
);

export const appointmentEventsRelations = relations(
  appointmentEvents,
  ({ one }) => ({
    appointment: one(appointments, {
      fields: [appointmentEvents.appointmentId],
      references: [appointments.id],
    }),
  }),
);

/* ------------------------------------------------------------------ tipos */

export type Clinic = typeof clinics.$inferSelect;
export type Staff = typeof staff.$inferSelect;
export type Patient = typeof patients.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type AppointmentEvent = typeof appointmentEvents.$inferSelect;
export type AppointmentStatus = Appointment["status"];
export type StaffRole = Staff["role"];
