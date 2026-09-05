import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyUcabRows, parseUcabMeetings } from './ucab.js';

/**
 * Una fila del RPC de la Escuela, con lo mínimo que necesita el cruce
 * @param {Object} overrides - Campos a cambiar
 * @return {Object} Fila como la devuelve Supabase
 */
function row(overrides = {}) {
  return {
    type: 'OBLIG',
    crn: 15660,
    subject_id: 'INFO-02028',
    subject_name: 'Computación en la Nube',
    subject_semester: '05SE',
    taxonomy: 'TA-4',
    modality: 'P',
    uc: 4,
    section: 1,
    professor: 'Bravo Viloria, Jhoberth Andrés',
    monday: '17:00_18:50 P/A',
    tuesday: null,
    wednesday: null,
    thursday: null,
    friday: null,
    saturday: null,
    sunday: null,
    ...overrides
  };
}

/**
 * Una sección como la que produce Banner
 * @param {Object} overrides - Campos a cambiar
 * @return {Object} Sección normalizada
 */
function section(overrides = {}) {
  return {
    crn: '15660',
    seq: '001',
    open: true,
    campus: 'UCAB Montalbán',
    type: 'Teórico-Práctica',
    seats: { max: 30, taken: 10, free: 20 },
    professors: [],
    meetings: [{ day: 0, start: 1020, end: 1130, room: null }],
    ...overrides
  };
}

test('parseUcabMeetings lee un bloque simple', () => {
  const meetings = parseUcabMeetings(row({ monday: '09:00_10:50 P/A' }));

  assert.deepEqual(meetings, [{ day: 0, start: 540, end: 650, room: null }]);
});

test('parseUcabMeetings conserva el aula cuando no es "por asignar"', () => {
  const meetings = parseUcabMeetings(row({ monday: null, thursday: '07:00_08:50 EC-18' }));

  assert.deepEqual(meetings, [{ day: 3, start: 420, end: 530, room: 'EC-18' }]);
});

test('parseUcabMeetings separa dos bloques que caen el mismo día', () => {
  const meetings = parseUcabMeetings(row({ monday: '08:00_09:50 P/A 10:00_11:50 P/A' }));

  assert.deepEqual(meetings, [
    { day: 0, start: 480, end: 590, room: null },
    { day: 0, start: 600, end: 710, room: null }
  ]);
});

test('parseUcabMeetings ignora los días vacíos', () => {
  assert.deepEqual(parseUcabMeetings(row({ monday: null })), []);
});

test('el profesor entra en la sección que ya existe, cruzando por NRC', () => {
  const subjects = [{ id: 'INFO02028', title: 'Computación en la Nube', sections: [section()] }];
  const report = applyUcabRows({ subjects, rows: [row()] });

  assert.deepEqual(subjects[0].sections[0].professors, ['Bravo Viloria, Jhoberth Andrés']);
  assert.equal(subjects[0].sections[0].modality, 'P');
  assert.equal(report.withProfessor, 1);
  assert.equal(report.added, 0);
});

test('"Por Asignar" no es un profesor: la sección queda sin nombre', () => {
  const subjects = [{ id: 'INFO02028', title: 'Computación en la Nube', sections: [section()] }];
  const report = applyUcabRows({ subjects, rows: [row({ professor: 'Por Asignar' })] });

  assert.deepEqual(subjects[0].sections[0].professors, []);
  assert.equal(report.withProfessor, 0);
});

test('el cruce no toca el horario ni los cupos que ya trajo Banner', () => {
  const original = section();
  const subjects = [{ id: 'INFO02028', title: 'Computación en la Nube', sections: [original] }];

  applyUcabRows({ subjects, rows: [row({ monday: '23:00_23:50 P/A' })] });

  assert.deepEqual(original.meetings, [{ day: 0, start: 1020, end: 1130, room: null }]);
  assert.deepEqual(original.seats, { max: 30, taken: 10, free: 20 });
  assert.equal(original.open, true);
});

test('una sección que Banner no trajo se agrega, sin inventar cupos', () => {
  const subjects = [{ id: 'INFO02028', title: 'Computación en la Nube', sections: [section()] }];
  const report = applyUcabRows({
    subjects,
    rows: [row({ crn: 16973, section: 2, tuesday: '10:00_11:50 P/A', monday: null })]
  });

  assert.equal(report.added, 1);
  assert.equal(subjects[0].sections.length, 2);

  const nueva = subjects[0].sections.find(entry => entry.crn === '16973');
  assert.equal(nueva.seq, '002');
  assert.equal(nueva.open, null, 'sin dato de cupos no se afirma que esté abierta');
  assert.equal(nueva.seats, null);
  assert.deepEqual(nueva.meetings, [{ day: 1, start: 600, end: 710, room: null }]);
});

test('una materia que Banner no trajo entera se crea con sus créditos', () => {
  const subjects = [];
  const report = applyUcabRows({
    subjects,
    rows: [
      row({
        crn: 15001,
        subject_id: 'FACE-00024',
        subject_name: 'Contabilidad Financiera',
        uc: 5,
        section: 3
      })
    ]
  });

  assert.equal(report.newSubjects, 1);
  assert.equal(subjects.length, 1);
  assert.equal(subjects[0].id, 'FACE00024');
  assert.equal(subjects[0].subject, 'FACE');
  assert.equal(subjects[0].number, '00024');
  assert.equal(subjects[0].credits, 5);
  assert.equal(subjects[0].sections[0].crn, '15001');
});

test('las secciones agregadas quedan ordenadas junto a las de Banner', () => {
  const subjects = [
    { id: 'INFO02028', title: 'Computación en la Nube', sections: [section({ crn: '9', seq: '003' })] }
  ];

  applyUcabRows({ subjects, rows: [row({ crn: 16973, section: 1 })] });

  assert.deepEqual(
    subjects[0].sections.map(entry => entry.seq),
    ['001', '003']
  );
});

test('una fila sin NRC no rompe el cruce', () => {
  const subjects = [{ id: 'INFO02028', title: 'Computación en la Nube', sections: [section()] }];
  const report = applyUcabRows({ subjects, rows: [row({ crn: null }), row()] });

  assert.equal(report.skipped, 1);
  assert.equal(report.withProfessor, 1);
});
