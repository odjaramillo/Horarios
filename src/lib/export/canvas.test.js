import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ellipsize, wrap } from './canvas.js';

/** Contexto falso: un carácter mide un píxel, así el ancho es la cantidad de letras */
const ctx = { measureText: text => ({ width: text.length }) };

test('ellipsize deja el texto intacto si entra', () => {
  assert.equal(ellipsize(ctx, 'Cálculo', 20), 'Cálculo');
});

test('ellipsize recorta y marca el corte', () => {
  const result = ellipsize(ctx, 'Algoritmos y Estructuras de Datos', 12);

  assert.ok(result.endsWith('…'));
  assert.ok(result.length <= 12);
});

test('wrap parte en las palabras', () => {
  assert.deepEqual(wrap(ctx, 'Cálculo Diferencial', 10, 2), ['Cálculo', 'Diferencial'.slice(0, 9) + '…']);
});

test('wrap nunca descarta palabras en silencio', () => {
  // El bug original: al llenarse las líneas, el resto del título desaparecía
  const lines = wrap(ctx, 'Algoritmos y Estructuras de Datos', 14, 2);

  assert.equal(lines.length, 2);
  assert.ok(lines.at(-1).endsWith('…'), `la última línea debe avisar el corte: ${lines.at(-1)}`);
});

test('wrap respeta el tope de líneas', () => {
  const lines = wrap(ctx, 'una dos tres cuatro cinco seis siete ocho', 8, 3);

  assert.equal(lines.length, 3);
});

test('una palabra más ancha que el espacio se recorta en vez de desbordar', () => {
  const lines = wrap(ctx, 'Interdisciplinariedad', 8, 1);

  assert.equal(lines.length, 1);
  assert.ok(lines[0].length <= 8);
});
