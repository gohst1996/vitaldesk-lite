import { appendFile } from "fs/promises";
import { getSmtp, getMailFrom } from "./app-config";

type Mail = { to: string; subject: string; html: string; text: string };

/**
 * Envia por SMTP si hay credenciales. Si no, escribe el correo en la consola y
 * en .mailbox.log — asi el flujo completo se puede probar sin servidor de correo.
 */
export async function sendMail(mail: Mail): Promise<void> {
  const smtp = await getSmtp();

  if (!smtp) {
    const dump = [
      "────────────────────────────────────────",
      `PARA:     ${mail.to}`,
      `ASUNTO:   ${mail.subject}`,
      `FECHA:    ${new Date().toISOString()}`,
      "",
      mail.text,
      "────────────────────────────────────────",
      "",
    ].join("\n");
    console.log(`\n[correo simulado]\n${dump}`);
    try {
      await appendFile(".mailbox.log", dump);
    } catch {
      /* en serverless el fs es de solo lectura; la consola basta */
    }
    return;
  }

  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    // Sin estos límites, un SMTP que no responde deja al usuario esperando
    // indefinidamente en la pantalla de login.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  await transport.sendMail({
    from: await getMailFrom(),
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
}

/* ------------------------------------------------------------- plantillas */

function layout(title: string, body: string) {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f1f5f9;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" style="max-width:480px;background:#fff;border-radius:16px;padding:28px;box-shadow:0 1px 3px rgba(15,23,42,.08)">
      <tr><td>
        <p style="margin:0 0 4px;font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#0d9488">VitalDesk</p>
        <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${title}</h1>
        ${body}
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#64748b">VitalDesk Lite · agenda de citas</p>
  </td></tr></table>
</body></html>`;
}

export function loginCodeMail(code: string, clinicName?: string) {
  const where = clinicName ? ` en ${clinicName}` : "";
  return {
    subject: `Tu código de acceso: ${code}`,
    text: `Tu código para entrar${where} es ${code}.\n\nVence en 10 minutos. Si no fuiste vos, ignorá este correo.`,
    html: layout(
      "Tu código de acceso",
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475569">Usá este código para entrar${where}:</p>
       <p style="margin:0 0 16px;font-size:34px;font-weight:700;letter-spacing:.32em;text-align:center;background:#f0fdfa;border:1px solid #ccfbf1;border-radius:12px;padding:18px 8px;color:#0f766e">${code}</p>
       <p style="margin:0;font-size:13px;color:#64748b">Vence en 10 minutos. Si no fuiste vos, ignorá este correo.</p>`,
    ),
  };
}

type ApptMail = {
  patientName: string;
  clinicName: string;
  when: string;
  reason?: string | null;
  message?: string | null;
  url: string;
};

export function appointmentRequestedMail(m: ApptMail) {
  return {
    subject: `Recibimos tu solicitud de cita — ${m.clinicName}`,
    text: `Hola ${m.patientName},\n\nRecibimos tu solicitud de cita para ${m.when}.\n\nQueda EN ESPERA hasta que la clínica la revise. Te avisamos por este mismo correo apenas la confirmen o te propongan otra fecha.\n\nVer el estado: ${m.url}`,
    html: layout(
      "Recibimos tu solicitud",
      `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#475569">Hola ${m.patientName}, tu solicitud para <strong>${m.when}</strong> quedó registrada.</p>
       <p style="margin:0 0 16px;display:inline-block;background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:999px;padding:6px 14px;font-size:13px;font-weight:600">En espera de confirmación</p>
       <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#475569">Te escribimos apenas ${m.clinicName} la confirme o te proponga otra fecha.</p>
       <a href="${m.url}" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;border-radius:10px;padding:12px 22px;font-weight:600;font-size:15px">Ver mi cita</a>`,
    ),
  };
}

export function appointmentConfirmedMail(m: ApptMail) {
  return {
    subject: `Cita confirmada: ${m.when} — ${m.clinicName}`,
    text: `Hola ${m.patientName},\n\n${m.clinicName} confirmó tu cita para ${m.when}.\n${m.message ? `\nMensaje de la clínica: ${m.message}\n` : ""}\nVer detalle: ${m.url}`,
    html: layout(
      "Tu cita quedó confirmada",
      `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#475569">Hola ${m.patientName}, ${m.clinicName} confirmó tu cita.</p>
       <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#0f766e">${m.when}</p>
       ${m.message ? `<p style="margin:0 0 16px;padding:12px 14px;background:#f8fafc;border-left:3px solid #0d9488;border-radius:6px;font-size:14px;line-height:1.6;color:#475569">${m.message}</p>` : ""}
       <a href="${m.url}" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;border-radius:10px;padding:12px 22px;font-weight:600;font-size:15px">Ver detalle</a>`,
    ),
  };
}

export function appointmentRescheduledMail(m: ApptMail) {
  return {
    subject: `Nueva fecha propuesta: ${m.when} — ${m.clinicName}`,
    text: `Hola ${m.patientName},\n\n${m.clinicName} no puede en el horario que pediste y te propone: ${m.when}.\n${m.message ? `\nMensaje de la clínica: ${m.message}\n` : ""}\nAceptá o rechazá la nueva fecha acá: ${m.url}`,
    html: layout(
      "Te proponen otra fecha",
      `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#475569">Hola ${m.patientName}, ${m.clinicName} no puede en el horario que pediste y te propone:</p>
       <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#1d4ed8">${m.when}</p>
       ${m.message ? `<p style="margin:0 0 16px;padding:12px 14px;background:#f8fafc;border-left:3px solid #2563eb;border-radius:6px;font-size:14px;line-height:1.6;color:#475569">${m.message}</p>` : ""}
       <a href="${m.url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;border-radius:10px;padding:12px 22px;font-weight:600;font-size:15px">Aceptar o rechazar</a>`,
    ),
  };
}

export function appointmentDeclinedMail(m: ApptMail) {
  return {
    subject: `No pudimos agendar tu cita — ${m.clinicName}`,
    text: `Hola ${m.patientName},\n\n${m.clinicName} no pudo tomar tu solicitud para ${m.when}.\n${m.message ? `\nMotivo: ${m.message}\n` : ""}\nPodés pedir otra fecha acá: ${m.url}`,
    html: layout(
      "No pudimos agendar tu cita",
      `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#475569">Hola ${m.patientName}, ${m.clinicName} no pudo tomar tu solicitud para <strong>${m.when}</strong>.</p>
       ${m.message ? `<p style="margin:0 0 16px;padding:12px 14px;background:#f8fafc;border-left:3px solid #dc2626;border-radius:6px;font-size:14px;line-height:1.6;color:#475569">${m.message}</p>` : ""}
       <a href="${m.url}" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;border-radius:10px;padding:12px 22px;font-weight:600;font-size:15px">Pedir otra fecha</a>`,
    ),
  };
}
