/**
 * Descargas del horario. Un solo dibujo en canvas alimenta la imagen y el PDF.
 */
import { renderSchedule } from './canvas.js';
import { buildPdf } from './pdf.js';
import { nrcDetail } from './nrc.js';

/**
 * Entrega un archivo al navegador
 * @param {Blob} blob - Contenido del archivo
 * @param {String} filename - Nombre sugerido
 */
function save(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

/**
 * Convierte un canvas en un Blob
 * @param {HTMLCanvasElement} canvas - Canvas dibujado
 * @param {String} type - Tipo MIME
 * @param {Number} quality - Calidad para formatos con pérdida
 * @return {Promise<Blob>} Imagen codificada
 */
function toBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('El navegador no pudo generar la imagen.'))),
      type,
      quality
    );
  });
}

/**
 * Descarga el horario como imagen PNG
 * @param {Array} schedule - Combinación de {subject, section}
 * @param {Object} term - Período con {code, label}
 */
export async function downloadPng(schedule, term) {
  const canvas = await renderSchedule(schedule, term, 2);

  save(await toBlob(canvas, 'image/png'), `horario-${term?.code ?? 'ucab'}.png`);
}

/**
 * Descarga el horario como PDF de una página
 * @param {Array} schedule - Combinación de {subject, section}
 * @param {Object} term - Período con {code, label}
 */
export async function downloadPdf(schedule, term) {
  const canvas = await renderSchedule(schedule, term, 3);
  const jpeg = new Uint8Array(await (await toBlob(canvas, 'image/jpeg', 0.92)).arrayBuffer());
  const pdf = buildPdf(jpeg, canvas.width, canvas.height, `Horario ${term?.label ?? ''}`.trim());

  save(new Blob([pdf], { type: 'application/pdf' }), `horario-${term?.code ?? 'ucab'}.pdf`);
}

/**
 * Descarga el detalle del horario como texto plano
 * @param {Array} schedule - Combinación de {subject, section}
 * @param {Object} term - Período con {code, label}
 */
export function downloadNrcText(schedule, term) {
  const blob = new Blob([nrcDetail(schedule, term)], { type: 'text/plain;charset=utf-8' });

  save(blob, `horario-${term?.code ?? 'ucab'}.txt`);
}
