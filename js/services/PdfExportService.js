import { loadPdfMake } from '../utils/PdfLoader.js';

/**
 * Servicio para exportar horarios a formato PDF con layout de grilla (estilo horario escolar)
 */
export default {
  /**
   * Descarga el horario como PDF
   * @param {Array} scheduleItems - Lista de materias del horario
   * @param {String} filename - Nombre del archivo PDF
   * @return {Promise<void>}
   */
  async downloadSchedule(scheduleItems, filename = 'horario.pdf') {
    if (!scheduleItems || scheduleItems.length === 0) {
      throw new Error('No hay materias en el horario para exportar');
    }

    await loadPdfMake();

    const docDefinition = this._buildDocDefinition(scheduleItems);
    window.pdfMake.createPdf(docDefinition).download(filename);
  },

  /**
   * Construye la definición del documento PDF con formato de grilla
   * @param {Array} scheduleItems - Lista de materias del horario
   * @return {Object} Definición del documento pdfMake
   */
  _buildDocDefinition(scheduleItems) {
    if (!scheduleItems || scheduleItems.length === 0) {
      return {
        pageSize: 'A4',
        content: [{ text: 'No hay materias para mostrar', alignment: 'center' }]
      };
    }

    const totalCredits = scheduleItems.reduce((sum, course) => {
      return sum + (parseFloat(course.creditHourLow) || 0);
    }, 0);

    const matrix = this._buildMatrix(scheduleItems);

    // Color palette for subjects
    const subjectColors = {};
    const colors = [
      '#DBEAFE', '#D1FAE5', '#EDE9FE', '#FEF3C7', '#FFE4E6',
      '#CFFAFE', '#FAE8FF', '#CCFBF1', '#FFEDD5', '#ECFCCB'
    ];
    const textColors = [
      '#1E40AF', '#065F46', '#5B21B6', '#92400E', '#9F1239',
      '#155E75', '#86198F', '#115E59', '#C2410C', '#3F6212'
    ];
    const uniqueSubjects = [...new Set(scheduleItems.map(c => c.subjectId))];
    uniqueSubjects.forEach((id, i) => {
      subjectColors[id] = { bg: colors[i % colors.length], text: textColors[i % textColors.length] };
    });

    return {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [15, 25, 15, 25],
      content: [
        { text: 'Horario UCAB', style: 'title' },
        { text: `${scheduleItems.length} materias | ${totalCredits} UC`, style: 'subtitle' },
        { text: '\n' },
        this._renderGridTable(matrix, subjectColors)
      ],
      styles: {
        title: {
          fontSize: 16,
          bold: true,
          alignment: 'center',
          margin: [0, 0, 0, 4]
        },
        subtitle: {
          fontSize: 10,
          alignment: 'center',
          margin: [0, 0, 0, 8],
          color: '#666666'
        }
      },
      defaultStyle: {
        fontSize: 7
      }
    };
  },

  /**
   * Construye la matriz horario-día con los cursos asignados
   * @param {Array} scheduleItems - Lista de materias
   * @return {Object} Matriz { timeSlots, dayOrder, grid }
   */
  _buildMatrix(scheduleItems) {
    const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayNames = {
      monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles',
      thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado'
    };

    // Find the actual hour range used
    let minHour = 22;
    let maxHour = 7;

    scheduleItems.forEach(course => {
      if (!course.section || !course.section.meetingsFaculty) return;
      course.section.meetingsFaculty.forEach(meeting => {
        if (!meeting.meetingTime) return;
        const mt = meeting.meetingTime;
        const begin = parseInt(mt.beginTime?.substring(0, 2), 10);
        const end = parseInt(mt.endTime?.substring(0, 2), 10);
        if (!isNaN(begin) && begin < minHour) minHour = begin;
        if (!isNaN(end) && end >= maxHour) maxHour = end + 1;
      });
    });

    // Generate time slots for the range
    const timeSlots = [];
    for (let h = minHour; h < maxHour; h++) {
      timeSlots.push(`${String(h).padStart(2, '0')}:00`);
    }

    // Build grid[timeSlot][day] = [courses]
    const grid = {};
    timeSlots.forEach(slot => {
      grid[slot] = {};
      dayOrder.forEach(day => {
        grid[slot][day] = [];
      });
    });

    // Fill grid
    scheduleItems.forEach(course => {
      if (!course.section || !course.section.meetingsFaculty) return;

      course.section.meetingsFaculty.forEach(meeting => {
        if (!meeting.meetingTime) return;
        const mt = meeting.meetingTime;

        dayOrder.forEach(day => {
          if (!mt[day]) return;

          const beginH = parseInt(mt.beginTime?.substring(0, 2), 10);
          const beginM = parseInt(mt.beginTime?.substring(2), 10);
          const endH = parseInt(mt.endTime?.substring(0, 2), 10);
          const endM = parseInt(mt.endTime?.substring(2), 10);
          const beginMin = beginH * 60 + beginM;
          const endMin = endH * 60 + endM;

          timeSlots.forEach(slot => {
            const [slotH] = slot.split(':').map(Number);
            const slotMin = slotH * 60;
            const nextSlotMin = slotMin + 60;

            const overlaps =
              (beginMin >= slotMin && beginMin < nextSlotMin) ||
              (endMin > slotMin && endMin <= nextSlotMin) ||
              (beginMin <= slotMin && endMin >= nextSlotMin);

            if (overlaps) {
              grid[slot][day].push({
                subjectId: course.subjectId,
                title: this._decodeHtmlEntities(course.courseTitle),
                code: `${course.subject}${course.courseNumber}`,
                section: course.section.sequenceNumber,
                nrc: course.section.courseReferenceNumber,
                time: `${this._formatTime(mt.beginTime)}-${this._formatTime(mt.endTime)}`,
                room: mt.room || ''
              });
            }
          });
        });
      });
    });

    return { timeSlots, dayOrder, dayNames, grid };
  },

  /**
   * Renders the grid table for pdfMake
   * @param {Object} matrix - The schedule matrix
   * @param {Object} subjectColors - Color map by subjectId
   * @return {Object} pdfMake table element
   */
  _renderGridTable(matrix, subjectColors) {
    const { timeSlots, dayOrder, dayNames, grid } = matrix;

    // Filter out days with no classes at all
    const activeDays = dayOrder.filter(day =>
      timeSlots.some(slot => grid[slot][day].length > 0)
    );

    if (activeDays.length === 0) {
      return { text: 'No hay clases programadas', alignment: 'center' };
    }

    // Header row
    const headerRow = [
      { text: 'Hora', bold: true, fillColor: '#1E293B', color: '#FFFFFF', alignment: 'center', margin: [2, 4, 2, 4] },
      ...activeDays.map(day => ({
        text: dayNames[day],
        bold: true,
        fillColor: '#1E293B',
        color: '#FFFFFF',
        alignment: 'center',
        margin: [2, 4, 2, 4]
      }))
    ];

    // Data rows
    const dataRows = timeSlots.map(slot => {
      const row = [
        { text: slot, bold: true, alignment: 'center', fillColor: '#F8FAFC', color: '#334155', margin: [2, 3, 2, 3] }
      ];

      activeDays.forEach(day => {
        const courses = grid[slot][day];
        if (courses.length === 0) {
          row.push({ text: '', fillColor: '#FFFFFF', margin: [1, 1, 1, 1] });
        } else {
          // Deduplicate by subjectId (same class spans multiple slots)
          const seen = new Set();
          const uniqueCourses = courses.filter(c => {
            if (seen.has(c.subjectId + c.section)) return false;
            seen.add(c.subjectId + c.section);
            return true;
          });

          const cellContent = uniqueCourses.map(c => {
            const color = subjectColors[c.subjectId] || { bg: '#F1F5F9', text: '#334155' };
            return {
              stack: [
                { text: c.title, bold: true, fontSize: 7, color: color.text },
                { text: `Sec ${c.section}`, fontSize: 6, color: color.text },
                { text: c.time, fontSize: 5.5, color: '#64748B', italics: true }
              ],
              margin: [1, 1, 1, 1]
            };
          });

          const bgColor = subjectColors[uniqueCourses[0].subjectId]?.bg || '#F1F5F9';

          row.push({
            stack: cellContent.length === 1 ? cellContent[0].stack : cellContent.map(c => c.stack).flat(),
            fillColor: bgColor,
            margin: [2, 2, 2, 2]
          });
        }
      });

      return row;
    });

    const colWidths = ['auto', ...activeDays.map(() => '*')];

    return {
      table: {
        headerRows: 1,
        widths: colWidths,
        body: [headerRow, ...dataRows]
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => '#E2E8F0',
        vLineColor: () => '#E2E8F0',
        paddingLeft: () => 3,
        paddingRight: () => 3,
        paddingTop: () => 2,
        paddingBottom: () => 2
      }
    };
  },

  /**
   * Formatea tiempo de HHMM a H:MM
   * @param {String} time - Tiempo en formato HHMM
   * @return {String} Tiempo formateado
   */
  _formatTime(time) {
    if (!time) return '';
    const hours = parseInt(time.substring(0, 2), 10);
    const minutes = time.substring(2);
    return `${hours}:${minutes}`;
  },

  /**
   * Decodifica entidades HTML
   * @param {String} text - Texto con entidades HTML
   * @return {String} Texto decodificado
   */
  _decodeHtmlEntities(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.innerHTML = text;
    return div.textContent || div.innerText || '';
  }
};
