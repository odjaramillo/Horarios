import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

const courses = await read('../../../public/courses.json');
const malla = await read('../../../data/malla-informatica.json');

const titleKey = text =>
  (text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

const byTitle = new Map(courses.subjects.map(subject => [titleKey(subject.title), subject]));

/**
 * Diferencia conocida entre el plan impreso y lo que Banner ofrece este período.
 * No es un error de transcripción: son dos fuentes que discrepan de verdad.
 * Si aparece otra, el test debe fallar para que alguien la mire.
 */
const KNOWN_GAPS = [{ name: 'Álgebra Lineal', plan: 5, banner: 6 }];

test('cada materia del plan que se dicta quedó ubicada en su semestre', () => {
  const placed = courses.subjects.filter(subject => subject.semester !== undefined);
  const inPlan = malla.subjects.filter(entry => byTitle.has(titleKey(entry.name)));

  assert.equal(placed.length, inPlan.length);
  assert.ok(placed.every(subject => subject.semester >= 1 && subject.semester <= malla.semesters));
});

test('cada materia ubicada tiene un área conocida y su tono', () => {
  for (const subject of courses.subjects.filter(entry => entry.semester !== undefined)) {
    assert.ok(malla.areas[subject.area], `área desconocida en ${subject.id}: ${subject.area}`);
    assert.equal(subject.hue, malla.areas[subject.area].hue);
  }
});

test('el plan publicado tiene las 54 materias, marcadas según se dicten o no', () => {
  assert.equal(courses.plan.subjects.length, malla.subjects.length);

  const missing = malla.subjects.filter(entry => !byTitle.has(titleKey(entry.name)));
  const notOffered = courses.plan.subjects.filter(entry => !entry.offered);

  assert.equal(notOffered.length, missing.length);
  assert.ok(
    notOffered.every(entry => entry.id.startsWith('plan:')),
    'las que no se dictan usan un identificador propio, no uno de Banner'
  );
});

test('cada materia del plan aporta créditos, se dicte o no', () => {
  for (const subject of courses.plan.subjects) {
    assert.equal(typeof subject.credits, 'number', `${subject.name} sin créditos`);
  }

  const total = courses.plan.subjects.reduce((sum, entry) => sum + entry.credits, 0);

  // 242 y no 241 por la discrepancia conocida de Álgebra Lineal
  const allowed = KNOWN_GAPS.reduce((sum, gap) => sum + (gap.banner - gap.plan), 0);

  assert.equal(total, malla.totalCredits + allowed);
});

test('los créditos por semestre cuadran con los declarados en la malla', () => {
  const gaps = [];

  for (const [semester, expected] of Object.entries(malla.semesterCredits)) {
    const actual = courses.plan.subjects
      .filter(entry => entry.semester === Number(semester))
      .reduce((sum, entry) => sum + entry.credits, 0);

    if (actual !== expected) gaps.push({ semester: Number(semester), actual, expected });
  }

  // Solo el semestre 2 puede diferir, y solo por la discrepancia conocida
  const allowed = KNOWN_GAPS.reduce((sum, gap) => sum + (gap.banner - gap.plan), 0);

  assert.deepEqual(
    gaps,
    [{ semester: 2, actual: 31 + allowed, expected: 31 }],
    `descuadre inesperado: ${JSON.stringify(gaps)}`
  );
});

test('la discrepancia conocida sigue siendo la que creemos', () => {
  for (const gap of KNOWN_GAPS) {
    const subject = byTitle.get(titleKey(gap.name));

    assert.ok(subject, `${gap.name} debería existir en los datos`);
    assert.equal(
      subject.credits,
      gap.banner,
      `${gap.name} cambió de créditos en Banner; revisa si la discrepancia con la malla se resolvió`
    );
  }
});

test('cada materia del plan aporta créditos de una sola fuente', () => {
  for (const entry of malla.subjects) {
    const offered = byTitle.has(titleKey(entry.name));

    assert.equal(
      entry.planCredits !== undefined,
      !offered,
      `${entry.name}: planCredits solo debe existir para las materias que no se dictan`
    );
  }
});
