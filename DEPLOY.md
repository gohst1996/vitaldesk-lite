# Deploy — Neon + Vercel (free tier)

Todo esto es gratis para arrancar. Tiempo real: unos 20 minutos.

---

## 1. La base de datos (Neon)

1. Entrá a <https://neon.tech> y creá un proyecto.
   - Nombre: `vitaldesk-lite`
   - Región: **AWS US East (Ohio)** — la más cerca de Costa Rica con free tier.
   - Postgres 16.
2. En el dashboard, abrí **Connection Details** y copiá la
   **Pooled connection string**. Se ve así:

   ```
   postgresql://usuario:clave@ep-algo-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

   > Usá la **pooled** (la que dice `-pooler`), no la directa. Vercel abre y
   > cierra conexiones todo el tiempo y sin pooler se te llena el límite.

Guardá esa string, es tu `DATABASE_URL`.

---

## 2. El secreto de sesiones

En tu terminal:

```bash
openssl rand -base64 32
```

Copiá el resultado. Ese es tu `AUTH_SECRET`.

> Si lo cambiás después, se cierran todas las sesiones abiertas. No es grave,
> pero que no sea por accidente.

---

## 3. El correo (SMTP)

Sin esto la app **no manda correos** y nadie puede entrar. Cualquier proveedor
SMTP sirve. Dos opciones con free tier decente:

**Resend** (<https://resend.com>) — 3.000 correos/mes gratis:

```
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=re_xxxxxxxxxxxx      ← tu API key
MAIL_FROM=Tu Clínica <citas@tudominio.com>
```

**Brevo** (<https://brevo.com>) — 300 correos/día gratis:

```
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=tu-correo@brevo.com
SMTP_PASS=la-clave-smtp-que-te-dan
MAIL_FROM=Tu Clínica <citas@tudominio.com>
```

En los dos casos vas a tener que **verificar tu dominio** (agregar unos
registros DNS: SPF, DKIM). Sin eso los correos caen en spam. Si todavía no
tenés dominio, ambos te dejan usar uno de prueba de ellos mientras tanto.

---

## 4. Subir el código

```bash
cd vitaldesk-lite
git init
git add -A
git commit -m "VitalDesk Lite"
gh repo create vitaldesk-lite --private --source=. --push
```

(o creá el repo a mano en GitHub y hacé `git push`)

---

## 5. Vercel

1. <https://vercel.com/new> → importá el repo.
2. Framework: **Next.js** (lo detecta solo). No toques nada más.
3. Antes de darle Deploy, abrí **Environment Variables** y pegá:

   | Variable       | Valor                                    |
   | -------------- | ---------------------------------------- |
   | `DATABASE_URL` | la pooled string de Neon                 |
   | `AUTH_SECRET`  | lo que salió de `openssl rand`           |
   | `APP_URL`      | `https://vitaldesk-lite.vercel.app`      |
   | `SMTP_HOST`    | de tu proveedor                          |
   | `SMTP_PORT`    | `587`                                    |
   | `SMTP_USER`    | de tu proveedor                          |
   | `SMTP_PASS`    | de tu proveedor                          |
   | `MAIL_FROM`    | `Tu Clínica <citas@tudominio.com>`       |
   | `SHOW_DEV_CODE`| `false`                                  |

   > `APP_URL` tiene que ser la URL final. Si después le ponés dominio propio,
   > actualizala — es la que va dentro de los links de los correos.

4. Deploy.

---

## 6. Crear las tablas

Desde tu máquina, apuntando a la base de producción:

```bash
DATABASE_URL="<la string de Neon>" npm run db:migrate
```

Una sola vez. Cada vez que cambies `src/db/schema.ts` en el futuro:

```bash
npm run db:generate                              # genera el SQL
DATABASE_URL="<prod>" npm run db:migrate         # lo aplica
```

---

## 7. Cargar tu primera clínica

**Opción rápida** — los datos de demo:

```bash
DATABASE_URL="<prod>" npm run seed
```

**Opción real** — SQL a mano contra tu base:

```sql
INSERT INTO clinics (id, slug, name, kind, timezone, phone, address,
                     open_hour, close_hour, work_days, slot_mins)
VALUES ('cl_' || substr(md5(random()::text), 1, 20),
        'tu-clinica',                 -- va en la URL: /c/tu-clinica
        'Clínica Dental Tal',
        'DENTAL',                     -- DENTAL | MEDICAL | OTHER
        'America/Costa_Rica',
        '2222 3333',
        'Nicoya, Guanacaste',
        8, 17,                        -- abre 8am, cierra 5pm
        '{1,2,3,4,5}',                -- lunes a viernes
        30);                          -- citas de 30 min

INSERT INTO staff (id, clinic_id, email, name, role)
SELECT 'st_' || substr(md5(random()::text), 1, 20),
       id, 'doctor@tuclinica.com', 'Dr. Fulano', 'DOCTOR'
FROM clinics WHERE slug = 'tu-clinica';
```

Ese correo es el que entra en `/panel/entrar`. Para la asistente, otra fila
igual con `'ASSISTANT'`.

---

## 8. Probarlo

1. Entrá a `https://tu-app.vercel.app/panel/entrar` con el correo del doctor.
   Debería llegarte el código. **Si no llega, revisá el spam y los logs de
   Vercel** (Deployments → el último → Runtime Logs).
2. Abrí `https://tu-app.vercel.app/c/tu-clinica` en el celular.
3. Pedí una cita con otro correo tuyo.
4. Volvé al panel: tiene que estar en la bandeja.
5. En el celular, **Compartir → Agregar a inicio** (iPhone) o
   **⋮ → Instalar app** (Android). Se abre en pantalla completa, sin barra de
   navegador.

Ese link `/c/tu-clinica` es el que la clínica manda por WhatsApp.

---

## 9. Dominio propio (opcional)

En Vercel → Settings → Domains → agregá `citas.tuclinica.com`. Te da un CNAME
para poner en tu DNS. Después actualizá `APP_URL` con el dominio nuevo y
redeployá.

---

## Antes de meter pacientes de verdad

- [ ] `SHOW_DEV_CODE=false`. Con esto en `true` cualquiera ve el código en
      pantalla y entra con el correo de otro.
- [ ] `AUTH_SECRET` distinto del de desarrollo.
- [ ] Dominio verificado en el proveedor de correo (SPF + DKIM), o todo cae en
      spam.
- [ ] **Backups.** Neon free tier guarda 7 días de historial, pero configurá
      además un `pg_dump` propio programado. Es el mismo pendiente que tenés en
      VitalDesk Full.
- [ ] Revisá el plan de Neon: el free tier suspende la base tras 5 minutos sin
      uso y el primer request después tarda ~1 s en despertar. Para una demo va
      bien; para una clínica con pacientes, el plan pago.

---

## Problemas comunes

**"Falta DATABASE_URL"** → la variable no quedó guardada en Vercel, o guardaste
sin redeployar. Las variables nuevas solo aplican al siguiente deploy.

**No llegan los correos** → mirá los Runtime Logs de Vercel. Si ves el correo
impreso en la consola, es que `SMTP_HOST` está vacío.

**"too many connections"** → estás usando la connection string directa de Neon
en vez de la pooled.

**El código dice "incorrecto" siempre** → cambiaste `AUTH_SECRET` después de
generar el código. Los códigos viejos ya no validan; pedí uno nuevo.
