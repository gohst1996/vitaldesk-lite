import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Un solo pool por proceso. En dev Next.js recarga los modulos en caliente,
 * asi que lo guardamos en globalThis para no abrir un pool nuevo en cada recarga.
 */
const globalForDb = globalThis as unknown as { __vdPool?: Pool; __vdDb?: Db };

function makePool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "Falta DATABASE_URL en las variables de entorno. " +
        "En local: copiá .env.example a .env. " +
        "En Vercel: Settings → Environment Variables.",
    );
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

function realPool(): Pool {
  if (!globalForDb.__vdPool) globalForDb.__vdPool = makePool();
  return globalForDb.__vdPool;
}

function realDb(): Db {
  if (!globalForDb.__vdDb) globalForDb.__vdDb = drizzle(realPool(), { schema });
  return globalForDb.__vdDb;
}

/**
 * `db` y `pool` son perezosos a propósito.
 *
 * Si se conectaran al importar el módulo, `next build` reventaría entero cuando
 * falta DATABASE_URL: al recolectar los datos de las páginas, Next importa este
 * archivo y la excepción sube antes de servir una sola petición. Con el proxy,
 * la conexión se abre en la primera consulta de verdad — el build pasa y una
 * variable mal puesta se ve como un error claro en runtime, no como un build
 * roto sin explicación.
 */
export const pool = new Proxy({} as Pool, {
  get: (_t, prop, receiver) => Reflect.get(realPool(), prop, receiver),
  set: (_t, prop, value) => Reflect.set(realPool(), prop, value),
  has: (_t, prop) => Reflect.has(realPool(), prop),
});

export const db = new Proxy({} as Db, {
  get: (_t, prop, receiver) => Reflect.get(realDb(), prop, receiver),
  has: (_t, prop) => Reflect.has(realDb(), prop),
});

export { schema };
