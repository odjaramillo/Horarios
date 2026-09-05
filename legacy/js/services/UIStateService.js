/**
 * Servicio para gestión de estado de la interfaz del modo híbrido
 * Maneja el estado de la UI, preferencias de usuario y persistencia de sesión
 */
export default {
  // Keys for selections persistence
  SELECTION_STORAGE_KEYS: {
    SELECTIONS: 'horarios_selections',
    SELECTED_SCHEDULE: 'horarios_selected_schedule',
    LAST_GENERATED: 'horarios_last_generated'
  },

  // Estado interno del servicio
  _state: {
    viewState: {
      selectedMode: 'subjects', // 'subjects' | 'sections'
      expandedSubjects: new Set(),
      selectedItems: {
        priority: [],
        candidate: []
      },
      filterPanelVisible: true,
      selectionPanelVisible: true,
      helpPanelVisible: false,
      onboardingCompleted: false
    },
    userPreferences: {
      theme: 'light',
      compactView: false,
      autoSave: true,
      showTooltips: true,
      animationsEnabled: true,
      defaultCampus: '',
      onlyOpenSections: true
    },
    sessionData: {
      lastActivity: Date.now(),
      searchHistory: [],
      recentSelections: []
    }
  },

  // Listeners para cambios de estado
  _listeners: new Map(),

  /**
   * Inicializa el servicio de estado de UI
   */
  init() {
    this.loadUserPreferences();
    this.loadSessionData();
    this._setupAutoSave();
    this._trackActivity();
    this.setupStorageSync();
  },

  /**
   * Obtiene el estado actual de la vista
   * @return {Object} Estado actual de la vista
   */
  getViewState() {
    return { ...this._state.viewState };
  },

  /**
   * Actualiza el estado de la vista
   * @param {Object} newState - Nuevo estado a aplicar
   */
  updateViewState(newState) {
    const oldState = { ...this._state.viewState };
    this._state.viewState = { ...this._state.viewState, ...newState };
    
    // Notificar a los listeners
    this._notifyListeners('viewState', this._state.viewState, oldState);
    
    // Auto-guardar si está habilitado
    if (this._state.userPreferences.autoSave) {
      this._saveSessionData();
    }
  },

  /**
   * Cambia el modo de selección (materias/secciones)
   * @param {String} mode - Nuevo modo ('subjects' | 'sections')
   */
  setSelectionMode(mode) {
    if (['subjects', 'sections'].includes(mode)) {
      this.updateViewState({ selectedMode: mode });
    }
  },

  /**
   * Obtiene el modo de selección actual
   * @return {String} Modo actual
   */
  getSelectionMode() {
    return this._state.viewState.selectedMode;
  },

  /**
   * Expande o colapsa una materia
   * @param {String} subjectId - ID de la materia
   * @param {Boolean} expanded - Si debe estar expandida
   */
  setSubjectExpanded(subjectId, expanded) {
    const expandedSubjects = new Set(this._state.viewState.expandedSubjects);
    
    if (expanded) {
      expandedSubjects.add(subjectId);
    } else {
      expandedSubjects.delete(subjectId);
    }
    
    this.updateViewState({ expandedSubjects });
  },

  /**
   * Verifica si una materia está expandida
   * @param {String} subjectId - ID de la materia
   * @return {Boolean} true si está expandida
   */
  isSubjectExpanded(subjectId) {
    return this._state.viewState.expandedSubjects.has(subjectId);
  },

  /**
   * Obtiene todas las materias expandidas
   * @return {Array} Lista de IDs de materias expandidas
   */
  getExpandedSubjects() {
    return Array.from(this._state.viewState.expandedSubjects);
  },

  /**
   * Añade un elemento a las selecciones
   * @param {Object} item - Elemento a añadir
   * @param {String} type - Tipo de selección ('priority' | 'candidate')
   */
  addSelectedItem(item, type = 'priority') {
    if (!['priority', 'candidate'].includes(type)) {
      throw new Error('Tipo de selección inválido');
    }

    const selectedItems = { ...this._state.viewState.selectedItems };
    const itemExists = selectedItems[type].some(existing => existing.id === item.id);
    
    if (!itemExists) {
      selectedItems[type] = [...selectedItems[type], { ...item, addedAt: Date.now() }];
      this.updateViewState({ selectedItems });
      
      // Añadir a selecciones recientes
      this._addToRecentSelections(item);
    }
  },

  /**
   * Elimina un elemento de las selecciones
   * @param {String} itemId - ID del elemento a eliminar
   * @param {String} type - Tipo de selección ('priority' | 'candidate')
   */
  removeSelectedItem(itemId, type) {
    if (!['priority', 'candidate'].includes(type)) {
      throw new Error('Tipo de selección inválido');
    }

    const selectedItems = { ...this._state.viewState.selectedItems };
    selectedItems[type] = selectedItems[type].filter(item => item.id !== itemId);
    this.updateViewState({ selectedItems });
  },

  /**
   * Mueve un elemento entre tipos de selección
   * @param {String} itemId - ID del elemento
   * @param {String} fromType - Tipo origen
   * @param {String} toType - Tipo destino
   */
  moveSelectedItem(itemId, fromType, toType) {
    const selectedItems = { ...this._state.viewState.selectedItems };
    const itemIndex = selectedItems[fromType].findIndex(item => item.id === itemId);
    
    if (itemIndex >= 0) {
      const item = selectedItems[fromType][itemIndex];
      selectedItems[fromType].splice(itemIndex, 1);
      selectedItems[toType].push(item);
      this.updateViewState({ selectedItems });
    }
  },

  /**
   * Reordena elementos dentro de un tipo de selección
   * @param {String} type - Tipo de selección
   * @param {Array} newOrder - Nuevo orden de IDs
   */
  reorderSelectedItems(type, newOrder) {
    const selectedItems = { ...this._state.viewState.selectedItems };
    const currentItems = selectedItems[type];
    
    const reorderedItems = newOrder.map(id => 
      currentItems.find(item => item.id === id)
    ).filter(Boolean);
    
    selectedItems[type] = reorderedItems;
    this.updateViewState({ selectedItems });
  },

  /**
   * Obtiene elementos seleccionados por tipo
   * @param {String} type - Tipo de selección ('priority' | 'candidate')
   * @return {Array} Lista de elementos seleccionados
   */
  getSelectedItems(type) {
    if (type) {
      return [...this._state.viewState.selectedItems[type]];
    }
    return {
      priority: [...this._state.viewState.selectedItems.priority],
      candidate: [...this._state.viewState.selectedItems.candidate]
    };
  },

  /**
   * Limpia todas las selecciones
   * @param {String} type - Tipo específico a limpiar (opcional)
   */
  clearSelectedItems(type = null) {
    const selectedItems = { ...this._state.viewState.selectedItems };
    
    if (type) {
      selectedItems[type] = [];
    } else {
      selectedItems.priority = [];
      selectedItems.candidate = [];
    }
    
    this.updateViewState({ selectedItems });
  },

  /**
   * Controla la visibilidad de paneles
   * @param {String} panel - Nombre del panel
   * @param {Boolean} visible - Si debe ser visible
   */
  setPanelVisibility(panel, visible) {
    const validPanels = ['filterPanelVisible', 'selectionPanelVisible', 'helpPanelVisible'];
    
    if (validPanels.includes(panel)) {
      this.updateViewState({ [panel]: visible });
    }
  },

  /**
   * Obtiene la visibilidad de un panel
   * @param {String} panel - Nombre del panel
   * @return {Boolean} true si es visible
   */
  isPanelVisible(panel) {
    return this._state.viewState[panel] || false;
  },

  /**
   * Marca el onboarding como completado
   */
  completeOnboarding() {
    this.updateViewState({ onboardingCompleted: true });
    this.saveUserPreferences();
  },

  /**
   * Verifica si el onboarding fue completado
   * @return {Boolean} true si fue completado
   */
  isOnboardingCompleted() {
    return this._state.viewState.onboardingCompleted;
  },

  /**
   * Obtiene las preferencias de usuario
   * @return {Object} Preferencias actuales
   */
  getUserPreferences() {
    return { ...this._state.userPreferences };
  },

  /**
   * Actualiza las preferencias de usuario
   * @param {Object} newPreferences - Nuevas preferencias
   */
  updateUserPreferences(newPreferences) {
    const oldPreferences = { ...this._state.userPreferences };
    this._state.userPreferences = { ...this._state.userPreferences, ...newPreferences };
    
    // Notificar cambios
    this._notifyListeners('userPreferences', this._state.userPreferences, oldPreferences);
    
    // Guardar automáticamente
    this.saveUserPreferences();
  },

  saveSelections(selectedItems, options = {}) {
    try {
      const data = {
        items: selectedItems,
        options: {
          onlyOpenSections: options.onlyOpenSections ?? true,
          selectedCampus: options.selectedCampus ?? ''
        },
        timestamp: Date.now(),
        version: '1.0'
      };
      localStorage.setItem(this.SELECTION_STORAGE_KEYS.SELECTIONS, JSON.stringify(data));
      console.log('[Persistence] Saved selections:', selectedItems?.priority?.length + selectedItems?.candidate?.length, 'items');
    } catch (error) {
      console.error('[Persistence] Error saving:', error);
    }
  },

  loadSelections() {
    try {
      const saved = localStorage.getItem(this.SELECTION_STORAGE_KEYS.SELECTIONS);
      if (!saved) return null;
      
      const data = JSON.parse(saved);
      if (data.version !== '1.0') {
        console.warn('[Persistence] Version mismatch, ignoring');
        return null;
      }
      
      console.log('[Persistence] Loaded selections:', data.items?.priority?.length + data.items?.candidate?.length, 'items');
      return data;
    } catch (error) {
      console.error('[Persistence] Error loading:', error);
      return null;
    }
  },

  saveSelectedSchedule(schedule) {
    try {
      const data = { schedule: schedule, timestamp: Date.now() };
      localStorage.setItem(this.SELECTION_STORAGE_KEYS.SELECTED_SCHEDULE, JSON.stringify(data));
    } catch (error) {
      console.error('[Persistence] Error saving schedule:', error);
    }
  },

  loadSelectedSchedule() {
    try {
      const saved = localStorage.getItem(this.SELECTION_STORAGE_KEYS.SELECTED_SCHEDULE);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error('[Persistence] Error loading schedule:', error);
      return null;
    }
  },

  setupStorageSync() {
    window.addEventListener('storage', (event) => {
      if (event.key === this.SELECTION_STORAGE_KEYS.SELECTIONS) {
        console.log('[Persistence] Detected change in another tab');
        window.dispatchEvent(new CustomEvent('horarios:selections-changed', {
          detail: event.newValue ? JSON.parse(event.newValue) : null
        }));
      }
    });
  },

  /**
   * Guarda las preferencias de usuario en localStorage
   */
  saveUserPreferences() {
    try {
      localStorage.setItem('hybrid_user_preferences', JSON.stringify(this._state.userPreferences));
    } catch (error) {
      console.warn('Error guardando preferencias de usuario:', error);
    }
  },

  /**
   * Carga las preferencias de usuario desde localStorage
   */
  loadUserPreferences() {
    try {
      const saved = localStorage.getItem('hybrid_user_preferences');
      if (saved) {
        const preferences = JSON.parse(saved);
        this._state.userPreferences = { ...this._state.userPreferences, ...preferences };
      }
    } catch (error) {
      console.warn('Error cargando preferencias de usuario:', error);
    }
  },

  /**
   * Guarda el estado de la sesión
   */
  saveSessionData() {
    this._saveSessionData();
  },

  /**
   * Carga el estado de la sesión
   */
  loadSessionData() {
    try {
      const saved = sessionStorage.getItem('hybrid_session_data');
      if (saved) {
        const sessionData = JSON.parse(saved);
        this._state.sessionData = { ...this._state.sessionData, ...sessionData };
        
        // Restaurar estado de vista si existe
        if (sessionData.viewState) {
          // Convertir expandedSubjects de array a Set si es necesario
          if (Array.isArray(sessionData.viewState.expandedSubjects)) {
            sessionData.viewState.expandedSubjects = new Set(sessionData.viewState.expandedSubjects);
          }
          this._state.viewState = { ...this._state.viewState, ...sessionData.viewState };
        }
      }
    } catch (error) {
      console.warn('Error cargando datos de sesión:', error);
    }
  },

  /**
   * Añade un listener para cambios de estado
   * @param {String} event - Tipo de evento
   * @param {Function} callback - Función callback
   * @return {Function} Función para remover el listener
   */
  addEventListener(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    
    this._listeners.get(event).add(callback);
    
    // Retornar función para remover el listener
    return () => {
      const eventListeners = this._listeners.get(event);
      if (eventListeners) {
        eventListeners.delete(callback);
      }
    };
  },

  /**
   * Notifica a los listeners sobre cambios de estado
   * @param {String} event - Tipo de evento
   * @param {*} newValue - Nuevo valor
   * @param {*} oldValue - Valor anterior
   */
  _notifyListeners(event, newValue, oldValue) {
    const eventListeners = this._listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(newValue, oldValue);
        } catch (error) {
          console.error('Error en listener de UIStateService:', error);
        }
      });
    }
  },

  /**
   * Guarda datos de sesión internamente
   */
  _saveSessionData() {
    try {
      const dataToSave = {
        ...this._state.sessionData,
        viewState: {
          ...this._state.viewState,
          expandedSubjects: Array.from(this._state.viewState.expandedSubjects)
        },
        lastActivity: Date.now()
      };
      
      sessionStorage.setItem('hybrid_session_data', JSON.stringify(dataToSave));
    } catch (error) {
      console.warn('Error guardando datos de sesión:', error);
    }
  },

  /**
   * Configura el auto-guardado
   */
  _setupAutoSave() {
    // Guardar cada 30 segundos si hay cambios
    setInterval(() => {
      if (this._state.userPreferences.autoSave) {
        this._saveSessionData();
      }
    }, 30000);
  },

  /**
   * Rastrea la actividad del usuario
   */
  _trackActivity() {
    // Actualizar timestamp de última actividad
    const updateActivity = () => {
      this._state.sessionData.lastActivity = Date.now();
    };

    // Escuchar eventos de actividad
    ['click', 'keydown', 'scroll', 'mousemove'].forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });
  },

  /**
   * Añade un elemento a las selecciones recientes
   * @param {Object} item - Elemento a añadir
   */
  _addToRecentSelections(item) {
    const recentSelections = [...this._state.sessionData.recentSelections];
    
    // Remover si ya existe
    const existingIndex = recentSelections.findIndex(recent => recent.id === item.id);
    if (existingIndex >= 0) {
      recentSelections.splice(existingIndex, 1);
    }
    
    // Añadir al principio
    recentSelections.unshift({ ...item, selectedAt: Date.now() });
    
    // Mantener solo los últimos 20
    if (recentSelections.length > 20) {
      recentSelections.splice(20);
    }
    
    this._state.sessionData.recentSelections = recentSelections;
  },

  /**
   * Obtiene las selecciones recientes
   * @param {Number} limit - Límite de elementos a retornar
   * @return {Array} Lista de selecciones recientes
   */
  getRecentSelections(limit = 10) {
    return this._state.sessionData.recentSelections.slice(0, limit);
  },

  /**
   * Limpia todos los datos de sesión
   */
  clearSessionData() {
    this._state.sessionData = {
      lastActivity: Date.now(),
      searchHistory: [],
      recentSelections: []
    };
    
    this._state.viewState = {
      selectedMode: 'subjects',
      expandedSubjects: new Set(),
      selectedItems: { priority: [], candidate: [] },
      filterPanelVisible: true,
      selectionPanelVisible: true,
      helpPanelVisible: false,
      onboardingCompleted: this._state.viewState.onboardingCompleted
    };
    
    try {
      sessionStorage.removeItem('hybrid_session_data');
    } catch (error) {
      console.warn('Error limpiando datos de sesión:', error);
    }
  },

  /**
   * Obtiene estadísticas del estado actual
   * @return {Object} Estadísticas del estado
   */
  getStateStats() {
    return {
      totalSelections: this._state.viewState.selectedItems.priority.length + 
                      this._state.viewState.selectedItems.candidate.length,
      prioritySelections: this._state.viewState.selectedItems.priority.length,
      candidateSelections: this._state.viewState.selectedItems.candidate.length,
      expandedSubjects: this._state.viewState.expandedSubjects.size,
      recentSelections: this._state.sessionData.recentSelections.length,
      lastActivity: new Date(this._state.sessionData.lastActivity),
      sessionDuration: Date.now() - this._state.sessionData.lastActivity
    };
  }
};