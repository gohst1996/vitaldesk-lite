/**
 * Recorrido end-to-end contra PRODUCCIÓN, en viewport de celular.
 * Se corre desde la Mac porque el contenedor no tiene salida a vercel.app.
 */
import { chromium, devices } from "playwright";

const BASE = "https://vitaldesk-lite.vercel.app";
const iphone = devices["iPhone 13"];
const fails = [];
let ok = 0;

function check(cond, label) {
  if (cond) { ok++; console.log(`  OK   ${label}`); }
  else { fails.push(label); console.log(`  FALLA ${label}`); }
}

async function readDevCode(page) {
  const el = page.locator("text=/Modo demo/").first();
  await el.waitFor({ timeout: 25000 });
  const txt = await el.locator("..").innerText();
  const m = txt.match(/\b(\d{6})\b/);
  if (!m) throw new Error(`sin codigo en: ${txt}`);
  return m[1];
}

const typeCode = (page, code) =>
  page.locator('input[aria-label^="D"]').first().fill(code);

// Se usa el Brave ya instalado (es Chromium) con un perfil temporal propio:
// el Chromium que baja Playwright quedó incompleto en esta máquina.
const browser = await chromium.launch({
  executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
});
const ctx = await browser.newContext({ ...iphone });
const page = await ctx.newPage();
const sello = Date.now();
const correoPaciente = `prueba${sello}@ejemplo.cr`;

try {
  console.log("\n1) Paciente pide una cita");
  await page.goto(`${BASE}/c/sonrisa-nicoya`, { waitUntil: "networkidle", timeout: 45000 });
  check(await page.getByText("Ped").first().isVisible(), "la portada de la clinica carga");

  await page.getByRole("link", { name: "Pedir una cita" }).click();
  await page.waitForURL("**/pedir", { timeout: 30000 });

  await page.fill('input[name="name"]', "Prueba Automatica");
  await page.fill('input[name="email"]', correoPaciente);
  await page.fill('textarea[name="reason"]', "Prueba end-to-end contra produccion.");
  await page.locator("button[aria-pressed]").nth(1).click();
  await page.getByRole("button", { name: "10:00 a", exact: false }).first().click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.waitForURL("**/verificar**", { timeout: 45000 });
  check(true, "llega a la pantalla de verificacion");

  const code = await readDevCode(page);
  console.log(`     codigo: ${code}`);
  await typeCode(page, code);
  await page.getByRole("button", { name: "Confirmar" }).click();
  await page.waitForURL("**/citas/**", { timeout: 45000 });
  check(await page.getByText("registrada").isVisible(), "la cita se crea tras verificar el correo");
  check(await page.getByText("En espera").first().isVisible(), "queda EN ESPERA");
  const apptUrl = page.url();

  console.log("\n2) El doctor entra y reprograma");
  const staffCtx = await browser.newContext({ ...iphone });
  const staff = await staffCtx.newPage();
  await staff.goto(`${BASE}/panel/entrar`, { waitUntil: "networkidle", timeout: 45000 });
  await staff.fill('input[name="email"]', "nonamesisus@gmail.com");
  await staff.getByRole("button", { name: "Mandame" }).click();
  await staff.waitForURL("**/panel/verificar**", { timeout: 45000 });
  const sc = await readDevCode(staff);
  await typeCode(staff, sc);
  await staff.getByRole("button", { name: "Entrar" }).click();
  await staff.waitForURL(`${BASE}/panel`, { timeout: 45000 });
  check(true, "el doctor entra al panel con su correo");
  check(await staff.getByText("Prueba Automatica").first().isVisible(),
        "la solicitud aparece en la bandeja");

  await staff.getByText("Prueba Automatica").first().click();
  await staff.waitForURL("**/panel/cita/**", { timeout: 45000 });
  await staff.getByRole("button", { name: "Proponer otra fecha" }).click();
  await staff.locator("button[aria-pressed]").nth(2).click();
  await staff.getByRole("button", { name: "2:00 p", exact: false }).first().click();
  await staff.fill('textarea[name="message"]', "Te propongo esta otra hora.");
  await staff.getByRole("button", { name: "Mandar la propuesta" }).click();
  await staff.waitForURL("**/panel?hecho=reprogramada", { timeout: 45000 });
  check(true, "la propuesta se guarda");

  console.log("\n3) El paciente acepta");
  await page.goto(apptUrl, { waitUntil: "networkidle", timeout: 45000 });
  check(await page.getByText("Te proponen esta fecha").isVisible(), "el paciente ve la propuesta");
  await page.getByRole("button", { name: "me sirve" }).click();
  await page.waitForTimeout(4000);
  await page.reload({ waitUntil: "networkidle", timeout: 45000 });
  check(await page.getByText("Confirmada").first().isVisible(), "queda CONFIRMADA");

  console.log("\n4) Agenda y seguridad");
  await staff.goto(`${BASE}/panel/agenda`, { waitUntil: "networkidle", timeout: 45000 });
  check(await staff.getByText("Prueba Automatica").first().isVisible(), "cae en la agenda");

  console.log("\n5) La sesion sobrevive (el secreto es estable)");
  await staff.goto(`${BASE}/panel`, { waitUntil: "networkidle", timeout: 45000 });
  check(!staff.url().includes("entrar"), "la sesion del doctor sigue viva");

  const anon = await browser.newContext({ ...iphone });
  const ap = await anon.newPage();
  await ap.goto(`${BASE}/panel`, { waitUntil: "networkidle", timeout: 45000 });
  check(ap.url().includes("/panel/entrar"), "sin sesion, el panel redirige al login");
  await anon.close();
  await staffCtx.close();
} catch (e) {
  console.log(`\nERROR: ${e.message}`);
  fails.push(e.message);
} finally {
  await browser.close();
}

console.log("\n" + "-".repeat(50));
console.log(fails.length === 0 ? `TODO PASO (${ok} chequeos)` : `${fails.length} FALLO(S)`);
fails.forEach((f) => console.log(`  · ${f}`));
process.exit(fails.length ? 1 : 0);
