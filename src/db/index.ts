import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Un solo pool por proceso. En dev Next.js recarga los modulos en caliente,
 * asi que lo guardamos en globalThis para no abrir un pool nuevo en cada recarga.
 */
const globalForDb = globalThis as unknown as { __vdPool?: Pool };

function makePool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Falta DATABASE_URL en las variables de entorno");
  }
  const needsSsl =
    !connectionString.includes("localhost") &&
    !connectionString.includes("127.0.0.1");

  return new Pool({
    connectionString,
    max: Number(process.env.DB_POOL_MAX ?? 5),
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });
}

export const pool = globalForDb.__vdPool ?? makePool();
if (process.env.NODE_ENV !== "production") globalForDb.__vdPool = pool;

export const db = drizzle(pool, { schema });
export { schema };
