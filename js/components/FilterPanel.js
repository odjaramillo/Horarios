/**
 * FilterPanel Component
 * Componente Vue para panel de filtros avanzados del modo híbrido
 * Proporciona búsqueda multi-criterio, filtros por horario y disponibilidad,
 * presets de filtros y contador de resultados en tiempo real
 */

import FilterService from '../services/FilterService.js';

export default {
  name: 'FilterPanel',

  props: {
    subjects: {
      type: Array,
      default: () => []
    },
    courses: {
      type: Array,
      default: () => []
    },
    campuses: {
      type: Array,
      default: () => []
    },
    subjectCodes: {
      type: Array,
      default: () => []
    }
  },

  data() {
    return {
      // Filtros actuales
      filters: {
        text: '',
        subject: '',
        campus: '',
        schedule: {
          days: [],
          timeRange: { start: '', end: '' }
        },
        availability: 'all',
        professor: ''
      },

      // Estado del panel
      isExpanded: true,
      showPresets: false,
      showScheduleFilters: false,

      // Presets
      presets: [],
      newPresetName: '',
      showPresetForm: false,

      // Opciones de días
      dayOptions: [
        { value: 'monday', label: 'Lunes', short: 'L' },
        { value: 'tuesday', label: 'Martes', short: 'M' },
        { value: 'wednesday', label: 'Miércoles', short: 'W' },
        { value: 'thursday', label: 'Jueves', short: 'J' },
        { value: 'friday', label: 'Viernes', short: 'V' },
        { value: 'saturday', label: 'Sábado', short: 'S' },
        { value: 'sunday', label: 'Domingo', short: 'D' }
      ],

      // Opciones de disponibilidad
      availabilityOptions: [
        { value: 'all', label: 'Todas las secciones', icon: '📋' },
        { value: 'open', label: 'Solo secciones abiertas', icon: '✅' },
        { value: 'closed', label: 'Solo secciones cerradas', icon: '❌' }
      ],

      // Debounce timer para búsqueda
      searchDebounceTimer: null,

      // Resultados filtrados
      filteredResults: [],
      resultCount: 0
    };
  },

  computed: {
    /**
     * Cuenta el número de filtros activos
     */
    activeFiltersCount() {
      let count = 0;
      if (this.filters.text.trim()) count++;
      if (this.filters.subject.trim()) count++;
      if (this.filters.campus.trim()) count++;
      if (this.filters.availability !== 'all') count++;
      if (this.filters.professor.trim()) count++;
      if (this.filters.schedule.days.length > 0) count++;
      if (this.filters.schedule.timeRange.start && this.filters.schedule.timeRange.end) count++;
      return count;
    },

    /**
     * Verifica si hay filtros de horario activos
     */
    hasScheduleFilters() {
      return this.filters.schedule.days.length > 0 ||
        (this.filters.schedule.timeRange.start && this.filters.schedule.timeRange.end);
    },

    /**
     * Obtiene estadísticas de filtrado
     */
    filterStats() {
      return FilterService.getFilterStats(this.subjects, this.filteredResults);
    }
  },

  watch: {
    /**
     * Observa cambios en los filtros para aplicarlos automáticamente
     */
    filters: {
      handler(newFilters) {
        this.debouncedApplyFilters();
      },
      deep: true
    },

    /**
     * Observa cambios en los subjects para recalcular filtros
     */
    subjects: {
      handler() {
        this.applyFilters();
      },
      immediate: true
    }
  },

  mounted() {
    // Inicializar el servicio de filtros
    FilterService.init();

    // Cargar presets guardados
    this.loadPresets();

    // Aplicar filtros iniciales
    this.applyFilters();
  },

  methods: {
    /**
     * Aplica los filtros con debounce para optimizar rendimiento
     */
    debouncedApplyFilters() {
      if (this.searchDebounceTimer) {
        clearTimeout(this.searchDebounceTimer);
      }

      this.searchDebounceTimer = setTimeout(() => {
        this.applyFilters();
      }, 300);
    },

    /**
     * Aplica los filtros actuales a la lista de subjects
     */
    applyFilters() {
      // Actualizar filtros en el servicio
      FilterService.updateFilters(this.filters);

      // Aplicar filtros a los subjects
      this.filteredResults = this.filterSubjects(this.subjects);
      this.resultCount = this.filteredResults.length;

      // Emitir evento con resultados filtrados
      this.$emit('filters-applied', {
        filteredSubjects: this.filteredResults,
        filters: { ...this.filters },
        stats: this.filterStats
      });
    },

    /**
     * Filtra los subjects según los criterios actuales
     */
    filterSubjects(subjects) {
      if (!subjects || subjects.length === 0) return [];

      return subjects.filter(subject => {
        // Filtro por texto (código, nombre, título)
        if (this.filters.text.trim()) {
          const searchText = this.normalizeText(this.filters.text);
          const subjectCode = this.normalizeText(`${subject.subject}${subject.courseNumber}`);
          const subjectTitle = this.normalizeText(subject.courseTitle);

          if (!subjectCode.includes(searchText) && !subjectTitle.includes(searchText)) {
            return false;
          }
        }

        // Filtro por materia específica
        if (this.filters.subject && subject.subject !== this.filters.subject) {
          return false;
        }

        // Filtro por campus
        if (this.filters.campus) {
          const hasCoursesInCampus = this.courses.some(course =>
            course.subject === subject.subject &&
            course.courseNumber === subject.courseNumber &&
            course.campusDescription === this.filters.campus
          );

          if (!hasCoursesInCampus) {
            return false;
          }
        }

        // Filtro por disponibilidad
        if (this.filters.availability !== 'all') {
          const isOpen = this.filters.availability === 'open';
          const hasMatchingSections = subject.sections.some(section => section.openSection === isOpen);

          if (!hasMatchingSections) {
            return false;
          }
        }

        // Filtro por profesor
        if (this.filters.professor.trim()) {
          const professorFilter = this.normalizeText(this.filters.professor);
          const hasMatchingProfessor = subject.sections.some(section =>
            this.sectionHasProfessor(section, professorFilter)
          );

          if (!hasMatchingProfessor) {
            return false;
          }
        }

        // Filtro por horario
        if (this.hasScheduleFilters) {
          const hasMatchingSchedule = subject.sections.some(section =>
            this.sectionMatchesSchedule(section)
          );

          if (!hasMatchingSchedule) {
            return false;
          }
        }

        return true;
      });
    },

    /**
     * Normaliza texto para búsqueda
     */
    normalizeText(text) {
      if (!text) return '';
      return text.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    },

    /**
     * Verifica si una sección tiene un profesor específico
     */
    sectionHasProfessor(section, professorFilter) {
      if (!section.meetingsFaculty || !Array.isArray(section.meetingsFaculty)) {
        return false;
      }

      return section.meetingsFaculty.some(meeting => {
        if (!meeting.faculty || !Array.isArray(meeting.faculty)) {
          return false;
        }
        return meeting.faculty.some(faculty =>
          faculty.displayName &&
          this.normalizeText(faculty.displayName).includes(professorFilter)
        );
      });
    },

    /**
     * Verifica si una sección coincide con los filtros de horario
     */
    sectionMatchesSchedule(section) {
      if (!section.meetingsFaculty || !Array.isArray(section.meetingsFaculty)) {
        return false;
      }

      return section.meetingsFaculty.some(meeting => {
        if (!meeting.meetingTime) return false;

        // Verificar días si están especificados
        if (this.filters.schedule.days.length > 0) {
          const dayMapping = {
            'monday': meeting.meetingTime.monday,
            'tuesday': meeting.meetingTime.tuesday,
            'wednesday': meeting.meetingTime.wednesday,
            'thursday': meeting.meetingTime.thursday,
            'friday': meeting.meetingTime.friday,
            'saturday': meeting.meetingTime.saturday,
            'sunday': meeting.meetingTime.sunday
          };

          const hasMatchingDay = this.filters.schedule.days.some(day => dayMapping[day]);
          if (!hasMatchingDay) {
            return false;
          }
        }

        // Verificar rango de tiempo si está especificado
        if (this.filters.schedule.timeRange.start && this.filters.schedule.timeRange.end) {
          return this.timeInRange(
            meeting.meetingTime.beginTime,
            meeting.meetingTime.endTime,
            this.filters.schedule.timeRange.start,
            this.filters.schedule.timeRange.end
          );
        }

        return true;
      });
    },

    /**
     * Verifica si un horario está dentro del rango especificado
     */
    timeInRange(beginTime, endTime, rangeStart, rangeEnd) {
      if (!beginTime || !endTime) return false;

      const toMinutes = timeStr => {
        if (!timeStr) return 0;
        const hours = parseInt(timeStr.substring(0, 2), 10);
        const minutes = parseInt(timeStr.substring(2), 10);
        return hours * 60 + minutes;
      };

      const courseStart = toMinutes(beginTime);
      const courseEnd = toMinutes(endTime);
      const filterStart = toMinutes(rangeStart.replace(':', ''));
      const filterEnd = toMinutes(rangeEnd.replace(':', ''));

      // Verificar si hay superposición
      return (courseStart < filterEnd) && (filterStart < courseEnd);
    },

    /**
     * Limpia un filtro específico
     */
    clearFilter(filterName) {
      const defaultValues = {
        text: '',
        subject: '',
        campus: '',
        schedule: { days: [], timeRange: { start: '', end: '' } },
        availability: 'all',
        professor: ''
      };

      if (defaultValues.hasOwnProperty(filterName)) {
        this.filters[filterName] = defaultValues[filterName];
      }
    },

    /**
     * Limpia todos los filtros
     */
    clearAllFilters() {
      this.filters = {
        text: '',
        subject: '',
        campus: '',
        schedule: { days: [], timeRange: { start: '', end: '' } },
        availability: 'all',
        professor: ''
      };
    },

    /**
     * Alterna la selección de un día
     */
    toggleDay(day) {
      const index = this.filters.schedule.days.indexOf(day);
      if (index >= 0) {
        this.filters.schedule.days.splice(index, 1);
      } else {
        this.filters.schedule.days.push(day);
      }
    },

    /**
     * Verifica si un día está seleccionado
     */
    isDaySelected(day) {
      return this.filters.schedule.days.includes(day);
    },

    /**
     * Guarda un nuevo preset
     */
    savePreset() {
      if (!this.newPresetName.trim()) return;

      const preset = FilterService.savePreset(this.newPresetName.trim(), this.filters);
      this.loadPresets();

      this.newPresetName = '';
      this.showPresetForm = false;

      this.$emit('preset-saved', preset);
    },

    /**
     * Carga un preset
     */
    loadPreset(preset) {
      FilterService.loadPreset(preset);
      this.filters = FilterService.getCurrentFilters();
      this.showPresets = false;

      this.$emit('preset-loaded', preset);
    },

    /**
     * Elimina un preset
     */
    deletePreset(presetId) {
      FilterService.deletePreset(presetId);
      this.loadPresets();

      this.$emit('preset-deleted', presetId);
    },

    /**
     * Carga los presets guardados
     */
    loadPresets() {
      this.presets = FilterService.getPresets();
    },

    /**
     * Alterna la expansión del panel
     */
    toggleExpansion() {
      this.isExpanded = !this.isExpanded;
    },

    /**
     * Alterna la visibilidad de los filtros de horario
     */
    toggleScheduleFilters() {
      this.showScheduleFilters = !this.showScheduleFilters;
    }
  },

  template: `
    <div class="flex-none flex flex-col pt-6 px-6 pb-2 border-b border-slate-200/50 space-y-4 w-full relative z-20 font-display">
      
      <!-- Search Bar -->
      <div class="relative group">
        <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">search</span>
        <input 
          v-model="filters.text"
          class="w-full h-12 pl-12 pr-10 bg-white border border-border-color rounded-full focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400 transition-all outline-none text-primary-text font-medium" 
          placeholder="Buscar por código, nombre o título..." 
          type="text"
        />
        <button v-if="filters.text" @click="clearFilter('text')" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors">
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <!-- Quick Filters Row -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-3">
          
          <!-- Campus Select -->
          <div class="relative">
            <select v-model="filters.campus" class="appearance-none flex items-center gap-2 pl-4 pr-10 py-2 h-10 rounded-full bg-white border border-border-color hover:bg-slate-50 transition-colors text-sm font-medium text-primary-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer">
              <option value="">Sede: Todas</option>
              <option v-for="campus in campuses" :key="campus" :value="campus">{{ campus }}</option>
            </select>
            <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">expand_more</span>
          </div>

          <!-- Availability Select -->
          <div class="relative">
             <select v-model="filters.availability" class="appearance-none flex items-center gap-2 pl-4 pr-10 py-2 h-10 rounded-full bg-white border border-border-color hover:bg-slate-50 transition-colors text-sm font-medium text-primary-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer">
              <option v-for="option in availabilityOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">expand_more</span>
          </div>

        </div>

        <!-- Advanced Toggle & Clear -->
        <div class="flex items-center gap-2">
          <button @click="clearAllFilters" v-if="activeFiltersCount > 0" class="text-xs font-bold text-slate-500 hover:text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px]">delete</span>
            <span class="hidden sm:inline">Limpiar</span>
          </button>
          
          <button @click="toggleExpansion" :class="['flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border', isExpanded ? 'bg-primary/10 text-primary border-primary/20' : 'bg-white text-slate-600 border-border-color hover:bg-slate-50']">
            <span class="material-symbols-outlined text-[18px]">tune</span>
            <span class="hidden sm:inline">Avanzados</span>
            <span v-if="activeFiltersCount > 0" class="bg-primary text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">{{ activeFiltersCount }}</span>
          </button>
        </div>
      </div>

      <!-- Advanced Filters Panel (Collapsible) -->
      <div v-show="isExpanded" class="p-4 bg-slate-50 border border-border-color rounded-2xl mt-3 animate-in fade-in zoom-in-95 duration-200">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <!-- Subject Dropdown -->
          <div>
            <label class="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider pl-1">Departamento</label>
            <div class="relative">
              <select v-model="filters.subject" class="w-full appearance-none flex items-center gap-2 pl-4 pr-10 py-2 h-10 rounded-xl bg-white border border-border-color hover:border-slate-300 transition-colors text-sm font-medium text-primary-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer">
                <option value="">Todos los departamentos</option>
                <option v-for="code in subjectCodes" :key="code" :value="code">{{ code }}</option>
              </select>
              <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">expand_more</span>
            </div>
          </div>
          
          <!-- Professor Input -->
          <div>
            <label class="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider pl-1">Profesor</label>
            <div class="relative group">
              <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors text-[18px]">person</span>
              <input 
                v-model="filters.professor"
                class="w-full h-10 pl-9 pr-10 bg-white border border-border-color rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400 transition-all outline-none text-primary-text text-sm font-medium" 
                placeholder="Buscar por nombre..." 
                type="text"
              />
              <button v-if="filters.professor" @click="clearFilter('professor')" class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors">
                <span class="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Presets Row -->
        <div class="mt-4 pt-4 border-t border-border-color flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2 overflow-x-auto pb-1 flex-1 min-w-0" style="scrollbar-width: none;">
             <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 flex-none">PRESETS:</span>
             <button v-if="presets.length === 0" class="text-xs text-slate-400 italic px-2 flex-none cursor-default">Ninguno</button>
             
             <div v-for="preset in presets" :key="preset.id" class="flex-none flex items-center bg-white hover:bg-slate-50 border border-border-color rounded-lg text-xs font-medium text-primary-text transition-colors group">
                <button @click="loadPreset(preset)" class="px-2.5 py-1.5">{{ preset.name }}</button>
                <button @click="deletePreset(preset.id)" class="px-1.5 py-1.5 text-slate-400 hover:text-rose-500 border-l border-border-color opacity-50 hover:opacity-100 transition-opacity" title="Eliminar preset">
                  <span class="material-symbols-outlined text-[14px]">close</span>
                </button>
             </div>
          </div>
          
          <div class="flex items-center gap-2 flex-none">
            <input 
              v-if="showPresetForm"
              v-model="newPresetName"
              type="text" 
              class="h-8 w-32 px-3 bg-white border border-border-color rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400 transition-all outline-none text-primary-text text-xs font-medium" 
              placeholder="Nombre..."
              @keyup.enter="savePreset"
            >
            <button v-if="showPresetForm" @click="savePreset" :disabled="!newPresetName.trim()" class="h-8 px-3 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Guardar</button>
            <button v-if="showPresetForm" @click="showPresetForm = false; newPresetName = ''" class="h-8 px-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"><span class="material-symbols-outlined text-[16px] block">close</span></button>
            
            <button v-if="!showPresetForm" @click="showPresetForm = true" class="flex items-center gap-1 h-8 px-3 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-lg transition-colors border border-border-color">
              <span class="material-symbols-outlined text-[14px]">add</span> <span class="hidden sm:inline">Guardar Actual</span>
            </button>
          </div>
        </div>
      </div>
      
      <!-- Filter Stats (Subtle) -->
      <div class="px-2 pt-2 pb-0 opacity-80">
        <p class="text-[11px] font-bold text-slate-400 flex items-center justify-between w-full">
          <span>Mostrando {{ resultCount }} de {{ subjects.length }} materias</span>
          <span v-if="filterStats.percentage < 100" class="text-primary">{{ filterStats.percentage }}% del catálogo</span>
        </p>
      </div>

    </div>
  `
};