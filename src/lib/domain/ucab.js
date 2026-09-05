/**
 * Cruce entre las dos fuentes de una misma oferta académica.
 *
 * Banner sabe de cupos, aulas y si la sección está abierta, pero devuelve el
 * profesor vacío en las 333 secciones. La Escuela publica lo contrario: nombre
 * del profesor y modalidad, sin cupos. El NRC es la misma llave en ambas, así
 * que se puede unir sin ambigüedad.
 *
 * Regla de oro: Banner manda en lo que Banner sabe. Este cruce solo añade lo
 * que falta y nunca pisa un horario, un cupo ni un aula ya conocidos.
 */

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/** Un bloque es "HH:MM_HH:MM AULA", y un día puede traer varios seguidos */
const BLOCK = /(\d{2}):(\d{2})_(\d{2}):(\d{2})\s+(\S+)/g;

/** La Escuela escribe así lo que todavía no tiene asignado */
const UNASSIGNED = 'por asignar';

/** Las filas del catálogo de electivas vienen marcadas con este tipo */
const ELECTIVE = 'ELECT';

/** Códigos que llenan la ranura "Electiva (Informática)" del plan */
const OWN_SCHOOL = /^(INFO|FING)/;

/**
 * Convierte "P/A" y variantes en ausencia de dato
 * @param {String} room - Aula tal como la publica la Escuela
 * @return {String|null} Aula real, o null si no hay
 */
function toRoom(room) {
  return !room || room === 'P/A' ? null : room;
}

/**
 * Lee los bloques de clase de una fila de la Escuela
 * @param {Object} row - Fila del RPC, con una columna por día
 * @return {Array} Bloques {day, start, end, room}
 */
export function parseUcabMeetings(row) {
  const meetings = [];

  DAY_KEYS.forEach((key, day) => {
    for (const [, h1, m1, h2, m2, room] of String(row[key] ?? '').matchAll(BLOCK)) {
      meetings.push({
        day,
        start: Number(h1) * 60 + Number(m1),
        end: Number(h2) * 60 + Number(m2),
        room: toRoom(room)
      });
    }
  });

  return meetings;
}

/**
 * El profesor, o nada si todavía no lo asignan
 * @param {String} professor - Nombre tal como lo publica la Escuela
 * @return {Array<String>} Cero o un nombre
 */
function toProfessors(professor) {
  const name = (professor ?? '').trim();

  return !name || name.toLowerCase() === UNASSIGNED ? [] : [name];
}

/**
 * El código que usa la app: el de la Escuela sin el guion
 * @param {String} subjectId - Código como "INFO-P2028"
 * @return {String} Código como "INFOP2028"
 */
function toSubjectId(subjectId) {
  return String(subjectId ?? '').replace(/-/g, '');
}

/**
 * A cuál de las dos ranuras del plan va una electiva.
 *
 * El plan reserva "Electiva (Informática)" y "Electiva (Complementaria)" sin
 * decir qué asignatura llena cada una. La regla de la Escuela es el origen:
 * lo que ofrece Informática — con código INFO, o FING cuando lo publica la
 * facultad — cuenta como la propia; el resto de escuelas, como complementaria.
 *
 * @param {String} subjectId - Código de la materia, ya sin guion
 * @return {String} 'informatica' o 'complementaria'
 */
export function electiveKindOf(subjectId) {
  return OWN_SCHOOL.test(String(subjectId ?? '')) ? 'informatica' : 'complementaria';
}

/**
 * Sección nacida de la Escuela, para un NRC que Banner no trajo.
 *
 * `open` y `seats` quedan en null a propósito: no tenemos el dato, y decir
 * "abierta" sin saberlo mandaría a alguien a inscribir una sección llena.
 *
 * @param {Object} row - Fila del RPC
 * @return {Object} Sección normalizada
 */
function toSection(row) {
  return {
    crn: String(row.crn),
    seq: String(row.section).padStart(3, '0'),
    open: null,
    campus: 'UCAB Montalbán',
    type: null,
    seats: null,
    professors: toProfessors(row.professor),
    meetings: parseUcabMeetings(row),
    modality: row.modality ?? null
  };
}

/**
 * Materia nacida de la Escuela, para un código que Banner no trajo
 * @param {Object} row - Fila del RPC
 * @return {Object} Materia sin secciones
 */
function toSubject(row) {
  const id = toSubjectId(row.subject_id);
  const [, subject, number] = /^([A-Za-z]+)(.*)$/.exec(id) ?? [null, id, ''];

  return {
    id,
    subject,
    number,
    title: String(row.subject_name ?? '').replace(/\.$/, ''),
    credits: row.uc ?? 0,
    sections: []
  };
}

/**
 * Añade a las materias de Banner lo que solo publica la Escuela.
 *
 * Modifica `subjects` en el sitio y devuelve el recuento de lo que hizo, para
 * que quien lo llame pueda avisar en vez de aplicar cambios en silencio.
 *
 * @param {Object} params - Parámetros
 * @param {Array} params.subjects - Materias agrupadas desde Banner
 * @param {Array} params.rows - Filas de los RPC de la Escuela
 * @return {Object} Recuento {matched, withProfessor, added, newSubjects, electives, skipped}
 */
export function applyUcabRows({ subjects, rows }) {
  const byId = new Map(subjects.map(subject => [subject.id, subject]));
  const byCrn = new Map();

  for (const subject of subjects) {
    for (const section of subject.sections) byCrn.set(String(section.crn), section);
  }

  const report = { matched: 0, withProfessor: 0, added: 0, newSubjects: 0, electives: 0, skipped: 0 };
  const touched = new Set();

  /**
   * El catálogo de la Escuela decide qué es electiva y de qué clase. Por
   * título entraban electivas de otras carreras que un informático no puede
   * cursar, como "Electiva: Gerencia de la Construcción".
   * @param {Object} subject - Materia a marcar
   * @param {Object} row - Fila del RPC
   * @return {void}
   */
  const markElective = (subject, row) => {
    if (row.type !== ELECTIVE || subject.elective) return;

    subject.elective = true;
    subject.electiveKind = electiveKindOf(subject.id);
    report.electives++;
  };

  for (const row of rows) {
    if (row?.crn === null || row?.crn === undefined) {
      report.skipped++;
      continue;
    }

    const professors = toProfessors(row.professor);
    const existing = byCrn.get(String(row.crn));
    const id = toSubjectId(row.subject_id);

    if (existing) {
      report.matched++;
      if (professors.length > 0) {
        existing.professors = professors;
        report.withProfessor++;
      }
      if (row.modality) existing.modality = row.modality;
      if (byId.has(id)) markElective(byId.get(id), row);
      continue;
    }

    let subject = byId.get(id);

    if (!subject) {
      subject = toSubject(row);
      byId.set(id, subject);
      subjects.push(subject);
      report.newSubjects++;
    }

    markElective(subject, row);
    subject.sections.push(toSection(row));
    touched.add(subject);
    report.added++;
  }

  for (const subject of touched) subject.sections.sort((a, b) => a.seq.localeCompare(b.seq));

  return report;
}
