/**
 * Lógica de horarios: comparación de bloques, detección de choques y
 * generación de combinaciones.
 *
 * Todo acá es función pura sobre el modelo de dominio. No conoce Svelte, ni el
 * DOM, ni de dónde salieron los datos. Eso es lo que permite probarlo con node
 * y razonar sobre ello sin abrir el navegador.
 */

export const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const DAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Iniciales sin ambigüedad: martes y miércoles no pueden ser las dos "M". */
export const DAYS_INITIAL = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

/** Tope de combinaciones. Sin esto el producto cartesiano congela la pestaña. */
export const MAX_SCHEDULES = 200;

/**
 * Convierte minutos desde medianoche a una hora legible
 * @param {Number} minutes - Minutos desde medianoche
 * @return {String} Hora en formato "9:00"
 */
export function formatTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return `${hours}:${String(rest).padStart(2, '0')}`;
}

/**
 * Describe los bloques de una sección en una línea
 * @param {Object} section - Sección del modelo de dominio
 * @return {String} Por ejemplo "Lun, Mié 9:00–10:50"
 */
export function describeMeetings(section) {
  if (section.meetings.length === 0) return 'Sin horario asignado';

  const byTime = new Map();

  for (const meeting of section.meetings) {
    const key = `${meeting.start}-${meeting.end}`;
    if (!byTime.has(key)) byTime.set(key, { ...meeting, days: [] });
    byTime.get(key).days.push(meeting.day);
  }

  return [...byTime.values()]
    .map(group => {
      const days = group.days.sort((a, b) => a - b).map(day => DAYS_SHORT[day]).join(', ');
      return `${days} ${formatTime(group.start)}–${formatTime(group.end)}`;
    })
    .join(' · ');
}

/**
 * Indica si dos bloques de clase caen encima
 * @param {Object} a - Bloque {day, start, end}
 * @param {Object} b - Bloque {day, start, end}
 * @return {Boolean} true si se pisan
 */
function meetingsOverlap(a, b) {
  return a.day === b.day && a.start < b.end && b.start < a.end;
}

/**
 * Indica si dos secciones no pueden cursarse juntas
 * @param {Object} a - Sección
 * @param {Object} b - Sección
 * @return {Boolean} true si chocan en algún bloque
 */
export function sectionsClash(a, b) {
  return a.meetings.some(one => b.meetings.some(other => meetingsOverlap(one, other)));
}

/**
 * Convierte "09:30" en minutos desde medianoche
 * @param {String} value - Hora en formato HH:MM
 * @return {Number|null} Minutos, o null si viene vacía
 */
export function parseTime(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value ?? '');

  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/**
 * Secciones de una materia que se pueden usar según las restricciones activas.
 *
 * Los días y el rango horario son restricciones del horario, no filtros de la
 * lista: descartan la sección que cae fuera de lo que el usuario acepta cursar,
 * dejando en pie las demás secciones de la misma materia.
 *
 * @param {Object} subject - Materia
 * @param {Object} options - {availability, campus, allowedCrns, avoidDays, earliest, latest}
 * @return {Array} Secciones utilizables
 */
export function usableSections(subject, options = {}) {
  const {
    availability = 'open',
    campus = '',
    allowedCrns = null,
    avoidDays = [],
    earliest = null,
    latest = null
  } = options;

  const blockedDays = new Set(avoidDays);

  return subject.sections.filter(section => {
    if (section.meetings.length === 0) return false;
    // `open` en null significa que no sabemos: la Escuela publica esas
    // secciones sin cupos. Esconderlas sería afirmar que están cerradas.
    if (availability === 'open' && section.open === false) return false;
    if (availability === 'closed' && section.open !== false) return false;
    if (campus && section.campus !== campus) return false;
    if (allowedCrns && !allowedCrns.has(section.crn)) return false;

    return section.meetings.every(meeting => {
      if (blockedDays.has(meeting.day)) return false;
      if (earliest !== null && meeting.start < earliest) return false;
      if (latest !== null && meeting.end > latest) return false;
      return true;
    });
  });
}

/**
 * Busca pares de materias que nunca pueden cursarse juntas, porque cada sección
 * de una choca con todas las de la otra. Es la explicación que le falta al
 * usuario cuando no sale ningún horario.
 * @param {Array} subjects - Materias con sus secciones ya filtradas
 * @return {Array} Pares {a, b} imposibles de combinar
 */
export function findBlockingPairs(subjects) {
  const blocking = [];

  for (let i = 0; i < subjects.length; i += 1) {
    for (let j = i + 1; j < subjects.length; j += 1) {
      const [first, second] = [subjects[i], subjects[j]];

      const compatible = first.options.some(one =>
        second.options.some(other => !sectionsClash(one, other))
      );

      if (!compatible) blocking.push({ a: first.subject, b: second.subject });
    }
  }

  return blocking;
}

/**
 * Genera todas las combinaciones de secciones sin choques.
 *
 * Hay dos clases de materia. Las obligatorias tienen que estar en todos los
 * horarios. Las opcionales entran solo si caben: para cada una, el recorrido
 * prueba primero sus secciones y solo después la rama de dejarla afuera, así
 * los horarios más completos aparecen antes y el tope descarta los más pobres.
 *
 * Usa backtracking en vez de producto cartesiano: descarta una rama en cuanto
 * aparece el primer choque, en lugar de armar millones de combinaciones para
 * después filtrarlas.
 *
 * @param {Array} subjects - Materias elegidas
 * @param {Object} options - {optionalIds, availability, campus, sectionLocks, avoidDays, earliest, latest, limit}
 * @return {Object} {schedules, truncated, blocking, unschedulable, droppedOptional}
 */
export function generateSchedules(subjects, options = {}) {
  const { sectionLocks = {}, limit = MAX_SCHEDULES, optionalIds = [], ...constraints } = options;

  const optional = new Set(optionalIds);

  const candidates = subjects.map(subject => ({
    subject,
    optional: optional.has(subject.id),
    options: usableSections(subject, {
      ...constraints,
      allowedCrns: sectionLocks[subject.id] ? new Set(sectionLocks[subject.id]) : null
    })
  }));

  const empty = candidates.filter(entry => entry.options.length === 0);
  const unschedulable = empty.filter(entry => !entry.optional).map(entry => entry.subject);
  const droppedOptional = empty.filter(entry => entry.optional).map(entry => entry.subject);

  const viable = candidates.filter(entry => entry.options.length > 0);
  const required = viable.filter(entry => !entry.optional);

  if (viable.length === 0) {
    return { schedules: [], truncated: false, blocking: [], unschedulable, droppedOptional };
  }

  // Las obligatorias primero, y dentro de cada grupo las de menos alternativas:
  // la rama que no lleva a ningún lado muere cuanto antes.
  const byFewestOptions = (a, b) => a.options.length - b.options.length;
  const ordered = [
    ...required.toSorted(byFewestOptions),
    ...viable.filter(entry => entry.optional).toSorted(byFewestOptions)
  ];

  const schedules = [];

  // Se busca una combinación de más que el tope: si aparece, sabemos que
  // quedaron horarios afuera y podemos decirlo sin mentir.
  const ceiling = limit + 1;

  const walk = (index, chosen) => {
    if (index === ordered.length) {
      if (chosen.length > 0) schedules.push([...chosen]);
      return;
    }

    const entry = ordered[index];

    for (const section of entry.options) {
      if (chosen.some(taken => sectionsClash(taken.section, section))) continue;

      chosen.push({ subject: entry.subject, section });
      walk(index + 1, chosen);
      chosen.pop();

      if (schedules.length >= ceiling) return;
    }

    // Dejar afuera una materia solo es válido si el usuario la marcó opcional
    if (entry.optional) walk(index + 1, chosen);
  };

  walk(0, []);

  const truncated = schedules.length > limit;
  if (truncated) schedules.length = limit;

  schedules.sort((a, b) => b.length - a.length);

  const blocking = schedules.length === 0 ? findBlockingPairs(required) : [];

  return { schedules, truncated, blocking, unschedulable, droppedOptional };
}

/**
 * Rango de horas que hace falta dibujar para un horario dado
 * @param {Array} schedule - Combinación de {subject, section}
 * @return {Object} {from, to} en horas enteras
 */
export function scheduleBounds(schedule) {
  const meetings = schedule.flatMap(entry => entry.section.meetings);

  if (meetings.length === 0) return { from: 7, to: 20 };

  const first = Math.min(...meetings.map(meeting => meeting.start));
  const last = Math.max(...meetings.map(meeting => meeting.end));

  return { from: Math.floor(first / 60), to: Math.ceil(last / 60) };
}

/**
 * Días de la semana que el horario realmente ocupa
 * @param {Array} schedule - Combinación de {subject, section}
 * @return {Array<Number>} Índices de día usados
 */
export function activeDays(schedule) {
  const used = new Set(schedule.flatMap(entry => entry.section.meetings.map(meeting => meeting.day)));

  return DAYS.map((_, day) => day).filter(day => used.has(day));
}

/**
 * Suma de créditos de una combinación
 * @param {Array} schedule - Combinación de {subject, section}
 * @return {Number} Créditos totales
 */
export function totalCredits(schedule) {
  return schedule.reduce((sum, entry) => sum + (entry.subject.credits ?? 0), 0);
}

/**
 * Horas de clase por semana de una combinación
 * @param {Array} schedule - Combinación de {subject, section}
 * @return {Number} Horas semanales, redondeadas
 */
export function weeklyHours(schedule) {
  const minutes = schedule
    .flatMap(entry => entry.section.meetings)
    .reduce((sum, meeting) => sum + (meeting.end - meeting.start), 0);

  return Math.round(minutes / 60);
}
