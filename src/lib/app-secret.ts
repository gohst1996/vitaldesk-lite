import "server-only";
import { randomBytes } from "crypto";
import { pool } from "@/db";

/**
 * Secreto para firmar sesiones y hashear los códigos de acceso.
 *
 * Preferimos AUTH_SECRET del entorno. Si no está —por ejemplo en un deploy
 * donde las variables no se cargaron— se genera uno y se guarda en la base.
 * Guardarlo ahí (y no en memoria) es lo que hace que las sesiones sobrevivan
 * a un redeploy y que todas las instancias serverless compartan el mismo.
 */

let enMemoria: string | null = null;

const DDL = `
  CREATE TABLE IF NOT EXISTS app_secrets (
    name       text PRIMARY KEY,
    value      text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )
`;

export async function getAuthSecret(): Promise<string> {
  const delEntorno = process.env.AUTH_SECRET?.trim();
  if (delEntorno && delEntorno.length >= 32) return delEntorno;

  if (enMemoria) return enMemoria;

  await pool.query(DDL);

  const existente = await pool.query<{ value: string }>(
    "SELECT value FROM app_secrets WHERE name = 'auth_secret'",
  );
  if (existente.rows[0]?.value) {
    enMemoria = existente.rows[0].value;
    return enMemoria;
  }

  // ON CONFLICT DO NOTHING: si dos instancias arrancan a la vez, gana una sola.
  const nuevo = randomBytes(32).toString("base64");
  await pool.query(
    "INSERT INTO app_secrets (name, value) VALUES ('auth_secret', $1) ON CONFLICT (name) DO NOTHING",
    [nuevo],
  );

  const final = await pool.query<{ value: string }>(
    "SELECT value FROM app_secrets WHERE name = 'auth_secret'",
  );
  enMemoria = final.rows[0]?.value ?? nuevo;
  return enMemoria;
}
