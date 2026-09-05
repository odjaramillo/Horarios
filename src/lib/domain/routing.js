/**
 * Traza las flechas de la malla evitando las cajas.
 *
 * La malla impresa nunca cruza una asignatura con una línea: los tramos
 * horizontales largos van por los pasillos que quedan entre filas, y los
 * verticales por los pasillos entre columnas. Esto reproduce esa regla.
 *
 * Es geometría pura sobre rectángulos ya medidos, así que se puede probar sin
 * navegador.
 */

/** Separación mínima entre dos líneas que comparten pasillo */
const LANE = 3.5;

/**
 * Agrupa las cajas en bandas horizontales, una por fila del diagrama
 * @param {Array} nodes - Materias con {id, row}
 * @param {Map} boxes - Rectángulos medidos por identificador
 * @return {Map} Fila → {top, bottom}
 */
function rowBands(nodes, boxes) {
  const bands = new Map();

  for (const node of nodes) {
    const box = boxes.get(node.id);
    if (!box) continue;

    const band = bands.get(node.row) ?? { top: Infinity, bottom: -Infinity };

    band.top = Math.min(band.top, box.y);
    band.bottom = Math.max(band.bottom, box.y + box.height);
    bands.set(node.row, band);
  }

  return bands;
}

/**
 * Punto medio del pasillo que hay entre dos filas contiguas
 * @param {Map} bands - Bandas por fila
 * @param {Number} above - Fila de arriba
 * @param {Number} fallbackGap - Separación a usar si no hay fila vecina
 * @return {Number} Coordenada vertical del pasillo
 */
function corridorBetween(bands, above, fallbackGap) {
  const top = bands.get(above);
  const bottom = bands.get(above + 1);

  if (top && bottom) {
    return { y: (top.bottom + bottom.top) / 2, room: Math.max(0, bottom.top - top.bottom) };
  }

  if (top) return { y: top.bottom + fallbackGap, room: fallbackGap * 2 };
  if (bottom) return { y: bottom.top - fallbackGap, room: fallbackGap * 2 };

  return { y: 0, room: fallbackGap * 2 };
}

/**
 * Decide por qué pasillo horizontal viaja una arista larga.
 *
 * Se elige el pasillo pegado a la materia de destino, para que la bajada final
 * sea corta y la línea se lea como entrando en ella.
 *
 * @param {Object} edge - Arista con {from, to}
 * @param {Map} bands - Bandas por fila
 * @param {Number} fallbackGap - Separación a usar en los extremos
 * @return {Number} Coordenada vertical del pasillo
 */
function pickCorridor(edge, bands, fallbackGap) {
  const from = edge.from.row;
  const to = edge.to.row;

  if (to > from) return corridorBetween(bands, to - 1, fallbackGap);
  if (to < from) return corridorBetween(bands, to, fallbackGap);

  // Misma fila: hay que rodear las materias intermedias por arriba, salvo en
  // la primera fila, donde no hay pasillo por encima.
  return to === 0 ? corridorBetween(bands, 0, fallbackGap) : corridorBetween(bands, to - 1, fallbackGap);
}

/**
 * Calcula el camino de cada flecha
 * @param {Object} input - {edges, boxes, nodes, gapX}
 * @return {Array} Aristas con su atributo `d` y la punta de flecha
 */
export function routeEdges({ edges, boxes, nodes, gapX = 24 }) {
  const bands = rowBands(nodes, boxes);
  const fallbackGap = Math.max(8, gapX / 2);
  const half = gapX / 2;

  const routed = [];
  const pending = [];

  for (const edge of edges) {
    const from = boxes.get(edge.from.id);
    const to = boxes.get(edge.to.id);

    if (!from || !to) continue;

    const sameColumn = edge.from.semester === edge.to.semester;
    const adjacent = edge.to.semester - edge.from.semester === 1;
    const sameRow = edge.from.row === edge.to.row;

    // Dentro del mismo semestre la flecha es vertical: sale por el borde de
    // abajo y entra por el de arriba, o al revés si va hacia arriba.
    if (sameColumn) {
      const down = to.y > from.y;
      const x = Math.max(from.x, to.x) + Math.min(from.width, to.width) / 2;
      const y1 = down ? from.y + from.height : from.y;
      const y2 = down ? to.y : to.y + to.height;

      routed.push({
        ...edge,
        d: `M ${x} ${y1} V ${y2}`,
        arrow: { x, y: y2, direction: down ? 'down' : 'up' }
      });
      continue;
    }

    const x1 = from.x + from.width;
    const y1 = from.y + from.height / 2;
    const x2 = to.x;
    const y2 = to.y + to.height / 2;

    // Contigua y en la misma fila: recta.
    if (adjacent && sameRow) {
      routed.push({ ...edge, d: `M ${x1} ${y1} H ${x2}`, arrow: { x: x2, y: y2, direction: 'right' } });
      continue;
    }

    // Contigua pero en otra fila: el tramo vertical cabe en el pasillo que
    // separa las dos columnas, sin necesidad de rodear nada.
    if (adjacent) {
      const mid = (x1 + x2) / 2;

      routed.push({
        ...edge,
        d: `M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`,
        arrow: { x: x2, y: y2, direction: 'right' }
      });
      continue;
    }

    // Salto de más de una columna: hay materias en medio, así que la línea
    // sube o baja a un pasillo entre filas y viaja por ahí. El carril se
    // reparte después, cuando se sabe cuántas comparten ese pasillo.
    pending.push({ edge, corridor: pickCorridor(edge, bands, fallbackGap), x1, y1, x2, y2 });
  }

  const perCorridor = new Map();
  for (const item of pending) {
    const key = Math.round(item.corridor.y);
    perCorridor.set(key, [...(perCorridor.get(key) ?? []), item]);
  }

  for (const group of perCorridor.values()) {
    // Los carriles se reparten centrados en el pasillo y nunca lo desbordan:
    // salirse significa dibujar la línea encima de una materia.
    const room = Math.max(0, group[0].corridor.room / 2 - 2);
    const spread = group.length > 1 ? Math.min(LANE, (room * 2) / (group.length - 1)) : 0;

    group.forEach((item, index) => {
      const y = item.corridor.y + (index - (group.length - 1) / 2) * spread;
      const outX = item.x1 + half;
      const inX = item.x2 - half;

      routed.push({
        ...item.edge,
        d: `M ${item.x1} ${item.y1} H ${outX} V ${y} H ${inX} V ${item.y2} H ${item.x2}`,
        arrow: { x: item.x2, y: item.y2, direction: 'right' }
      });
    });
  }

  return routed;
}

/**
 * Puntos de un triángulo que apunta hacia donde entra la línea
 * @param {Object} arrow - {x, y, direction}
 * @param {Number} size - Largo del triángulo
 * @return {String} Atributo `points` de un polígono
 */
export function arrowHead({ x, y, direction }, size = 5) {
  const wing = size * 0.6;

  if (direction === 'down') {
    return `${x},${y} ${x - wing},${y - size} ${x + wing},${y - size}`;
  }

  if (direction === 'up') {
    return `${x},${y} ${x - wing},${y + size} ${x + wing},${y + size}`;
  }

  return `${x},${y} ${x - size},${y - wing} ${x - size},${y + wing}`;
}
