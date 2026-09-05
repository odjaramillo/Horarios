/**
 * Baja los horarios que publica la Escuela de Informática.
 *
 * La página de inscripciones lee su propio backend con la clave anónima que
 * lleva incrustada en el HTML: es pública por diseño y no da acceso a nada que
 * la página no muestre ya. Aquí se piden los mismos dos RPC que pide ella para
 * el listado por semestre, que no necesitan cédula ni sesión.
 *
 * De aquí sale lo único que Banner no da: el profesor, la modalidad y la
 * correspondencia entre las secciones de teoría y las de práctica, que vive en
 * el propio HTML de la página y no en ningún RPC.
 *
 * Uso: npm run ucab
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parsePairings } from '../src/lib/domain/practices.js';

const PAGE =
  'https://ingenieria.ucab.edu.ve/informatica/la-escuela/caracas/procesos-academicos/ingenieria-informatica/inscripciones/';
const SUPABASE_URL = 'https://zmvecicbbxbpuhbnexiz.supabase.co';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptdmVjaWNiYnhicHVoYm5leGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4ODQzMzAsImV4cCI6MjA4NTQ2MDMzMH0.m5lHEASg8lCo4qjajA4yLzjqYN12g3tlNkZh4h_vBmE';

const CAREER_CODE = 'IINE';
const OUTPUT_FILE = join('data', 'ucab-schedules.json');

/**
 * Llama a una función del backend de la Escuela
 * @param {String} name - Nombre del RPC
 * @param {Object} body - Argumentos
 * @return {Promise<any>} Respuesta ya deserializada
 */
async function rpc(name, body = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`${name} respondió ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

const career = await rpc('er_get_career_info', { p_car_cod_corto: CAREER_CODE });

if (!career?.id) {
  throw new Error(`No se pudo resolver la carrera ${CAREER_CODE}; ¿cambió la página?`);
}

const term = await rpc('er_get_active_term');

// El catálogo de electivas va aparte porque el plan las declara como ranuras
// sin nombre propio: el listado por semestre no las incluye.
const [semester, electives] = await Promise.all([
  rpc('er_get_semester_subject_schedules', { p_career_id: career.id }),
  rpc('er_get_elective_catalog', { p_career_id: career.id })
]);

const rows = [...(semester ?? []), ...(electives ?? [])];

// La correspondencia teoría/práctica no está en la base: son tablas escritas a
// mano en la página. Si la página no carga, se sigue sin ellas en vez de
// perder también los profesores.
let pairings = [];

try {
  const page = await fetch(PAGE, { headers: { 'User-Agent': 'horarios-ucab' } });

  if (!page.ok) throw new Error(`la página respondió ${page.status}`);

  pairings = parsePairings(await page.text());
} catch (error) {
  console.warn(`\u26a0\ufe0f  No se pudieron leer las tablas de teoría/práctica: ${error.message}`);
}

if (rows.length === 0) {
  throw new Error('La Escuela no devolvió ninguna sección; no se sobrescribe el archivo.');
}

await writeFile(
  OUTPUT_FILE,
  `${JSON.stringify({ fetchedAt: new Date().toISOString(), source: PAGE, term, career, pairings, rows }, null, 1)}\n`
);

const named = rows.filter(row => row.professor && row.professor !== 'Por Asignar').length;

console.log(`🏫 ${career.nombre} (id ${career.id}) — período ${term}`);
console.log(`✅ ${rows.length} secciones: ${semester?.length ?? 0} del plan, ${electives?.length ?? 0} electivas`);
console.log(`👤 ${named} con profesor asignado, ${rows.length - named} por asignar`);
const pairs = pairings.reduce((sum, table) => sum + table.pairs.length, 0);
console.log(`🔗 ${pairings.length} tablas de teoría/práctica, ${pairs} combinaciones`);
console.log(`💾 ${OUTPUT_FILE}`);
