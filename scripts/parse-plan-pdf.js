/**
 * Extrae el plan de estudios del PDF oficial.
 *
 * La primera página del PDF es una tabla, no el diagrama: trae una columna
 * "Prelaciones" con los requisitos escritos. Leer de ahí evita transcribir
 * flechas de una imagen, que es donde se cuelan los errores invisibles.
 *
 * Uso: npm run plan
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';

const run = promisify(execFile);

const PDF = 'data/plan-de-estudio.pdf';
const OUTPUT = 'data/malla-informatica.json';
const DIAGRAM = 'data/diagrama-informatica.json';

const SEMESTERS = {
  PRIMER: 1,
  SEGUNDO: 2,
  TERCER: 3,
  CUARTO: 4,
  QUINTO: 5,
  SEXTO: 6,
  'SÉPTIMO': 7,
  OCTAVO: 8
};

/**
 * Lee la primera página del PDF conservando la disposición en columnas
 * @return {Promise<String>} Texto de la tabla
 */
async function readTable() {
  try {
    const { stdout } = await run('pdftotext', ['-layout', '-f', '1', '-l', '1', PDF, '-']);

    return stdout;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(
        'Hace falta pdftotext (paquete poppler-utils) para leer el plan de estudios.\n' +
          '  Debian/Ubuntu: sudo apt install poppler-utils'
      );
    }

    throw error;
  }
}

/**
 * Separa la fila en su parte de identificación y la de requisitos
 * @param {String} line - Línea de la tabla
 * @return {Object|null} Datos de la materia, o null si la línea no lo es
 */
function parseRow(line) {
  const withNumbers = /^\s*([A-Z]{4})\s+([A-Z0-9]{4,6})\s+(\D+?)\s{2,}(\d[\d\s]*\d)\s+(.*)$/.exec(line);

  if (withNumbers) {
    const [, faculty, number, name, numbers, tail] = withNumbers;
    const values = numbers.trim().split(/\s+/).map(Number);

    return {
      id: `${faculty}${number}`,
      name: name.trim().replace(/\s+/g, ' '),
      // HT HP HL HAD Pr HTI TH UC THP ECTS CLAR: los créditos son el octavo.
      // Las materias de 0 UC traen menos columnas y ahí no hay octavo.
      credits: values[7] ?? 0,
      tail
    };
  }

  // Servicio comunitario y afines no tienen número de curso ni columna numérica
  const withoutNumbers = /^\s*([A-Z]{4})\s{3,}([A-ZÁÉÍÓÚÑ][^\d]*?)\s{3,}(\S.*)$/.exec(line);
  if (!withoutNumbers) return null;

  const [, faculty, name, tail] = withoutNumbers;

  return { id: faculty, name: name.trim().replace(/\s+/g, ' '), credits: 0, tail };
}

/**
 * Extrae prerrequisitos, correquisitos y compuerta por créditos de la
 * columna "Prelaciones". Se buscan por patrón y no por posición, porque las
 * columnas se desplazan de una fila a otra.
 * @param {String} tail - Resto de la fila
 * @return {Object} {requires, coreq, creditGate}
 */
function parseRequirements(tail) {
  const requires = [];
  const coreq = [];

  // Antes de los requisitos quedan las columnas de evaluación, modalidad y
  // taxonomía. Si no se quitan, "EVR PRE TA-4 Álgebra" entra como nombre.
  const clean = tail.replace(/\b(EVR|EVC\*?|PRE\/VIT|PRE\*?|VIT|LIN|TA-\S+)\b/g, ' ');

  for (const [, name, kind] of clean.matchAll(/([A-ZÁÉÍÓÚÑ][^()+]*?)\s*\((PQ|CQ)\)/g)) {
    const label = name.trim().replace(/\s+/g, ' ');

    (kind === 'PQ' ? requires : coreq).push(label);
  }

  const gate = /\b(\d+)\s*UC\b/.exec(clean);

  return {
    ...(requires.length > 0 ? { requires } : {}),
    ...(coreq.length > 0 ? { coreq } : {}),
    ...(gate ? { creditGate: Number(gate[1]) } : {})
  };
}

const table = await readTable();

const subjects = [];
const semesterCredits = {};
let semester = 0;

for (const line of table.split('\n')) {
  const header = /(PRIMER|SEGUNDO|TERCER|CUARTO|QUINTO|SEXTO|SÉPTIMO|OCTAVO)\s+SEMESTRE/.exec(line);

  if (header) {
    semester = SEMESTERS[header[1]];

    // La cabecera del semestre trae sus totales; el octavo número son los UC
    const totals = line.replace(header[0], '').trim().split(/\s+/).map(Number).filter(Number.isFinite);
    if (totals.length >= 8) semesterCredits[semester] = totals[7];

    continue;
  }

  if (semester === 0) continue;

  const row = parseRow(line);
  if (!row) continue;

  const { tail, ...subject } = row;
  subjects.push({ ...subject, semester, ...parseRequirements(tail) });
}

// El plan codifica ambas electivas como "FING RANGO": el identificador no es
// único. Se desambiguan las dos, no solo la segunda, para que ninguna dependa
// del orden en que aparezcan.
const slug = name =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const counts = new Map();
for (const subject of subjects) counts.set(subject.id, (counts.get(subject.id) ?? 0) + 1);

for (const subject of subjects) {
  if (counts.get(subject.id) > 1) subject.id = `${subject.id}-${slug(subject.name)}`;
}

// El área de formación (el color) y la fila (la posición vertical) no están en
// la tabla: son del diagrama. Viven en su propio archivo, que este script solo
// lee. Leerlos de su propia salida haría que se degradaran en cada corrida.
const diagram = JSON.parse(await readFile(DIAGRAM, 'utf8'));

const missingPlacement = [];
for (const subject of subjects) {
  const placement = diagram.subjects[subject.name];

  if (!placement) {
    missingPlacement.push(subject.name);
    continue;
  }

  subject.area = placement.area;
  subject.row = placement.row;
}

const extraPlacements = Object.keys(diagram.subjects).filter(
  name => !subjects.some(subject => subject.name === name)
);

const byName = new Map(subjects.map(subject => [subject.name, subject]));
const unknownRefs = [];

for (const subject of subjects) {
  for (const name of [...(subject.requires ?? []), ...(subject.coreq ?? [])]) {
    if (!byName.has(name)) unknownRefs.push(`${subject.name} → ${name}`);
  }
}

const total = subjects.reduce((sum, subject) => sum + subject.credits, 0);

await writeFile(
  OUTPUT,
  JSON.stringify(
    {
      career: 'Ingeniería Informática',
      plan: 'Sept. 2026',
      source: PDF,
      semesters: 8,
      totalCredits: total,
      semesterCredits,
      areas: diagram.areas,
      note: 'Generado por scripts/parse-plan-pdf.js desde la tabla del PDF oficial. El area y la fila salen de data/diagrama-informatica.json.',
      subjects
    },
    null,
    2
  ) + '\n'
);

console.log(`📘 ${subjects.length} materias leídas de ${PDF}`);
console.log(`🔗 ${subjects.filter(s => s.requires).length} con prerrequisitos, ${subjects.filter(s => s.coreq).length} con correquisitos, ${subjects.filter(s => s.creditGate).length} con compuerta de créditos`);
console.log(`🎓 ${total} UC en total; por semestre: ${Object.values(semesterCredits).join(' + ')}`);

if (missingPlacement.length > 0) console.warn(`⚠️  Sin ubicación en el diagrama: ${missingPlacement.join(', ')}`);
if (extraPlacements.length > 0) console.warn(`⚠️  El diagrama nombra materias que el PDF no tiene: ${extraPlacements.join(', ')}`);
if (unknownRefs.length > 0) console.warn(`⚠️  Requisitos que no encuentran materia: ${unknownRefs.join(' | ')}`);
