import PdfExportService from '../services/PdfExportService.js';
import IcsExportService from '../services/IcsExportService.js';
import ShareService from '../services/ShareService.js';

/**
 * Componente de menú de exportación
 * Permite exportar a PDF, ICS o compartir URL
 */
export default {
  props: {
    schedule: { type: Object, required: true }
  },

  emits: ['export'],

  data() {
    return {
      isOpen: false,
      isExporting: false,
      exportType: null
    };
  },

  methods: {
    /**
     * Alterna la visibilidad del menú desplegable
     */
    toggleMenu() {
      this.isOpen = !this.isOpen;
    },

    /**
     * Exporta el horario actual a formato PDF
     * Utiliza PdfExportService para generar y descargar el archivo
     */
    async exportPdf() {
      this.isExporting = true;
      this.exportType = 'pdf';
      
      try {
        await PdfExportService.downloadSchedule(
          this.schedule.items,
          `horario-${new Date().toISOString().split('T')[0]}.pdf`
        );
        this.$emit('export', { type: 'pdf', success: true });
      } catch (error) {
        this.$emit('export', { type: 'pdf', success: false, error });
      } finally {
        this.isExporting = false;
        this.exportType = null;
        this.isOpen = false;
      }
    },

    /**
     * Exporta el horario actual a formato ICS para calendarios
     * Utiliza IcsExportService para generar y descargar el archivo
     */
    async exportIcs() {
      this.isExporting = true;
      this.exportType = 'ics';
      
      try {
        await IcsExportService.downloadIcs(
          this.schedule.items,
          `horario-${new Date().toISOString().split('T')[0]}.ics`
        );
        this.$emit('export', { type: 'ics', success: true });
      } catch (error) {
        this.$emit('export', { type: 'ics', success: false, error });
      } finally {
        this.isExporting = false;
        this.exportType = null;
        this.isOpen = false;
      }
    },

    /**
     * Comparte el horario actual mediante una URL
     * Genera una URL con el estado y la copia al portapapeles
     */
    async shareUrl() {
      this.isExporting = true;
      this.exportType = 'share';
      
      try {
        const state = {
          selectedItems: this.schedule.items,
          onlyOpenSections: true,
          selectedCampus: ''
        };
        
        const url = ShareService.generateShareUrl(state);
        await ShareService.copyToClipboard(url);
        this.$emit('export', { type: 'share', success: true });
      } catch (error) {
        this.$emit('export', { type: 'share', success: false, error });
      } finally {
        this.isExporting = false;
        this.exportType = null;
        this.isOpen = false;
      }
    }
  },

  template: `
    <div class="export-menu">
      <button 
        class="export-menu__trigger"
        @click="toggleMenu"
        :disabled="isExporting"
      >
        <span v-if="isExporting">⏳</span>
        <span v-else>📥</span>
        Exportar
      </button>
      
      <div v-if="isOpen" class="export-menu__dropdown">
        <button 
          class="export-menu__item"
          @click="exportPdf"
          :disabled="isExporting"
        >
          📄 <span v-if="exportType === 'pdf'">⏳</span> PDF
        </button>
        
        <button 
          class="export-menu__item"
          @click="exportIcs"
          :disabled="isExporting"
        >
          📅 <span v-if="exportType === 'ics'">⏳</span> ICS (Calendario)
        </button>
        
        <button 
          class="export-menu__item"
          @click="shareUrl"
          :disabled="isExporting"
        >
          🔗 <span v-if="exportType === 'share'">⏳</span> Compartir URL
        </button>
      </div>
    </div>
  `
};
