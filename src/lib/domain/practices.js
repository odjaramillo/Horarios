/**
 * Ata cada práctica a la teoría de la que sale.
 *
 * Banner las publica como dos materias distintas, con NRC distinto, porque se
 * inscriben por separado: "Computación en la Nube" (INFO-02028) y "Computación
 * en la Nube (Práctica)" (INFO-P2028). El plan de estudios solo nombra la
 * teoría, así que la práctica se quedaba sin semestre y sin prelaciones, y
 * desaparecía en cuanto filtrabas por avance.
 *
 * No hay campo que las una: Banner devuelve `linkIdentifier` en null. Lo único
 * que las relaciona es el código, donde la práctica cambia el cero de la
 * teoría por una P.
 */

/** "INFOP2028" es la práctica de "INFO02028" */
const PRACTICE_CODE = /^([A-Z]+)P(\d.*)$/;

/** El título lo confirma: sin esto, cualquier código con P entraría */
const PRACTICE_TITLE = /\(\s*pr[áa]ctica\s*\)/i;

/** Lo que la práctica toma de su teoría para situarse en el plan */
const INHERITED = ['semester', 'area', 'hue'];

/**
 * El código de la teoría a la que pertenece una práctica
 * @param {String} id - Código de la materia
 * @return {String|null} Código de la teoría, o null si no es una práctica
 */
export function theoryIdOf(id) {
  const match = PRACTICE_CODE.exec(String(id ?? ''));

  return match ? `${match[1]}0${match[2]}` : null;
}

/**
 * Marca cada práctica con la teoría que la explica.
 *
 * Modifica `subjects` en el sitio. La práctica hereda semestre y área para que
 * los filtros la sitúen donde el estudiante la espera, pero no se copia nada
 * más: sus secciones, sus créditos y su NRC son suyos.
 *
 * @param {Array} subjects - Materias ya agrupadas
 * @return {Object} Recuento {linked, orphans} con los códigos sin teoría
 */
export function linkPractices(subjects) {
  const byId = new Map(subjects.map(subject => [subject.id, subject]));
  const report = { linked: 0, orphans: [] };

  for (const subject of subjects) {
    if (!PRACTICE_TITLE.test(subject.title ?? '')) continue;

    const theoryId = theoryIdOf(subject.id);
    const theory = theoryId ? byId.get(theoryId) : null;

    if (!theory) {
      report.orphans.push(subject.id);
      continue;
    }

    subject.practiceOf = theory.id;
    for (const key of INHERITED) {
      if (theory[key] !== undefined) subject[key] = theory[key];
    }

    report.linked++;
  }

  return report;
}
