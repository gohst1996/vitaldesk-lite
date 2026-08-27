import { NextResponse } from "next/server";
import { pool } from "@/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Bootstrap de un solo uso.
 *
 * Crea el esquema y los datos iniciales contra la base a la que la app YA está
 * conectada. Existe porque la integración Neon–Vercel apuntó el deploy a un
 * branch distinto del que se migró a mano, y sus credenciales sólo las conoce
 * el propio deploy.
 *
 * Protegido por un token en la ruta. Es idempotente.
 *
 * ⚠️  BORRAR ESTE ARCHIVO en cuanto la base quede lista.
 */
const TOKEN = "ZnKaayVToyaAr46TG2TR2XOAh2CB5LTH";

const ESQUEMA = `-- ═══════════════════════════════════════════════════════════════════════
--  VitalDesk Lite — esquema inicial
--  Pegar completo en el SQL Editor de Neon y darle Run.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TYPE "public"."appointment_origin" AS ENUM('PATIENT', 'STAFF');
CREATE TYPE "public"."appointment_status" AS ENUM('PENDING', 'RESCHEDULE_PROPOSED', 'CONFIRMED', 'DECLINED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');
CREATE TYPE "public"."clinic_kind" AS ENUM('DENTAL', 'MEDICAL', 'OTHER');
CREATE TYPE "public"."staff_role" AS ENUM('DOCTOR', 'ASSISTANT');
CREATE TABLE "appointment_events" (
	"id" varchar(30) PRIMARY KEY NOT NULL,
	"appointment_id" varchar(30) NOT NULL,
	"type" varchar(60) NOT NULL,
	"actor" varchar(60) NOT NULL,
	"message" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "appointments" (
	"id" varchar(30) PRIMARY KEY NOT NULL,
	"clinic_id" varchar(30) NOT NULL,
	"patient_id" varchar(30) NOT NULL,
	"doctor_id" varchar(30),
	"requested_at" timestamp with time zone NOT NULL,
	"scheduled_at" timestamp with time zone,
	"proposed_at" timestamp with time zone,
	"duration_mins" integer DEFAULT 30 NOT NULL,
	"reason" text,
	"staff_note" text,
	"reply_message" text,
	"status" "appointment_status" DEFAULT 'PENDING' NOT NULL,
	"origin" "appointment_origin" DEFAULT 'PATIENT' NOT NULL,
	"created_by_staff_id" varchar(30),
	"decided_by_staff_id" varchar(30),
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "clinics" (
	"id" varchar(30) PRIMARY KEY NOT NULL,
	"slug" varchar(60) NOT NULL,
	"name" text NOT NULL,
	"kind" "clinic_kind" DEFAULT 'DENTAL' NOT NULL,
	"timezone" varchar(60) DEFAULT 'America/Costa_Rica' NOT NULL,
	"phone" varchar(40),
	"address" text,
	"open_hour" integer DEFAULT 8 NOT NULL,
	"close_hour" integer DEFAULT 18 NOT NULL,
	"work_days" integer[] DEFAULT '{1,2,3,4,5}'::integer[] NOT NULL,
	"slot_mins" integer DEFAULT 30 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clinics_slug_unique" UNIQUE("slug")
);

CREATE TABLE "login_codes" (
	"id" varchar(30) PRIMARY KEY NOT NULL,
	"email" varchar(254) NOT NULL,
	"code_hash" varchar(64) NOT NULL,
	"clinic_id" varchar(30),
	"purpose" varchar(20) DEFAULT 'login' NOT NULL,
	"payload" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "patients" (
	"id" varchar(30) PRIMARY KEY NOT NULL,
	"clinic_id" varchar(30) NOT NULL,
	"email" varchar(254) NOT NULL,
	"name" text NOT NULL,
	"phone" varchar(40),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "staff" (
	"id" varchar(30) PRIMARY KEY NOT NULL,
	"clinic_id" varchar(30) NOT NULL,
	"email" varchar(254) NOT NULL,
	"name" text NOT NULL,
	"role" "staff_role" DEFAULT 'DOCTOR' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "appointment_events" ADD CONSTRAINT "appointment_events_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_staff_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_staff_id_staff_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_decided_by_staff_id_staff_id_fk" FOREIGN KEY ("decided_by_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "patients" ADD CONSTRAINT "patients_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "staff" ADD CONSTRAINT "staff_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "appointment_events_appt_idx" ON "appointment_events" USING btree ("appointment_id","created_at");
CREATE INDEX "appointments_clinic_status_idx" ON "appointments" USING btree ("clinic_id","status");
CREATE INDEX "appointments_clinic_scheduled_idx" ON "appointments" USING btree ("clinic_id","scheduled_at");
CREATE INDEX "appointments_patient_idx" ON "appointments" USING btree ("patient_id");
CREATE INDEX "login_codes_email_idx" ON "login_codes" USING btree ("email","created_at");
CREATE UNIQUE INDEX "patients_clinic_email_idx" ON "patients" USING btree ("clinic_id","email");
CREATE INDEX "patients_email_idx" ON "patients" USING btree ("email");
CREATE UNIQUE INDEX "staff_clinic_email_idx" ON "staff" USING btree ("clinic_id","email");
CREATE INDEX "staff_email_idx" ON "staff" USING btree ("email");

-- ── Registro de migraciones de Drizzle ──────────────────────────────────────
-- Sin esto, el próximo \`drizzle-kit migrate\` intenta crear todo de nuevo.
CREATE SCHEMA IF NOT EXISTS "drizzle";

CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);

INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
SELECT '53f5f29a6a9625bfff685ba7888b252a3f5b7df74d24fd03b2c7636bb59ba5af', 1787803930994
WHERE NOT EXISTS (
  SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = '53f5f29a6a9625bfff685ba7888b252a3f5b7df74d24fd03b2c7636bb59ba5af'
);
`;

const DATOS = `-- ═══════════════════════════════════════════════════════════════════════
--  VitalDesk Lite — clínica inicial
--  Correr DESPUÉS de 01-esquema.sql. Se puede correr varias veces sin romper.
-- ═══════════════════════════════════════════════════════════════════════

-- ── La clínica ──────────────────────────────────────────────────────────
-- El slug es lo que va en la URL que se manda por WhatsApp: /c/sonrisa-nicoya
INSERT INTO clinics (id, slug, name, kind, timezone, phone, address,
                     open_hour, close_hour, work_days, slot_mins)
VALUES ('cl0demo0sonrisa0nicoya',
        'sonrisa-nicoya',
        'Clínica Dental Sonrisa',
        'DENTAL',
        'America/Costa_Rica',
        '2685 4400',
        'Nicoya, Guanacaste',
        8, 17,              -- abre 8 a.m., cierra 5 p.m.
        '{1,2,3,4,5}',      -- lunes a viernes
        30)                 -- citas de 30 minutos
ON CONFLICT (slug) DO NOTHING;

-- ── El equipo ───────────────────────────────────────────────────────────
-- Estos correos son los que entran en /panel/entrar.
-- El primero es el tuyo: con ese entrás vos al panel.
INSERT INTO staff (id, clinic_id, email, name, role)
SELECT v.id, c.id, v.email, v.name, v.role::staff_role
FROM clinics c,
     (VALUES
        ('st0andree000000000000', 'nonamesisus@gmail.com', 'Andree Peña Mora', 'DOCTOR'),
        ('st0demo0dentista00000', 'dentista@demo.cr',      'Dra. Laura Jiménez', 'DOCTOR'),
        ('st0demo0asistente0000', 'asistente@demo.cr',     'Karol Vargas',       'ASSISTANT')
     ) AS v(id, email, name, role)
WHERE c.slug = 'sonrisa-nicoya'
ON CONFLICT (clinic_id, email) DO NOTHING;

-- ── Una paciente de ejemplo ─────────────────────────────────────────────
INSERT INTO patients (id, clinic_id, email, name, phone)
SELECT 'pa0demo0maria00000000', id, 'maria@demo.cr', 'María Rodríguez', '8812 3344'
FROM clinics WHERE slug = 'sonrisa-nicoya'
ON CONFLICT (clinic_id, email) DO NOTHING;

-- ── Una cita en espera, para que la bandeja no arranque vacía ───────────
INSERT INTO appointments (id, clinic_id, patient_id, requested_at, duration_mins,
                          reason, status, origin)
SELECT 'ap0demo00000000000000', p.clinic_id, p.id,
       -- mañana a las 9:00, hora de Costa Rica
       (date_trunc('day', now() AT TIME ZONE 'America/Costa_Rica')
        + interval '1 day 9 hours') AT TIME ZONE 'America/Costa_Rica',
       30,
       'Me duele una muela de abajo del lado derecho desde el lunes. Se pone peor con lo frío.',
       'PENDING', 'PATIENT'
FROM patients p
WHERE p.email = 'maria@demo.cr'
ON CONFLICT (id) DO NOTHING;

INSERT INTO appointment_events (id, appointment_id, type, actor, message)
SELECT 'ev0demo00000000000000', 'ap0demo00000000000000', 'created',
       'patient:pa0demo0maria00000000', 'El paciente solicitó la cita'
WHERE EXISTS (SELECT 1 FROM appointments WHERE id = 'ap0demo00000000000000')
ON CONFLICT (id) DO NOTHING;

`;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (token !== TOKEN) {
    return NextResponse.json({ error: "no encontrado" }, { status: 404 });
  }

  const pasos: string[] = [];

  const correr = async (nombre: string, texto: string) => {
    try {
      await pool.query(texto);
      pasos.push(`${nombre}: OK`);
    } catch (e) {
      const err = e as { message?: string; code?: string };
      // Si ya existía, seguimos: esto es idempotente a propósito.
      pasos.push(
        `${nombre}: ${err.code ? `[${err.code}] ` : ""}${(err.message ?? String(e)).slice(0, 220)}`,
      );
    }
  };

  await correr("esquema", ESQUEMA);
  await correr("datos", DATOS);

  let resumen: unknown;
  try {
    const r = await pool.query(
      "select (select count(*) from clinics)::int as clinicas," +
        " (select count(*) from staff)::int as equipo," +
        " (select count(*) from patients)::int as pacientes," +
        " (select count(*) from appointments)::int as citas",
    );
    resumen = r.rows[0];
  } catch (e) {
    resumen = `no se pudo contar: ${(e as Error).message?.slice(0, 200)}`;
  }

  return NextResponse.json(
    { pasos, resumen },
    { headers: { "cache-control": "no-store" } },
  );
}
