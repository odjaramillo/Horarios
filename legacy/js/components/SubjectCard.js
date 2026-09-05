/**
 * SubjectCard Component
 * 
 * A redesigned card component for displaying subject information with improved
 * visual hierarchy, better space utilization, and enhanced selection indicators.
 * 
 * Features:
 * - Semantic color coding for selection states
 * - Consistent iconography
 * - Improved visual hierarchy
 * - Better space utilization
 * - Smooth animations and transitions
 */

export default {
  props: {
    subject: {
      type: Object,
      required: true
    },
    isSelected: {
      type: Boolean,
      default: false
    },
    selectionType: {
      type: String,
      default: null,
      validator: value => value === null || ['priority', 'candidate'].includes(value)
    },
    isExpanded: {
      type: Boolean,
      default: false
    },
    selectionMode: {
      type: String,
      required: true,
      validator: value => ['subject', 'section'].includes(value)
    },
    onlyOpenSections: {
      type: Boolean,
      default: true
    },
    selectedSections: {
      type: Array,
      default: () => []
    }
  },

  emits: ['toggle-selection', 'toggle-expansion', 'section-selection'],

  computed: {
    /**
     * Calculate statistics for the subject
     */
    subjectStats() {
      const totalSections = this.subject.sections?.length || 0;
      const openSections = this.subject.sections?.filter(section => section.openSection).length || 0;
      const credits = this.subject.creditHourLow || 0;

      return {
        totalSections,
        openSections,
        credits,
        availabilityPercentage: totalSections > 0 ? Math.round((openSections / totalSections) * 100) : 0
      };
    },

    /**
     * Get card CSS classes based on selection state
     */
    cardClasses() {
      return [
        'subject-card',
        {
          'subject-card--selected-priority': this.isSelected && this.selectionType === 'priority',
          'subject-card--selected-candidate': this.isSelected && this.selectionType === 'candidate',
          'subject-card--expanded': this.isExpanded,
          'subject-card--clickable': this.selectionMode === 'subject'
        }
      ];
    },

    /**
     * Get selection indicator configuration
     */
    selectionIndicator() {
      if (!this.isSelected) return null;

      return {
        type: this.selectionType,
        icon: this.selectionType === 'priority' ? '🔴' : '🟡',
        label: this.selectionType === 'priority' ? 'Prioritaria' : 'Candidata',
        class: `selection-indicator--${this.selectionType}`
      };
    },

    /**
     * Check if subject has HTML data
     */
    hasHtmlData() {
      return this.subject.sections?.some(section => section.dataSource === 'html') || false;
    },

    /**
     * Get availability status configuration
     */
    availabilityStatus() {
      const { openSections, totalSections, availabilityPercentage } = this.subjectStats;

      let status = 'low';
      let icon = '❌';
      let color = 'danger';

      if (availabilityPercentage >= 70) {
        status = 'high';
        icon = '✅';
        color = 'success';
      } else if (availabilityPercentage >= 30) {
        status = 'medium';
        icon = '⚠️';
        color = 'warning';
      }

      return {
        status,
        icon,
        color,
        text: `${openSections}/${totalSections} disponibles`,
        percentage: availabilityPercentage
      };
    },

    /**
     * Format subject sections for display
     */
    formattedSections() {
      if (!this.subject.sections || this.subject.sections.length === 0) {
        return 'Sin secciones disponibles';
      }

      const sampleNRCs = this.subject.sections
        .slice(0, 2)
        .map(section => section.courseReferenceNumber)
        .filter(Boolean)
        .join(', ');

      const hasMore = this.subject.sections.length > 2;
      const nrcText = sampleNRCs ? ` (NRCs: ${sampleNRCs}${hasMore ? '...' : ''})` : '';

      return `${this.subjectStats.openSections} de ${this.subjectStats.totalSections} secciones abiertas${nrcText}`;
    }
  },

  methods: {
    /**
     * Handle subject card click
     */
    handleCardClick() {
      if (this.selectionMode === 'subject') {
        this.$emit('toggle-selection', this.subject);
      }
    },

    /**
     * Handle expansion toggle
     */
    handleExpansionToggle(event) {
      event.stopPropagation();
      this.$emit('toggle-expansion', this.subject.id);
    },

    /**
     * Handle section selection
     */
    handleSectionSelection(section, event) {
      event.stopPropagation();
      this.$emit('section-selection', section, this.subject);
    },

    /**
     * Format section schedule for display
     */
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

    /**
     * Format section professor for display
     */
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

    /**
     * Check if a section is selected
     */
    isSectionSelected(sectionId) {
      return this.selectedSections.some(item =>
        item.type === 'section' && item.item.id === sectionId
      );
    },

    /**
     * Get section selection type
     */
    getSectionSelectionType(sectionId) {
      const selectedSection = this.selectedSections.find(item =>
        item.type === 'section' && item.item.id === sectionId
      );
      return selectedSection ? selectedSection.selectionType : null;
    }
  },

  template: `
    <div 
      :class="[
        'rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group relative flex flex-col font-display border',
        isSelected && selectionType === 'priority' ? 'bg-red-50 border-red-200 shadow-[0_0_15px_-3px_rgba(239,68,68,0.2)]' : 
        isSelected && selectionType === 'candidate' ? 'bg-amber-50 border-amber-200 shadow-[0_0_15px_-3px_rgba(245,158,11,0.2)]' : 
        'bg-white border-border-color hover:border-primary/30'
      ]"
      :data-subject-id="subject.id"
      @click="handleCardClick"
    >
      <!-- State Indicator Strip -->
      <div v-if="isSelected && selectionType === 'priority'" class="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500 rounded-l-[1.25rem]"></div>
      <div v-if="isSelected && selectionType === 'candidate'" class="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500 rounded-l-[1.25rem]"></div>

      <div class="flex items-start gap-3 sm:gap-4" :class="{ 'pl-2 sm:pl-3': isSelected }">
        
        <!-- Checkbox / Selection Circle -->
        <div class="pt-1 hidden sm:block">
          <div :class="[
            'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors',
            isSelected && selectionType === 'priority' ? 'border-red-500 bg-red-500 text-white' :
            isSelected && selectionType === 'candidate' ? 'border-amber-500 bg-amber-500 text-white' :
            'border-slate-300 group-hover:border-primary text-transparent'
          ]">
            <span class="material-symbols-outlined text-[16px] font-bold" v-show="isSelected">check</span>
          </div>
        </div>

        <div class="flex-1 flex flex-col min-w-0">
          
          <!-- Header Row -->
          <div class="flex items-start justify-between mb-1 gap-2">
            <div class="flex items-center gap-2 flex-wrap">
              <h3 :class="[
                'font-bold text-[1.1rem] transition-colors truncate',
                isSelected && selectionType === 'priority' ? 'text-red-700' :
                isSelected && selectionType === 'candidate' ? 'text-amber-700' :
                'text-slate-800 group-hover:text-primary'
              ]">{{ subject.subject }}{{ subject.courseNumber }}</h3>
              
              <!-- Badges -->
              <span v-if="isSelected && selectionType === 'priority'" class="px-2.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold tracking-wide uppercase rounded-full border border-red-200">Prioritaria</span>
              <span v-if="isSelected && selectionType === 'candidate'" class="px-2.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold tracking-wide uppercase rounded-full border border-amber-200">Candidata</span>
            </div>
            
            <span class="px-2.5 py-1 bg-slate-100/80 text-slate-600 text-xs font-bold rounded-lg border border-slate-200 flex-none shrink-0">{{ subjectStats.credits }} UC</span>
          </div>
          
          <!-- Title -->
          <p class="text-slate-500 text-sm font-medium leading-tight mb-3 line-clamp-2">{{ subject.courseTitle }}</p>

          <!-- Divider -->
          <div class="w-full h-px bg-slate-200/60 my-2"></div>

          <!-- Bottom Row: Stats & Expand -->
          <div class="flex items-center justify-between mt-1">
            <div class="flex items-center gap-3">
              <!-- Availability -->
              <div class="flex items-center gap-1.5" :class="availabilityStatus.color === 'success' ? 'text-emerald-600' : availabilityStatus.color === 'danger' ? 'text-rose-600' : 'text-amber-600'">
                 <span class="material-symbols-outlined text-[16px]">{{ availabilityStatus.color === 'success' ? 'check_circle' : availabilityStatus.color === 'danger' ? 'cancel' : 'warning' }}</span>
                 <span class="text-xs font-bold">{{ subjectStats.openSections }}/{{ subjectStats.totalSections }} SEC</span>
              </div>
            </div>

            <!-- Expand Button -->
            <button 
              @click="handleExpansionToggle"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 relative z-10"
            >
              <span>{{ isExpanded ? 'Ocultar' : 'Secciones' }}</span>
              <span class="material-symbols-outlined text-[16px] transition-transform duration-200" :class="{ 'rotate-180': isExpanded }">keyboard_arrow_down</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Sections Dropdown (Expanded State) -->
      <div v-if="isExpanded" class="mt-4 pt-4 border-t border-slate-200/60" @click.stop>
        <div class="space-y-3">
          <div 
            v-for="section in subject.sections" 
            :key="section.id"
            @click="selectionMode === 'section' ? handleSectionSelection(section, $event) : null"
            :class="[
              'p-3 rounded-xl border transition-all text-sm',
              !section.openSection ? 'bg-slate-50/50 border-slate-200 opacity-60' :
              isSectionSelected(section.id) && getSectionSelectionType(section.id) === 'priority' ? 'bg-red-50 border-red-200' :
              isSectionSelected(section.id) && getSectionSelectionType(section.id) === 'candidate' ? 'bg-amber-50 border-amber-200' :
              'bg-white border-slate-200 hover:border-primary/30 hover:shadow-sm',
              selectionMode === 'section' ? 'cursor-pointer hover:scale-[1.01]' : ''
            ]"
          >
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="font-bold font-mono text-slate-700 bg-slate-100 px-2 rounded">{{ section.courseReferenceNumber }}</span>
                <span class="font-bold text-slate-800">Sec. {{ section.sequenceNumber }}</span>
              </div>
              <!-- Status Badge -->
              <span :class="[
                'text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border',
                section.openSection ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
              ]">
                {{ section.openSection ? 'Abierta' : 'Cerrada' }}
              </span>
            </div>

            <div class="space-y-1.5 mt-2">
              <div class="flex items-start gap-2 text-slate-600 text-[13px] font-medium">
                <span class="material-symbols-outlined text-[16px] text-slate-400 mt-0.5 flex-none">schedule</span>
                <span class="leading-tight">{{ formatSectionSchedule(section) }}</span>
              </div>
              <div class="flex items-start gap-2 text-slate-600 text-[13px] font-medium">
                <span class="material-symbols-outlined text-[16px] text-slate-400 mt-0.5 flex-none">person</span>
                <span class="leading-tight line-clamp-2">{{ formatSectionProfessor(section) }}</span>
              </div>
            </div>
            
            <div v-if="isSectionSelected(section.id)" class="mt-3 pt-2 text-xs font-bold flex items-center justify-end border-t" :class="getSectionSelectionType(section.id) === 'priority' ? 'border-red-200' : 'border-amber-200'">
               <span :class="getSectionSelectionType(section.id) === 'priority' ? 'text-red-600' : 'text-amber-600'">
                 <span class="material-symbols-outlined text-[14px] align-text-bottom mr-1">check_circle</span>
                 {{ getSectionSelectionType(section.id) === 'priority' ? 'Prioritaria' : 'Candidata' }} Seleccionada
               </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
};