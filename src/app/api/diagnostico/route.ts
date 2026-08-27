import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Endpoint de diagnóstico. Reporta QUÉ variables llegan y si la base responde,
 * nunca sus valores. Sirve para depurar un deploy sin acceso al panel del host.
 *
 * Se puede borrar cuando todo esté andando.
 */
export async function GET() {
  // Nombres que los distintos integradores de Postgres suelen inyectar.
  const candidatas = [
    "DATABASE_URL",
    "POSTGRES_URL",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL_NON_POOLING",
    "DATABASE_URL_UNPOOLED",
    "PGHOST",
    "NEON_DATABASE_URL",
  ];

  const env: Record<string, string> = {};
  for (const n of candidatas) {
    const v = process.env[n];
    env[n] = v ? `presente (${v.length} caracteres)` : "AUSENTE";
  }

  const otras = {
    AUTH_SECRET: process.env.AUTH_SECRET
      ? `presente (${process.env.AUTH_SECRET.length} caracteres)`
      : "AUSENTE",
    APP_URL: process.env.APP_URL ?? "AUSENTE",
    SHOW_DEV_CODE: process.env.SHOW_DEV_CODE ?? "AUSENTE",
    MAIL_FROM: process.env.MAIL_FROM ? "presente" : "AUSENTE",
    SMTP_HOST: process.env.SMTP_HOST ? "presente" : "vacío (modo demo)",
    NODE_ENV: process.env.NODE_ENV ?? "?",
    VERCEL_ENV: process.env.VERCEL_ENV ?? "?",
  };

  // Todas las variables que empiezan con algo relacionado a Postgres,
  // solo los nombres, para descubrir cuál inyectó el integrador.
  const nombresPostgres = Object.keys(process.env)
    .filter((k) => /^(PG|POSTGRES|NEON|DATABASE)/i.test(k))
    .sort();

  let baseDeDatos: string;
  try {
    const { db } = await import("@/db");
    const { clinics } = await import("@/db/schema");
    const filas = await db.select({ slug: clinics.slug }).from(clinics).limit(5);
    baseDeDatos = `OK — ${filas.length} clínica(s): ${filas.map((f) => f.slug).join(", ")}`;
  } catch (err) {
    // El mensaje puede traer el host; nunca la contraseña.
    const msg = err instanceof Error ? err.message : String(err);
    baseDeDatos = `FALLA — ${msg.replace(/:[^:@/]+@/g, ":***@").slice(0, 300)}`;
  }

  return NextResponse.json(
    { conexion: env, config: otras, nombresPostgres, baseDeDatos },
    { headers: { "cache-control": "no-store" } },
  );
}
