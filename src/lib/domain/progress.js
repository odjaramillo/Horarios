/**
 * Avance en el plan de estudios: qué aprobaste y qué habilita eso.
 *
 * Todo acá distingue lo que el estudiante marcó de lo que la aplicación dedujo.
 * Esa diferencia importa: una deducción sale de una flecha transcrita de una
 * imagen, y el estudiante tiene que poder verla y desmentirla.
 */

/**
 * Amplía lo marcado con lo que se deduce de los prerrequisitos.
 *
 * Si aprobaste Cálculo Integral, aprobaste Cálculo Diferencial: la universidad
 * no te habría dejado inscribirla si no. No es una suposición sobre tu avance,
 * es una consecuencia de las reglas.
 *
 * @param {Array<String>} declared - Identificadores marcados a mano
 * @param {Array} planSubjects - Materias del plan
 * @return {{approved: Set<String>, inferred: Set<String>}} Aprobadas y cuáles salieron por deducción
 */
export function expandApproved(declared, planSubjects) {
  const requirements = new Map(planSubjects.map(subject => [subject.id, subject.requires ?? []]));

  const approved = new Set(declared);
  const inferred = new Set();
  const pending = [...declared];

  while (pending.length > 0) {
    const id = pending.pop();

    for (const required of requirements.get(id) ?? []) {
      if (approved.has(required)) continue;

      approved.add(required);
      inferred.add(required);
      pending.push(required);
    }
  }

  return { approved, inferred };
}

/**
 * Créditos acumulados por lo aprobado
 * @param {Set<String>|Array<String>} approved - Identificadores aprobados
 * @param {Array} planSubjects - Materias del plan
 * @return {Number} Suma de unidades de crédito
 */
export function approvedCredits(approved, planSubjects) {
  const ids = approved instanceof Set ? approved : new Set(approved);

  return planSubjects
    .filter(subject => ids.has(subject.id))
    .reduce((sum, subject) => sum + (subject.credits ?? 0), 0);
}

/**
 * Materias de los semestres hasta el indicado, incluido
 * @param {Number} semester - Último semestre a incluir
 * @param {Array} planSubjects - Materias del plan
 * @return {Array<String>} Identificadores
 */
export function subjectsUpTo(semester, planSubjects) {
  return planSubjects.filter(subject => subject.semester <= semester).map(subject => subject.id);
}

/**
 * Comprueba si una materia se puede inscribir con el avance actual
 * @param {Object} subject - Materia del plan
 * @param {Set<String>} approved - Identificadores aprobados
 * @param {Number} credits - Créditos acumulados
 * @return {{ok: Boolean, missing: Array<String>, creditsShort: Number}} Motivos del bloqueo
 */
export function eligibility(subject, approved, credits) {
  if (approved.has(subject.id)) {
    return { ok: false, missing: [], creditsShort: 0, alreadyApproved: true };
  }

  const missing = (subject.requires ?? []).filter(id => !approved.has(id));
  const creditsShort = subject.creditGate ? Math.max(0, subject.creditGate - credits) : 0;

  return { ok: missing.length === 0 && creditsShort === 0, missing, creditsShort };
}

/**
 * Materias que se pueden inscribir ahora mismo
 * @param {Set<String>} approved - Identificadores aprobados
 * @param {Array} planSubjects - Materias del plan
 * @return {Array} Materias habilitadas, solo las que se dictan
 */
export function availableNow(approved, planSubjects) {
  const credits = approvedCredits(approved, planSubjects);

  return planSubjects.filter(
    subject => subject.offered && eligibility(subject, approved, credits).ok
  );
}
