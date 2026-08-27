/**
 * Chequeos de la lógica que no se ve en pantalla: fechas con zona horaria y
 * el ciclo de vida de los códigos de acceso.
 *
 *   npm run check
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { and, eq, sql } from "drizzle-orm";
import { db, pool } from "../src/db";
import { loginCodes } from "../src/db/schema";
import {
  buildSlots,
  formatLong,
  isoWeekday,
  nextWorkDays,
  partsInTz,
  zonedToUtc,
} from "../src/lib/dates";
import { issueLoginCode, verifyLoginCode } from "../src/lib/auth-codes";

let passed = 0;
const failed: string[] = [];

function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++;
      console.log(`  ✓ ${name}`);
    })
    .catch((err) => {
      failed.push(`${name}: ${err.message}`);
      console.log(`  ✗ ${name}\n      ${err.message}`);
    });
}

async function main() {
  console.log("\nFechas y zonas horarias");

  await test("zonedToUtc respeta la zona de Costa Rica (UTC-6, sin horario de verano)", () => {
    const utc = zonedToUtc("2026-09-03", "14:30", "America/Costa_Rica");
    assert.equal(utc.toISOString(), "2026-09-03T20:30:00.000Z");
  });

  await test("ida y vuelta: lo que guardo es lo que muestro", () => {
    const utc = zonedToUtc("2026-12-24", "08:00", "America/Costa_Rica");
    const back = partsInTz(utc, "America/Costa_Rica");
    assert.equal(back.date, "2026-12-24");
    assert.equal(back.time, "08:00");
  });

  await test("funciona en una zona CON horario de verano (Nueva York, verano)", () => {
    const utc = zonedToUtc("2026-07-15", "09:00", "America/New_York");
    assert.equal(utc.toISOString(), "2026-07-15T13:00:00.000Z"); // EDT = UTC-4
  });

  await test("funciona en esa misma zona en invierno", () => {
    const utc = zonedToUtc("2026-01-15", "09:00", "America/New_York");
    assert.equal(utc.toISOString(), "2026-01-15T14:00:00.000Z"); // EST = UTC-5
  });

  await test("formatLong sale en español legible", () => {
    const utc = zonedToUtc("2026-09-03", "14:30", "America/Costa_Rica");
    const s = formatLong(utc, "America/Costa_Rica");
    assert.ok(s.includes("septiembre"), `esperaba el mes en español, salió: ${s}`);
    assert.ok(s.includes("2:30 p.m."), `esperaba "2:30 p.m.", salió: ${s}`);
    assert.ok(!s.includes("p. m."), `no debería quedar "p. m.": ${s}`);
  });

  await test("buildSlots respeta el horario y la duración", () => {
    assert.deepEqual(buildSlots(8, 10, 30), ["08:00", "08:30", "09:00", "09:30"]);
    assert.deepEqual(buildSlots(8, 9, 20), ["08:00", "08:20", "08:40"]);
    // No genera una franja que se pase de la hora de cierre
    assert.deepEqual(buildSlots(8, 9, 45), ["08:00"]);
  });

  await test("isoWeekday: lunes es 1 y domingo es 7", () => {
    assert.equal(isoWeekday("2026-08-31"), 1); // lunes
    assert.equal(isoWeekday("2026-09-06"), 7); // domingo
  });

  await test("nextWorkDays solo devuelve días que la clínica atiende", () => {
    const days = nextWorkDays([1, 2, 3, 4, 5], 8, "America/Costa_Rica");
    assert.equal(days.length, 8);
    for (const d of days) {
      assert.ok([1, 2, 3, 4, 5].includes(isoWeekday(d.value)), `${d.value} cayó en fin de semana`);
    }
  });

  await test("nextWorkDays con una clínica que solo abre sábados", () => {
    const days = nextWorkDays([6], 3, "America/Costa_Rica");
    assert.equal(days.length, 3);
    for (const d of days) assert.equal(isoWeekday(d.value), 6);
  });

  console.log("\nCódigos de acceso");

  const email = `check-${Date.now()}@test.local`;

  await test("un código recién emitido valida", async () => {
    const issued = await issueLoginCode({ email, purpose: "login" });
    assert.ok(issued.ok, "no se pudo emitir");
    assert.ok(issued.ok && issued.devCode, "sin SMTP debería devolver el código");
    const result = await verifyLoginCode(email, issued.ok ? issued.devCode! : "");
    assert.ok(result.ok, "el código válido no pasó");
  });

  await test("el mismo código no sirve dos veces", async () => {
    const issued = await issueLoginCode({ email, purpose: "login" });
    const code = issued.ok ? issued.devCode! : "";
    const first = await verifyLoginCode(email, code);
    assert.ok(first.ok);
    const second = await verifyLoginCode(email, code);
    assert.ok(!second.ok, "un código quemado volvió a pasar");
  });

  await test("un código equivocado no pasa", async () => {
    const issued = await issueLoginCode({ email, purpose: "login" });
    const code = issued.ok ? issued.devCode! : "";
    const wrong = code === "000000" ? "111111" : "000000";
    const result = await verifyLoginCode(email, wrong);
    assert.ok(!result.ok);
    assert.equal(result.ok === false && result.error, "invalid");
  });

  await test("un código vencido no pasa", async () => {
    const issued = await issueLoginCode({ email, purpose: "login" });
    const code = issued.ok ? issued.devCode! : "";
    // Lo envejecemos a mano
    await db
      .update(loginCodes)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(and(eq(loginCodes.email, email), sql`${loginCodes.consumedAt} is null`));
    const result = await verifyLoginCode(email, code);
    assert.ok(!result.ok);
    assert.equal(result.ok === false && result.error, "expired");
  });

  await test("después de 5 códigos en 15 minutos, corta", async () => {
    const spamEmail = `spam-${Date.now()}@test.local`;
    for (let i = 0; i < 5; i++) {
      const r = await issueLoginCode({ email: spamEmail, purpose: "login" });
      assert.ok(r.ok, `el código ${i + 1} debería haber salido`);
    }
    const sixth = await issueLoginCode({ email: spamEmail, purpose: "login" });
    assert.ok(!sixth.ok, "el sexto debería haberse rechazado");
    assert.equal(sixth.ok === false && sixth.error, "rate_limited");
  });

  await test("el código nunca se guarda en texto plano", async () => {
    const plainEmail = `plain-${Date.now()}@test.local`;
    const issued = await issueLoginCode({ email: plainEmail, purpose: "login" });
    const code = issued.ok ? issued.devCode! : "";
    const [row] = await db
      .select()
      .from(loginCodes)
      .where(eq(loginCodes.email, plainEmail))
      .limit(1);
    assert.ok(row, "no se guardó la fila");
    assert.notEqual(row.codeHash, code);
    assert.equal(row.codeHash.length, 64, "debería ser un sha256 hex");
  });

  await test("el borrador de la cita viaja dentro del código", async () => {
    const draftEmail = `draft-${Date.now()}@test.local`;
    const draft = {
      clinicId: "clinica-x",
      name: "Prueba",
      phone: null,
      reason: "dolor",
      notes: null,
      requestedAt: new Date().toISOString(),
    };
    const issued = await issueLoginCode({
      email: draftEmail,
      purpose: "booking",
      payload: draft,
    });
    const result = await verifyLoginCode(draftEmail, issued.ok ? issued.devCode! : "");
    assert.ok(result.ok);
    assert.equal(result.ok && result.payload?.name, "Prueba");
    assert.equal(result.ok && result.purpose, "booking");
  });

  // Limpieza de lo que dejaron las pruebas
  await db.delete(loginCodes).where(sql`${loginCodes.email} like '%@test.local'`);

  console.log("\n" + "─".repeat(46));
  if (failed.length === 0) {
    console.log(`✅ ${passed} chequeos pasaron`);
  } else {
    console.log(`❌ ${failed.length} fallaron:`);
    failed.forEach((f) => console.log(`   · ${f}`));
  }
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
