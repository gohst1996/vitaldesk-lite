import "server-only";
import { pool } from "@/db";

/**
 * Configuración que puede vivir en la base cuando no está en el entorno.
 *
 * Existe por lo mismo que app-secret.ts: en este deploy las variables de
 * entorno no se cargaron y no hay forma de escribirlas desde afuera. El
 * entorno siempre gana; la base es el respaldo.
 */

const DDL = `
  CREATE TABLE IF NOT EXISTS app_config (
    name       text PRIMARY KEY,
    value      text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )
`;

/**
 * Caché con vencimiento corto, a propósito.
 *
 * Next puede cargar este módulo en bundles separados (uno para las Server
 * Actions, otro para los route handlers), así que invalidar la variable al
 * escribir NO alcanza: cada bundle tiene la suya. Con un TTL corto, cualquier
 * cambio se ve en segundos sin importar dónde se haya escrito.
 */
const TTL_MS = 10_000;
let cache: Map<string, string> | null = null;
let cacheVence = 0;

async function cargar(): Promise<Map<string, string>> {
  if (cache && Date.now() < cacheVence) return cache;
  await pool.query(DDL);
  const r = await pool.query<{ name: string; value: string }>(
    "SELECT name, value FROM app_config",
  );
  cache = new Map(r.rows.map((f) => [f.name, f.value]));
  cacheVence = Date.now() + TTL_MS;
  return cache;
}

/** Entorno primero; si no está o viene vacío, la base. */
export async function getConfig(
  nombre: string,
  variableDeEntorno: string,
): Promise<string | undefined> {
  const delEntorno = process.env[variableDeEntorno]?.trim();
  if (delEntorno) return delEntorno;
  const guardada = (await cargar()).get(nombre)?.trim();
  return guardada || undefined;
}

export async function setConfig(
  valores: Record<string, string>,
): Promise<string[]> {
  await pool.query(DDL);
  const escritos: string[] = [];
  for (const [name, value] of Object.entries(valores)) {
    if (typeof value !== "string") continue;
    await pool.query(
      `INSERT INTO app_config (name, value) VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [name, value],
    );
    escritos.push(name);
  }
  cache = null;
  cacheVence = 0;
  return escritos;
}

export type Smtp = {
  host: string;
  port: number;
  user: string;
  pass: string;
};

export async function getSmtp(): Promise<Smtp | null> {
  const host = await getConfig("smtp_host", "SMTP_HOST");
  if (!host) return null;
  return {
    host,
    port: Number((await getConfig("smtp_port", "SMTP_PORT")) ?? 587),
    user: (await getConfig("smtp_user", "SMTP_USER")) ?? "",
    pass: (await getConfig("smtp_pass", "SMTP_PASS")) ?? "",
  };
}

export async function getMailFrom(): Promise<string> {
  return (
    (await getConfig("mail_from", "MAIL_FROM")) ??
    "VitalDesk Lite <onboarding@resend.dev>"
  );
}

/**
 * El código se muestra en pantalla sólo mientras no haya forma de mandarlo por
 * correo. Apenas hay SMTP configurado, se apaga solo.
 */
export async function mostrarCodigoEnPantalla(): Promise<boolean> {
  if (process.env.SHOW_DEV_CODE?.trim() === "false") return false;
  return (await getSmtp()) === null;
}
