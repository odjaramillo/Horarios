import { createApp } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import CourseList from './components/CourseList.js';
import SubjectSelector from './components/SubjectSelector.js';
import SectionSelector from './components/SectionSelector.js';
import SelectionPanel from './components/SelectionPanel.js';
import ScheduleResults from './components/ScheduleResults.js';
import UIStateService from './services/UIStateService.js';
import ShareService from './services/ShareService.js';

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
    if (sharedState) {
      console.log('[App] Restoring from shared URL');
      this.uiState.updateViewState({
        selectedItems: sharedState.selectedItems,
        onlyOpenSections: sharedState.onlyOpenSections,
        selectedCampus: sharedState.selectedCampus
      });
      ShareService.cleanUrl();
      this.showNotification('Horario restaurado desde URL compartida', 'success');
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
    }
  },
  
  template: `
    <div class="app-container">
      <header class="app-header">
        <div class="header-content">
          <div class="header-main">
            <h1 class="app-title">📚 Planificador de Horarios UCAB</h1>
            <p class="app-subtitle">Selecciona materias y secciones para generar tu horario ideal</p>
          </div>
          <div class="header-status">
            <span class="status-badge integrated" title="Datos integrados desde HTML y JSON">
              <i class="fas fa-database"></i> Datos Integrados
            </span>
          </div>
        </div>
      </header>
      
      <div class="app-main">
        <!-- Main Hybrid Selector -->
        <div class="main-content">
          <div class="content-grid">
            <div class="selector-column">
              <section-selector @schedules-generated="handleSchedulesGenerated" />
            </div>
            <div class="results-column">
              <schedule-results 
                :generated-schedules="generatedSchedules"
                :selected-items="selectedItems"
                :only-open-sections="onlyOpenSections"
                :selected-campus="selectedCampus"
              />
            </div>
          </div>
        </div>
        
        <!-- Advanced Options (Collapsible) -->
        <div class="advanced-options" v-if="showAdvancedOptions">
          <div class="advanced-header">
            <h3>🔧 Opciones Avanzadas</h3>
            <button @click="toggleAdvancedOptions" class="btn-close-advanced">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="advanced-content">
            <div class="advanced-tabs">
              <button 
                @click="currentView = 'subject-selector'" 
                :class="['advanced-tab', currentView === 'subject-selector' ? 'active' : '']"
              >
                <i class="fas fa-book"></i>
                Selección por Materias
              </button>
              <button 
                @click="currentView = 'course-list'" 
                :class="['advanced-tab', currentView === 'course-list' ? 'active' : '']"
              >
                <i class="fas fa-list"></i>
                Lista de Cursos
              </button>
            </div>
            
            <div class="advanced-view">
              <div v-if="currentView === 'subject-selector'" class="legacy-view">
                <div class="legacy-grid">
                  <div class="legacy-selector">
                    <subject-selector @schedules-generated="handleSchedulesGenerated" />
                  </div>
                  <div class="legacy-results">
                    <schedule-results 
                      :generated-schedules="generatedSchedules"
                      :selected-items="selectedItems"
                      :only-open-sections="onlyOpenSections"
                      :selected-campus="selectedCampus"
                    />
                  </div>
                </div>
              </div>
              
              <div v-else-if="currentView === 'course-list'" class="legacy-view">
                <course-list></course-list>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Toggle Advanced Options Button -->
        <div class="advanced-toggle" v-if="!showAdvancedOptions">
          <button @click="toggleAdvancedOptions" class="btn-advanced-toggle">
            <i class="fas fa-cog"></i>
            Opciones Avanzadas
          </button>
        </div>
      </div>
    </div>
  `
});

app.mount('#app');
