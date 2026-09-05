/**
 * Exporta un horario como calendario .ics.
 *
 * Las fechas del período salen de los propios datos de Banner, no de una
 * estimación: un evento que empieza el día equivocado es peor que no exportar.
 */

/** Venezuela usa UTC-4 todo el año, sin horario de verano. */
const TZID = 'America/Caracas';
const TZ_OFFSET = '-0400';

/**
 * Parte una línea larga como exige el RFC 5545: máximo 75 octetos, y las
 * continuaciones empiezan con un espacio. Sin esto, un título largo rompe el
 * importador de algunos calendarios.
 * @param {String} line - Línea completa
 * @return {String} Línea plegada
 */
function fold(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;

  const parts = [];
  let current = '';
  let length = 0;

  for (const char of line) {
    const size = new TextEncoder().encode(char).length;

    if (length + size > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = '';
      length = 0;
    }

    current += char;
    length += size;
  }

  parts.push(current);

  return parts.join('\r\n ');
}

/**
 * Escapa los caracteres con significado propio en el formato
 * @param {String} text - Texto libre
 * @return {String} Texto seguro para un campo .ics
 */
function escape(text) {
  return String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Fecha y hora local en el formato compacto del estándar
 * @param {Date} date - Fecha
 * @param {Number} minutes - Minutos desde medianoche
 * @return {String} Por ejemplo "20260914T090000"
 */
function stamp(date, minutes) {
  const pad = value => String(value).padStart(2, '0');
  const hours = Math.floor(minutes / 60);

  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(hours)}${pad(minutes % 60)}00`
  );
}

/**
 * Primera fecha en la que se dicta un día de la semana, a partir del inicio del período
 * @param {String} termStart - Fecha ISO de inicio de clases
 * @param {Number} day - 0 = lunes … 6 = domingo
 * @return {Date} Fecha de la primera clase
 */
function firstOccurrence(termStart, day) {
  const date = new Date(`${termStart}T00:00:00Z`);
  const startDay = (date.getUTCDay() + 6) % 7; // Domingo es 0 en JS; acá lunes es 0
  const shift = (day - startDay + 7) % 7;

  date.setUTCDate(date.getUTCDate() + shift);

  return date;
}

/**
 * Construye el contenido de un archivo .ics
 * @param {Array} schedule - Combinación de {subject, section}
 * @param {Object} term - Período con {label, start, end}
 * @return {String} Calendario en formato iCalendar
 */
export function buildIcs(schedule, term) {
  if (!term?.start || !term?.end) {
    throw new Error('Los datos no traen las fechas del período; no se puede exportar el calendario.');
  }

  const until = `${term.end.replaceAll('-', '')}T235959Z`;
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Planificador de Horarios UCAB//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escape(`Horario ${term.label}`)}`,
    `X-WR-TIMEZONE:${TZID}`,
    'BEGIN:VTIMEZONE',
    `TZID:${TZID}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    `TZOFFSETFROM:${TZ_OFFSET}`,
    `TZOFFSETTO:${TZ_OFFSET}`,
    'TZNAME:VET',
    'END:STANDARD',
    'END:VTIMEZONE'
  ];

  for (const { subject, section } of schedule) {
    for (const meeting of section.meetings) {
      const date = firstOccurrence(term.start, meeting.day);

      lines.push(
        'BEGIN:VEVENT',
        `UID:${section.crn}-${meeting.day}-${meeting.start}@horarios-ucab`,
        `DTSTAMP:${now}`,
        `DTSTART;TZID=${TZID}:${stamp(date, meeting.start)}`,
        `DTEND;TZID=${TZID}:${stamp(date, meeting.end)}`,
        `RRULE:FREQ=WEEKLY;UNTIL=${until}`,
        `SUMMARY:${escape(subject.title)}`,
        `DESCRIPTION:${escape(
          [
            `${subject.id} · ${subject.credits} UC`,
            `NRC ${section.crn} · Sección ${section.seq}`,
            section.professors.length ? section.professors.join(', ') : null,
            section.type
          ]
            .filter(Boolean)
            .join('\n')
        )}`,
        `LOCATION:${escape(section.room ?? section.campus)}`,
        'END:VEVENT'
      );
    }
  }

  lines.push('END:VCALENDAR');

  return lines.map(fold).join('\r\n');
}

/**
 * Descarga el horario como archivo .ics
 * @param {Array} schedule - Combinación de {subject, section}
 * @param {Object} term - Período con {label, start, end}
 */
export function downloadIcs(schedule, term) {
  const blob = new Blob([buildIcs(schedule, term)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `horario-${term.code || 'ucab'}.ics`;
  link.click();

  URL.revokeObjectURL(url);
}
