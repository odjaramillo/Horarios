/**
 * Convierte las respuestas paginadas del buscador de Banner en el modelo de
 * dominio que consume la aplicación.
 *
 * El formato de Banner es verboso, viene con entidades HTML y reparte una misma
 * materia entre muchas páginas. Todo eso se resuelve acá, una sola vez, para que
 * el navegador reciba datos ya limpios y agrupados.
 *
 * Uso: npm run merge
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const DATA_DIR = 'data';
const PLAN_FILE = join('data', 'malla-informatica.json');
const OUTPUT_FILE = join('public', 'courses.json');
const SOURCE_PATTERN = /^searchResults\d*(\.json)?$/;

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const ENTITIES = {
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', Uuml: 'Ü',
  amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' '
};

/**
 * Reemplaza entidades HTML por su carácter real
 * @param {String} text - Texto tal como lo entrega Banner
 * @return {String} Texto legible
 */
function decodeEntities(text) {
  if (!text) return '';

  return String(text)
    .replace(/&([a-zA-Z]+);/g, (match, name) => ENTITIES[name] ?? match)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .trim();
}

/**
 * Convierte "0900" en minutos desde medianoche, la unidad con la que la app
 * compara y dibuja horarios
 * @param {String} hhmm - Hora en formato militar de 4 dígitos
 * @return {Number|null} Minutos desde medianoche
 */
function toMinutes(hhmm) {
  if (!hhmm || hhmm.length !== 4) return null;

  const hours = Number(hhmm.slice(0, 2));
  const minutes = Number(hhmm.slice(2));

  return Number.isNaN(hours) || Number.isNaN(minutes) ? null : hours * 60 + minutes;
}

/**
 * Extrae los bloques de clase de una sección, uno por día que se dicta
 * @param {Array} meetingsFaculty - Encuentros tal como los entrega Banner
 * @return {Array} Bloques {day, start, end, room}
 */
function toMeetings(meetingsFaculty) {
  const meetings = [];

  for (const entry of meetingsFaculty ?? []) {
    const time = entry?.meetingTime;
    if (!time) continue;

    const start = toMinutes(time.beginTime);
    const end = toMinutes(time.endTime);
    if (start === null || end === null) continue;

    DAY_KEYS.forEach((key, day) => {
      if (time[key]) meetings.push({ day, start, end, room: time.room ?? null });
    });
  }

  return meetings;
}

/**
 * Reúne los nombres de profesor sin repetir y sin los marcadores vacíos
 * @param {Object} section - Sección cruda de Banner
 * @return {Array<String>} Nombres de profesor
 */
function toProfessors(section) {
  const names = (section.faculty ?? [])
    .map(person => decodeEntities(person?.displayName))
    .filter(Boolean);

  return [...new Set(names)];
}

/**
 * Traduce una sección cruda al modelo de dominio
 * @param {Object} raw - Sección tal como la entrega Banner
 * @return {Object} Sección normalizada
 */
function toSection(raw) {
  return {
    crn: raw.courseReferenceNumber,
    seq: raw.sequenceNumber,
    open: Boolean(raw.openSection),
    campus: decodeEntities(raw.campusDescription),
    type: decodeEntities(raw.scheduleTypeDescription),
    seats: {
      max: raw.maximumEnrollment ?? 0,
      taken: raw.enrollment ?? 0,
      free: raw.seatsAvailable ?? 0
    },
    professors: toProfessors(raw),
    meetings: toMeetings(raw.meetingsFaculty)
  };
}

/**
 * Convierte la fecha MM/DD/YYYY de Banner a formato ISO
 * @param {String} date - Fecha como la entrega Banner
 * @return {String|null} Fecha en formato YYYY-MM-DD
 */
function toIsoDate(date) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date ?? '');

  return match ? `${match[3]}-${match[1]}-${match[2]}` : null;
}

/**
 * Primer y último día de clases del período, tomados de los propios datos en
 * vez de adivinarlos. Es lo que permite exportar un calendario con fechas reales.
 * @param {Array} rawSections - Secciones crudas de Banner
 * @return {Object} {start, end} en formato ISO, o null si no vienen
 */
function termDates(rawSections) {
  const starts = [];
  const ends = [];

  for (const section of rawSections) {
    for (const entry of section.meetingsFaculty ?? []) {
      const start = toIsoDate(entry?.meetingTime?.startDate);
      const end = toIsoDate(entry?.meetingTime?.endDate);

      if (start) starts.push(start);
      if (end) ends.push(end);
    }
  }

  return {
    start: starts.length ? starts.sort()[0] : null,
    end: ends.length ? ends.sort().at(-1) : null
  };
}

/**
 * Lee cada página descargada y devuelve sus secciones en un solo arreglo
 * @return {Promise<{sections: Array, files: Array<String>}>}
 */
async function readPages() {
  const files = (await readdir(DATA_DIR)).filter(name => SOURCE_PATTERN.test(name)).sort();

  if (files.length === 0) {
    throw new Error(`No se encontraron archivos searchResults* en ${DATA_DIR}/`);
  }

  const sections = [];
  for (const file of files) {
    const page = JSON.parse(await readFile(join(DATA_DIR, file), 'utf8'));

    if (!Array.isArray(page.data)) {
      throw new Error(`${file} no tiene un arreglo "data"; ¿es una respuesta del buscador?`);
    }

    sections.push(...page.data);
  }

  return { sections, files };
}

/**
 * Agrupa las secciones bajo la materia a la que pertenecen
 * @param {Array} rawSections - Secciones crudas, ya sin repetidas
 * @return {Array} Materias con sus secciones
 */
function groupIntoSubjects(rawSections) {
  const subjects = new Map();

  for (const raw of rawSections) {
    const id = `${raw.subject}${raw.courseNumber}`;

    if (!subjects.has(id)) {
      subjects.set(id, {
        id,
        subject: raw.subject,
        number: raw.courseNumber,
        title: decodeEntities(raw.courseTitle).replace(/\.$/, ''),
        credits: raw.creditHourLow ?? 0,
        sections: []
      });
    }

    subjects.get(id).sections.push(toSection(raw));
  }

  for (const subject of subjects.values()) {
    subject.sections.sort((a, b) => a.seq.localeCompare(b.seq));
  }

  return [...subjects.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Compara dos títulos ignorando acentos, mayúsculas y puntuación
 * @param {String} text - Título
 * @return {String} Clave comparable
 */
function titleKey(text) {
  return (text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Cruza el plan de estudios con las materias que sí se dictan.
 *
 * El plan aporta semestre y área; los créditos los manda Banner, porque son los
 * de la sección que realmente vas a inscribir. Cuando los dos discrepan se avisa
 * en vez de elegir en silencio.
 *
 * @param {Array} subjects - Materias ya agrupadas
 * @return {Promise<Object>} Datos del plan para incluir en la salida
 */
async function attachPlan(subjects) {
  let plan;

  try {
    plan = JSON.parse(await readFile(PLAN_FILE, 'utf8'));
  } catch {
    console.warn(`⚠️  No se encontró ${PLAN_FILE}; las materias quedan sin semestre ni área.`);
    return null;
  }

  const byTitle = new Map(subjects.map(subject => [titleKey(subject.title), subject]));

  /**
   * Identificador para una materia del plan que no se dicta este período
   * @param {String} name - Nombre de la materia
   * @return {String} Identificador estable
   */
  const planId = name => `plan:${titleKey(name)}`;

  const idOf = name => byTitle.get(titleKey(name))?.id ?? planId(name);

  const creditGaps = [];

  // El plan completo: las 54 materias de la carrera, se dicten o no este
  // período. Los créditos de las que no se dictan igual cuentan para los
  // requisitos por créditos acumulados.
  const planSubjects = plan.subjects.map(entry => {
    const match = byTitle.get(titleKey(entry.name));

    if (match) {
      match.semester = entry.semester;
      match.area = entry.area;
      match.hue = plan.areas[entry.area]?.hue ?? null;
      if (entry.creditGate) match.creditGate = entry.creditGate;
      if (entry.requires) match.requires = entry.requires.map(idOf);

      if (entry.planCredits != null && entry.planCredits !== match.credits) {
        creditGaps.push({ id: match.id, name: entry.name, plan: entry.planCredits, banner: match.credits });
      }
    }

    return {
      id: match?.id ?? planId(entry.name),
      name: entry.name,
      semester: entry.semester,
      area: entry.area,
      hue: plan.areas[entry.area]?.hue ?? null,
      credits: match ? match.credits : (entry.planCredits ?? 0),
      offered: Boolean(match),
      ...(entry.requires ? { requires: entry.requires.map(idOf) } : {}),
      ...(entry.creditGate ? { creditGate: entry.creditGate } : {})
    };
  });

  // Lo único comprobable de una flecha: su origen tiene que estar en un
  // semestre anterior. No prueba que la flecha exista, pero atrapa las
  // invertidas y las imposibles.
  const semesterOf = new Map(planSubjects.map(entry => [entry.id, entry.semester]));

  for (const entry of planSubjects) {
    for (const requiredId of entry.requires ?? []) {
      if (!semesterOf.has(requiredId)) {
        console.warn(`⚠️  ${entry.name} requiere una materia que no está en el plan.`);
        continue;
      }

      if (semesterOf.get(requiredId) >= entry.semester) {
        console.warn(
          `⚠️  ${entry.name} (sem ${entry.semester}) requiere algo de un semestre igual o posterior.`
        );
      }
    }
  }

  // La malla declara cuántos créditos suma cada semestre: sirve de suma de
  // control para detectar una materia mal ubicada al transcribirla.
  const mismatched = [];
  for (const [semester, expected] of Object.entries(plan.semesterCredits ?? {})) {
    const actual = planSubjects
      .filter(entry => entry.semester === Number(semester))
      .reduce((sum, entry) => sum + entry.credits, 0);

    if (actual !== expected) mismatched.push({ semester, actual, expected });
  }

  for (const gap of mismatched) {
    console.warn(
      `⚠️  Semestre ${gap.semester}: ${gap.actual} UC calculadas contra ${gap.expected} declaradas en la malla.`
    );
  }

  for (const gap of creditGaps) {
    console.warn(`⚠️  ${gap.id} ${gap.name}: la malla dice ${gap.plan} UC y Banner ${gap.banner}.`);
  }

  const orphans = subjects.filter(subject => subject.semester === undefined).length;
  if (orphans > 0) {
    console.log(`ℹ️  ${orphans} materias dictadas no están en el plan de Informática.`);
  }

  return {
    career: plan.career,
    plan: plan.plan,
    totalCredits: plan.totalCredits,
    semesters: plan.semesters,
    semesterCredits: plan.semesterCredits,
    areas: plan.areas,
    prerequisiteNote: plan.prerequisiteNote,
    subjects: planSubjects
  };
}

const { sections: rawSections, files } = await readPages();

const byCrn = new Map();
for (const section of rawSections) {
  if (section.courseReferenceNumber) byCrn.set(section.courseReferenceNumber, section);
}
const unique = [...byCrn.values()];

const terms = [...new Set(unique.map(section => section.termDesc).filter(Boolean))];
if (terms.length > 1) {
  console.warn(`⚠️  Se mezclaron varios períodos: ${terms.join(' | ')}`);
  console.warn('   Revisa que todas las páginas sean de la misma búsqueda.');
}

const subjects = groupIntoSubjects(unique);
const plan = await attachPlan(subjects);
const termCode = unique[0]?.term ?? '';
const termLabel = decodeEntities(terms[0] ?? '').replace(/^\d+\s*/, '');
const { start, end } = termDates(unique);

await mkdir(dirname(OUTPUT_FILE), { recursive: true });
await writeFile(
  OUTPUT_FILE,
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    term: { code: termCode, label: termLabel, start, end },
    plan,
    sourceFiles: files,
    subjects
  })
);

const withSchedule = unique.filter(section => toMeetings(section.meetingsFaculty).length > 0).length;
const bytes = (await readFile(OUTPUT_FILE)).length;

console.log(`📄 ${files.length} páginas leídas: ${files.join(', ')}`);
console.log(`🎓 Período: ${termCode} ${termLabel} (${start} → ${end})`);
console.log(`✅ ${subjects.length} materias, ${unique.length} secciones (${unique.length - withSchedule} sin horario)`);
if (plan) {
  const conPlan = subjects.filter(subject => subject.semester !== undefined).length;
  const sinDictar = plan.subjects.filter(entry => !entry.offered).length;
  console.log(`🎯 plan de ${plan.subjects.length} materias: ${conPlan} se dictan, ${sinDictar} no`);
}
console.log(`💾 ${OUTPUT_FILE} — ${(bytes / 1024).toFixed(0)} KB`);
