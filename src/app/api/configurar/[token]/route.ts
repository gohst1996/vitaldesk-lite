import { NextResponse } from "next/server";
import { setConfig, getSmtp, getMailFrom } from "@/lib/app-config";
import { sendMail } from "@/lib/mailer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Carga la configuración de correo en la base, de un solo uso.
 *
 * Existe porque en este deploy no hay forma de escribir variables de entorno
 * desde afuera. Las credenciales viajan en el CUERPO del POST, nunca en la URL,
 * para que no queden en los logs de acceso.
 *
 * ⚠️  BORRAR ESTE ARCHIVO en cuanto el correo quede andando.
 */
const TOKEN = "ntdVvpDNU_rqyM_wpuG50_jhN7DkkftE";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (token !== TOKEN) {
    return NextResponse.json({ error: "no encontrado" }, { status: 404 });
  }

  let cuerpo: Record<string, string>;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "cuerpo inválido" }, { status: 400 });
  }

  const permitidos = [
    "smtp_host",
    "smtp_port",
    "smtp_user",
    "smtp_pass",
    "mail_from",
  ];
  const aGuardar: Record<string, string> = {};
  for (const k of permitidos) {
    if (typeof cuerpo[k] === "string" && cuerpo[k].trim()) {
      aGuardar[k] = cuerpo[k].trim();
    }
  }

  const escritos = await setConfig(aGuardar);

  // Confirmamos qué quedó, sin devolver ningún valor sensible.
  const smtp = await getSmtp();
  const estado = smtp
    ? { host: smtp.host, port: smtp.port, usuario: smtp.user, clave: "guardada" }
    : null;

  // Prueba de envío real, si piden una.
  let prueba: string | undefined;
  const destino = typeof cuerpo.probar_a === "string" ? cuerpo.probar_a.trim() : "";
  if (destino) {
    try {
      await sendMail({
        to: destino,
        subject: "VitalDesk Lite — prueba de correo",
        text: "Si estás leyendo esto, el correo de VitalDesk Lite quedó funcionando.",
        html: "<p>Si estás leyendo esto, el correo de <strong>VitalDesk Lite</strong> quedó funcionando.</p>",
      });
      prueba = `enviado a ${destino}`;
    } catch (e) {
      prueba = `FALLÓ — ${(e as Error).message?.slice(0, 300)}`;
    }
  }

  return NextResponse.json(
    { escritos, smtp: estado, remitente: await getMailFrom(), prueba },
    { headers: { "cache-control": "no-store" } },
  );
}
