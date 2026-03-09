import { createApp } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import CourseList from './components/CourseList.js';
import SubjectSelector from './components/SubjectSelector.js';
import SectionSelector from './components/SectionSelector.js';
import SelectionPanel from './components/SelectionPanel.js';
import ScheduleResults from './components/ScheduleResults.js';
import UIStateService from './services/UIStateService.js';
import ShareService from './services/ShareService.js';
import CourseService from './services/CourseService.js';

const app = createApp({
  components: {
    CourseList,
    SubjectSelector,
    SectionSelector,
    SelectionPanel,
    ScheduleResults
  },

  data() {
    return {
      currentView: 'hybrid-selector',
      generatedSchedules: null,
      showAdvancedOptions: false,
      uiState: UIStateService,
      selectedItems: [],
      onlyOpenSections: true,
      selectedCampus: ''
    };
  },

  watch: {
    generatedSchedules: {
      handler(schedules) {
        if (schedules) {
          this.uiState.saveSelectedSchedule(schedules);
        }
      },
      deep: true
    },
    'uiState._state.viewState.selectedItems': {
      handler(items) {
        this.selectedItems = items;
      },
      deep: true,
      immediate: true
    },
    'uiState._state.viewState.onlyOpenSections': {
      handler(value) {
        this.onlyOpenSections = value;
      },
      immediate: true
    },
    'uiState._state.viewState.selectedCampus': {
      handler(value) {
        this.selectedCampus = value;
      },
      immediate: true
    },
    selectedItems: {
      handler(items) {
        // Auto-save to localStorage when selections change
        if (items && Array.isArray(items)) {
          this.uiState.saveSelections(items, {
            onlyOpenSections: this.onlyOpenSections,
            selectedCampus: this.selectedCampus
          });
        }
      },
      deep: true
    }
  },

  computed: {
    totalCredits() {
      let credits = 0;
      if (!this.selectedItems || !Array.isArray(this.selectedItems)) return 0;
      this.selectedItems.forEach(item => {
        if (item.type === 'subject' && item.item && item.item.creditHourLow) {
          credits += parseInt(item.item.creditHourLow);
        } else if (item.type === 'section' && item.subjectInfo && item.subjectInfo.creditHourLow) {
          credits += parseInt(item.subjectInfo.creditHourLow);
        }
      });
      return credits;
    },
    totalHours() {
      // Approximate hours assuming 1.5 multiplier
      return Math.round(this.totalCredits * 1.5);
    },
    freeDays() {
      // Placeholder for now
      return 0;
    },
    activeCampus() {
      return this.selectedCampus ? this.selectedCampus : "Todas";
    }
  },

  mounted() {
    this.uiState.init();

    const savedSelections = this.uiState.loadSelections();
    if (savedSelections && savedSelections.items) {
      console.log('[App] Restoring selections from localStorage');
      this.uiState.updateViewState({
        selectedItems: savedSelections.items
      });
    }

    const sharedState = ShareService.decodeFromUrl();
    if (sharedState && sharedState.selectedItems && sharedState.selectedItems.length > 0) {
      console.log('[App] Restoring from shared URL:', sharedState);

      // Check if CourseService has data loaded
      const hasCourseData = CourseService.getAllCourses && CourseService.getAllCourses().length > 0;

      if (hasCourseData) {
        this._restoreFromSharedState(sharedState);
      } else {
        // Wait for course data to load, then restore
        console.log('[App] Waiting for course data to load...');
        const checkInterval = setInterval(() => {
          if (CourseService.getAllCourses().length > 0) {
            clearInterval(checkInterval);
            this._restoreFromSharedState(sharedState);
          }
        }, 500);

        // Timeout after 10 seconds
        setTimeout(() => clearInterval(checkInterval), 10000);
      }
    }

    window.addEventListener('horarios:selections-changed', (event) => {
      console.log('[App] Detected external selections change');
      if (event.detail) {
        this.uiState.updateViewState({
          selectedItems: event.detail.items
        });
      }
    });
  },

  methods: {
    handleSchedulesGenerated(schedules) {
      this.generatedSchedules = schedules;
    },

    toggleAdvancedOptions() {
      this.showAdvancedOptions = !this.showAdvancedOptions;
    },

    showNotification(message, type = 'info') {
      const toast = document.createElement('div');
      toast.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'} border-0`;
      toast.setAttribute('role', 'alert');
      toast.setAttribute('aria-live', 'assertive');
      toast.setAttribute('aria-atomic', 'true');
      toast.style.position = 'fixed';
      toast.style.top = '20px';
      toast.style.right = '20px';
      toast.style.zIndex = '9999';
      toast.innerHTML = `
        <div class="d-flex">
          <div class="toast-body">${message}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
      `;
      document.body.appendChild(toast);

      const bsToast = new bootstrap.Toast(toast);
      bsToast.show();

      setTimeout(() => {
        toast.remove();
      }, 5000);
    },

    _restoreFromSharedState(sharedState) {
      console.log('[App] _restoreFromSharedState called with:', sharedState);

      // Decode the selectedItems from URL format to app format
      const items = sharedState.selectedItems || [];
      const restoredItems = items.map(item => {
        const course = CourseService.getSubjectById(item.subjectId);
        if (!course) {
          console.warn('[App] Course not found:', item.subjectId);
          return null;
        }
        return {
          type: 'subject',
          selectionType: item.selectionType || 'priority',
          item: course,
          subjectInfo: null
        };
      }).filter(item => item !== null);

      console.log('[App] Restored items:', restoredItems);

      this.uiState.updateViewState({
        selectedItems: restoredItems,
        onlyOpenSections: sharedState.onlyOpenSections ?? true,
        selectedCampus: sharedState.selectedCampus ?? ''
      });

      ShareService.cleanUrl();
      this.showNotification(`Horario restaurado: ${restoredItems.length} materias`, 'success');
    }
  },

  template: `
    <div class="flex flex-col h-screen relative bg-transparent w-full font-display">
      <header class="flex-none flex flex-wrap items-center justify-between border-b border-slate-200/50 bg-white/70 backdrop-blur-md px-6 py-3 md:px-8 md:py-4 z-10 shadow-sm gap-4">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center size-10 rounded-full bg-primary/10 text-primary hidden sm:flex">
            <span class="material-symbols-outlined text-2xl">school</span>
          </div>
          <h1 class="text-xl font-bold tracking-tight text-slate-800 hidden sm:block">Planificador de Horarios UCAB</h1>
          <h1 class="text-xl font-bold tracking-tight text-slate-800 sm:hidden">Planificador UCAB</h1>
        </div>
        
        <!-- Stats Bar -->
        <div class="flex flex-wrap items-center justify-center gap-4 sm:gap-6 bg-white/80 px-5 sm:px-8 py-2 rounded-full border border-slate-200 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)]">
          <div class="flex flex-col items-center">
            <span class="text-[9px] sm:text-[10px] font-bold text-slate-400 tracking-wider">CRÉDITOS</span>
            <span class="text-xs sm:text-sm font-bold text-slate-800">{{ totalCredits }} UC</span>
          </div>
          <div class="w-px h-6 bg-slate-200"></div>
          <div class="flex flex-col items-center hidden sm:flex">
            <span class="text-[10px] font-bold text-slate-400 tracking-wider">HORAS</span>
            <span class="text-sm font-bold text-slate-800">{{ totalHours }} hrs</span>
          </div>
          <div class="w-px h-6 bg-slate-200 hidden sm:block"></div>
          <div class="flex flex-col items-center">
            <span class="text-[9px] sm:text-[10px] font-bold text-slate-400 tracking-wider">SEDE</span>
            <span class="text-xs sm:text-sm font-bold text-slate-800">{{ activeCampus }}</span>
          </div>
        </div>

        <div class="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
          <span class="material-symbols-outlined text-sm sm:text-base">check_circle</span>
          <span class="text-xs sm:text-sm font-semibold hidden lg:block">Datos Integrados</span>
        </div>
      </header>
      
      <main class="flex-1 flex flex-col lg:flex-row overflow-hidden p-0 lg:p-0 gap-4 lg:gap-6 w-full max-w-[1800px] mx-auto relative z-10">
        <!-- Main Hybrid Selector -->
        <div class="w-full lg:w-[45%] flex flex-col bg-panel-bg border border-border-color rounded-2xl shadow-panel overflow-hidden flex-none">
          <section-selector @schedules-generated="handleSchedulesGenerated" />
        </div>
        
        <div class="w-full lg:w-[55%] flex flex-col bg-panel-bg border border-border-color rounded-2xl shadow-panel overflow-hidden relative">
          <schedule-results 
            :generated-schedules="generatedSchedules"
            :selected-items="selectedItems"
            :only-open-sections="onlyOpenSections"
            :selected-campus="selectedCampus"
          />
        </div>
      </main>

      <!-- Advanced Options Toggle -->
      <button v-if="!showAdvancedOptions" @click="toggleAdvancedOptions" class="fixed bottom-6 right-6 bg-slate-800 text-white p-3 rounded-full shadow-lg hover:bg-slate-700 transition-all hover:scale-105 active:scale-95 flex items-center justify-center z-50 group" title="Opciones Avanzadas">
        <span class="material-symbols-outlined group-hover:rotate-45 transition-transform duration-300">settings</span>
      </button>

      <!-- Advanced Options Panel -->
      <div v-if="showAdvancedOptions" class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
          <div class="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 class="text-lg font-bold flex items-center gap-2 text-slate-800">
              <span class="material-symbols-outlined text-primary">manufacturing</span>
              Opciones Avanzadas
            </h3>
            <button @click="toggleAdvancedOptions" class="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          
          <div class="flex p-4 border-b border-slate-100 gap-2 bg-white">
            <button 
              @click="currentView = 'subject-selector'" 
              :class="['px-5 py-2.5 rounded-xl font-medium text-sm transition-all', currentView === 'subject-selector' ? 'bg-primary text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100']"
            >
              Selección por Materias
            </button>
            <button 
              @click="currentView = 'course-list'" 
              :class="['px-5 py-2.5 rounded-xl font-medium text-sm transition-all', currentView === 'course-list' ? 'bg-primary text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100']"
            >
              Lista de Cursos
            </button>
          </div>
          
          <div class="p-6 overflow-y-auto flex-1 bg-slate-50/50">
            <div v-if="currentView === 'subject-selector'">
               <subject-selector @schedules-generated="handleSchedulesGenerated" />
            </div>
            <div v-else-if="currentView === 'course-list'">
              <course-list></course-list>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
});

app.mount('#app');
