/**
 * Ata cada práctica a la teoría de la que sale.
 *
 * Banner las publica como dos materias distintas, con NRC distinto, porque se
 * inscriben por separado: "Computación en la Nube" (INFO-02028) y "Computación
 * en la Nube (Práctica)" (INFO-P2028). El plan de estudios solo nombra la
 * teoría, así que la práctica se quedaba sin semestre y sin prelaciones, y
 * desaparecía en cuanto filtrabas por avance.
 *
 * No hay campo que las una: Banner devuelve `linkIdentifier` en null. Lo único
 * que las relaciona es el código, donde la práctica cambia el cero de la
 * teoría por una P.
 */

/** "INFOP2028" es la práctica de "INFO02028" */
const PRACTICE_CODE = /^([A-Z]+)P(\d.*)$/;

/** La página prueba las dos: la P puede venir de un 0 o de un 1 */
const THEORY_DIGITS = ['0', '1'];

/** El título lo confirma: sin esto, cualquier código con P entraría */
const PRACTICE_TITLE = /\(\s*pr[áa]ctica\s*\)/i;

/** Lo que la práctica toma de su teoría para situarse en el plan */
const INHERITED = ['semester', 'area', 'hue'];

/**
 * Códigos de teoría posibles para una práctica, en orden de preferencia
 * @param {String} id - Código de la materia
 * @return {Array<String>} Candidatos, vacío si no es una práctica
 */
export function theoryIdsOf(id) {
  const match = PRACTICE_CODE.exec(String(id ?? ''));

  return match ? THEORY_DIGITS.map(digit => `${match[1]}${digit}${match[2]}`) : [];
}

/**
 * Marca cada práctica con la teoría que la explica.
 *
 * Modifica `subjects` en el sitio. La práctica hereda semestre y área para que
 * los filtros la sitúen donde el estudiante la espera, pero no se copia nada
 * más: sus secciones, sus créditos y su NRC son suyos.
 *
 * @param {Array} subjects - Materias ya agrupadas
 * @param {Array} pairings - Tablas de correspondencia de la Escuela
 * @return {Object} Recuento {linked, paired, orphans} con los códigos sin teoría
 */
export function linkPractices(subjects, pairings = []) {
  const byId = new Map(subjects.map(subject => [subject.id, subject]));
  const report = { linked: 0, paired: 0, orphans: [] };

  for (const subject of subjects) {
    if (!PRACTICE_TITLE.test(subject.title ?? '')) continue;

    const theory = theoryIdsOf(subject.id)
      .map(candidate => byId.get(candidate))
      .find(Boolean);

    if (!theory) {
      report.orphans.push(subject.id);
      continue;
    }

    subject.practiceOf = theory.id;
    for (const key of INHERITED) {
      if (theory[key] !== undefined) subject[key] = theory[key];
    }

    report.linked++;
  }

  // La Escuela no permite cualquier combinación: cada sección de práctica va
  // con unas de teoría concretas. Solo se restringe lo que la tabla nombra.
  for (const table of pairings) {
    const practice = byId.get(table.practice);
    if (!practice) continue;

    const byPractice = new Map();
    const byTheory = new Map();

    for (const [theoryCrn, practiceCrn] of table.pairs) {
      if (!byPractice.has(practiceCrn)) byPractice.set(practiceCrn, []);
      byPractice.get(practiceCrn).push(theoryCrn);

      if (!byTheory.has(theoryCrn)) byTheory.set(theoryCrn, []);
      byTheory.get(theoryCrn).push(practiceCrn);
    }

    for (const section of practice.sections) {
      const crns = byPractice.get(String(section.crn));

      if (crns) {
        section.theoryCrns = crns;
        report.paired++;
      }
    }

    // También se marca la teoría: una sección que la tabla no nombra —como la
    // 401 de Computación en la Nube— queda sin restricción en vez de quedarse
    // sin ninguna práctica posible.
    for (const section of byId.get(table.theory)?.sections ?? []) {
      const crns = byTheory.get(String(section.crn));

      if (crns) section.practiceCrns = crns;
    }
  }

  return report;
}

/** La cabecera de una tabla de correspondencia nombra el código entre paréntesis */
const HEADER_CODE = /\(([A-Z]+-[\w]+)\)/;

/** Cada tabla de TablePress viene precedida de su título, con la misma clave */
const TABLE = /<h2 id="tablepress-([\w-]+)-name"[^>]*>[\s\S]*?<\/h2>\s*<table id="tablepress-\1"[\s\S]*?<\/table>/g;

const HEADERS = /<th[^>]*class="column-([12])"[^>]*>([\s\S]*?)<\/th>/g;
const ROWS = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
const CELL = /<td[^>]*class="column-([12])"[^>]*>([\s\S]*?)<\/td>/g;

/**
 * Quita las etiquetas y los espacios de una celda
 * @param {String} html - Contenido de la celda
 * @return {String} Texto plano
 */
function text(html) {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Lee las tablas de correspondencia entre teoría y práctica de la página.
 *
 * No basta con saber que INFO-P2028 es la práctica de INFO-02028: la Escuela
 * decide además qué sección de práctica va con qué sección de teoría, y no
 * todas las combinaciones valen. Esa correspondencia solo existe como una tabla
 * en el HTML, no en ningún RPC.
 *
 * La primera columna trae el NRC de la teoría con `rowspan`, así que se arrastra
 * hacia abajo mientras las filas siguientes solo traigan práctica.
 *
 * @param {String} html - HTML de la página de inscripciones
 * @return {Array} Tablas {theory, practice, pairs: [[teoría, práctica]]}
 */
export function parsePairings(html) {
  const tables = [];

  for (const [block] of String(html ?? '').matchAll(TABLE)) {
    const headers = {};
    for (const [, column, label] of block.matchAll(HEADERS)) headers[column] = text(label);

    const theory = /^teor[íi]a/i.test(headers['1'] ?? '') && HEADER_CODE.exec(headers['1']);
    const practice = /^pr[áa]ctica/i.test(headers['2'] ?? '') && HEADER_CODE.exec(headers['2']);

    if (!theory || !practice) continue;

    const seen = new Set();
    const pairs = [];
    let current = null;

    for (const [, row] of block.matchAll(ROWS)) {
      for (const [, column, value] of row.matchAll(CELL)) {
        if (column === '1') current = text(value);
        else if (current) {
          const key = `${current}-${text(value)}`;

          if (!seen.has(key)) {
            seen.add(key);
            pairs.push([current, text(value)]);
          }
        }
      }
    }

    if (pairs.length > 0) {
      tables.push({
        theory: theory[1].replace(/-/g, ''),
        practice: practice[1].replace(/-/g, ''),
        pairs
      });
    }
  }

  return tables;
}
