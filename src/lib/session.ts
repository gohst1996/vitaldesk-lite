import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getAuthSecret } from "./app-secret";

export const SESSION_COOKIE = "vd_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dias

export type Session =
  | {
      kind: "patient";
      patientId: string;
      clinicId: string;
      clinicSlug: string;
      email: string;
      name: string;
    }
  | {
      kind: "staff";
      staffId: string;
      clinicId: string;
      clinicSlug: string;
      email: string;
      name: string;
      role: "DOCTOR" | "ASSISTANT";
    };

async function secret() {
  return new TextEncoder().encode(await getAuthSecret());
}

export async function createSessionToken(session: Session): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("vitaldesk-lite")
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(await secret());
}

export async function readSessionToken(
  token: string | undefined,
): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await secret(), {
      issuer: "vitaldesk-lite",
    });
    if (payload.kind === "patient" || payload.kind === "staff") {
      return payload as unknown as Session;
    }
    return null;
  } catch {
    return null;
  }
}

export async function setSession(session: Session): Promise<void> {
  const token = await createSessionToken(session);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return readSessionToken(jar.get(SESSION_COOKIE)?.value);
}

export async function requirePatient(clinicSlug?: string) {
  const s = await getSession();
  if (!s || s.kind !== "patient") return null;
  if (clinicSlug && s.clinicSlug !== clinicSlug) return null;
  return s;
}

export async function requireStaff(clinicSlug?: string) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return null;
  if (clinicSlug && s.clinicSlug !== clinicSlug) return null;
  return s;
}
