import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { generateSchedules, pairingAllows } from './schedule.js';

const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

const courses = await read('../../../public/courses.json');
const malla = await read('../../../data/malla-informatica.json');
const diagram = await read('../../../data/diagrama-informatica.json');

const plan = courses.plan.subjects;
const byId = new Map(plan.map(subject => [subject.id, subject]));

const titleKey = text =>
  (text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

/**
 * Diferencia conocida entre el plan oficial y lo que Banner ofrece este período.
 * No es un error de lectura: son dos fuentes que discrepan de verdad.
 * Si aparece otra, el test debe fallar para que alguien la mire.
 */
const KNOWN_GAPS = [{ name: 'Álgebra Lineal', plan: 5, banner: 6 }];

test('el plan publicado tiene todas las materias del PDF', () => {
  assert.equal(plan.length, malla.subjects.length);
  assert.equal(plan.length, 55);
});

test('los créditos por semestre cuadran con los que declara el PDF', () => {
  for (const [semester, expected] of Object.entries(malla.semesterCredits)) {
    const actual = plan
      .filter(subject => subject.semester === Number(semester))
      .reduce((sum, subject) => sum + subject.credits, 0);

    assert.equal(actual, expected, `semestre ${semester}`);
  }
});

test('el total de la carrera son 241 UC', () => {
  assert.equal(plan.reduce((sum, subject) => sum + subject.credits, 0), 241);
  assert.equal(courses.plan.totalCredits, 241);
});

test('cada materia tiene área conocida, tono y fila del diagrama', () => {
  for (const subject of plan) {
    assert.ok(courses.plan.areas[subject.area], `área desconocida en ${subject.name}`);
    assert.equal(subject.hue, courses.plan.areas[subject.area].hue);
    assert.equal(typeof subject.row, 'number', `${subject.name} sin fila`);
  }
});

test('el diagrama nombra exactamente las materias del plan', () => {
  const placed = new Set(Object.keys(diagram.subjects));

  assert.equal(placed.size, plan.length);
  for (const subject of plan) {
    assert.ok(placed.has(subject.name), `${subject.name} no está en el diagrama`);
  }
});

test('cada fila del diagrama tiene una sola materia por semestre', () => {
  const seen = new Set();

  for (const subject of plan) {
    const cell = `${subject.row}:${subject.semester}`;

    assert.equal(seen.has(cell), false, `dos materias en fila ${subject.row}, semestre ${subject.semester}`);
    seen.add(cell);
  }
});

test('todo requisito apunta a una materia del plan', () => {
  for (const subject of plan) {
    for (const id of [...(subject.requires ?? []), ...(subject.coreq ?? [])]) {
      assert.ok(byId.has(id), `${subject.name} referencia ${id}, que no existe`);
    }
  }
});

test('ningún prerrequisito está en un semestre posterior', () => {
  for (const subject of plan) {
    for (const id of subject.requires ?? []) {
      assert.ok(
        byId.get(id).semester <= subject.semester,
        `${subject.name} (sem ${subject.semester}) requiere ${byId.get(id).name} (sem ${byId.get(id).semester})`
      );
    }
  }
});

test('el PDF y Banner coinciden en el código de cada materia que se dicta', () => {
  const byTitle = new Map(courses.subjects.map(subject => [titleKey(subject.title), subject]));

  for (const subject of plan.filter(entry => entry.offered)) {
    assert.equal(byTitle.get(titleKey(subject.name))?.id, subject.id, subject.name);
  }
});

test('la única discrepancia de créditos con Banner es la conocida', () => {
  const byTitle = new Map(courses.subjects.map(subject => [titleKey(subject.title), subject]));

  const gaps = plan
    .filter(entry => entry.offered)
    .map(entry => ({ name: entry.name, plan: entry.credits, banner: byTitle.get(titleKey(entry.name)).credits }))
    .filter(entry => entry.plan !== entry.banner);

  assert.deepEqual(gaps, KNOWN_GAPS);
});

test('el caso que reportó el usuario: Organización del Computador exige Matemáticas Discretas', () => {
  const subject = plan.find(entry => entry.name === 'Organización del Computador');

  assert.deepEqual(subject.requires.map(id => byId.get(id).name), ['Matemáticas Discretas']);
});

test('las cadenas transcritas a mano sobreviven a la lectura del PDF', () => {
  const chain = [
    ['Cálculo Diferencial', 'Álgebra y Trigonometría'],
    ['Cálculo Integral', 'Cálculo Diferencial'],
    ['Programación Orientada a Objetos', 'Algoritmos y Estructuras de Datos']
  ];

  for (const [name, required] of chain) {
    const subject = plan.find(entry => entry.name === name);

    assert.ok(
      subject.requires.map(id => byId.get(id).name).includes(required),
      `${name} debería requerir ${required}`
    );
  }
});

test('el PDF aporta requisitos que la transcripción a mano no tenía', () => {
  const withRequirements = plan.filter(subject => subject.requires).length;

  assert.ok(withRequirements >= 33, `solo ${withRequirements} materias con prerrequisitos`);
  assert.ok(plan.some(subject => subject.coreq), 'el plan tiene correquisitos');
  assert.ok(plan.filter(subject => subject.requires?.length > 1).length >= 4, 'hay requisitos múltiples');
});

test('los identificadores del plan son únicos', () => {
  // El PDF codifica ambas electivas como "FING RANGO": si la desambiguación se
  // rompe, Svelte falla al renderizar la malla por claves repetidas.
  const ids = plan.map(subject => subject.id);

  assert.equal(new Set(ids).size, ids.length, `repetidos: ${ids.filter((id, i) => ids.indexOf(id) !== i)}`);
});

test('cada práctica apunta a una teoría que existe y comparte su semestre', () => {
  const byId = new Map(courses.subjects.map(subject => [subject.id, subject]));
  const practices = courses.subjects.filter(subject => subject.practiceOf);

  assert.ok(practices.length >= 10, `solo ${practices.length} prácticas atadas`);

  for (const practice of practices) {
    const theory = byId.get(practice.practiceOf);

    assert.ok(theory, `${practice.id} apunta a ${practice.practiceOf}, que no está en la oferta`);
    assert.equal(practice.semester, theory.semester, `${practice.id} y su teoría difieren de semestre`);
  }
});

test('ninguna práctica se cuela entre las materias del plan', () => {
  // Heredan el semestre para que los filtros las sitúen, pero la malla solo
  // nombra la teoría: si entran al plan, los créditos se contarían dos veces.
  const planIds = new Set(plan.map(subject => subject.id));

  for (const practice of courses.subjects.filter(subject => subject.practiceOf)) {
    assert.ok(!planIds.has(practice.id), `${practice.id} no debería estar en el plan`);
  }
});

test('ningún horario junta una teoría con la práctica de otra sección', () => {
  const byId = new Map(courses.subjects.map(subject => [subject.id, subject]));

  const paired = courses.subjects.filter(subject =>
    subject.practiceOf && subject.sections.some(section => section.theoryCrns)
  );

  assert.ok(paired.length >= 5, `solo ${paired.length} prácticas con correspondencia declarada`);

  let restringidas = 0;

  for (const practice of paired) {
    const theory = byId.get(practice.practiceOf);

    // Sin esto la prueba pasaría en vacío: `pairingAllows` deja pasar todo lo
    // que la tabla no nombra, así que hay que exigir que la teoría esté marcada.
    assert.ok(
      theory.sections.some(section => section.practiceCrns),
      `ninguna sección de ${theory.id} quedó marcada con sus prácticas`
    );

    const { schedules } = generateSchedules([theory, practice], { availability: 'all' });

    assert.ok(schedules.length > 0, `${practice.id} no produce ningún horario`);

    for (const combo of schedules) {
      const t = combo.find(entry => entry.subject.id === theory.id)?.section;
      const p = combo.find(entry => entry.subject.id === practice.id)?.section;

      if (!t || !p) continue;

      restringidas += 1;
      assert.ok(
        pairingAllows(t, p),
        `${theory.id} ${t.crn} quedó con la práctica ${p.crn}, que no le corresponde`
      );
    }
  }

  assert.ok(restringidas > 0, 'no se comprobó ninguna combinación real');
});

test('la correspondencia descarta combinaciones que sin ella existirían', () => {
  const byId = new Map(courses.subjects.map(subject => [subject.id, subject]));
  const practice = byId.get('INFOP2028');
  const theory = byId.get(practice.practiceOf);

  const { schedules } = generateSchedules([theory, practice], { availability: 'all' });

  const combinaciones = schedules.filter(combo => combo.length === 2).length;
  const sinRestriccion = theory.sections.length * practice.sections.length;

  assert.ok(
    combinaciones < sinRestriccion,
    `salieron ${combinaciones} de ${sinRestriccion}: la restricción no está mordiendo`
  );
});
