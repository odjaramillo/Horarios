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
 * Quita una materia de lo aprobado, y con ella todo lo que dependía.
 *
 * Es el reverso exacto de expandApproved. Si aprobar Cálculo Integral implica
 * haber aprobado Cálculo Diferencial, entonces decir que NO aprobaste
 * Diferencial implica que tampoco aprobaste Integral. Dejar Integral marcada
 * volvería a deducir Diferencial y el clic no tendría efecto visible.
 *
 * @param {Array<String>} declared - Identificadores marcados a mano
 * @param {String} id - Materia que se desmarca
 * @param {Array} planSubjects - Materias del plan
 * @return {Array<String>} Lo marcado que sobrevive
 */
export function withoutApproved(declared, id, planSubjects) {
  const dependents = new Map();

  for (const subject of planSubjects) {
    for (const required of subject.requires ?? []) {
      if (!dependents.has(required)) dependents.set(required, []);
      dependents.get(required).push(subject.id);
    }
  }

  const doomed = new Set([id]);
  const pending = [id];

  while (pending.length > 0) {
    for (const dependent of dependents.get(pending.pop()) ?? []) {
      if (doomed.has(dependent)) continue;

      doomed.add(dependent);
      pending.push(dependent);
    }
  }

  return declared.filter(current => !doomed.has(current));
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
 * Ranuras de electiva del plan que todavía no están cubiertas
 * @param {Array} planSubjects - Materias del plan
 * @param {Set<String>} approved - Identificadores aprobados
 * @return {Array} Ranuras libres
 */
export function openElectiveSlots(planSubjects, approved) {
  return planSubjects.filter(subject => subject.electiveSlot && !approved.has(subject.id));
}

/**
 * Comprueba si una electiva concreta se puede inscribir.
 *
 * El plan reserva ranuras ("Electiva (Informática)", "Electiva
 * (Complementaria)") sin decir qué asignatura las llena; Banner ofrece
 * electivas concretas que no figuran en el plan. Una concreta sirve para
 * cualquier ranura libre, así que se mide contra la menos exigente: decir que
 * no puedes inscribirla cuando sí puedes es peor que lo contrario.
 *
 * @param {Array} slots - Ranuras de electiva libres
 * @param {Number} credits - Créditos acumulados
 * @return {Object} Motivos del bloqueo, con la ranura elegida
 */
export function electiveEligibility(slots, credits) {
  if (slots.length === 0) {
    return { ok: false, missing: [], creditsShort: 0, slotsFilled: true };
  }

  const cheapest = slots.reduce((best, slot) =>
    (slot.creditGate ?? 0) < (best.creditGate ?? 0) ? slot : best
  );

  const creditsShort = Math.max(0, (cheapest.creditGate ?? 0) - credits);

  return { ok: creditsShort === 0, missing: [], creditsShort, slot: cheapest };
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
