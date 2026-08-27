CREATE TYPE "public"."appointment_origin" AS ENUM('PATIENT', 'STAFF');--> statement-breakpoint
CREATE TYPE "public"."appointment_status" AS ENUM('PENDING', 'RESCHEDULE_PROPOSED', 'CONFIRMED', 'DECLINED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');--> statement-breakpoint
CREATE TYPE "public"."clinic_kind" AS ENUM('DENTAL', 'MEDICAL', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('DOCTOR', 'ASSISTANT');--> statement-breakpoint
CREATE TABLE "appointment_events" (
	"id" varchar(30) PRIMARY KEY NOT NULL,
	"appointment_id" varchar(30) NOT NULL,
	"type" varchar(60) NOT NULL,
	"actor" varchar(60) NOT NULL,
	"message" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "appointment_events" ADD CONSTRAINT "appointment_events_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_staff_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_staff_id_staff_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_decided_by_staff_id_staff_id_fk" FOREIGN KEY ("decided_by_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointment_events_appt_idx" ON "appointment_events" USING btree ("appointment_id","created_at");--> statement-breakpoint
CREATE INDEX "appointments_clinic_status_idx" ON "appointments" USING btree ("clinic_id","status");--> statement-breakpoint
CREATE INDEX "appointments_clinic_scheduled_idx" ON "appointments" USING btree ("clinic_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "appointments_patient_idx" ON "appointments" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "login_codes_email_idx" ON "login_codes" USING btree ("email","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "patients_clinic_email_idx" ON "patients" USING btree ("clinic_id","email");--> statement-breakpoint
CREATE INDEX "patients_email_idx" ON "patients" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_clinic_email_idx" ON "staff" USING btree ("clinic_id","email");--> statement-breakpoint
CREATE INDEX "staff_email_idx" ON "staff" USING btree ("email");