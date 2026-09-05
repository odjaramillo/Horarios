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

import { applyUcabRows, electiveKindOf } from '../src/lib/domain/ucab.js';

const DATA_DIR = 'data';
const UCAB_FILE = join('data', 'ucab-schedules.json');
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
 * @param {Boolean} hasCatalog - Si la Escuela ya marcó cuáles son electivas
 * @return {Promise<Object>} Datos del plan para incluir en la salida
 */
async function attachPlan(subjects, hasCatalog) {
  let plan;

  try {
    plan = JSON.parse(await readFile(PLAN_FILE, 'utf8'));
  } catch {
    console.warn(`⚠️  No se encontró ${PLAN_FILE}; las materias quedan sin semestre ni área.`);
    return null;
  }

  const byTitle = new Map(subjects.map(subject => [titleKey(subject.title), subject]));
  const idOf = new Map(plan.subjects.map(entry => [entry.name, entry.id]));

  // El plan reserva dos ranuras de electiva sin nombre propio. Banner ofrece
  // electivas concretas que las llenan, pero que no figuran en el plan.
  const isElective = name => /^electiva/i.test(name.trim());

  // Las dos ranuras se distinguen por su propio nombre en el plan
  const slotKind = name => (/inform[áa]tica/i.test(name) ? 'informatica' : 'complementaria');

  const creditGaps = [];
  const codeGaps = [];

  // El plan completo: las 55 materias de la carrera, se dicten o no este
  // período. Los créditos de las que no se dictan igual cuentan para los
  // requisitos por créditos acumulados.
  const planSubjects = plan.subjects.map(entry => {
    const match = byTitle.get(titleKey(entry.name));
    const requires = (entry.requires ?? []).map(name => idOf.get(name)).filter(Boolean);
    const coreq = (entry.coreq ?? []).map(name => idOf.get(name)).filter(Boolean);

    if (match) {
      if (match.id !== entry.id) codeGaps.push({ name: entry.name, plan: entry.id, banner: match.id });
      if (entry.credits !== match.credits) {
        creditGaps.push({ name: entry.name, plan: entry.credits, banner: match.credits });
      }

      match.semester = entry.semester;
      match.area = entry.area;
      match.row = entry.row;
      match.hue = plan.areas[entry.area]?.hue ?? null;
      if (entry.creditGate) match.creditGate = entry.creditGate;
      if (requires.length > 0) match.requires = requires;
      if (coreq.length > 0) match.coreq = coreq;
    }

    return {
      id: entry.id,
      name: entry.name,
      semester: entry.semester,
      row: entry.row,
      area: entry.area,
      hue: plan.areas[entry.area]?.hue ?? null,
      credits: entry.credits,
      offered: Boolean(match),
      ...(isElective(entry.name)
        ? { electiveSlot: true, electiveKind: slotKind(entry.name) }
        : {}),
      ...(requires.length > 0 ? { requires } : {}),
      ...(coreq.length > 0 ? { coreq } : {}),
      ...(entry.creditGate ? { creditGate: entry.creditGate } : {})
    };
  });

  // Lo único comprobable de un requisito: no puede estar en un semestre
  // posterior. El mismo semestre sí es válido: el Trabajo de Grado exige el
  // Curso de Trabajo de Grado y ambos están en el octavo.
  const semesterOf = new Map(planSubjects.map(entry => [entry.id, entry.semester]));

  for (const entry of planSubjects) {
    for (const requiredId of entry.requires ?? []) {
      if (semesterOf.get(requiredId) > entry.semester) {
        console.warn(
          `⚠️  ${entry.name} (sem ${entry.semester}) requiere algo de un semestre posterior.`
        );
      }
    }
  }

  // La malla declara cuántos créditos suma cada semestre: sirve de suma de
  // control para detectar una materia mal ubicada al transcribirla.
  for (const [semester, expected] of Object.entries(plan.semesterCredits ?? {})) {
    const actual = planSubjects
      .filter(entry => entry.semester === Number(semester))
      .reduce((sum, entry) => sum + entry.credits, 0);

    if (actual !== expected) {
      console.warn(`⚠️  Semestre ${semester}: ${actual} UC calculadas contra ${expected} declaradas.`);
    }
  }

  for (const gap of codeGaps) {
    console.warn(`⚠️  ${gap.name}: el plan la codifica ${gap.plan} y Banner ${gap.banner}.`);
  }

  for (const gap of creditGaps) {
    console.warn(`⚠️  ${gap.name}: el plan dice ${gap.plan} UC y Banner ${gap.banner}.`);
  }

  // Una electiva concreta no está en el plan, pero cuenta para sus ranuras:
  // sin esta marca quedaría fuera de los filtros por avance.
  // Sin el catálogo de la Escuela solo queda el título, que se equivoca en las
  // dos direcciones: cuela electivas de otras carreras y deja fuera las que no
  // se llaman "Electiva: algo".
  if (!hasCatalog) {
    for (const subject of subjects) {
      if (subject.semester === undefined && isElective(subject.title)) {
        subject.elective = true;
        subject.electiveKind = electiveKindOf(subject.id);
      }
    }
  }

  const electives = subjects.filter(subject => subject.elective);
  const own = electives.filter(subject => subject.electiveKind === 'informatica').length;
  console.log(
    `ℹ️  ${electives.length} electivas concretas: ${own} para la ranura de Informática, ` +
      `${electives.length - own} para la Complementaria`
  );

  const orphans = subjects.filter(subject => subject.semester === undefined).length;
  if (orphans > 0) {
    console.log(`ℹ️  ${orphans} materias dictadas no están en el plan de Informática.`);
  }

  return {
    career: plan.career,
    plan: plan.plan,
    source: plan.source,
    totalCredits: plan.totalCredits,
    semesters: plan.semesters,
    semesterCredits: plan.semesterCredits,
    areas: plan.areas,
    subjects: planSubjects
  };
}

/**
 * Suma lo que solo publica la Escuela: profesor y modalidad.
 *
 * Es opcional a propósito. Si el archivo no está, el merge sigue dando datos
 * correctos, solo que sin profesores; así nadie queda bloqueado por no haber
 * corrido `npm run ucab`.
 *
 * @param {Array} subjects - Materias agrupadas desde Banner
 * @return {Promise<Object|null>} Resumen del cruce, o null si no hay archivo
 */
async function applyUcabSchedules(subjects) {
  let file;

  try {
    file = JSON.parse(await readFile(UCAB_FILE, 'utf8'));
  } catch {
    console.warn(`\u26a0\ufe0f  No se encontró ${UCAB_FILE}; las secciones quedan sin profesor.`);
    console.warn('   Corre `npm run ucab` para bajarlo de la página de la Escuela.');
    return null;
  }

  const report = applyUcabRows({ subjects, rows: file.rows ?? [] });

  console.log(
    `\ud83d\udc64 Escuela: ${report.withProfessor} secciones con profesor, ` +
      `${report.added} que Banner no trajo (${report.newSubjects} materias nuevas)`
  );

  if (report.skipped > 0) console.warn(`\u26a0\ufe0f  ${report.skipped} filas de la Escuela sin NRC.`);

  return { fetchedAt: file.fetchedAt, term: file.term, ...report };
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
const ucab = await applyUcabSchedules(subjects);

// El cruce va antes de unir el plan a propósito: si la Escuela publica una
// materia que Banner no trajo, el plan tiene que verla como dictada.
const plan = await attachPlan(subjects, ucab !== null);
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
    ucab,
    subjects
  })
);

// Se cuenta sobre la salida y no sobre Banner: si no, el resumen deja fuera
// las secciones que aportó la Escuela.
const allSections = subjects.flatMap(subject => subject.sections);
const withSchedule = allSections.filter(section => section.meetings.length > 0).length;
const bytes = (await readFile(OUTPUT_FILE)).length;

console.log(`📄 ${files.length} páginas leídas: ${files.join(', ')}`);
console.log(`🎓 Período: ${termCode} ${termLabel} (${start} → ${end})`);
console.log(
  `✅ ${subjects.length} materias, ${allSections.length} secciones ` +
    `(${allSections.length - withSchedule} sin horario)`
);
if (plan) {
  const conPlan = subjects.filter(subject => subject.semester !== undefined).length;
  const sinDictar = plan.subjects.filter(entry => !entry.offered).length;
  console.log(`🎯 plan de ${plan.subjects.length} materias: ${conPlan} se dictan, ${sinDictar} no`);
}
console.log(`💾 ${OUTPUT_FILE} — ${(bytes / 1024).toFixed(0)} KB`);
