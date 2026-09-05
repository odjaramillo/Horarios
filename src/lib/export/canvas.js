/**
 * Dibuja el horario en un canvas.
 *
 * Es la fuente única para la imagen y para el PDF: se dibuja una vez y de ahí
 * salen los dos formatos. El navegador acepta `oklch()` en canvas, así que se
 * usan las mismas fórmulas de color que en app.css en vez de una paleta aparte
 * que habría que mantener sincronizada a mano.
 */
import { DAYS, activeDays, formatTime, scheduleBounds, totalCredits, weeklyHours } from '../domain/schedule.js';
import { hueFor } from '../domain/palette.js';

const PAD = 32;
const HEADER = 92;
const DAY_HEADER = 34;
const HOUR = 62;
const GUTTER = 56;
const DAY_WIDTH = 168;
const FOOTER = 54;

/** La imagen se exporta siempre en claro: se imprime y se comparte mejor. */
const INK = 'oklch(0.21 0.012 260)';
const INK_SOFT = 'oklch(0.48 0.014 260)';
const INK_FAINT = 'oklch(0.62 0.012 260)';
const LINE = 'oklch(0.912 0.005 260)';
const PAPER = 'oklch(1 0 0)';

const font = (size, weight = 400) => `${weight} ${size}px Inter, system-ui, sans-serif`;

/**
 * Recorta un texto para que entre en el ancho disponible
 * @param {CanvasRenderingContext2D} ctx - Contexto de dibujo
 * @param {String} text - Texto original
 * @param {Number} maxWidth - Ancho máximo en píxeles
 * @return {String} Texto, con puntos suspensivos si hubo que cortarlo
 */
export function ellipsize(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;

  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }

  return `${cut.trim()}…`;
}

/**
 * Parte un texto en las líneas que quepan
 * @param {CanvasRenderingContext2D} ctx - Contexto de dibujo
 * @param {String} text - Texto original
 * @param {Number} maxWidth - Ancho máximo en píxeles
 * @param {Number} maxLines - Cantidad máxima de líneas
 * @return {Array<String>} Líneas resultantes
 */
export function wrap(ctx, text, maxWidth, maxLines) {
  const words = text.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (!current || ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else if (lines.length + 1 < maxLines) {
      lines.push(current);
      current = word;
    } else {
      // Ya no quedan líneas: lo que sobra se acumula para que el recorte final
      // lo muestre con puntos suspensivos en vez de desaparecer sin aviso.
      current = candidate;
    }
  }

  lines.push(current);

  return lines.map(line => ellipsize(ctx, line, maxWidth));
}

/**
 * Rectángulo con esquinas redondeadas, relleno y borde
 * @param {CanvasRenderingContext2D} ctx - Contexto de dibujo
 * @param {Object} box - {x, y, width, height, radius}
 * @param {Object} colors - {fill, stroke}
 */
function roundedBox(ctx, { x, y, width, height, radius = 8 }, { fill, stroke }) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);

  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }

  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/**
 * Dibuja el horario completo y devuelve el canvas
 * @param {Array} schedule - Combinación de {subject, section}
 * @param {Object} term - Período con {label}
 * @param {Number} scale - Multiplicador de resolución
 * @return {Promise<HTMLCanvasElement>} Canvas con el horario dibujado
 */
export async function renderSchedule(schedule, term, scale = 2) {
  await document.fonts.ready;

  const days = activeDays(schedule);
  const bounds = scheduleBounds(schedule);
  const hours = bounds.to - bounds.from;

  const width = PAD * 2 + GUTTER + days.length * DAY_WIDTH;
  const height = HEADER + DAY_HEADER + hours * HOUR + FOOTER + PAD;

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, width, height);

  // Encabezado
  ctx.fillStyle = INK;
  ctx.font = font(24, 700);
  ctx.fillText('Horario', PAD, 44);

  ctx.fillStyle = INK_FAINT;
  ctx.font = font(13, 500);
  ctx.fillText(term?.label ?? '', PAD, 66);

  const summary = `${totalCredits(schedule)} UC · ${weeklyHours(schedule)} h/sem · ${schedule.length} materias`;
  ctx.textAlign = 'right';
  ctx.fillStyle = INK_SOFT;
  ctx.font = font(13, 600);
  ctx.fillText(summary, width - PAD, 44);
  ctx.textAlign = 'left';

  const gridTop = HEADER;
  const bodyTop = gridTop + DAY_HEADER;
  const gridLeft = PAD + GUTTER;

  // Encabezados de día
  ctx.textAlign = 'center';
  ctx.fillStyle = INK_FAINT;
  ctx.font = font(11, 700);
  days.forEach((day, index) => {
    ctx.fillText(
      DAYS[day].toUpperCase(),
      gridLeft + index * DAY_WIDTH + DAY_WIDTH / 2,
      gridTop + 22
    );
  });
  ctx.textAlign = 'left';

  // Líneas de hora y etiquetas
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  for (let index = 0; index <= hours; index += 1) {
    const y = bodyTop + index * HOUR;

    ctx.beginPath();
    ctx.moveTo(PAD, y + 0.5);
    ctx.lineTo(width - PAD, y + 0.5);
    ctx.stroke();

    if (index < hours) {
      ctx.fillStyle = INK_FAINT;
      ctx.font = font(11, 500);
      ctx.textAlign = 'right';
      ctx.fillText(formatTime((bounds.from + index) * 60), gridLeft - 12, y + 14);
      ctx.textAlign = 'left';
    }
  }

  // Separadores de columna
  days.forEach((_, index) => {
    if (index === 0) return;

    const x = gridLeft + index * DAY_WIDTH;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, bodyTop);
    ctx.lineTo(x + 0.5, bodyTop + hours * HOUR);
    ctx.stroke();
  });

  // Bloques de clase
  for (const { subject, section } of schedule) {
    const hue = hueFor(subject);

    for (const meeting of section.meetings) {
      const column = days.indexOf(meeting.day);
      if (column === -1) continue;

      const x = gridLeft + column * DAY_WIDTH + 4;
      const y = bodyTop + ((meeting.start - bounds.from * 60) / 60) * HOUR;
      const blockHeight = ((meeting.end - meeting.start) / 60) * HOUR - 4;
      const blockWidth = DAY_WIDTH - 8;

      roundedBox(
        ctx,
        { x, y, width: blockWidth, height: blockHeight },
        { fill: `oklch(0.955 0.045 ${hue})`, stroke: `oklch(0.85 0.085 ${hue})` }
      );

      const textColor = `oklch(0.42 0.13 ${hue})`;
      const inner = blockWidth - 16;
      let cursor = y + 17;

      ctx.fillStyle = textColor;
      ctx.font = font(12, 700);
      for (const line of wrap(ctx, subject.title, inner, blockHeight > 44 ? 2 : 1)) {
        ctx.fillText(line, x + 8, cursor);
        cursor += 14;
      }

      ctx.font = font(11, 500);
      ctx.globalAlpha = 0.85;
      ctx.fillText(`${formatTime(meeting.start)}–${formatTime(meeting.end)}`, x + 8, cursor);
      cursor += 13;

      if (blockHeight > cursor - y + 6) {
        ctx.globalAlpha = 0.7;
        ctx.fillText(ellipsize(ctx, `NRC ${section.crn} · SEC ${section.seq}`, inner), x + 8, cursor);
        cursor += 13;
      }

      if (section.professors.length > 0 && blockHeight > cursor - y + 6) {
        ctx.fillText(ellipsize(ctx, section.professors[0], inner), x + 8, cursor);
      }

      ctx.globalAlpha = 1;
    }
  }

  // Pie con los NRC, para que la imagen sirva al inscribir
  const nrcs = schedule.map(entry => entry.section.crn).join('  ');
  const footerY = bodyTop + hours * HOUR + 26;

  ctx.fillStyle = INK_FAINT;
  ctx.font = font(11, 600);
  ctx.fillText('NRC', PAD, footerY);

  ctx.fillStyle = INK_SOFT;
  ctx.font = font(12, 600);
  ctx.fillText(ellipsize(ctx, nrcs, width - PAD * 2 - 40), PAD + 34, footerY);

  return canvas;
}
