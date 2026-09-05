/**
 * Tono de color de cada materia.
 *
 * Cuando la materia está en el plan de estudios usa el tono de su área, así el
 * color dice algo: de un vistazo ves si tu semana es todo matemática. Para las
 * que no están en el plan se deriva del identificador, de forma estable entre
 * sesiones y sin guardar nada.
 *
 * El salto de 137° (el ángulo áureo) separa al máximo tonos consecutivos, de
 * modo que dos materias vecinas nunca terminan con colores parecidos.
 */

const GOLDEN_ANGLE = 137.508;
const BUCKETS = 12;

/**
 * Tono derivado del identificador
 * @param {String} id - Identificador de la materia, por ejemplo "FING02002"
 * @return {Number} Tono entre 0 y 360
 */
function hashHue(id) {
  let hash = 0;

  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }

  return Math.round(((hash % BUCKETS) * GOLDEN_ANGLE) % 360);
}

/**
 * Tono en grados para una materia
 * @param {Object} subject - Materia del modelo de dominio
 * @return {Number} Tono entre 0 y 360
 */
export function hueFor(subject) {
  return subject.hue ?? hashHue(subject.id);
}
