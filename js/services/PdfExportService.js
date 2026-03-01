import { loadPdfMake } from '../utils/PdfLoader.js';

/**
 * Servicio para exportar horarios a formato PDF
 */
export default {
  /**
   * Descarga el horario como PDF
   * @param {Array} scheduleItems - Lista de materias del horario
   * @param {String} filename - Nombre del archivo PDF
   * @return {Promise<void>}
   */
  async downloadSchedule(scheduleItems, filename = 'horario.pdf') {
    await loadPdfMake();
    
    const docDefinition = this._buildDocDefinition(scheduleItems);
    
    window.pdfMake.createPdf(docDefinition).download(filename);
  },
  
  /**
   * Construye la definición del documento PDF
   * @param {Array} scheduleItems - Lista de materias del horario
   * @return {Object} Definición del documento pdfMake
   */
  _buildDocDefinition(scheduleItems) {
    const totalCredits = scheduleItems.reduce((sum, course) => {
      return sum + (parseFloat(course.creditHourLow) || 0);
    }, 0);
    
    const totalSubjects = scheduleItems.length;
    
    return {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [20, 30, 20, 30],
      content: [
        { text: 'Horario UCAB', style: 'title' },
        { text: `Total de créditos: ${totalCredits} | Materias: ${totalSubjects}`, style: 'subtitle' },
        { text: '\n' },
        ...this._buildScheduleTable(scheduleItems)
      ],
      styles: {
        title: {
          fontSize: 18,
          bold: true,
          alignment: 'center',
          margin: [0, 0, 0, 10]
        },
        subtitle: {
          fontSize: 12,
          alignment: 'center',
          margin: [0, 0, 0, 20],
          color: '#666666'
        },
        dayHeader: {
          fontSize: 12,
          bold: true,
          fillColor: '#4a90d9',
          color: '#ffffff',
          alignment: 'center'
        },
        tableHeader: {
          fontSize: 10,
          bold: true,
          fillColor: '#f2f2f2',
          alignment: 'center'
        },
        tableCell: {
          fontSize: 9,
          alignment: 'left'
        },
        timeCell: {
          fontSize: 9,
          bold: true,
          alignment: 'center'
        }
      },
      defaultStyle: {
        fontSize: 10
      }
    };
  },
  
  /**
   * Construye las tablas del horario agrupadas por día
   * @param {Array} scheduleItems - Lista de materias del horario
   * @return {Array} Array de elementos de contenido para el PDF
   */
  _buildScheduleTable(scheduleItems) {
    const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const dayNames = {
      monday: 'Lunes',
      tuesday: 'Martes',
      wednesday: 'Miércoles',
      thursday: 'Jueves',
      friday: 'Viernes'
    };
    
    const content = [];
    
    dayOrder.forEach(day => {
      const dayItems = this._getItemsForDay(scheduleItems, day);
      
      if (dayItems.length === 0) return;
      
      const sortedItems = dayItems.sort((a, b) => 
        a.beginTime.localeCompare(b.beginTime)
      );
      
      const tableBody = [
        [
          { text: dayNames[day], style: 'dayHeader', colSpan: 6 },
          {}, {}, {}, {}, {}
        ],
        [
          { text: 'Hora', style: 'tableHeader' },
          { text: 'Materia', style: 'tableHeader' },
          { text: 'Sección', style: 'tableHeader' },
          { text: 'Salón', style: 'tableHeader' },
          { text: 'Profesor', style: 'tableHeader' },
          { text: 'NRC', style: 'tableHeader' }
        ]
      ];
      
      sortedItems.forEach(item => {
        tableBody.push([
          { text: `${item.beginTime} - ${item.endTime}`, style: 'timeCell' },
          { text: `${item.subject}${item.courseNumber}\n${item.courseTitle}`, style: 'tableCell' },
          { text: item.section, style: 'tableCell' },
          { text: item.room || 'N/A', style: 'tableCell' },
          { text: item.professor || 'N/A', style: 'tableCell' },
          { text: item.nrc, style: 'tableCell' }
        ]);
      });
      
      content.push({
        table: {
          headerRows: 2,
          widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto'],
          body: tableBody
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 15]
      });
    });
    
    return content;
  },
  
  /**
   * Extrae los items de un día específico
   * @param {Array} scheduleItems - Lista de materias del horario
   * @param {String} day - Día de la semana (monday, tuesday, etc.)
   * @return {Array} Items para ese día
   */
  _getItemsForDay(scheduleItems, day) {
    const items = [];
    
    scheduleItems.forEach(course => {
      if (!course.section || !course.section.meetingsFaculty) return;
      
      course.section.meetingsFaculty.forEach(meeting => {
        if (!meeting.meetingTime) return;
        
        const mt = meeting.meetingTime;
        if (mt[day]) {
          items.push({
            subject: course.subject,
            courseNumber: course.courseNumber,
            courseTitle: this._decodeHtmlEntities(course.courseTitle),
            section: course.section.sequenceNumber,
            nrc: course.section.courseReferenceNumber,
            beginTime: this._formatTime(mt.beginTime),
            endTime: this._formatTime(mt.endTime),
            room: this._extractRoom(mt),
            professor: this._extractProfessor(meeting)
          });
        }
      });
    });
    
    return items;
  },
  
  /**
   * Formatea tiempo de HHMM a HH:MM
   * @param {String} time - Tiempo en formato HHMM
   * @return {String} Tiempo formateado
   */
  _formatTime(time) {
    if (!time) return '';
    
    const hours = time.substring(0, 2);
    const minutes = time.substring(2);
    
    return `${hours}:${minutes}`;
  },
  
  /**
   * Extrae el salón de la reunión
   * @param {Object} meetingTime - Objeto meetingTime
   * @return {String} Salón o 'N/A'
   */
  _extractRoom(meetingTime) {
    return meetingTime?.room || 'N/A';
  },
  
  /**
   * Extrae el profesor de la reunión
   * @param {Object} meeting - Objeto meeting
   * @return {String} Nombre del profesor o 'N/A'
   */
  _extractProfessor(meeting) {
    if (meeting.faculty && meeting.faculty.length > 0) {
      const prof = meeting.faculty[0];
      return `${prof.firstName || ''} ${prof.lastName || ''}`.trim() || 'N/A';
    }
    return 'N/A';
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
