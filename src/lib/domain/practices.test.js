import { test } from 'node:test';
import assert from 'node:assert/strict';

import { linkPractices, parsePairings, theoryIdsOf } from './practices.js';

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

test('theoryIdsOf cambia la P del código por el dígito de la teoría', () => {
  // La propia página prueba las dos formas: INFO-P2028 -> INFO-02028 o INFO-12028
  assert.deepEqual(theoryIdsOf('INFOP2028'), ['INFO02028', 'INFO12028']);
  assert.deepEqual(theoryIdsOf('FINGP2115'), ['FING02115', 'FING12115']);
});

test('theoryIdsOf ignora los códigos que no son de práctica', () => {
  assert.deepEqual(theoryIdsOf('INFO02028'), []);
  assert.deepEqual(theoryIdsOf('UCAB00001'), []);
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

const TABLA = `
<h2 id="tablepress-cloud-name" class="tablepress-table-name">Computación en la Nube</h2>
<table id="tablepress-cloud" class="tablepress tbody-has-connected-cells">
<thead><tr class="row-1">
<th class="column-1">Teoría (INFO-02028)</th><th class="column-2">Práctica (INFO-P2028)</th>
</tr></thead>
<tbody class="row-striping row-hover">
<tr class="row-2"><td rowspan="2" class="column-1">15660</td><td class="column-2">15683</td></tr>
<tr class="row-3"><td class="column-2">15684</td></tr>
<tr class="row-4"><td rowspan="2" class="column-1">16973</td><td class="column-2">16974</td></tr>
<tr class="row-5"><td class="column-2">16976</td></tr>
</tbody></table>`;

test('parsePairings lee la tabla y arrastra el NRC de la teoría por el rowspan', () => {
  const [tabla] = parsePairings(TABLA);

  assert.equal(tabla.theory, 'INFO02028');
  assert.equal(tabla.practice, 'INFOP2028');
  assert.deepEqual(tabla.pairs, [
    ['15660', '15683'],
    ['15660', '15684'],
    ['16973', '16974'],
    ['16973', '16976']
  ]);
});

test('parsePairings descarta las tablas que no son de teoría y práctica', () => {
  const otra = `
<h2 id="tablepress-temp-name" class="tablepress-table-name">Horarios tentativos</h2>
<table id="tablepress-temp" class="tablepress">
<thead><tr class="row-1"><th class="column-1">NRC</th><th class="column-2">CÓDIGO</th></tr></thead>
<tbody><tr class="row-2"><td class="column-1">16789</td><td class="column-2">FING-02001</td></tr></tbody>
</table>`;

  assert.deepEqual(parsePairings(otra), []);
  assert.equal(parsePairings(TABLA + otra).length, 1);
});

test('parsePairings no repite un par que la tabla lista dos veces', () => {
  const repetida = TABLA.replace(
    '<tr class="row-5"><td class="column-2">16976</td></tr>',
    '<tr class="row-5"><td class="column-2">16976</td></tr><tr class="row-6"><td class="column-2">16974</td></tr>'
  );

  assert.equal(parsePairings(repetida)[0].pairs.length, 4);
});

test('parsePairings devuelve vacío si no hay tablas', () => {
  assert.deepEqual(parsePairings('<p>nada</p>'), []);
  assert.deepEqual(parsePairings(''), []);
});

/**
 * Una materia con secciones identificadas solo por NRC
 * @param {String} id - Código
 * @param {String} title - Título
 * @param {Array<String>} crns - NRC de cada sección
 * @return {Object} Materia
 */
function withSections(id, title, crns) {
  return { id, title, credits: 4, sections: crns.map(crn => ({ crn, meetings: [] })) };
}

const PAIRING = [
  {
    theory: 'INFO02028',
    practice: 'INFOP2028',
    pairs: [
      ['15660', '15683'],
      ['15660', '15684'],
      ['16973', '16974'],
      ['16973', '16976']
    ]
  }
];

test('cada sección de práctica sabe con qué teorías puede ir', () => {
  const subjects = [
    withSections('INFO02028', 'Computación en la Nube', ['15660', '16973']),
    withSections('INFOP2028', 'Computación en la Nube (Práctica)', ['15683', '15684', '16974', '16976'])
  ];

  const report = linkPractices(subjects, PAIRING);

  const byCrn = new Map(subjects[1].sections.map(entry => [entry.crn, entry]));

  assert.deepEqual(byCrn.get('15683').theoryCrns, ['15660']);
  assert.deepEqual(byCrn.get('15684').theoryCrns, ['15660']);
  assert.deepEqual(byCrn.get('16974').theoryCrns, ['16973']);
  assert.deepEqual(byCrn.get('16976').theoryCrns, ['16973']);
  assert.equal(report.paired, 4);
});

test('una práctica que la tabla no nombra se queda sin restricción', () => {
  const subjects = [
    withSections('INFO02028', 'Computación en la Nube', ['15660']),
    withSections('INFOP2028', 'Computación en la Nube (Práctica)', ['15683', '99999'])
  ];

  linkPractices(subjects, PAIRING);

  const suelta = subjects[1].sections.find(entry => entry.crn === '99999');

  assert.equal(suelta.theoryCrns, undefined, 'sin dato no se inventa una restricción');
});

test('sin tablas de correspondencia todo sigue funcionando', () => {
  const subjects = [
    withSections('INFO02028', 'Computación en la Nube', ['15660']),
    withSections('INFOP2028', 'Computación en la Nube (Práctica)', ['15683'])
  ];

  const report = linkPractices(subjects);

  assert.equal(report.linked, 1);
  assert.equal(report.paired, 0);
  assert.equal(subjects[1].sections[0].theoryCrns, undefined);
});

test('la teoría también queda marcada, y la sección que la tabla ignora no', () => {
  const subjects = [
    withSections('INFO02028', 'Computación en la Nube', ['15660', '16973', '17153']),
    withSections('INFOP2028', 'Computación en la Nube (Práctica)', ['15683', '15684', '16974', '16976'])
  ];

  linkPractices(subjects, PAIRING);

  const teoria = new Map(subjects[0].sections.map(entry => [entry.crn, entry]));

  assert.deepEqual(teoria.get('15660').practiceCrns, ['15683', '15684']);
  assert.deepEqual(teoria.get('16973').practiceCrns, ['16974', '16976']);
  assert.equal(teoria.get('17153').practiceCrns, undefined, 'la 401 no está en la tabla');
});
