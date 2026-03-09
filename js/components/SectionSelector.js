import CourseService from '../services/CourseService.js';
import ScheduleGeneratorService from '../services/ScheduleGeneratorService.js';
import SubjectCard from './SubjectCard.js';
import FilterPanel from './FilterPanel.js';
import SelectionPanel from './SelectionPanel.js';
import AnimationService from '../services/AnimationService.js';

export default {
  components: {
    SubjectCard,
    FilterPanel,
    SelectionPanel
  },

  data() {
    return {
      courses: [],
      subjects: [],
      filteredSubjects: [],
      selectedItems: [], // Array de objetos { type: 'subject'|'section', item, selectionType, subjectInfo? }
      selectionMode: 'priority', // Puede ser 'priority' o 'candidate'
      selectionType: 'subject', // Puede ser 'subject' o 'section'
      loading: true,
      error: null,
      filters: {
        subject: '',
        courseNumber: '',
        search: '',
        campus: ''
      },
      subjectCodes: [],
      campuses: [],
      onlyOpenSections: true,
      generatingSchedules: false,
      generatedSchedules: null,
      selectedCampus: '',
      expandedSubjects: new Set() // Para controlar qué materias están expandidas
    };
  },

  async mounted() {
    try {
      this.loading = true;

      // Initialize animation service
      AnimationService.init();

      this.courses = await CourseService.loadCourses();
      this.subjects = ScheduleGeneratorService.groupCoursesBySubject(this.courses);
      this.filteredSubjects = [...this.subjects];
      this.initializeFilters();

      // Animate initial load
      this.$nextTick(() => {
        const subjectCards = document.querySelectorAll('.subject-card');
        subjectCards.forEach((card, index) => {
          setTimeout(() => {
            card.classList.add('animate-fade-in');
          }, index * 50);
        });
      });

    } catch (error) {
      this.error = `Error al cargar los cursos: ${error.message}`;
      console.error(error);
    } finally {
      this.loading = false;
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
    }
  },

  methods: {
    // FilterPanel event handlers
    onFiltersApplied(data) {
      this.filteredSubjects = data.filteredSubjects;

      // Emit event for parent components if needed
      this.$emit('subjects-filtered', {
        filteredSubjects: data.filteredSubjects,
        filters: data.filters,
        stats: data.stats
      });
    },

    onPresetSaved(preset) {
      // Handle preset saved event
      console.log('Preset guardado:', preset.name);
    },

    onPresetLoaded(preset) {
      // Handle preset loaded event
      console.log('Preset cargado:', preset.name);
    },

    onPresetDeleted(presetId) {
      // Handle preset deleted event
      console.log('Preset eliminado:', presetId);
    },

    normalizeText(text) {
      if (!text) return '';
      return text.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    },

    initializeFilters() {
      this.subjectCodes = [...new Set(this.subjects.map(subject => subject.subject))].sort();

      const allCampuses = new Set();
      this.courses.forEach(course => {
        if (course.campusDescription && course.campusDescription.trim()) {
          allCampuses.add(course.campusDescription);
        }
      });
      this.campuses = [...allCampuses].sort();
    },



    async toggleSubjectExpansion(subjectId) {
      const isExpanded = this.expandedSubjects.has(subjectId);

      if (isExpanded) {
        // Animate collapse
        const sectionsContainer = document.querySelector(`[data-subject-id="${subjectId}"] .subject-card__sections`);
        if (sectionsContainer) {
          sectionsContainer.classList.add('subject-card__sections--collapsing');
          await AnimationService.expandCollapse(sectionsContainer, false);
          sectionsContainer.classList.remove('subject-card__sections--collapsing');
        }
        this.expandedSubjects.delete(subjectId);
      } else {
        // Animate expand
        this.expandedSubjects.add(subjectId);
        this.$nextTick(async () => {
          const sectionsContainer = document.querySelector(`[data-subject-id="${subjectId}"] .subject-card__sections`);
          if (sectionsContainer) {
            sectionsContainer.classList.add('subject-card__sections--expanding');
            await AnimationService.expandCollapse(sectionsContainer, true);
            sectionsContainer.classList.remove('subject-card__sections--expanding');
          }
        });
      }
    },

    isSubjectExpanded(subjectId) {
      return this.expandedSubjects.has(subjectId);
    },

    // Método para seleccionar una materia completa
    async toggleSubjectSelection(subject) {
      const subjectId = subject.id;
      const index = this.selectedItems.findIndex(item =>
        item.type === 'subject' && item.item.id === subjectId
      );

      // Find the subject card element for animation
      const subjectCard = document.querySelector(`[data-subject-id="${subjectId}"]`);

      if (index === -1) {
        // Add selection with animation
        this.selectedItems.push({
          type: 'subject',
          item: subject,
          selectionType: this.selectionMode
        });

        if (subjectCard) {
          subjectCard.classList.add('subject-card--state-changing');
          await AnimationService.bounce(subjectCard, { scale: 1.02 });
          subjectCard.classList.remove('subject-card--state-changing');
        }
      } else {
        // Remove selection with animation
        if (subjectCard) {
          subjectCard.classList.add('subject-card--state-changing');
          await AnimationService.fade(subjectCard, false, { duration: 200 });
          await AnimationService.fade(subjectCard, true, { duration: 200 });
          subjectCard.classList.remove('subject-card--state-changing');
        }
        this.selectedItems.splice(index, 1);
      }
    },

    // Método para seleccionar una sección específica
    async toggleSectionSelection(section, subject) {
      const sectionId = section.id;
      const index = this.selectedItems.findIndex(item =>
        item.type === 'section' && item.item.id === sectionId
      );

      // Find the section card element for animation
      const sectionCard = document.querySelector(`[data-section-id="${sectionId}"]`);

      if (index === -1) {
        // Add selection with animation
        this.selectedItems.push({
          type: 'section',
          item: section,
          selectionType: this.selectionMode,
          subjectInfo: {
            id: subject.id,
            subject: subject.subject,
            courseNumber: subject.courseNumber,
            courseTitle: subject.courseTitle,
            creditHourLow: subject.creditHourLow
          }
        });

        if (sectionCard) {
          await AnimationService.slide(sectionCard, 'right', true, { distance: 20 });
        }
      } else {
        // Remove selection with animation
        if (sectionCard) {
          await AnimationService.slide(sectionCard, 'left', false, { distance: 20 });
        }
        this.selectedItems.splice(index, 1);
      }
    },

    async toggleSelectionType(index) {
      if (index >= 0 && index < this.selectedItems.length) {
        const item = this.selectedItems[index];
        const currentType = item.selectionType;

        // Find the corresponding card element
        const cardSelector = item.type === 'subject'
          ? `[data-subject-id="${item.item.id}"]`
          : `[data-section-id="${item.item.id}"]`;
        const cardElement = document.querySelector(cardSelector);

        // Animate state change
        if (cardElement) {
          cardElement.classList.add('subject-card--state-changing');
          await AnimationService.stateTransition(cardElement,
            `selected-${currentType}`,
            `selected-${currentType === 'priority' ? 'candidate' : 'priority'}`
          );
          cardElement.classList.remove('subject-card--state-changing');
        }

        this.selectedItems[index].selectionType = currentType === 'priority' ? 'candidate' : 'priority';
      }
    },

    isSubjectSelected(subjectId) {
      return this.selectedItems.some(item =>
        item.type === 'subject' && item.item.id === subjectId
      );
    },

    isSectionSelected(sectionId) {
      return this.selectedItems.some(item =>
        item.type === 'section' && item.item.id === sectionId
      );
    },

    getSelectionType(itemId, type) {
      const item = this.selectedItems.find(item =>
        item.type === type && item.item.id === itemId
      );
      return item ? item.selectionType : null;
    },



    countOpenSections(subject) {
      return subject.sections.filter(section => section.openSection).length;
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

      const professors = section.meetingsFaculty
        .map(meeting => {
          if (meeting.faculty && meeting.faculty.displayName) {
            return meeting.faculty.displayName;
          }
          return null;
        })
        .filter(prof => prof)
        .filter((prof, index, arr) => arr.indexOf(prof) === index); // Remove duplicates

      if (professors.length === 0) {
        return 'Sin profesor asignado';
      }

      return professors.join(', ');
    },

    async generateSchedules() {
      this.generatingSchedules = true;

      // Show loading indicator
      const generateButton = document.querySelector('.btn-primary[data-action="generate"]');
      let loadingIndicator = null;

      if (generateButton) {
        loadingIndicator = AnimationService.createLoadingIndicator(generateButton.parentElement, {
          type: 'spinner',
          text: 'Generando horarios',
          size: 'small'
        });
      }

      try {
        // Add a small delay to show the loading animation
        await new Promise(resolve => setTimeout(resolve, 300));

        // Procesar materias completas seleccionadas
        const prioritySubjects = this.prioritySubjects.map(item => item.item);
        const candidateSubjects = this.candidateSubjects.map(item => item.item);

        // Procesar secciones específicas seleccionadas
        const prioritySections = this.prioritySections;
        const candidateSections = this.candidateSections;

        // Agrupar secciones específicas por materia
        const groupedPrioritySections = this.groupSectionsBySubject(prioritySections);
        const groupedCandidateSections = this.groupSectionsBySubject(candidateSections);

        // Combinar materias completas con secciones específicas
        const finalPrioritySubjects = this.combineSubjectsAndSections(prioritySubjects, groupedPrioritySections);
        const finalCandidateSubjects = this.combineSubjectsAndSections(candidateSubjects, groupedCandidateSections);

        this.generatedSchedules = ScheduleGeneratorService.generatePossibleSchedulesWithCandidates(
          finalPrioritySubjects,
          finalCandidateSubjects,
          this.onlyOpenSections,
          this.selectedCampus
        );

        this.$emit('schedules-generated', this.generatedSchedules);

        // Animate success
        if (generateButton) {
          await AnimationService.bounce(generateButton, { scale: 1.05 });
        }

      } catch (error) {
        console.error('Error generando horarios:', error);
        this.error = `Error al generar horarios: ${error.message}`;

        // Animate error
        if (generateButton) {
          generateButton.classList.add('btn-danger');
          await AnimationService.pulse(generateButton, { opacity: 0.7 });
          setTimeout(() => {
            generateButton.classList.remove('btn-danger');
          }, 2000);
        }
      } finally {
        this.generatingSchedules = false;

        // Remove loading indicator
        if (loadingIndicator) {
          loadingIndicator.remove();
        }
      }
    },

    groupSectionsBySubject(sections) {
      const grouped = {};
      sections.forEach(item => {
        const subjectKey = `${item.subjectInfo.subject}${item.subjectInfo.courseNumber}`;
        if (!grouped[subjectKey]) {
          grouped[subjectKey] = {
            id: subjectKey,
            subject: item.subjectInfo.subject,
            courseNumber: item.subjectInfo.courseNumber,
            courseTitle: item.subjectInfo.courseTitle,
            creditHourLow: item.subjectInfo.creditHourLow,
            sections: [],
            isSpecificSections: true // Marcar que estas son secciones específicas seleccionadas
          };
        }
        grouped[subjectKey].sections.push(item.item);
      });
      return Object.values(grouped);
    },

    combineSubjectsAndSections(subjects, groupedSections) {
      const result = [...subjects];

      // Agregar materias que solo tienen secciones específicas
      groupedSections.forEach(sectionSubject => {
        const existingSubject = result.find(subject => subject.id === sectionSubject.id);
        if (existingSubject) {
          // Si ya existe la materia, reemplazar sus secciones con las específicas seleccionadas
          existingSubject.sections = sectionSubject.sections;
          existingSubject.isSpecificSections = true; // Marcar que son secciones específicas
        } else {
          // Si no existe, agregar la materia con sus secciones específicas
          sectionSubject.isSpecificSections = true; // Marcar que son secciones específicas
          result.push(sectionSubject);
        }
      });

      return result;
    },

    // SelectionPanel event handlers
    onToggleSelectionType(item) {
      const index = this.selectedItems.indexOf(item);
      this.toggleSelectionType(index);
    },

    onRemoveItem(item) {
      if (item.type === 'subject') {
        this.toggleSubjectSelection(item.item);
      } else if (item.type === 'section') {
        this.toggleSectionSelection(item.item, item.subjectInfo);
      }
    },

    onBulkChangeType(items, newType) {
      items.forEach(item => {
        if (item.selectionType !== newType) {
          const index = this.selectedItems.indexOf(item);
          this.toggleSelectionType(index);
        }
      });
    },

    onClearAll() {
      // Create a copy to avoid modifying array while iterating
      const itemsToRemove = [...this.selectedItems];
      itemsToRemove.forEach(item => {
        this.onRemoveItem(item);
      });
    },

    onGenerateSchedules() {
      this.generateSchedules();
    },

    formatSubjectSections(subject) {
      const totalSections = subject.sections.length;
      const openSections = this.countOpenSections(subject);

      const nrcs = subject.sections.slice(0, 2)
        .map(section => section.courseReferenceNumber)
        .filter(Boolean)
        .join(", ");

      return `${openSections} de ${totalSections} secciones abiertas${nrcs ? ` (NRCs: ${nrcs}${subject.sections.length > 2 ? '...' : ''})` : ''}`;
    }
  },

  template: `
    <div class="flex flex-col h-full w-full font-display bg-transparent relative">
      <div v-if="loading" class="flex-1 flex flex-col items-center justify-center min-h-[400px]">
        <span class="material-symbols-outlined text-4xl text-primary animate-spin">sync</span>
        <span class="mt-4 text-slate-500 font-bold tracking-wide animate-pulse">Cargando materias...</span>
      </div>
      
      <div v-else-if="error" class="m-6 p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 shadow-sm flex flex-col items-center justify-center text-center">
        <span class="material-symbols-outlined text-3xl mb-2">error</span>
        <h3 class="font-bold mb-1">Error de carga</h3>
        <p class="text-sm font-medium">{{ error }}</p>
      </div>
      
      <div v-else class="flex flex-col h-full w-full absolute inset-0">
        <!-- 1. FilterPanel -->
        <FilterPanel
          :subjects="subjects"
          :courses="courses"
          :campuses="campuses"
          :subject-codes="subjectCodes"
          @filters-applied="onFiltersApplied"
          @preset-saved="onPresetSaved"
          @preset-loaded="onPresetLoaded"
          @preset-deleted="onPresetDeleted"
        />

        <!-- 2. Mode Controls -->
        <div class="flex-none px-6 py-4 bg-slate-50 border-b border-border-color z-10 shadow-sm">
          <div class="flex flex-col sm:flex-row gap-4 mb-2">
            
            <div class="flex-1">
              <label class="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest flex items-center gap-1 pl-1">
                <span class="material-symbols-outlined text-[14px]">touch_app</span> Modo de Selección
              </label>
              <div class="flex bg-slate-200 p-1 rounded-xl shadow-inner">
                <button 
                  @click="selectionType = 'subject'" 
                  :class="['flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all duration-200', selectionType === 'subject' ? 'bg-white text-primary-text shadow-sm border border-border-color' : 'text-slate-500 hover:text-primary-text hover:bg-slate-300 border border-transparent']"
                >
                  <span class="material-symbols-outlined text-[16px]">library_books</span> <span class="truncate">Materias</span>
                </button>
                <button 
                  @click="selectionType = 'section'" 
                  :class="['flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all duration-200', selectionType === 'section' ? 'bg-white text-primary-text shadow-sm border border-border-color' : 'text-slate-500 hover:text-primary-text hover:bg-slate-300 border border-transparent']"
                >
                  <span class="material-symbols-outlined text-[16px]">list_alt</span> <span class="truncate">Secciones</span>
                </button>
              </div>
            </div>

            <div class="flex-1">
              <label class="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest flex items-center gap-1 pl-1">
                <span class="material-symbols-outlined text-[14px]">flag</span> Nivel de Prioridad
              </label>
              <div class="flex bg-slate-200 p-1 rounded-xl shadow-inner">
                <button 
                  @click="selectionMode = 'priority'" 
                  :class="['flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all duration-200', selectionMode === 'priority' ? 'bg-red-50 text-red-700 shadow-sm border border-red-200' : 'text-slate-500 hover:text-red-600 hover:bg-red-50 border border-transparent']"
                >
                  <span class="material-symbols-outlined text-[16px]" :class="selectionMode === 'priority' ? 'text-red-500' : ''">error</span> <span class="truncate">Prioritaria</span>
                </button>
                <button 
                  @click="selectionMode = 'candidate'" 
                  :class="['flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all duration-200', selectionMode === 'candidate' ? 'bg-amber-50 text-amber-700 shadow-sm border border-amber-200' : 'text-slate-500 hover:text-amber-600 hover:bg-amber-50 border border-transparent']"
                >
                  <span class="material-symbols-outlined text-[16px]" :class="selectionMode === 'candidate' ? 'text-amber-500' : ''">star</span> <span class="truncate">Candidata</span>
                </button>
              </div>
            </div>

          </div>
        </div>
        
        <!-- 3. Scrollable Subject List -->
        <div class="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50" style="scrollbar-color: #cbd5e1 transparent; scrollbar-width: thin;">
          <div v-if="filteredSubjects.length === 0" class="flex flex-col items-center justify-center py-12 text-center h-full">
            <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400 animate-pulse">
               <span class="material-symbols-outlined text-3xl">search_off</span>
            </div>
            <h5 class="text-primary-text font-bold mb-1">No hay materias disponibles</h5>
            <p class="text-slate-500 text-sm max-w-[250px] leading-relaxed">Intenta modificar tus filtros de búsqueda para encontrar lo que necesitas.</p>
          </div>
          
          <div v-else class="space-y-4 pb-4">
            <SubjectCard
              v-for="subject in filteredSubjects" 
              :key="subject.id"
              :subject="subject"
              :is-selected="isSubjectSelected(subject.id)"
              :selection-type="getSelectionType(subject.id, 'subject')"
              :is-expanded="isSubjectExpanded(subject.id)"
              :selection-mode="selectionType"
              :only-open-sections="onlyOpenSections"
              :selected-sections="selectedItems"
              :data-subject-id="subject.id"
              class="animate-in fade-in slide-in-from-bottom-2 duration-300"
              @toggle-selection="toggleSubjectSelection"
              @toggle-expansion="toggleSubjectExpansion"
              @section-selection="toggleSectionSelection"
            />
          </div>
        </div>
        
        <!-- 4. Bottom Selection & Generation Panel -->
        <SelectionPanel
          class="flex-none bg-white border-t border-border-color shadow-[0_-10px_30px_rgba(0,0,0,0.03)] z-20"
          :selected-items="selectedItems"
          :only-open-sections.sync="onlyOpenSections"
          :selected-campus.sync="selectedCampus"
          :campuses="campuses"
          :generating-schedules="generatingSchedules"
          @toggle-selection-type="onToggleSelectionType"
          @remove-item="onRemoveItem"
          @bulk-change-type="onBulkChangeType"
          @clear-all="onClearAll"
          @generate-schedules="onGenerateSchedules"
          @update:onlyOpenSections="onlyOpenSections = $event"
          @update:selectedCampus="selectedCampus = $event"
        />
      </div>
    </div>
  `
};
