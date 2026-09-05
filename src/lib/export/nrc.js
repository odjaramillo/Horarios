/**
 * Texto plano con los NRC del horario, para pegar en el módulo de inscripción.
 */
import { describeMeetings, totalCredits } from '../domain/schedule.js';

/**
 * Solo los códigos, separados por espacios
 * @param {Array} schedule - Combinación de {subject, section}
 * @return {String} Códigos NRC
 */
export function nrcCodes(schedule) {
  return schedule.map(entry => entry.section.crn).join(' ');
}

/**
 * Lista legible con código, materia y horario
 * @param {Array} schedule - Combinación de {subject, section}
 * @param {Object} term - Período con {label}
 * @return {String} Texto listo para pegar o mandar por chat
 */
export function nrcDetail(schedule, term) {
  const lines = schedule.map(({ subject, section }) =>
    [
      section.crn.padEnd(7),
      subject.id.padEnd(11),
      `SEC ${section.seq}`.padEnd(9),
      subject.title
    ].join('')
  );

  const schedules = schedule.map(
    ({ subject, section }) => `${subject.id}  ${describeMeetings(section)}`
  );

  return [
    `Horario ${term?.label ?? ''}`.trim(),
    `${totalCredits(schedule)} UC · ${schedule.length} materias`,
    '',
    'NRC    MATERIA    SECCIÓN  ASIGNATURA',
    ...lines,
    '',
    ...schedules,
    '',
    `Para inscribir: ${nrcCodes(schedule)}`
  ].join('\n');
}
