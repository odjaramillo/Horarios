import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { arrowHead, routeEdges } from './routing.js';

const COLUMN = 216;
const GAP_X = 24;
const ROW = 56;
const GAP_Y = 16;

/**
 * Coloca las materias en una retícula sintética, como la que produce el
 * navegador, para poder comprobar la geometría sin abrir un navegador.
 * @param {Array} nodes - Materias con {id, semester, row}
 * @return {Map} Rectángulos por identificador
 */
function gridBoxes(nodes) {
  return new Map(
    nodes.map(node => [
      node.id,
      {
        x: (node.semester - 1) * (COLUMN + GAP_X),
        y: node.row * (ROW + GAP_Y),
        width: COLUMN,
        height: ROW
      }
    ])
  );
}

/**
 * Convierte un camino de segmentos rectos en pares de puntos
 * @param {String} d - Atributo `d` de un elemento path
 * @return {Array} Segmentos {x1, y1, x2, y2}
 */
function toSegments(d) {
  const tokens = d.trim().split(/\s+/);
  const segments = [];
  let x = 0;
  let y = 0;
  let index = 0;

  while (index < tokens.length) {
    const command = tokens[index];

    if (command === 'M') {
      x = Number(tokens[index + 1]);
      y = Number(tokens[index + 2]);
      index += 3;
      continue;
    }

    const value = Number(tokens[index + 1]);
    const next = command === 'H' ? { x: value, y } : { x, y: value };

    segments.push({ x1: x, y1: y, x2: next.x, y2: next.y });
    x = next.x;
    y = next.y;
    index += 2;
  }

  return segments;
}

/**
 * Indica si un segmento recto atraviesa un rectángulo
 * @param {Object} segment - {x1, y1, x2, y2}
 * @param {Object} box - {x, y, width, height}
 * @return {Boolean} true si lo cruza
 */
function crosses(segment, box) {
  // Se encoge la caja: tocar el borde al salir o al entrar es correcto
  const left = box.x + 1;
  const right = box.x + box.width - 1;
  const top = box.y + 1;
  const bottom = box.y + box.height - 1;

  const [minX, maxX] = [Math.min(segment.x1, segment.x2), Math.max(segment.x1, segment.x2)];
  const [minY, maxY] = [Math.min(segment.y1, segment.y2), Math.max(segment.y1, segment.y2)];

  return minX < right && maxX > left && minY < bottom && maxY > top;
}

const courses = JSON.parse(await readFile(new URL('../../../public/courses.json', import.meta.url), 'utf8'));
const nodes = courses.plan.subjects;
const byId = new Map(nodes.map(node => [node.id, node]));

const edges = nodes.flatMap(subject =>
  [
    ...(subject.requires ?? []).map(id => ({ kind: 'requires', id })),
    ...(subject.coreq ?? []).map(id => ({ kind: 'coreq', id }))
  ].map(({ kind, id }) => ({ key: `${id}->${subject.id}`, kind, from: byId.get(id), to: subject }))
);

const boxes = gridBoxes(nodes);
const routed = routeEdges({ edges, boxes, nodes, gapX: GAP_X });

test('se traza una flecha por cada prelación del plan', () => {
  assert.equal(edges.length, 43);
  assert.equal(routed.length, edges.length);
});

test('ninguna flecha atraviesa una materia', () => {
  const offenders = [];

  for (const edge of routed) {
    for (const segment of toSegments(edge.d)) {
      for (const node of nodes) {
        if (node.id === edge.from.id || node.id === edge.to.id) continue;

        if (crosses(segment, boxes.get(node.id))) {
          offenders.push(`${edge.from.name} → ${edge.to.name} cruza ${node.name}`);
        }
      }
    }
  }

  assert.deepEqual([...new Set(offenders)], []);
});

test('cada flecha empieza en su origen y termina en su destino', () => {
  for (const edge of routed) {
    const segments = toSegments(edge.d);
    const start = segments[0];
    const end = segments.at(-1);
    const from = boxes.get(edge.from.id);
    const to = boxes.get(edge.to.id);

    const touches = (x, y, box) =>
      x >= box.x - 1 &&
      x <= box.x + box.width + 1 &&
      y >= box.y - 1 &&
      y <= box.y + box.height + 1;

    assert.ok(touches(start.x1, start.y1, from), `${edge.key} no sale de su origen`);
    assert.ok(touches(end.x2, end.y2, to), `${edge.key} no llega a su destino`);
  }
});

test('las prelaciones del mismo semestre se dibujan verticales', () => {
  const sameColumn = routed.filter(edge => edge.from.semester === edge.to.semester);

  assert.equal(sameColumn.length, 5);
  for (const edge of sameColumn) {
    assert.match(edge.d, /^M [\d.-]+ [\d.-]+ V [\d.-]+$/, `${edge.key}: ${edge.d}`);
    assert.ok(['up', 'down'].includes(edge.arrow.direction));
  }
});

test('las prelaciones contiguas en la misma fila son una recta', () => {
  const straight = routed.filter(
    edge => edge.to.semester - edge.from.semester === 1 && edge.from.row === edge.to.row
  );

  assert.equal(straight.length, 23);
  for (const edge of straight) assert.match(edge.d, /^M [\d.-]+ [\d.-]+ H [\d.-]+$/);
});

test('las que saltan columnas viajan por un pasillo entre filas', () => {
  const long = routed.filter(edge => edge.to.semester - edge.from.semester > 1);

  assert.equal(long.length, 6);
  for (const edge of long) {
    // Salida, subida al pasillo, recorrido, bajada y entrada: cinco tramos
    assert.equal(toSegments(edge.d).length, 5, `${edge.key}: ${edge.d}`);
  }
});

test('dos flechas que comparten pasillo no se superponen', () => {
  const long = routed.filter(edge => edge.to.semester - edge.from.semester > 1);
  const corridors = long.map(edge => toSegments(edge.d)[2].y1);

  assert.equal(new Set(corridors).size, corridors.length, 'cada una debe llevar su propio carril');
});

test('la punta apunta hacia donde entra la línea', () => {
  const right = arrowHead({ x: 100, y: 50, direction: 'right' }, 5);
  const down = arrowHead({ x: 100, y: 50, direction: 'down' }, 5);

  assert.equal(right, '100,50 95,47 95,53');
  assert.equal(down, '100,50 97,45 103,45');
});
