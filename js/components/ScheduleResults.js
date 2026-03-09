import { decodeHtmlEntities } from '../utils/HtmlUtils.js';
import PdfExportService from '../services/PdfExportService.js';
import IcsExportService from '../services/IcsExportService.js';
import ShareService from '../services/ShareService.js';

export default {
  props: {
    generatedSchedules: Object,
    selectedItems: {
      type: Array,
      default: () => []
    },
    onlyOpenSections: {
      type: Boolean,
      default: true
    },
    selectedCampus: {
      type: String,
      default: ''
    }
  },

  data() {
    return {
      currentScheduleIndex: 0,
      daysOfWeek: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
      dayProperties: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
      timeSlots: [],
      displayFormat: 'grid', // Force grid as default
      subjectColors: {},
      showSaveModal: false,
      isExporting: false,
      themes: [
        { bg: 'bg-blue-100', border: 'border-blue-200', text: 'text-blue-900', textSub: 'text-blue-700', icon: 'text-blue-500' },
        { bg: 'bg-emerald-100', border: 'border-emerald-200', text: 'text-emerald-900', textSub: 'text-emerald-700', icon: 'text-emerald-500' },
        { bg: 'bg-violet-100', border: 'border-violet-200', text: 'text-violet-900', textSub: 'text-violet-700', icon: 'text-violet-500' },
        { bg: 'bg-amber-100', border: 'border-amber-200', text: 'text-amber-900', textSub: 'text-amber-700', icon: 'text-amber-500' },
        { bg: 'bg-rose-100', border: 'border-rose-200', text: 'text-rose-900', textSub: 'text-rose-700', icon: 'text-rose-500' },
        { bg: 'bg-cyan-100', border: 'border-cyan-200', text: 'text-cyan-900', textSub: 'text-cyan-700', icon: 'text-cyan-500' },
        { bg: 'bg-fuchsia-100', border: 'border-fuchsia-200', text: 'text-fuchsia-900', textSub: 'text-fuchsia-700', icon: 'text-fuchsia-500' },
        { bg: 'bg-teal-100', border: 'border-teal-200', text: 'text-teal-900', textSub: 'text-teal-700', icon: 'text-teal-500' },
        { bg: 'bg-orange-100', border: 'border-orange-200', text: 'text-orange-900', textSub: 'text-orange-700', icon: 'text-orange-500' },
        { bg: 'bg-lime-100', border: 'border-lime-200', text: 'text-lime-900', textSub: 'text-lime-700', icon: 'text-lime-500' }
      ]
    };
  },

  created() {
    // Crear horarios de 7:00 AM a 9:00 PM solo con horas completas (sin medias horas)
    const startHour = 7;
    const endHour = 22; // Aumentamos una hora para incluir hasta las 21:00

    for (let hour = startHour; hour < endHour; hour++) {
      this.timeSlots.push(`${hour}:00`);
      // Ya no incluimos las medias horas: this.timeSlots.push(`${hour}:30`);
    }
  },

  watch: {
    // Cuando cambia el horario actual, asignar colores a las materias
    currentSchedule: {
      immediate: true,
      handler(schedule) {
        if (schedule) {
          this.assignColorsToSubjects(schedule);
        }
      }
    }
  },

  computed: {
    hasResults() {
      return this.generatedSchedules &&
        this.generatedSchedules.schedules &&
        this.generatedSchedules.schedules.length > 0;
    },

    hasErrors() {
      return this.generatedSchedules &&
        this.generatedSchedules.errors &&
        this.generatedSchedules.errors.length > 0;
    },

    totalSchedules() {
      return this.generatedSchedules?.schedules?.length || 0;
    },

    currentSchedule() {
      return this.hasResults ? this.generatedSchedules.schedules[this.currentScheduleIndex] : null;
    },

    totalCredits() {
      if (!this.currentSchedule) return 0;

      return this.currentSchedule.reduce((total, course) => {
        return total + (parseFloat(course.creditHourLow) || 0);
      }, 0);
    },

    scheduleMatrix() {
      if (!this.currentSchedule) return null;

      // Crear matriz vacía para la semana
      const matrix = {};
      this.dayProperties.forEach(day => {
        matrix[day] = {};
        this.timeSlots.forEach(slot => {
          matrix[day][slot] = [];
        });
      });

      // Rellenar con las clases
      this.currentSchedule.forEach(course => {
        course.section.meetingsFaculty.forEach(meeting => {
          if (!meeting.meetingTime) return;

          const mt = meeting.meetingTime;
          this.dayProperties.forEach((day, index) => {
            if (mt[day]) {
              // Encontrar slots que se superponen con esta clase
              const slots = this.getSlotsForClass(mt.beginTime, mt.endTime);
              slots.forEach(slot => {
                matrix[day][slot].push({
                  id: course.subjectId,
                  title: `${course.subject}${course.courseNumber}`,
                  courseTitle: decodeHtmlEntities(course.courseTitle),  // Aseguramos que el título esté decodificado
                  fullTitle: course.courseTitle,
                  nrc: course.section.courseReferenceNumber,
                  section: course.section.sequenceNumber,
                  room: mt.room || 'N/A',
                  beginTime: this.formatTime(mt.beginTime),
                  endTime: this.formatTime(mt.endTime)
                });
              });
            }
          });
        });
      });

      return matrix;
    },

    mergedMatrix() {
      if (!this.scheduleMatrix) return null;

      const result = {};
      this.dayProperties.forEach(day => {
        result[day] = {};
        let skipUntil = -1;

        this.timeSlots.forEach((slot, idx) => {
          if (idx <= skipUntil) {
            result[day][slot] = { type: 'continuation' };
            return;
          }

          const courses = this.scheduleMatrix[day][slot];
          if (!courses || courses.length === 0) {
            result[day][slot] = { type: 'empty' };
            return;
          }

          // Find how many consecutive slots this same course spans
          const key = courses[0].id + '-' + courses[0].section;
          let span = 1;

          for (let i = idx + 1; i < this.timeSlots.length; i++) {
            const next = this.scheduleMatrix[day][this.timeSlots[i]];
            if (next && next.length > 0 && (next[0].id + '-' + next[0].section) === key) {
              span++;
            } else {
              break;
            }
          }

          skipUntil = idx + span - 1;
          result[day][slot] = { type: 'start', courses, span };
        });
      });

      return result;
    }
  },

  methods: {
    previousSchedule() {
      if (this.currentScheduleIndex > 0) {
        this.currentScheduleIndex--;
      }
    },

    nextSchedule() {
      if (this.currentScheduleIndex < this.totalSchedules - 1) {
        this.currentScheduleIndex++;
      }
    },

    formatTime(timeStr) {
      if (!timeStr) return '';

      const hours = parseInt(timeStr.substring(0, 2), 10);
      const minutes = timeStr.substring(2);

      return `${hours}:${minutes}`;
    },

    getSlotsForClass(beginTime, endTime) {
      // Convertir horarios a minutos desde medianoche
      const toMinutes = timeStr => {
        const hours = parseInt(timeStr.substring(0, 2), 10);
        const minutes = parseInt(timeStr.substring(2), 10);
        return hours * 60 + minutes;
      };

      const beginMinutes = toMinutes(beginTime);
      const endMinutes = toMinutes(endTime);

      // Encontrar qué slots de tiempo están cubiertos por esta clase
      // Esta lógica ya existente funcionará con los nuevos slots de hora completa
      return this.timeSlots.filter(slot => {
        const [slotHour, slotMinute] = slot.split(':').map(Number);
        const slotMinutes = slotHour * 60 + slotMinute;
        const nextSlotMinutes = slotMinutes + 60; // Consideramos que cada slot ahora es de 1 hora

        // Una clase se muestra en un slot si:
        // - Comienza durante este slot, O
        // - Termina durante este slot, O
        // - Abarca completamente el slot
        return (beginMinutes >= slotMinutes && beginMinutes < nextSlotMinutes) || // Comienza en este slot
          (endMinutes > slotMinutes && endMinutes <= nextSlotMinutes) ||     // Termina en este slot
          (beginMinutes <= slotMinutes && endMinutes >= nextSlotMinutes);    // Abarca el slot completo
      });
    },

    getCoursesForDay(day) {
      if (!this.currentSchedule) return [];

      const courses = [];
      this.currentSchedule.forEach(course => {
        course.section.meetingsFaculty.forEach(meeting => {
          if (!meeting.meetingTime) return;

          const mt = meeting.meetingTime;
          if (mt[day]) {
            courses.push({
              id: course.subjectId,
              title: `${course.subject}${course.courseNumber}`,
              fullTitle: course.courseTitle,
              nrc: course.section.courseReferenceNumber,
              section: course.section.sequenceNumber,
              room: mt.room || 'N/A',
              beginTime: this.formatTime(mt.beginTime),
              endTime: this.formatTime(mt.endTime)
            });
          }
        });
      });

      // Ordenar por hora de inicio
      return courses.sort((a, b) => {
        return a.beginTime.localeCompare(b.beginTime);
      });
    },

    getMeetingDaysText(course) {
      if (!course || !course.section || !course.section.meetingsFaculty) {
        return '';
      }

      const days = [];

      course.section.meetingsFaculty.forEach(meeting => {
        if (!meeting.meetingTime) return;

        const mt = meeting.meetingTime;
        if (mt.monday) days.push('Lun');
        if (mt.tuesday) days.push('Mar');
        if (mt.wednesday) days.push('Mié');
        if (mt.thursday) days.push('Jue');
        if (mt.friday) days.push('Vie');
        if (mt.saturday) days.push('Sáb');
        if (mt.sunday) days.push('Dom');
      });

      return days.join('/');
    },

    // Nuevo método para obtener el NRC correctamente
    getCourseNRC(course) {
      return course && course.section && course.section.courseReferenceNumber
        ? course.section.courseReferenceNumber
        : 'N/A';
    },

    getCellClasses(courses) {
      if (!courses || courses.length === 0) {
        return 'empty-cell';
      }

      // Si hay conflicto, usar clase de conflicto
      if (courses.length > 1) {
        return 'conflict-cell';
      }

      // Si es un solo curso, asignar el color correspondiente
      const colorClass = this.getCourseColorClass(courses[0]);
      return `course-cell ${colorClass}`;
    },

    toggleDisplayFormat() {
      this.displayFormat = this.displayFormat === 'list' ? 'grid' : 'list';
    },

    // Asignar colores a cada materia para la visualización en grilla
    assignColorsToSubjects(schedule) {
      this.subjectColors = {};

      if (!schedule) return;

      // Obtener IDs únicos de las materias
      const subjectIds = [...new Set(schedule.map(course => course.subjectId))];

      // Asignar un color a cada materia
      subjectIds.forEach((id, index) => {
        // Usar módulo para ciclar a través de los 10 colores disponibles
        const colorIndex = index % 10;
        this.subjectColors[id] = colorIndex;
      });
    },

    // Obtener la clase CSS para el color de una celda
    getCourseTheme(course) {
      if (!course || !course.id) return this.themes[0];
      const colorIndex = this.subjectColors[course.id];
      if (colorIndex === undefined) return this.themes[0];
      return this.themes[colorIndex % this.themes.length];
    },

    // Vista de Grilla - Asegurar que el NRC se muestre en cada celda
    getCellContent(courses) {
      if (!courses || courses.length === 0) return '';

      return courses.map(course => {
        // Obtener versión corta del título para mostrar (p.ej. "Cálculo Diferencial" en vez de "FING02003")
        const shortTitle = this.getShortTitle(course.courseTitle);

        return `
          <div>
            <strong class="course-title">${shortTitle} - ${course.section}</strong>
            <div class="course-details">
              ${course.beginTime} - ${course.endTime}
            </div>
            <div class="text-muted small">
              NRC: ${course.nrc}
              ${course.room !== 'N/A' ? ' | Aula: ' + course.room : ''}
            </div>
          </div>
        `;
      }).join('');
    },

    // Método para obtener versión corta del título de la materia
    getShortTitle(fullTitle) {
      if (!fullTitle) return '';

      // Quitamos puntos y caracteres especiales que puedan estar al final
      const cleanTitle = fullTitle.replace(/\.$/, '');

      // Si el título es corto, lo devolvemos completo
      if (cleanTitle.length < 40) return cleanTitle;

      // Si es largo, obtenemos las primeras palabras (hasta 35 caracteres)
      return cleanTitle.substring(0, 35) + '...';
    },

    // Métodos de descarga
    downloadAsImage() {
      this.showSaveModal = false;

      // Asegurarnos de que estamos en vista de grilla
      const originalFormat = this.displayFormat;
      this.displayFormat = 'grid';

      // Esperar a que el DOM se actualice
      this.$nextTick(() => {
        const element = document.querySelector('.schedule-grid-view');
        if (!element) {
          alert('No se pudo generar la imagen. Intenta de nuevo.');
          this.displayFormat = originalFormat;
          return;
        }

        // Temporarily expand the scroll container and grid to full height
        const scrollParent = element.parentElement;
        const savedParentStyle = scrollParent.style.cssText;
        const savedElementStyle = element.style.cssText;

        scrollParent.style.overflow = 'visible';
        scrollParent.style.height = 'auto';
        scrollParent.style.maxHeight = 'none';
        element.style.height = 'auto';

        html2canvas(element, {
          scale: 3,
          useCORS: true,
          backgroundColor: '#ffffff'
        }).then(canvas => {
          // Restore original styles
          scrollParent.style.cssText = savedParentStyle;
          element.style.cssText = savedElementStyle;

          const link = document.createElement('a');
          link.download = `horario-${new Date().toLocaleDateString().replace(/\//g, '-')}.png`;
          link.href = canvas.toDataURL('image/png');
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // Restaurar formato original
          this.displayFormat = originalFormat;
        }).catch(() => {
          scrollParent.style.cssText = savedParentStyle;
          element.style.cssText = savedElementStyle;
          this.displayFormat = originalFormat;
        });
      });
    },



    downloadNRCsOnly() {
      this.showSaveModal = false;

      // Extraer todos los NRCs únicos
      const nrcs = [...new Set(this.currentSchedule.map(course =>
        course.section.courseReferenceNumber
      ))];

      // Crear contenido con los NRCs, uno por línea
      let content = 'NRCs para inscripción:\n\n';
      nrcs.forEach(nrc => {
        content += nrc + '\n';
      });

      // También añadir una sección con NRCs en formato copiable (sin espacios)
      content += '\n\nFormato para copiar y pegar:\n';
      content += nrcs.join(', ');

      // Crear y descargar el archivo
      const blob = new Blob([content], { type: 'text/plain' });
      const link = document.createElement('a');
      link.download = 'NRC-para-inscribir.txt';
      link.href = URL.createObjectURL(blob);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },

    openSaveModal() {
      this.showSaveModal = true;
    },

    closeSaveModal() {
      this.showSaveModal = false;
    },

    async handleExportPdf() {
      if (!this.currentSchedule) return;
      try {
        this.isExporting = true;
        await PdfExportService.downloadSchedule(
          this.currentSchedule,
          `horario-${new Date().toISOString().split('T')[0]}.pdf`
        );
      } catch (error) {
        console.error('PDF export error:', error);
        alert('Error al generar PDF');
      } finally {
        this.isExporting = false;
      }
    },

    handleExportIcs() {
      if (!this.currentSchedule) return;
      try {
        IcsExportService.downloadIcs(
          this.currentSchedule,
          `horario-${new Date().toISOString().split('T')[0]}.ics`
        );
        this.showNotification('ICS descargado. Importa en Google Calendar u Outlook', 'success');
      } catch (error) {
        console.error('ICS export error:', error);
        this.showNotification('Error al generar ICS', 'error');
      }
    },

    showNotification(message, type) {
      this.$emit('notification', { message, type });
    },

    handleShare() {
      if (!this.currentSchedule) return;

      const message = this._buildWhatsAppMessage(this.currentSchedule);
      const encoded = encodeURIComponent(message);
      window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
    },

    _buildWhatsAppMessage(schedule) {
      let msg = `📚 *Mi Horario UCAB*\n`;
      msg += `📊 ${schedule.length} materias | ${this.totalCredits} UC\n\n`;

      const dayNames = {
        monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles',
        thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado'
      };
      const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

      dayOrder.forEach(day => {
        const courses = this.getCoursesForDay(day);
        if (courses.length === 0) return;

        msg += `📅 *${dayNames[day]}*\n`;
        courses.forEach(c => {
          msg += `  ${c.beginTime}-${c.endTime} ${c.fullTitle} (Sec ${c.section})\n`;
        });
        msg += `\n`;
      });

      msg += `_Generado con Planificador UCAB_`;
      return msg;
    }
  },

  template: `
    <div class="h-full w-full flex flex-col relative font-display overflow-hidden">
      <!-- Empty State -->
      <div v-if="!hasResults" class="absolute inset-0 flex flex-col items-center justify-center">
        <div class="relative z-10 text-center max-w-sm px-6 animate-in fade-in zoom-in duration-500">
          <div class="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-border-color">
            <span class="material-symbols-outlined text-5xl text-slate-400">calendar_month</span>
          </div>
          <h3 class="text-2xl font-bold text-primary-text mb-3 tracking-tight">Listo para Planificar</h3>
          <p class="text-slate-500 font-medium leading-relaxed">Selecciona tus materias en el panel izquierdo y haz clic en "Generar Horarios" para ver las opciones disponibles.</p>
        </div>
      </div>
      
      <!-- Results State -->
      <div v-else class="flex flex-col h-full w-full">
        <!-- Header Controls -->
        <header class="flex-none flex flex-col sm:flex-row items-center justify-between whitespace-nowrap border-b border-border-color px-4 sm:px-6 py-4 bg-white rounded-t-2xl shadow-sm border-t border-x z-20">
          <div class="flex items-center gap-3 mb-4 sm:mb-0">
            <div class="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center shadow-lg shadow-slate-800/20">
              <span class="material-symbols-outlined text-[20px]">calendar_view_week</span>
            </div>
            <div class="flex flex-col">
              <h2 class="text-lg font-bold leading-tight tracking-tight text-primary-text">Horarios Generados</h2>
              <p class="text-[11px] font-bold text-emerald-600 tracking-wide uppercase flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">check_circle</span> {{ totalSchedules }} Posibilidades</p>
            </div>
          </div>
          
          <div class="flex flex-wrap items-center justify-center gap-2">
            <button @click="handleExportPdf" :disabled="isExporting" class="flex items-center justify-center rounded-xl h-10 bg-white text-slate-700 gap-2 text-sm font-bold hover:bg-slate-50 transition-colors px-3 shadow-sm border border-border-color">
              <span class="material-symbols-outlined text-[20px]">{{ isExporting ? 'sync' : 'picture_as_pdf' }}</span>
              <span class="hidden sm:inline">{{ isExporting ? 'Generando...' : 'PDF' }}</span>
            </button>
            <button @click="openSaveModal" class="flex items-center justify-center rounded-xl h-10 bg-white text-slate-700 gap-2 text-sm font-bold hover:bg-slate-50 transition-colors px-3 shadow-sm border border-slate-200 hover:border-slate-300">
              <span class="material-symbols-outlined text-[20px]">download</span>
              <span class="hidden sm:inline">Exportar</span>
            </button>
            <button @click="handleShare" class="flex items-center justify-center rounded-xl h-10 bg-primary/10 text-primary gap-2 text-sm font-bold hover:bg-primary/20 transition-colors px-3 shadow-sm border border-primary/20">
              <span class="material-symbols-outlined text-[20px]">share</span>
              <span class="hidden sm:inline">Compartir</span>
            </button>
          </div>
        </header>

        <!-- Pagination & Stats -->
        <div class="flex-none flex flex-wrap items-center justify-between gap-4 px-4 sm:px-6 py-3 bg-slate-50 border-b border-border-color z-10 shadow-sm">
          <div class="flex items-center gap-1 bg-white p-1 rounded-full shadow-sm border border-border-color">
            <button @click="previousSchedule" :disabled="currentScheduleIndex === 0" class="flex w-10 h-10 items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent">
              <span class="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            <span class="text-sm font-bold w-20 text-center tracking-wide text-primary-text">Opción {{ currentScheduleIndex + 1 }}</span>
            <button @click="nextSchedule" :disabled="currentScheduleIndex >= totalSchedules - 1" class="flex w-10 h-10 items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent">
              <span class="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>
          
          <div class="flex items-center gap-3">
             <div class="flex flex-col items-end">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Carga Académica</span>
                <span class="text-sm font-bold text-primary-text">{{ totalCredits }} UC en Total</span>
             </div>
          </div>
        </div>

        <!-- Timetable Grid -->
        <div class="flex-1 overflow-auto bg-slate-50 p-2 sm:p-4 custom-scrollbar">
          <div class="schedule-grid-view min-w-[800px] h-full flex flex-col bg-white rounded-2xl border border-border-color shadow-sm overflow-hidden">
            <!-- Grid Header -->
            <div class="grid grid-cols-7 border-b border-border-color bg-slate-50">
              <div class="p-3 text-center text-xs font-bold text-slate-400 uppercase tracking-widest w-20 flex-shrink-0">Hora</div>
              <div v-for="day in daysOfWeek" :key="day" class="p-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">{{ day }}</div>
            </div>
            
            <!-- Grid Body -->
            <div class="relative flex-1 bg-transparent overflow-y-auto">
              <!-- Background separator lines -->
              <div class="absolute inset-0 grid grid-cols-7 pointer-events-none">
                <div class="border-r border-slate-100 w-20 flex-shrink-0 bg-slate-50/30"></div>
                <div v-for="i in 6" :key="i" class="border-r border-slate-100/70"></div>
              </div>

              <!-- Time Rows -->
              <div v-for="timeSlot in timeSlots" :key="timeSlot" class="grid grid-cols-7 border-b border-slate-100 min-h-[90px] relative z-10 group">
                <div class="p-2 text-center text-[11px] font-bold text-slate-400 w-20 flex flex-col items-center justify-center gap-0.5 group-hover:bg-slate-50/50 transition-colors">
                  <span>{{ timeSlot }}</span>
                  <span class="text-slate-200">|</span>
                </div>
                
                <div v-for="(day, dayIndex) in dayProperties" :key="day" class="p-1 relative">
                  <div v-if="mergedMatrix && mergedMatrix[day][timeSlot].type === 'start'" class="absolute inset-x-1 top-1 flex flex-col gap-1 z-20" :style="{ height: 'calc(' + mergedMatrix[day][timeSlot].span + ' * 90px - 8px)' }">
                    <div v-for="course in mergedMatrix[day][timeSlot].courses" :key="course.id" 
                         :class="[
                           'h-full flex flex-col justify-center rounded-xl p-2 sm:p-2.5 shadow-sm hover:shadow-md transition-all cursor-pointer border overflow-hidden group/card',
                           getCourseTheme(course).bg, getCourseTheme(course).border
                         ]">
                       <div class="flex items-start justify-between gap-1 mb-0.5">
                         <p class="font-bold text-xs leading-normal pb-0.5" :class="getCourseTheme(course).text" :title="course.fullTitle">{{ getShortTitle(course.courseTitle) }}</p>
                       </div>
                       
                       <div class="flex items-center gap-1 opacity-80 mt-auto">
                         <span class="material-symbols-outlined text-[12px]" :class="getCourseTheme(course).textSub">location_on</span>
                         <span class="text-\[11px\] font-semibold tracking-wide pb-0.5" :class="getCourseTheme(course).textSub">{{ course.room !== 'N/A' ? course.room : 'Por Asignar' }}</span>
                       </div>
                       
                       <div class="text-\[10px\] font-semibold mt-1 tracking-wide opacity-70 uppercase" :class="getCourseTheme(course).textSub">
                         NRC: {{ course.nrc }} • Sec: {{ course.section }}
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Export Modal -->
      <div v-if="showSaveModal" class="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-border-color animate-in zoom-in-95 duration-200">
          <div class="p-5 border-b border-slate-100 flex items-center justify-between">
            <h5 class="text-lg font-bold text-primary-text">Exportar Horario</h5>
            <button @click="closeSaveModal" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          
          <div class="p-5 space-y-3">
            <button @click="downloadAsImage" class="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-primary hover:bg-primary/5 transition-all text-left group">
              <div class="w-10 h-10 rounded-lg bg-blue-50 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                <span class="material-symbols-outlined">image</span>
              </div>
              <div>
                <strong class="block text-sm text-slate-800">Descargar como Imagen (PNG)</strong>
                <span class="text-xs text-slate-500 font-medium">Captura pixel-perfect del horario semanal</span>
              </div>
            </button>
            
            <button @click="handleExportIcs" class="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group">
              <div class="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span class="material-symbols-outlined">event</span>
              </div>
              <div>
                <strong class="block text-sm text-slate-800">Agregar a Calendario (ICS)</strong>
                <span class="text-xs text-slate-500 font-medium">Compatible con Google Calendar, Outlook y Apple</span>
              </div>
            </button>
            
            <button @click="downloadNRCsOnly" class="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50 transition-all text-left group">
              <div class="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span class="material-symbols-outlined">content_paste</span>
              </div>
              <div>
                <strong class="block text-sm text-slate-800">Copiar códigos NRC</strong>
                <span class="text-xs text-slate-500 font-medium">Texto plano ideal para el módulo de inscripción</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  `
};