import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildPdf } from './pdf.js';

/** JPEG válido de 1x1 píxel, para no depender de una librería de imágenes */
const JPEG_1X1 = Uint8Array.from(
  atob(
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
      'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAA' +
      'AQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIh' +
      'MUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpT' +
      'VFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5' +
      'usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iii' +
      'gD//2Q=='
  ),
  char => char.charCodeAt(0)
);

const decode = bytes => new TextDecoder('latin1').decode(bytes);

test('el PDF empieza con la cabecera y termina con la marca de fin', () => {
  const pdf = decode(buildPdf(JPEG_1X1, 800, 600));

  assert.match(pdf, /^%PDF-1\.4\n/);
  assert.match(pdf, /%%EOF\n$/);
});

test('startxref apunta exactamente a la tabla xref', () => {
  const bytes = buildPdf(JPEG_1X1, 800, 600);
  const pdf = decode(bytes);
  const offset = Number(/startxref\n(\d+)/.exec(pdf)[1]);

  assert.equal(pdf.slice(offset, offset + 4), 'xref');
});

test('cada offset de la tabla apunta al inicio de su objeto', () => {
  const pdf = decode(buildPdf(JPEG_1X1, 800, 600));
  const table = /xref\n0 (\d+)\n0000000000 65535 f \n([\s\S]*?)trailer/.exec(pdf);
  const offsets = table[2].trim().split('\n').map(line => Number(line.slice(0, 10)));

  assert.equal(Number(table[1]), offsets.length + 1, 'Size debe contar el objeto libre');

  offsets.forEach((offset, index) => {
    assert.equal(pdf.slice(offset, offset + 8).trim().split('\n')[0], `${index + 1} 0 obj`);
  });
});

test('la imagen conserva su proporción dentro de la página', () => {
  const pdf = decode(buildPdf(JPEG_1X1, 1000, 500));
  const matrix = /q\n([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm/.exec(pdf);
  const [width, height] = [Number(matrix[1]), Number(matrix[2])];

  assert.ok(Math.abs(width / height - 2) < 0.01, 'la relación 2:1 debe mantenerse');
  assert.ok(width <= 842 - 48, 'debe entrar en el ancho útil de A4 apaisado');
  assert.ok(height <= 595 - 48, 'debe entrar en el alto útil de A4 apaisado');
});

test('los bytes del JPEG viajan intactos', () => {
  const bytes = buildPdf(JPEG_1X1, 800, 600);
  const haystack = decode(bytes);
  const needle = decode(JPEG_1X1);

  assert.ok(haystack.includes(needle), 'el flujo de imagen no debe alterarse');
  assert.match(haystack, new RegExp(`/Length ${JPEG_1X1.length} >>\\nstream`));
});

test('escapa los paréntesis del título', () => {
  const pdf = decode(buildPdf(JPEG_1X1, 800, 600, 'Horario (2026) \\ prueba'));

  assert.match(pdf, /\/Title \(Horario \\\(2026\\\) \\\\ prueba\)/);
});

test('poppler lo abre y reporta una página del tamaño correcto', async t => {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const run = promisify(execFile);

  const path = join(tmpdir(), 'horarios-test.pdf');
  await writeFile(path, buildPdf(JPEG_1X1, 1600, 1000));

  let output;
  try {
    ({ stdout: output } = await run('pdfinfo', [path]));
  } catch {
    return t.skip('pdfinfo no está instalado');
  }

  assert.match(output, /Pages:\s+1/);
  assert.match(output, /Page size:\s+842 x 595 pts/);
  assert.doesNotMatch(output, /Error|error/);
});
