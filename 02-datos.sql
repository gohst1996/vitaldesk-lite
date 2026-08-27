-- ═══════════════════════════════════════════════════════════════════════
--  VitalDesk Lite — clínica inicial
--  Correr DESPUÉS de 01-esquema.sql. Se puede correr varias veces sin romper.
-- ═══════════════════════════════════════════════════════════════════════

-- ── La clínica ──────────────────────────────────────────────────────────
-- El slug es lo que va en la URL que se manda por WhatsApp: /c/sonrisa-nicoya
INSERT INTO clinics (id, slug, name, kind, timezone, phone, address,
                     open_hour, close_hour, work_days, slot_mins)
VALUES ('cl0demo0sonrisa0nicoya',
        'sonrisa-nicoya',
        'Clínica Dental Sonrisa',
        'DENTAL',
        'America/Costa_Rica',
        '2685 4400',
        'Nicoya, Guanacaste',
        8, 17,              -- abre 8 a.m., cierra 5 p.m.
        '{1,2,3,4,5}',      -- lunes a viernes
        30)                 -- citas de 30 minutos
ON CONFLICT (slug) DO NOTHING;

-- ── El equipo ───────────────────────────────────────────────────────────
-- Estos correos son los que entran en /panel/entrar.
-- El primero es el tuyo: con ese entrás vos al panel.
INSERT INTO staff (id, clinic_id, email, name, role)
SELECT v.id, c.id, v.email, v.name, v.role::staff_role
FROM clinics c,
     (VALUES
        ('st0andree000000000000', 'nonamesisus@gmail.com', 'Andree Peña Mora', 'DOCTOR'),
        ('st0demo0dentista00000', 'dentista@demo.cr',      'Dra. Laura Jiménez', 'DOCTOR'),
        ('st0demo0asistente0000', 'asistente@demo.cr',     'Karol Vargas',       'ASSISTANT')
     ) AS v(id, email, name, role)
WHERE c.slug = 'sonrisa-nicoya'
ON CONFLICT (clinic_id, email) DO NOTHING;

-- ── Una paciente de ejemplo ─────────────────────────────────────────────
INSERT INTO patients (id, clinic_id, email, name, phone)
SELECT 'pa0demo0maria00000000', id, 'maria@demo.cr', 'María Rodríguez', '8812 3344'
FROM clinics WHERE slug = 'sonrisa-nicoya'
ON CONFLICT (clinic_id, email) DO NOTHING;

-- ── Una cita en espera, para que la bandeja no arranque vacía ───────────
INSERT INTO appointments (id, clinic_id, patient_id, requested_at, duration_mins,
                          reason, status, origin)
SELECT 'ap0demo00000000000000', p.clinic_id, p.id,
       -- mañana a las 9:00, hora de Costa Rica
       (date_trunc('day', now() AT TIME ZONE 'America/Costa_Rica')
        + interval '1 day 9 hours') AT TIME ZONE 'America/Costa_Rica',
       30,
       'Me duele una muela de abajo del lado derecho desde el lunes. Se pone peor con lo frío.',
       'PENDING', 'PATIENT'
FROM patients p
WHERE p.email = 'maria@demo.cr'
ON CONFLICT (id) DO NOTHING;

INSERT INTO appointment_events (id, appointment_id, type, actor, message)
SELECT 'ev0demo00000000000000', 'ap0demo00000000000000', 'created',
       'patient:pa0demo0maria00000000', 'El paciente solicitó la cita'
WHERE EXISTS (SELECT 1 FROM appointments WHERE id = 'ap0demo00000000000000')
ON CONFLICT (id) DO NOTHING;

-- ── Verificación ────────────────────────────────────────────────────────
SELECT 'clínicas' AS tabla, count(*) FROM clinics
UNION ALL SELECT 'equipo',    count(*) FROM staff
UNION ALL SELECT 'pacientes', count(*) FROM patients
UNION ALL SELECT 'citas',     count(*) FROM appointments;
