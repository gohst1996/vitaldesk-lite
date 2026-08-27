/**
 * Utilidades de fecha. Todo se guarda en UTC y se muestra en la zona horaria
 * de la clinica.
 */

export const DEFAULT_TZ = "America/Costa_Rica";

const dayNames = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

/**
 * es-CR devuelve "9:00 a. m." con espacio angosto y punto intermedio.
 * Lo dejamos como "9:00 a.m.", que es como se escribe de verdad.
 */
function tidy(s: string): string {
  return s
    .replace(/[\u202f\u00a0]/g, " ")
    .replace(/\ba\.\s*m\./gi, "a.m.")
    .replace(/\bp\.\s*m\./gi, "p.m.");
}

export function formatLong(date: Date, tz = DEFAULT_TZ): string {
  const f = new Intl.DateTimeFormat("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: tz,
  });
  return capitalize(tidy(f.format(date)));
}

export function formatShort(date: Date, tz = DEFAULT_TZ): string {
  const f = new Intl.DateTimeFormat("es-CR", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: tz,
  });
  return tidy(f.format(date));
}

export function formatTime(date: Date, tz = DEFAULT_TZ): string {
  return tidy(new Intl.DateTimeFormat("es-CR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: tz,
  }).format(date));
}

export function formatDay(date: Date, tz = DEFAULT_TZ): string {
  return capitalize(
    new Intl.DateTimeFormat("es-CR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: tz,
    }).format(date),
  );
}

export function relative(date: Date): string {
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);

  let unit: string;
  if (mins < 60) unit = `${mins} min`;
  else if (hours < 24) unit = `${hours} h`;
  else unit = `${days} d`;

  return diff < 0 ? `hace ${unit}` : `en ${unit}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Partes de la fecha en la zona de la clinica. */
export function partsInTz(date: Date, tz = DEFAULT_TZ) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
    weekday: p.weekday as string,
  };
}

/** Desplazamiento de la zona respecto a UTC, en minutos, para ese instante. */
function tzOffsetMinutes(utcDate: Date, tz: string): number {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const p = Object.fromEntries(f.formatToParts(utcDate).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour === "24" ? "00" : p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return (asUtc - utcDate.getTime()) / 60_000;
}

/**
 * Convierte "2026-09-03" + "14:30" interpretados en la zona de la clinica
 * al instante UTC correspondiente.
 */
export function zonedToUtc(
  dateStr: string,
  timeStr: string,
  tz = DEFAULT_TZ,
): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm, 0, 0);
  // Dos pasadas: la primera aproxima, la segunda corrige si cae en cambio de horario.
  let offset = tzOffsetMinutes(new Date(naive), tz);
  let result = new Date(naive - offset * 60_000);
  offset = tzOffsetMinutes(result, tz);
  result = new Date(naive - offset * 60_000);
  return result;
}

/** "2026-09-03" de hoy en la zona de la clinica. */
export function todayInTz(tz = DEFAULT_TZ): string {
  return partsInTz(new Date(), tz).date;
}

/** Numero de dia ISO (1=lunes ... 7=domingo) de "2026-09-03". */
export function isoWeekday(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

export function weekdayName(iso: number): string {
  return dayNames[iso % 7];
}

/** Franjas "HH:MM" segun el horario de la clinica. */
export function buildSlots(
  openHour: number,
  closeHour: number,
  slotMins: number,
): string[] {
  const out: string[] = [];
  for (let m = openHour * 60; m + slotMins <= closeHour * 60; m += slotMins) {
    out.push(
      `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
    );
  }
  return out;
}

/** Lista de los proximos N dias habiles de la clinica. */
export function nextWorkDays(
  workDays: number[],
  count: number,
  tz = DEFAULT_TZ,
): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const start = new Date();
  for (let i = 0; i < 60 && out.length < count; i++) {
    const d = new Date(start.getTime() + i * 86_400_000);
    const { date } = partsInTz(d, tz);
    const iso = isoWeekday(date);
    if (!workDays.includes(iso)) continue;
    const [, mo, day] = date.split("-");
    out.push({
      value: date,
      label:
        i === 0
          ? "Hoy"
          : i === 1
            ? "Mañana"
            : `${capitalize(weekdayName(iso)).slice(0, 3)} ${Number(day)}/${Number(mo)}`,
    });
  }
  return out;
}

/**
 * Hoy ya no se puede agendar para una hora que pasó. Devuelve la fecha de hoy
 * en la zona de la clinica y la hora actual, para que el selector tache las
 * franjas vencidas.
 */
export function nowInTz(tz = DEFAULT_TZ): { date: string; time: string } {
  const { date, time } = partsInTz(new Date(), tz);
  return { date, time };
}
