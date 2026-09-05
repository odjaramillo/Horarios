import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  describeMeetings,
  findBlockingPairs,
  formatTime,
  generateSchedules,
  scheduleBounds,
  sectionsClash,
  totalCredits,
  parseTime,
  usableSections,
  weeklyHours,
  MAX_SCHEDULES
} from './schedule.js';

const section = (crn, meetings, extra = {}) => ({
  crn,
  seq: '001',
  open: true,
  campus: 'UCAB Montalbán',
  type: 'Teórico-Práctica',
  seats: { max: 30, taken: 0, free: 30 },
  professors: [],
  meetings,
  ...extra
});

const subject = (id, sections, credits = 4) => ({
  id,
  subject: id.slice(0, 4),
  number: id.slice(4),
  title: id,
  credits,
  sections
});

const monday9to11 = [{ day: 0, start: 540, end: 650, room: null }];
const monday10to12 = [{ day: 0, start: 600, end: 720, room: null }];
const tuesday9to11 = [{ day: 1, start: 540, end: 650, room: null }];

test('formatTime rellena los minutos con cero', () => {
  assert.equal(formatTime(540), '9:00');
  assert.equal(formatTime(605), '10:05');
  assert.equal(formatTime(0), '0:00');
});

test('sectionsClash detecta solapamiento el mismo día', () => {
  assert.equal(sectionsClash(section('a', monday9to11), section('b', monday10to12)), true);
});

test('sectionsClash ignora bloques en días distintos', () => {
  assert.equal(sectionsClash(section('a', monday9to11), section('b', tuesday9to11)), false);
});

test('sectionsClash trata el final y el inicio contiguos como compatibles', () => {
  const before = section('a', [{ day: 0, start: 540, end: 650, room: null }]);
  const after = section('b', [{ day: 0, start: 650, end: 760, room: null }]);

  assert.equal(sectionsClash(before, after), false);
});

test('usableSections descarta secciones sin horario', () => {
  const target = subject('FING00001', [section('a', []), section('b', monday9to11)]);

  assert.deepEqual(
    usableSections(target).map(entry => entry.crn),
    ['b']
  );
});

test('usableSections filtra por disponibilidad en sus tres estados', () => {
  const target = subject('FING00001', [
    section('a', monday9to11, { open: false }),
    section('b', tuesday9to11)
  ]);

  assert.deepEqual(usableSections(target, { availability: 'open' }).map(entry => entry.crn), ['b']);
  assert.deepEqual(usableSections(target, { availability: 'closed' }).map(entry => entry.crn), ['a']);
  assert.equal(usableSections(target, { availability: 'all' }).length, 2);
});

test('una sección sin dato de cupos no se esconde como si estuviera cerrada', () => {
  const target = subject('FING00001', [
    section('a', monday9to11, { open: false }),
    section('b', tuesday9to11, { open: null })
  ]);

  assert.deepEqual(usableSections(target, { availability: 'open' }).map(entry => entry.crn), ['b']);
  assert.deepEqual(usableSections(target, { availability: 'closed' }).map(entry => entry.crn), ['a']);
  assert.equal(usableSections(target, { availability: 'all' }).length, 2);
});

test('usableSections descarta la sección que cae en un día vetado', () => {
  const target = subject('FING00001', [section('a', monday9to11), section('b', tuesday9to11)]);

  assert.deepEqual(usableSections(target, { avoidDays: [0] }).map(entry => entry.crn), ['b']);
});

test('un día vetado descarta la sección completa, no solo ese bloque', () => {
  // Una sección que se dicta lunes Y martes no sirve si el lunes está vetado
  const target = subject('FING00001', [
    section('a', [...monday9to11, ...tuesday9to11]),
    section('b', tuesday9to11)
  ]);

  assert.deepEqual(usableSections(target, { avoidDays: [0] }).map(entry => entry.crn), ['b']);
});

test('usableSections respeta la hora más temprana aceptada', () => {
  const target = subject('FING00001', [
    section('temprana', [{ day: 0, start: 420, end: 530, room: null }]),
    section('tarde', monday10to12)
  ]);

  assert.deepEqual(
    usableSections(target, { earliest: parseTime('09:00') }).map(entry => entry.crn),
    ['tarde']
  );
});

test('usableSections respeta la hora más tardía aceptada', () => {
  const target = subject('FING00001', [
    section('manana', monday9to11),
    section('noche', [{ day: 0, start: 1080, end: 1190, room: null }])
  ]);

  assert.deepEqual(
    usableSections(target, { latest: parseTime('18:00') }).map(entry => entry.crn),
    ['manana']
  );
});

test('una restricción horaria deja viva a la materia si otra sección sirve', () => {
  const result = generateSchedules(
    [
      subject('FING00001', [
        section('temprana', [{ day: 0, start: 420, end: 530, room: null }]),
        section('tarde', [{ day: 0, start: 600, end: 710, room: null }])
      ])
    ],
    { earliest: parseTime('09:00') }
  );

  assert.equal(result.schedules.length, 1);
  assert.equal(result.schedules[0][0].section.crn, 'tarde');
  assert.deepEqual(result.unschedulable, []);
});

test('parseTime traduce el valor de un input de hora', () => {
  assert.equal(parseTime('09:30'), 570);
  assert.equal(parseTime('7:05'), 425);
  assert.equal(parseTime(''), null);
  assert.equal(parseTime(undefined), null);
});

test('usableSections respeta las secciones fijadas por el usuario', () => {
  const target = subject('FING00001', [section('a', monday9to11), section('b', tuesday9to11)]);

  const result = usableSections(target, { allowedCrns: new Set(['b']) });

  assert.deepEqual(result.map(entry => entry.crn), ['b']);
});

test('generateSchedules combina materias compatibles', () => {
  const result = generateSchedules([
    subject('FING00001', [section('a', monday9to11)]),
    subject('FING00002', [section('b', tuesday9to11)])
  ]);

  assert.equal(result.schedules.length, 1);
  assert.equal(result.schedules[0].length, 2);
  assert.deepEqual(result.blocking, []);
});

test('generateSchedules descarta las combinaciones que chocan', () => {
  const result = generateSchedules([
    subject('FING00001', [section('a', monday9to11), section('a2', tuesday9to11)]),
    subject('FING00002', [section('b', monday10to12)])
  ]);

  assert.equal(result.schedules.length, 1);
  assert.equal(result.schedules[0].find(entry => entry.subject.id === 'FING00001').section.crn, 'a2');
});

test('generateSchedules explica qué par de materias bloquea el horario', () => {
  const result = generateSchedules([
    subject('FING00001', [section('a', monday9to11)]),
    subject('FING00002', [section('b', monday10to12)])
  ]);

  assert.equal(result.schedules.length, 0);
  assert.equal(result.blocking.length, 1);
  assert.deepEqual(
    [result.blocking[0].a.id, result.blocking[0].b.id].sort(),
    ['FING00001', 'FING00002']
  );
});

test('una obligatoria sin secciones utilizables se reporta, y el horario sigue armándose sin ella', () => {
  // El contrato es deliberado: es más útil ver el horario posible con el resto
  // que no ver nada. Pero quien lo consuma DEBE mostrar unschedulable, porque
  // si no, la materia desaparece en silencio.
  const result = generateSchedules([
    subject('FING00001', [section('a', monday9to11)]),
    subject('FING00099', [section('z', monday9to11, { open: false })])
  ]);

  assert.deepEqual(result.unschedulable.map(entry => entry.id), ['FING00099']);
  assert.equal(result.schedules.length, 1);
  assert.deepEqual(result.schedules[0].map(entry => entry.subject.id), ['FING00001']);
});

test('una restricción horaria que deja fuera a una obligatoria también la reporta', () => {
  const result = generateSchedules(
    [
      subject('FING00001', [section('a', monday10to12)]),
      subject('FING00007', [section('temprana', [{ day: 2, start: 420, end: 530, room: null }])])
    ],
    { earliest: parseTime('09:00') }
  );

  assert.deepEqual(result.unschedulable.map(entry => entry.id), ['FING00007']);
  assert.equal(result.schedules.length, 1, 'el resto del horario sigue siendo útil');
});

test('generateSchedules corta en el tope y lo avisa', () => {
  // 8 materias en días distintos, 3 secciones cada una: 6561 combinaciones posibles
  const many = Array.from({ length: 8 }, (_, index) =>
    subject(
      `FING0000${index}`,
      Array.from({ length: 3 }, (_, option) =>
        section(`s${index}-${option}`, [
          { day: index % 6, start: 480 + option * 130, end: 590 + option * 130, room: null }
        ])
      )
    )
  );

  const result = generateSchedules(many, { limit: 50 });

  assert.equal(result.schedules.length, 50);
  assert.equal(result.truncated, true);
});

test('findBlockingPairs no marca materias que sí tienen una alternativa', () => {
  const pairs = findBlockingPairs([
    { subject: subject('FING00001'), options: [section('a', monday9to11), section('a2', tuesday9to11)] },
    { subject: subject('FING00002'), options: [section('b', monday10to12)] }
  ]);

  assert.deepEqual(pairs, []);
});

test('scheduleBounds cubre el bloque más temprano y el más tardío', () => {
  const schedule = [
    { subject: subject('FING00001'), section: section('a', [{ day: 0, start: 420, end: 530, room: null }]) },
    { subject: subject('FING00002'), section: section('b', [{ day: 2, start: 1080, end: 1190, room: null }]) }
  ];

  assert.deepEqual(scheduleBounds(schedule), { from: 7, to: 20 });
});

test('totalCredits y weeklyHours suman sobre la combinación', () => {
  const schedule = [
    { subject: subject('FING00001', [], 5), section: section('a', monday9to11) },
    { subject: subject('FING00002', [], 4), section: section('b', tuesday9to11) }
  ];

  assert.equal(totalCredits(schedule), 9);
  assert.equal(weeklyHours(schedule), 4);
});

test('describeMeetings agrupa los días que comparten horario', () => {
  const twice = section('a', [
    { day: 0, start: 540, end: 650, room: null },
    { day: 2, start: 540, end: 650, room: null }
  ]);

  assert.equal(describeMeetings(twice), 'Lun, Mié 9:00–10:50');
});

test('describeMeetings avisa cuando la sección no tiene horario', () => {
  assert.equal(describeMeetings(section('a', [])), 'Sin horario asignado');
});

test('el dataset real produce horarios válidos y sin choques', async () => {
  const raw = JSON.parse(await readFile(new URL('../../../public/courses.json', import.meta.url), 'utf8'));
  const bySubject = new Map(raw.subjects.map(entry => [entry.id, entry]));

  const chosen = ['FING02002', 'FING02003', 'FING02004'].map(id => bySubject.get(id));
  assert.ok(chosen.every(Boolean), 'las materias de prueba deben existir en los datos');

  const result = generateSchedules(chosen);

  assert.ok(result.schedules.length > 0, 'debería existir al menos una combinación');
  assert.ok(result.schedules.length <= MAX_SCHEDULES);

  for (const schedule of result.schedules) {
    assert.equal(schedule.length, 3);

    for (let i = 0; i < schedule.length; i += 1) {
      for (let j = i + 1; j < schedule.length; j += 1) {
        assert.equal(
          sectionsClash(schedule[i].section, schedule[j].section),
          false,
          'ninguna combinación devuelta puede tener choques'
        );
      }
    }
  }
});

test('una materia opcional entra cuando cabe', () => {
  const result = generateSchedules(
    [subject('FING00001', [section('a', monday9to11)]), subject('FING00002', [section('b', tuesday9to11)])],
    { optionalIds: ['FING00002'] }
  );

  assert.equal(result.schedules[0].length, 2);
});

test('una materia opcional que choca se deja afuera en vez de anular el horario', () => {
  const result = generateSchedules(
    [subject('FING00001', [section('a', monday9to11)]), subject('FING00002', [section('b', monday10to12)])],
    { optionalIds: ['FING00002'] }
  );

  assert.ok(result.schedules.length > 0, 'la obligatoria debe seguir dando horario');
  assert.deepEqual(
    result.schedules[0].map(entry => entry.subject.id),
    ['FING00001']
  );
  assert.deepEqual(result.blocking, []);
});

test('la misma materia como obligatoria sí anula el horario', () => {
  const result = generateSchedules([
    subject('FING00001', [section('a', monday9to11)]),
    subject('FING00002', [section('b', monday10to12)])
  ]);

  assert.equal(result.schedules.length, 0);
  assert.equal(result.blocking.length, 1);
});

test('los horarios más completos van primero', () => {
  // Las dos opcionales caben por separado, pero chocan entre sí:
  // deben existir horarios de 2 materias y uno de 1, en ese orden.
  const tuesday10to12 = [{ day: 1, start: 600, end: 720, room: null }];

  const result = generateSchedules(
    [
      subject('FING00001', [section('a', monday9to11)]),
      subject('FING00002', [section('b', tuesday9to11)]),
      subject('FING00003', [section('c', tuesday10to12)])
    ],
    { optionalIds: ['FING00002', 'FING00003'] }
  );

  const sizes = result.schedules.map(entry => entry.length);

  assert.deepEqual(sizes, [...sizes].sort((a, b) => b - a), 'deben venir de más a menos completo');
  assert.equal(sizes[0], 2);
  assert.equal(sizes.at(-1), 1, 'también existe el horario con solo la obligatoria');
});

test('una opcional sin secciones utilizables se reporta aparte, no como error', () => {
  const result = generateSchedules(
    [
      subject('FING00001', [section('a', monday9to11)]),
      subject('FING00099', [section('z', monday9to11, { open: false })])
    ],
    { optionalIds: ['FING00099'] }
  );

  assert.deepEqual(result.unschedulable, []);
  assert.deepEqual(result.droppedOptional.map(entry => entry.id), ['FING00099']);
  assert.equal(result.schedules.length, 1);
});

test('un horario formado solo por opcionales que no caben no se devuelve vacío', () => {
  const result = generateSchedules([subject('FING00002', [section('b', monday9to11)])], {
    optionalIds: ['FING00002'],
    avoidDays: [0]
  });

  assert.deepEqual(result.schedules, []);
  assert.deepEqual(result.droppedOptional.map(entry => entry.id), ['FING00002']);
});
