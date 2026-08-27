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

  // A qué endpoint se está conectando: host y base, sin usuario ni contraseña.
  let destino = "desconocido";
  for (const n of candidatas) {
    const v = process.env[n];
    if (!v || !v.trim() || !v.startsWith("post")) continue;
    try {
      const u = new URL(v);
      destino = `${n} → ${u.hostname}${u.pathname}`;
    } catch {
      destino = `${n} → (no se pudo interpretar)`;
    }
    break;
  }

  let baseDeDatos: string;
  let causa: string[] = [];
  try {
    const { db } = await import("@/db");
    const { clinics } = await import("@/db/schema");
    const filas = await db.select({ slug: clinics.slug }).from(clinics).limit(5);
    baseDeDatos = `OK — ${filas.length} clínica(s): ${filas.map((f) => f.slug).join(", ")}`;
  } catch (err) {
    const limpiar = (s: string) => s.replace(/:[^:@/\s]+@/g, ":***@").slice(0, 400);
    baseDeDatos = `FALLA — ${limpiar(err instanceof Error ? err.message : String(err))}`;
    // Drizzle envuelve el error real en `cause`; ahí está el motivo de verdad.
    let c: unknown = (err as { cause?: unknown })?.cause;
    let vueltas = 0;
    while (c && vueltas++ < 4) {
      const e = c as { message?: string; code?: string; cause?: unknown };
      causa.push(limpiar(`${e.code ? `[${e.code}] ` : ""}${e.message ?? String(c)}`));
      c = e.cause;
    }
  }

  return NextResponse.json(
    { destino, conexion: env, config: otras, nombresPostgres, baseDeDatos, causa },
    { headers: { "cache-control": "no-store" } },
  );
}
