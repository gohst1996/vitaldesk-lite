import "server-only";
import { createHash, randomInt, timingSafeEqual } from "crypto";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { loginCodes } from "@/db/schema";
import { env } from "./env";
import { sendMail, loginCodeMail } from "./mailer";

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
/** Cuantos codigos se pueden pedir por correo en la ventana de abajo. */
const MAX_CODES_PER_WINDOW = 5;
const WINDOW_MINUTES = 15;

export type BookingDraft = {
  clinicId: string;
  name: string;
  phone?: string | null;
  reason?: string | null;
  notes?: string | null;
  requestedAt: string; // ISO
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashCode(code: string): string {
  return createHash("sha256")
    .update(`${code}:${env.authSecret}`)
    .digest("hex");
}

function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export type IssueResult =
  | { ok: true; devCode?: string }
  | { ok: false; error: "rate_limited"; retryAfterMinutes: number };

/**
 * Genera un codigo de 6 digitos, lo guarda hasheado y lo manda por correo.
 * Si `payload` viene, la cita queda en borrador hasta que el correo se verifique.
 */
export async function issueLoginCode(opts: {
  email: string;
  clinicId?: string | null;
  clinicName?: string;
  purpose?: "login" | "booking";
  payload?: BookingDraft | null;
}): Promise<IssueResult> {
  const email = normalizeEmail(opts.email);
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60_000);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loginCodes)
    .where(and(eq(loginCodes.email, email), gte(loginCodes.createdAt, windowStart)));

  if (count >= MAX_CODES_PER_WINDOW) {
    return { ok: false, error: "rate_limited", retryAfterMinutes: WINDOW_MINUTES };
  }

  const code = generateCode();

  await db.insert(loginCodes).values({
    email,
    codeHash: hashCode(code),
    clinicId: opts.clinicId ?? null,
    purpose: opts.purpose ?? "login",
    payload: opts.payload ?? null,
    expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60_000),
  });

  const mail = loginCodeMail(code, opts.clinicName);
  await sendMail({ to: email, ...mail });

  return { ok: true, devCode: env.showDevCode ? code : undefined };
}

export type VerifyResult =
  | {
      ok: true;
      email: string;
      clinicId: string | null;
      purpose: string;
      payload: BookingDraft | null;
    }
  | { ok: false; error: "invalid" | "expired" | "too_many_attempts" };

/** Verifica el codigo y lo quema. Un codigo solo sirve una vez. */
export async function verifyLoginCode(
  rawEmail: string,
  code: string,
): Promise<VerifyResult> {
  const email = normalizeEmail(rawEmail);
  const clean = code.replace(/\D/g, "");

  const [row] = await db
    .select()
    .from(loginCodes)
    .where(and(eq(loginCodes.email, email), isNull(loginCodes.consumedAt)))
    .orderBy(desc(loginCodes.createdAt))
    .limit(1);

  if (!row) return { ok: false, error: "invalid" };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, error: "too_many_attempts" };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, error: "expired" };

  if (!safeEqual(hashCode(clean), row.codeHash)) {
    await db
      .update(loginCodes)
      .set({ attempts: row.attempts + 1 })
      .where(eq(loginCodes.id, row.id));
    return { ok: false, error: "invalid" };
  }

  await db
    .update(loginCodes)
    .set({ consumedAt: new Date() })
    .where(eq(loginCodes.id, row.id));

  return {
    ok: true,
    email,
    clinicId: row.clinicId,
    purpose: row.purpose,
    payload: (row.payload as BookingDraft | null) ?? null,
  };
}
