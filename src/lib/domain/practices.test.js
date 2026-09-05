import { test } from 'node:test';
import assert from 'node:assert/strict';

import { linkPractices, theoryIdOf } from './practices.js';

/**
 * Una materia mínima, como la que produce el merge
 * @param {String} id - Código
 * @param {String} title - Título
 * @param {Object} extra - Campos del plan ya unidos
 * @return {Object} Materia
 */
function subject(id, title, extra = {}) {
  return { id, title, credits: 4, sections: [], ...extra };
}

test('theoryIdOf cambia la P del código por el cero de la teoría', () => {
  assert.equal(theoryIdOf('INFOP2028'), 'INFO02028');
  assert.equal(theoryIdOf('FINGP2115'), 'FING02115');
});

test('theoryIdOf ignora los códigos que no son de práctica', () => {
  assert.equal(theoryIdOf('INFO02028'), null);
  assert.equal(theoryIdOf('UCAB00001'), null);
});

test('la práctica queda atada a su teoría y hereda su semestre', () => {
  const subjects = [
    subject('INFO02028', 'Computación en la Nube', { semester: 7, area: 'informatica', hue: 200 }),
    subject('INFOP2028', 'Computación en la Nube (Práctica)')
  ];

  const report = linkPractices(subjects);

  assert.equal(report.linked, 1);
  assert.equal(subjects[1].practiceOf, 'INFO02028');
  assert.equal(subjects[1].semester, 7, 'así aparece bajo el mismo semestre que su teoría');
  assert.equal(subjects[1].area, 'informatica');
  assert.equal(subjects[1].hue, 200);
});

test('una práctica sin teoría en la oferta se queda suelta', () => {
  const subjects = [subject('INFOP2023', 'Ciberseguridad (Práctica)')];

  const report = linkPractices(subjects);

  assert.equal(report.orphans.length, 1);
  assert.equal(subjects[0].practiceOf, undefined);
});

test('la práctica no se inventa un semestre si su teoría tampoco lo tiene', () => {
  const subjects = [
    subject('FING02112', 'Química'),
    subject('FINGP2112', 'Química (Práctica)')
  ];

  linkPractices(subjects);

  assert.equal(subjects[1].practiceOf, 'FING02112');
  assert.equal(subjects[1].semester, undefined);
});

test('el enlace no toca la teoría', () => {
  const teoria = subject('INFO02028', 'Computación en la Nube', { semester: 7 });
  const subjects = [teoria, subject('INFOP2028', 'Computación en la Nube (Práctica)')];

  linkPractices(subjects);

  assert.equal(teoria.practiceOf, undefined);
  assert.equal(teoria.semester, 7);
});

test('una materia con P en el código que no es práctica no se ata', () => {
  const subjects = [
    subject('INFO02028', 'Computación en la Nube', { semester: 7 }),
    subject('INFOP2028', 'Computación en la Nube Avanzada')
  ];

  const report = linkPractices(subjects);

  assert.equal(report.linked, 0);
  assert.equal(subjects[1].practiceOf, undefined);
});
