import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  approvedCredits,
  availableNow,
  electiveEligibility,
  eligibility,
  expandApproved,
  openElectiveSlots,
  subjectsUpTo,
  withoutApproved
} from './progress.js';

const plan = [
  { id: 'A', name: 'Álgebra', semester: 1, credits: 5, offered: true },
  { id: 'B', name: 'Cálculo I', semester: 2, credits: 6, offered: true, requires: ['A'] },
  { id: 'C', name: 'Cálculo II', semester: 3, credits: 5, offered: true, requires: ['B'] },
  { id: 'D', name: 'Inglés', semester: 1, credits: 3, offered: true },
  { id: 'E', name: 'Pasantía', semester: 7, credits: 4, offered: true, creditGate: 15 },
  { id: 'F', name: 'Electiva', semester: 7, credits: 3, offered: false, creditGate: 12 }
];

test('marcar una materia deduce sus prerrequisitos hacia atrás', () => {
  const { approved, inferred } = expandApproved(['C'], plan);

  assert.deepEqual([...approved].sort(), ['A', 'B', 'C']);
  assert.deepEqual([...inferred].sort(), ['A', 'B']);
});

test('lo marcado a mano nunca aparece como deducido', () => {
  const { inferred } = expandApproved(['A', 'C'], plan);

  assert.equal(inferred.has('A'), false, 'A se marcó a mano, no se dedujo');
  assert.deepEqual([...inferred], ['B']);
});

test('la deducción no arrastra materias de otra cadena', () => {
  const { approved } = expandApproved(['C'], plan);

  assert.equal(approved.has('D'), false, 'aprobar Cálculo II no dice nada sobre Inglés');
});

test('marcar una materia sin prerrequisitos no deduce nada', () => {
  const { approved, inferred } = expandApproved(['D'], plan);

  assert.deepEqual([...approved], ['D']);
  assert.equal(inferred.size, 0);
});

test('un ciclo en los datos no cuelga la deducción', () => {
  const roto = [
    { id: 'X', semester: 1, credits: 1, requires: ['Y'] },
    { id: 'Y', semester: 2, credits: 1, requires: ['X'] }
  ];

  const { approved } = expandApproved(['X'], roto);

  assert.deepEqual([...approved].sort(), ['X', 'Y']);
});

test('los créditos suman solo lo aprobado', () => {
  const { approved } = expandApproved(['C', 'D'], plan);

  assert.equal(approvedCredits(approved, plan), 5 + 6 + 5 + 3);
});

test('subjectsUpTo devuelve todo lo de los semestres anteriores', () => {
  assert.deepEqual(subjectsUpTo(2, plan).sort(), ['A', 'B', 'D']);
  assert.deepEqual(subjectsUpTo(0, plan), []);
});

test('una materia con el prerrequisito pendiente queda bloqueada y dice cuál', () => {
  const { approved } = expandApproved(['A'], plan);
  const result = eligibility(plan[2], approved, approvedCredits(approved, plan));

  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ['B']);
});

test('una materia con la compuerta de créditos sin alcanzar dice cuánto falta', () => {
  const { approved } = expandApproved(['A'], plan);
  const result = eligibility(plan[4], approved, approvedCredits(approved, plan));

  assert.equal(result.ok, false);
  assert.equal(result.creditsShort, 10);
  assert.deepEqual(result.missing, []);
});

test('una materia ya aprobada no se ofrece como inscribible', () => {
  const { approved } = expandApproved(['A'], plan);

  assert.equal(eligibility(plan[0], approved, 5).alreadyApproved, true);
  assert.equal(eligibility(plan[0], approved, 5).ok, false);
});

test('availableNow deja fuera lo aprobado, lo bloqueado y lo que no se dicta', () => {
  const { approved } = expandApproved(['B'], plan);
  const ids = availableNow(approved, plan).map(subject => subject.id);

  assert.deepEqual(ids.sort(), ['C', 'D'], 'A está aprobada, E no alcanza créditos, F no se dicta');
});

test('el plan real no tiene prerrequisitos que apunten a un semestre posterior', async () => {
  // El mismo semestre es válido: el Trabajo de Grado exige el Curso de Trabajo
  // de Grado, y los dos están en el octavo.
  const courses = JSON.parse(
    await readFile(new URL('../../../public/courses.json', import.meta.url), 'utf8')
  );
  const semesterOf = new Map(courses.plan.subjects.map(entry => [entry.id, entry.semester]));

  for (const subject of courses.plan.subjects) {
    for (const required of subject.requires ?? []) {
      assert.ok(semesterOf.has(required), `${subject.name} requiere un id inexistente`);
      assert.ok(
        semesterOf.get(required) <= subject.semester,
        `${subject.name} (sem ${subject.semester}) requiere algo de sem ${semesterOf.get(required)}`
      );
    }
  }
});

test('sobre el plan real, marcar Cálculo Integral deduce toda su cadena', async () => {
  const courses = JSON.parse(
    await readFile(new URL('../../../public/courses.json', import.meta.url), 'utf8')
  );

  const { approved, inferred } = expandApproved(['FING02004'], courses.plan.subjects);

  assert.ok(inferred.has('FING02003'), 'debería deducir Cálculo Diferencial');
  assert.ok(inferred.has('FING02002'), 'y Álgebra y Trigonometría');
  assert.equal(approved.size, 3);
});

test('desmarcar una materia suelta también lo que dependía de ella', () => {
  // Con A, B y C marcadas a mano, quitar A debe llevarse B y C
  const result = withoutApproved(['A', 'B', 'C', 'D'], 'A', plan);

  assert.deepEqual(result, ['D']);
});

test('desmarcar no toca cadenas ajenas', () => {
  assert.deepEqual(withoutApproved(['C', 'D'], 'D', plan), ['C']);
});

test('desmarcar en medio de la cadena arrastra solo hacia adelante', () => {
  const result = withoutApproved(['A', 'B', 'C'], 'B', plan);

  assert.deepEqual(result, ['A'], 'A es anterior a B y sobrevive');
});

test('desmarcar y volver a expandir deja el estado consistente', () => {
  const declared = withoutApproved(['C', 'D'], 'B', plan);
  const { approved } = expandApproved(declared, plan);

  assert.equal(approved.has('C'), false, 'C dependía de B');
  assert.equal(approved.has('B'), false);
  assert.deepEqual([...approved], ['D']);
});

test('un ciclo en los datos no cuelga el desmarcado', () => {
  const roto = [
    { id: 'X', semester: 1, credits: 1, requires: ['Y'] },
    { id: 'Y', semester: 2, credits: 1, requires: ['X'] }
  ];

  assert.deepEqual(withoutApproved(['X', 'Y'], 'X', roto), []);
});

const electivePlan = [
  ...plan,
  { id: 'SLOT-A', name: 'Electiva (Informática)', semester: 7, credits: 3, offered: false, electiveSlot: true, creditGate: 172 },
  { id: 'SLOT-B', name: 'Electiva (Complementaria)', semester: 7, credits: 3, offered: false, electiveSlot: true, creditGate: 138 }
];

test('openElectiveSlots devuelve las ranuras que faltan por cubrir', () => {
  assert.deepEqual(openElectiveSlots(electivePlan, new Set()).map(s => s.id), ['SLOT-A', 'SLOT-B']);
  assert.deepEqual(openElectiveSlots(electivePlan, new Set(['SLOT-B'])).map(s => s.id), ['SLOT-A']);
  assert.deepEqual(openElectiveSlots(electivePlan, new Set(['SLOT-A', 'SLOT-B'])), []);
});

test('una electiva concreta se mide contra la ranura menos exigente', () => {
  const slots = openElectiveSlots(electivePlan, new Set());

  assert.equal(electiveEligibility(slots, 140).ok, true, '140 UC pasan la ranura de 138');
  assert.equal(electiveEligibility(slots, 100).ok, false);
  assert.equal(electiveEligibility(slots, 100).creditsShort, 38);
  assert.equal(electiveEligibility(slots, 100).slot.id, 'SLOT-B');
});

test('cubierta la ranura barata, la electiva se mide contra la que queda', () => {
  const slots = openElectiveSlots(electivePlan, new Set(['SLOT-B']));

  assert.equal(electiveEligibility(slots, 140).ok, false, 'ahora hay que llegar a 172');
  assert.equal(electiveEligibility(slots, 140).creditsShort, 32);
});

test('sin ranuras libres la electiva ya no aporta nada', () => {
  const result = electiveEligibility([], 240);

  assert.equal(result.ok, false);
  assert.equal(result.slotsFilled, true);
});

test('una electiva nunca se bloquea por prerrequisitos', () => {
  assert.deepEqual(electiveEligibility(openElectiveSlots(electivePlan, new Set()), 200).missing, []);
});
