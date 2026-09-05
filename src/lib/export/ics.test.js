import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildIcs } from './ics.js';

const term = { code: '202715', label: 'Sem Sep/Ene 26-27', start: '2026-09-14', end: '2027-01-23' };

const schedule = [
  {
    subject: { id: 'FING02002', title: 'Álgebra y Trigonometría', credits: 5 },
    section: {
      crn: '15414',
      seq: '001',
      campus: 'UCAB Montalbán',
      type: 'Teórico-Práctica',
      professors: ['Ana Pérez'],
      meetings: [
        { day: 0, start: 540, end: 650, room: null },
        { day: 4, start: 540, end: 650, room: null }
      ]
    }
  }
];

test('genera un evento por bloque de clase', () => {
  const ics = buildIcs(schedule, term);

  assert.equal(ics.match(/BEGIN:VEVENT/g).length, 2);
  assert.match(ics, /END:VCALENDAR$/);
});

test('el lunes cae en el primer lunes del período', () => {
  // 2026-09-14 es lunes, así que el bloque del lunes empieza ese mismo día
  assert.match(buildIcs(schedule, term), /DTSTART;TZID=America\/Caracas:20260914T090000/);
});

test('el viernes salta al primer viernes posterior al inicio', () => {
  assert.match(buildIcs(schedule, term), /DTSTART;TZID=America\/Caracas:20260918T090000/);
});

test('la repetición termina en la fecha real de fin de clases', () => {
  assert.match(buildIcs(schedule, term), /RRULE:FREQ=WEEKLY;UNTIL=20270123T235959Z/);
});

test('escapa las comas del texto libre', () => {
  const ics = buildIcs(
    [{ ...schedule[0], subject: { ...schedule[0].subject, title: 'Física I, teoría' } }],
    term
  );

  assert.match(ics, /SUMMARY:Física I\\, teoría/);
});

test('ninguna línea supera los 75 octetos', () => {
  const largo = [
    {
      subject: {
        id: 'INFO00223',
        title: 'Trabajo de Grado en Ingeniería Informática con un título deliberadamente larguísimo',
        credits: 8
      },
      section: { ...schedule[0].section, professors: ['Un Nombre Muy Largo De Profesor Titular'] }
    }
  ];

  for (const line of buildIcs(largo, term).split('\r\n')) {
    assert.ok(
      new TextEncoder().encode(line).length <= 75,
      `línea de ${new TextEncoder().encode(line).length} octetos: ${line}`
    );
  }
});

test('avisa cuando los datos no traen fechas de período', () => {
  assert.throws(() => buildIcs(schedule, { label: 'x' }), /fechas del período/);
});
