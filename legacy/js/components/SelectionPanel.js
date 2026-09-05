export default {
  props: {
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
    },
    campuses: {
      type: Array,
      default: () => []
    },
    generatingSchedules: {
      type: Boolean,
      default: false
    }
  },

  computed: {
    priorityItems() {
      return this.selectedItems.filter(item => item.selectionType === 'priority');
    },

    candidateItems() {
      return this.selectedItems.filter(item => item.selectionType === 'candidate');
    },

    prioritySubjects() {
      return this.priorityItems.filter(item => item.type === 'subject');
    },

    candidateSubjects() {
      return this.candidateItems.filter(item => item.type === 'subject');
    },

    prioritySections() {
      return this.priorityItems.filter(item => item.type === 'section');
    },

    candidateSections() {
      return this.candidateItems.filter(item => item.type === 'section');
    },

    // Statistics computation
    selectionStats() {
      const stats = {
        totalItems: this.selectedItems.length,
        totalCredits: 0,
        priorityCredits: 0,
        candidateCredits: 0,
        dayDistribution: {
          monday: 0,
          tuesday: 0,
          wednesday: 0,
          thursday: 0,
          friday: 0,
          saturday: 0,
          sunday: 0
        },
        conflicts: this.detectConflicts(),
        openSections: 0,
        closedSections: 0
      };

      // Calculate credits
      this.selectedItems.forEach(item => {
        const credits = this.getItemCredits(item);
        stats.totalCredits += credits;

        if (item.selectionType === 'priority') {
          stats.priorityCredits += credits;
        } else {
          stats.candidateCredits += credits;
        }

        // Count day distribution and section status
        if (item.type === 'section') {
          this.updateDayDistribution(item.item, stats.dayDistribution);
          if (item.item.openSection) {
            stats.openSections++;
          } else {
            stats.closedSections++;
          }
        } else if (item.type === 'subject') {
          // For subjects, count all sections
          item.item.sections.forEach(section => {
            this.updateDayDistribution(section, stats.dayDistribution);
            if (section.openSection) {
              stats.openSections++;
            } else {
              stats.closedSections++;
            }
          });
        }
      });

      return stats;
    },

    hasConflicts() {
      return this.selectionStats.conflicts.length > 0;
    },

    conflictSeverity() {
      const conflicts = this.selectionStats.conflicts;
      if (conflicts.some(c => c.severity === 'error')) return 'error';
      if (conflicts.some(c => c.severity === 'warning')) return 'warning';
      return 'none';
    }
  },

  methods: {
    getItemCredits(item) {
      if (item.type === 'subject') {
        return parseInt(item.item.creditHourLow) || 0;
      } else if (item.type === 'section' && item.subjectInfo) {
        return parseInt(item.subjectInfo.creditHourLow) || 0;
      }
      return 0;
    },

    updateDayDistribution(section, distribution) {
      if (!section.meetingsFaculty || section.meetingsFaculty.length === 0) return;

      section.meetingsFaculty.forEach(meeting => {
        if (!meeting.meetingTime) return;

        const days = meeting.meetingTime;
        if (days.monday) distribution.monday++;
        if (days.tuesday) distribution.tuesday++;
        if (days.wednesday) distribution.wednesday++;
        if (days.thursday) distribution.thursday++;
        if (days.friday) distribution.friday++;
        if (days.saturday) distribution.saturday++;
        if (days.sunday) distribution.sunday++;
      });
    },

    detectConflicts() {
      const conflicts = [];
      const scheduleMap = new Map();

      // Collect all scheduled times
      this.selectedItems.forEach(item => {
        const sections = item.type === 'subject' ? item.item.sections : [item.item];

        sections.forEach(section => {
          if (!section.meetingsFaculty) return;

          section.meetingsFaculty.forEach(meeting => {
            if (!meeting.meetingTime) return;

            const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            days.forEach(day => {
              if (meeting.meetingTime[day]) {
                const timeKey = `${day}-${meeting.meetingTime.beginTime}-${meeting.meetingTime.endTime}`;

                if (!scheduleMap.has(timeKey)) {
                  scheduleMap.set(timeKey, []);
                }

                scheduleMap.get(timeKey).push({
                  item,
                  section,
                  meeting,
                  day,
                  beginTime: meeting.meetingTime.beginTime,
                  endTime: meeting.meetingTime.endTime
                });
              }
            });
          });
        });
      });

      // Check for time conflicts
      scheduleMap.forEach((entries, timeKey) => {
        if (entries.length > 1) {
          // Check if times actually overlap
          const overlapping = this.checkTimeOverlap(entries);
          if (overlapping.length > 1) {
            conflicts.push({
              type: 'schedule',
              severity: 'error',
              description: `Conflicto de horario el ${this.getDayName(entries[0].day)} de ${entries[0].beginTime} a ${entries[0].endTime}`,
              items: overlapping.map(e => e.item),
              suggestions: [
                'Selecciona una sección diferente para una de las materias',
                'Cambia una de las materias a candidata para generar horarios alternativos'
              ]
            });
          }
        }
      });

      // Check for closed sections in priority items
      this.priorityItems.forEach(item => {
        const sections = item.type === 'subject' ? item.item.sections : [item.item];
        const closedSections = sections.filter(s => !s.openSection);

        if (closedSections.length > 0 && item.type === 'section') {
          conflicts.push({
            type: 'capacity',
            severity: 'warning',
            description: `La sección ${item.item.courseReferenceNumber} está cerrada`,
            items: [item],
            suggestions: [
              'Considera cambiar a una sección abierta',
              'Cambia a candidata si tienes alternativas'
            ]
          });
        }
      });

      return conflicts;
    },

    checkTimeOverlap(entries) {
      // Simple time overlap check - can be enhanced
      return entries;
    },

    getDayName(day) {
      const dayNames = {
        monday: 'Lunes',
        tuesday: 'Martes',
        wednesday: 'Miércoles',
        thursday: 'Jueves',
        friday: 'Viernes',
        saturday: 'Sábado',
        sunday: 'Domingo'
      };
      return dayNames[day] || day;
    },

    formatSectionSchedule(section) {
      if (!section.meetingsFaculty || section.meetingsFaculty.length === 0) {
        return 'Sin horario definido';
      }

      const schedules = section.meetingsFaculty.map(meeting => {
        if (!meeting.meetingTime) return '';

        const days = [];
        if (meeting.meetingTime.monday) days.push('L');
        if (meeting.meetingTime.tuesday) days.push('M');
        if (meeting.meetingTime.wednesday) days.push('W');
        if (meeting.meetingTime.thursday) days.push('J');
        if (meeting.meetingTime.friday) days.push('V');
        if (meeting.meetingTime.saturday) days.push('S');
        if (meeting.meetingTime.sunday) days.push('D');

        const time = `${meeting.meetingTime.beginTime}-${meeting.meetingTime.endTime}`;
        return `${days.join('')} ${time}`;
      }).filter(schedule => schedule).join(', ');

      return schedules || 'Sin horario definido';
    },

    formatSectionProfessor(section) {
      if (!section.meetingsFaculty || section.meetingsFaculty.length === 0) {
        return 'Sin profesor asignado';
      }

      const allProfessors = [];

      section.meetingsFaculty.forEach(meeting => {
        if (meeting.faculty && Array.isArray(meeting.faculty)) {
          meeting.faculty.forEach(faculty => {
            if (faculty.displayName &&
              faculty.displayName.trim() !== '' &&
              faculty.displayName !== 'Por Asignar' &&
              !allProfessors.includes(faculty.displayName)) {
              allProfessors.push(faculty.displayName);
            }
          });
        }
      });

      return allProfessors.length > 0 ? allProfessors.join(', ') : 'Sin profesor asignado';
    },

    formatSubjectSections(subject) {
      const totalSections = subject.sections.length;
      const openSections = subject.sections.filter(section => section.openSection).length;

      const nrcs = subject.sections.slice(0, 2)
        .map(section => section.courseReferenceNumber)
        .filter(Boolean)
        .join(", ");

      return `${openSections} de ${totalSections} secciones abiertas${nrcs ? ` (NRCs: ${nrcs}${subject.sections.length > 2 ? '...' : ''})` : ''}`;
    },

    formatSubjectProfessors(subject) {
      if (!subject.sections || subject.sections.length === 0) {
        return 'Sin secciones disponibles';
      }

      const allProfessors = new Set();

      subject.sections.forEach(section => {
        const professorName = this.formatSectionProfessor(section);
        if (professorName && professorName !== 'Sin profesor asignado') {
          allProfessors.add(professorName);
        }
      });

      if (allProfessors.size === 0) {
        return 'Sin profesor asignado';
      } else if (allProfessors.size === 1) {
        return Array.from(allProfessors)[0];
      } else {
        return `${allProfessors.size} profesores diferentes`;
      }
    },

    // Event handlers
    toggleSelectionType(item) {
      this.$emit('toggle-selection-type', item);
    },

    removeItem(item) {
      this.$emit('remove-item', item);
    },

    generateSchedules() {
      this.$emit('generate-schedules');
    },

    // Bulk operations
    selectAllPriority() {
      this.$emit('bulk-change-type', this.candidateItems, 'priority');
    },

    selectAllCandidate() {
      this.$emit('bulk-change-type', this.priorityItems, 'candidate');
    },

    clearAllSelections() {
      this.$emit('clear-all');
    }
  },

  template: `
    <div class="flex flex-col bg-panel-bg border-t border-border-color rounded-b-2xl overflow-hidden font-display relative z-50">
      
      <!-- Compact Summary Bar & Chips -->
      <div v-if="selectedItems.length > 0" class="flex flex-col bg-slate-50 border-b border-border-color">
        <!-- Top Summary -->
        <div class="px-5 py-3 flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="flex -space-x-2 relative z-10">
              <div v-if="priorityItems.length > 0" class="flex items-center justify-center w-8 h-8 rounded-full bg-red-50 text-red-600 border border-red-100 shadow-sm z-20" title="Prioritarias">
                <span class="text-xs font-bold">{{ priorityItems.length }}</span>
              </div>
              <div v-if="candidateItems.length > 0" class="flex items-center justify-center w-8 h-8 rounded-full bg-amber-50 text-amber-600 border border-amber-100 shadow-sm z-10" title="Candidatas">
                <span class="text-xs font-bold">{{ candidateItems.length }}</span>
              </div>
            </div>
            
            <div class="flex flex-col text-xs mt-0.5">
              <span class="font-bold text-primary-text text-[13px] tracking-tight">{{ selectionStats.totalCredits }} UC Seleccionadas</span>
              <div class="flex items-center gap-2 mt-0.5">
                <span class="text-muted-text font-medium">{{ selectedItems.length }} elementos</span>
                <button @click="clearAllSelections" class="text-[10px] font-bold text-muted-text hover:text-rose-500 uppercase tracking-widest transition-colors flex items-center gap-0.5"><span class="material-symbols-outlined text-[12px]">delete</span> Limpiar</button>
              </div>
            </div>
          </div>

          <!-- Warning / Conflicts Compact -->
          <div v-if="hasConflicts" class="flex items-center gap-2 px-3 py-1.5 bg-rose-50 rounded-lg border border-rose-200 text-rose-700 shadow-sm animate-pulse">
             <span class="material-symbols-outlined text-[16px]">error</span>
             <span class="text-xs font-bold">{{ selectionStats.conflicts.length }} Conflictos</span>
          </div>
        </div>

        <!-- Selected Items Chips (Scrollable) -->
        <div class="px-5 pb-3 flex gap-2 overflow-x-auto no-scrollbar items-center">
          <span class="text-[10px] font-bold text-muted-text uppercase tracking-widest mr-1 opacity-70 flex-none">Items:</span>
          <div v-for="item in selectedItems" :key="item.item.id" 
               class="flex-none flex items-center bg-white border rounded-full pl-3 pr-1 py-1 gap-1 shadow-sm group hover:shadow transition-all"
               :class="item.selectionType === 'priority' ? 'border-red-200' : 'border-amber-200'">
            <button @click="toggleSelectionType(item)" class="text-[11px] font-bold truncate max-w-[120px] transition-colors" :class="item.selectionType === 'priority' ? 'text-red-600 hover:text-red-700' : 'text-amber-600 hover:text-amber-700'" :title="'Cambiar tipo. ' + (item.type === 'subject' ? item.item.courseTitle : item.subjectInfo.courseTitle)">
              {{ item.type === 'subject' ? item.item.subject + item.item.courseNumber : item.item.courseReferenceNumber }}
            </button>
            <button @click="removeItem(item)" class="w-5 h-5 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-rose-500 opacity-60 group-hover:opacity-100 transition-all ml-1">
              <span class="material-symbols-outlined text-[14px]">close</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Settings & Generate Row -->
      <div class="p-4 flex flex-col sm:flex-row gap-4 sm:items-center">
        
        <!-- Options List -->
        <div class="flex-none flex flex-row justify-center sm:justify-start gap-4">
          <!-- Only Open Sections Checkbox -->
          <label class="flex items-center gap-2 cursor-pointer group w-max">
            <div class="relative w-8 h-4 bg-slate-200 rounded-full transition-colors" :class="{ 'bg-primary': onlyOpenSections }">
              <input type="checkbox" :checked="onlyOpenSections" class="sr-only" @change="$emit('update:onlyOpenSections', $event.target.checked)">
              <div class="absolute left-0.5 top-0.5 bg-white w-3 h-3 rounded-full transition-transform shadow-sm" :class="{ 'translate-x-4': onlyOpenSections }"></div>
            </div>
            <span class="text-xs font-bold transition-colors text-primary-text">Solo abiertas</span>
          </label>
        </div>
        
        <!-- Generate Button -->
        <div class="flex-1 flex gap-2">
          <!-- Sede Selector Button/Dropdown embedded -->
          <div class="relative w-1/3 min-w-[100px]">
            <select :value="selectedCampus" @change="$emit('update:selectedCampus', $event.target.value)" class="w-full h-full appearance-none bg-slate-50 border border-border-color hover:border-slate-300 transition-colors rounded-xl pl-3 pr-8 py-3 text-sm font-bold text-primary-text outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 cursor-pointer">
               <option value="">Sede: Todas</option>
               <option v-for="campus in campuses" :key="campus" :value="campus">{{ campus }}</option>
            </select>
            <span class="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">expand_more</span>
          </div>

          <button 
            @click="generateSchedules" 
            :disabled="selectedItems.length === 0 || generatingSchedules"
            :class="[
              'w-2/3 h-[52px] rounded-full font-bold transition-all flex items-center justify-center gap-2',
              selectedItems.length === 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-border-color' :
              generatingSchedules ? 'bg-primary/80 text-white cursor-wait relative overflow-hidden' :
              hasConflicts ? 'bg-rose-500 hover:bg-rose-600 text-white hover:shadow-lg shadow-sm active:scale-[0.98]' :
              'bg-primary hover:bg-primary/90 text-white shadow-md hover:shadow-lg active:scale-[0.98]'
            ]"
          >
            <span class="material-symbols-outlined font-bold text-[20px]" :class="{ 'animate-spin': generatingSchedules }">
              {{ generatingSchedules ? 'sync' : hasConflicts ? 'warning' : 'magic_button' }}
            </span>
            <span class="text-sm tracking-wide">{{ generatingSchedules ? 'Generando...' : hasConflicts ? 'Generar Conflictos' : 'Generar Horarios' }}</span>
          </button>
        </div>

      </div>
    </div>
  `
};