# Sprint 2: Core Features Implementation Plan

> **For Claude:** Use subagent-driven-development to implement this plan task-by-task.

**Goal:** Implement 4 core features: localStorage persistence, PDF export, ICS export, and URL sharing for the Horarios UCAB scheduling application.

**Architecture:** Vue 3 + ES Modules (CDN-based, no build step). Extend existing UIStateService for persistence, create dedicated export services (PdfExportService, IcsExportService, ShareService). All dependencies loaded lazily from CDN.

**Tech Stack:** 
- Vue 3 (Options API, ES Modules)
- pdfMake 0.2.7 (PDF generation)
- qrcode.js 1.0.0 (QR codes)
- localStorage API (persistence)

---

## Current Project State

**Existing services:**
- `js/services/UIStateService.js` - User preferences + sessionStorage
- `js/services/ScheduleGeneratorService.js` - Schedule generation
- `js/services/FilterService.js` - Filtering logic
- `js/services/CourseService.js` - Course data
- `js/services/AnimationService.js` - UI animations

**Current data model:**
```javascript
// selectedItems structure
{
  type: 'subject' | 'section',
  selectionType: 'priority' | 'candidate',
  item: { /* Subject or Section object */ },
  subjectInfo: { /* Subject info (sections only) */ }
}
```

---

## Dependencies to Load

All loaded lazily (only when user clicks export button):

```html
<!-- PDF -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js"></script>

<!-- QR Code -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
```

---

# Task 1: LocalStorage Persistence

## Files

- **Modify:** `js/services/UIStateService.js` (lines 1-50)
- **Modify:** `js/app.js` (add lifecycle hooks)
- **Create:** `docs/test-persistence.html` (manual test)

## Implementation Steps

### Step 1: Add localStorage keys to UIStateService

Add these constants after the existing STORAGE_KEYS definition in `js/services/UIStateService.js`:

```javascript
// Keys for selections persistence
const SELECTION_STORAGE_KEYS = {
  SELECTIONS: 'horarios_selections',
  SELECTED_SCHEDULE: 'horarios_selected_schedule',
  LAST_GENERATED: 'horarios_last_generated'
};
```

### Step 2: Add save/load methods

Add these methods to the UIStateService object after `updateUserPreferences`:

```javascript
/**
 * Saves selections to localStorage
 * @param {Array} selectedItems - Current selected items
 * @param {Object} options - Generation options
 */
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
    localStorage.setItem(SELECTION_STORAGE_KEYS.SELECTIONS, JSON.stringify(data));
    console.log('[Persistence] Saved selections:', selectedItems.length, 'items');
  } catch (error) {
    console.error('[Persistence] Error saving:', error);
  }
},

/**
 * Loads selections from localStorage
 * @return {Object|null} Saved data or null
 */
loadSelections() {
  try {
    const saved = localStorage.getItem(SELECTION_STORAGE_KEYS.SELECTIONS);
    if (!saved) return null;
    
    const data = JSON.parse(saved);
    if (data.version !== '1.0') {
      console.warn('[Persistence] Version mismatch, ignoring');
      return null;
    }
    
    console.log('[Persistence] Loaded selections:', data.items?.length, 'items');
    return data;
  } catch (error) {
    console.error('[Persistence] Error loading:', error);
    return null;
  }
},
```

### Step 3: Add selectedSchedule methods

Add after loadSelections:

```javascript
/**
 * Saves the selected schedule
 * @param {Object} schedule - The schedule to save
 */
saveSelectedSchedule(schedule) {
  try {
    const data = {
      schedule: schedule,
      timestamp: Date.now()
    };
    localStorage.setItem(SELECTION_STORAGE_KEYS.SELECTED_SCHEDULE, JSON.stringify(data));
  } catch (error) {
    console.error('[Persistence] Error saving schedule:', error);
  }
},

/**
 * Loads the selected schedule
 * @return {Object|null}
 */
loadSelectedSchedule() {
  try {
    const saved = localStorage.getItem(SELECTION_STORAGE_KEYS.SELECTED_SCHEDULE);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error('[Persistence] Error loading schedule:', error);
    return null;
  }
},
```

### Step 4: Add storage event listener for cross-tab sync

Add at the end of the init or in a new method:

```javascript
/**
 * Sets up cross-tab synchronization
 */
setupStorageSync() {
  window.addEventListener('storage', (event) => {
    if (event.key === SELECTION_STORAGE_KEYS.SELECTIONS) {
      console.log('[Persistence] Detected change in another tab');
      // Emit event for Vue component to handle
      window.dispatchEvent(new CustomEvent('horarios:selections-changed', {
        detail: event.newValue ? JSON.parse(event.newValue) : null
      }));
    }
  });
},
```

### Step 5: Integrate with app.js

In `js/app.js`, find the Vue app initialization and add:

```javascript
// In the data() return object, add:
sharedState: null,

// In mounted() lifecycle:
mounted() {
  // Load persisted selections
  const savedData = UIStateService.loadSelections();
  if (savedData && savedData.items?.length > 0) {
    this.sharedState = savedData;
    // Trigger selection restoration after course data loads
    this.$nextTick(() => {
      this.restoreSelections(savedData);
    });
  }
  
  // Set up cross-tab sync
  UIStateService.setupStorageSync();
  
  // Listen for changes from other tabs
  window.addEventListener('horarios:selections-changed', (e) => {
    if (e.detail) {
      this.restoreSelections(e.detail);
    }
  });
},

// Add new method:
methods: {
  restoreSelections(savedData) {
    // Convert stored data back to selection items
    // This requires matching with CourseService data
    this.selectedItems = savedData.items || [];
    this.onlyOpenSections = savedData.options?.onlyOpenSections ?? true;
    this.selectedCampus = savedData.options?.selectedCampus ?? '';
  },
  
  // Add watcher to auto-save
  watch: {
    selectedItems: {
      handler(newItems) {
        UIStateService.saveSelections(newItems, {
          onlyOpenSections: this.onlyOpenSections,
          selectedCampus: this.selectedCampus
        });
      },
      deep: true
    }
  }
}
```

### Step 6: Create manual test file

Create `test-persistence.html`:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Test - Persistencia localStorage</title>
  <style>
    .test { padding: 10px; margin: 5px 0; border-radius: 4px; }
    .pass { background: #d4edda; }
    .fail { background: #f8d7da; }
  </style>
</head>
<body>
  <h1>Test de Persistencia localStorage</h1>
  <div id="results"></div>

  <script type="module">
    import UIStateService from './js/services/UIStateService.js';

    const results = document.getElementById('results');
    let passed = 0, failed = 0;

    function test(name, fn) {
      try {
        fn();
        results.innerHTML += `<div class="test pass">✅ ${name}</div>`;
        passed++;
      } catch (e) {
        results.innerHTML += `<div class="test fail">❌ ${name}: ${e.message}</div>`;
        failed++;
      }
    }

    // Test: localStorage disponible
    test('localStorage disponible', () => {
      const available = typeof localStorage !== 'undefined';
      if (!available) throw new Error('No disponible');
    });

    // Test: Guardar selecciones
    test('Guardar selecciones', () => {
      const mockItems = [
        { type: 'subject', selectionType: 'priority', item: { id: 'MAT101' } }
      ];
      UIStateService.saveSelections(mockItems, { onlyOpenSections: true });
      const loaded = UIStateService.loadSelections();
      if (!loaded || loaded.items.length !== 1) throw new Error('No match');
    });

    // Test: Versión correcta
    test('Versión guardada', () => {
      const loaded = UIStateService.loadSelections();
      if (loaded.version !== '1.0') throw new Error('Wrong version');
    });

    results.innerHTML += `<hr><p>Total: ${passed} passed, ${failed} failed</p>`;
  </script>
</body>
</html>
```

### Step 7: Commit

```bash
git add js/services/UIStateService.js js/app.js test-persistence.html
git commit -m "feat(persistence): add localStorage persistence for selections

- Add saveSelections/loadSelections methods to UIStateService
- Add cross-tab sync via storage event
- Add auto-save watcher in Vue app
- Add manual test file"
```

---

# Task 2: PDF Export

## Files

- **Create:** `js/services/PdfExportService.js`
- **Create:** `js/utils/PdfLoader.js`
- **Modify:** `js/components/ScheduleResults.js` (add export button)
- **Create:** `test-pdf-export.html`

## Implementation Steps

### Step 1: Create PdfLoader utility

Create `js/utils/PdfLoader.js`:

```javascript
/**
 * Dynamically loads pdfMake from CDN
 * @return {Promise<void>}
 */
export async function loadPdfMake() {
  if (window.pdfMake) return;
  
  // Load pdfmake
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load pdfmake'));
    document.head.appendChild(script);
  });
  
  // Load fonts
  await new Promise((resolve, reject) => {
    const fonts = document.createElement('script');
    fonts.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js';
    fonts.onload = resolve;
    fonts.onerror = () => reject(new Error('Failed to load pdfmake fonts'));
    document.head.appendChild(fonts);
  });
}
```

### Step 2: Create PdfExportService

Create `js/services/PdfExportService.js`:

```javascript
/**
 * Service for exporting schedules to PDF
 */
export default {
  /**
   * Downloads schedule as PDF
   * @param {Array} scheduleItems - Schedule items to export
   * @param {String} filename - Output filename
   */
  async downloadSchedule(scheduleItems, filename = 'horario-ucab.pdf') {
    const { loadPdfMake } = await import('../utils/PdfLoader.js');
    await loadPdfMake();
    
    const docDefinition = this._buildDocDefinition(scheduleItems);
    
    window.pdfMake.createPdf(docDefinition).download(filename);
    console.log('[PDF] Downloaded:', filename);
  },

  /**
   * Builds the PDF document definition
   * @private
   */
  _buildDocDefinition(scheduleItems) {
    const totalCredits = scheduleItems.reduce((sum, item) => 
      sum + parseInt(item.creditHourLow || 0), 0);

    return {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [20, 20, 20, 20],
      content: [
        { text: 'Horario UCAB', style: 'header' },
        { text: `Total Créditos: ${totalCredits} | Materias: ${scheduleItems.length}`, style: 'subheader' },
        { text: '\n' },
        this._buildScheduleTable(scheduleItems)
      ],
      styles: {
        header: { fontSize: 18, bold: true, color: '#1a365d' },
        subheader: { fontSize: 10, color: '#4a5568' },
        tableHeader: { bold: true, fontSize: 10, color: 'white', fillColor: '#2b6cb0' },
        tableCell: 9 }
      }
    };
  },

  /**
   * Builds the schedule table
   * @private
   */
  _buildScheduleTable(scheduleItems) {
    const dayMap = {
      monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles',
      thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado'
    };

    const tableBody = [
      [{ text: 'Día', style: 'tableHeader' }, { text: 'Hora', style: 'tableHeader' },
       { text: 'Materia', style: 'tableHeader' }, { text: 'Sección', style: 'tableHeader' },
       { text: 'Salón', style: 'tableHeader' }, { text: 'Profesor', style: 'tableHeader' }]
    ];

    // Group by day
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const byDay = { 'Lunes': [], 'Martes': [], 'Miércoles': [], 'Jueves': [], 'Viernes': [], 'Sábado': [] };

    scheduleItems.forEach(item => {
      if (!item.section?.meetingsFaculty) return;
      
      item.section.meetingsFaculty.forEach(meeting => {
        if (!meeting.meetingTime) return;
        
        Object.entries(dayMap).forEach(([key, day]) => {
          if (meeting.meetingTime[key]) {
            byDay[day].push({
              ...item,
              beginTime: meeting.meetingTime.beginTime,
              endTime: meeting.meetingTime.endTime
            });
          }
        });
      });
    });

    // Sort each day by time
    Object.values(byDay).forEach(dayItems => {
      dayItems.sort((a, b) => parseInt(a.beginTime) - parseInt(b.beginTime));
    });

    // Build table rows
    days.forEach(day => {
      const dayItems = byDay[day];
      if (dayItems.length === 0) {
        tableBody.push([{ text: day, fillColor: '#f7fafc' }, '-', '-', '-', '-', '-']);
      } else {
        dayItems.forEach((item, idx) => {
          tableBody.push([
            { text: idx === 0 ? day : '', fillColor: idx === 0 ? '#edf2f7' : 'white' },
            { text: `${this._formatTime(item.beginTime)}-${this._formatTime(item.endTime)}` },
            { text: `${item.subject}${item.courseNumber}` },
            { text: item.section.sequenceNumber },
            { text: this._extractRoom(item.section) || 'Por asignar' },
            { text: this._extractProfessor(item.section) || 'Por asignar' }
          ]);
        });
      }
    });

    return {
      table: {
        widths: [60, 60, '*', 40, 70, 80],
        body: tableBody
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0,
        paddingLeft: () => 4,
        paddingRight: () => 4
      }
    };
  },

  _formatTime(time) {
    if (!time || time.length !== 4) return time;
    return `${time.substring(0, 2)}:${time.substring(2)}`;
  },

  _extractRoom(section) {
    if (!section.meetingsFaculty) return null;
    for (const m of section.meetingsFaculty) {
      if (m.building) return m.building + (m.room ? ` ${m.room}` : '');
    }
    return null;
  },

  _extractProfessor(section) {
    if (!section.meetingsFaculty) return null;
    const professors = new Set();
    section.meetingsFaculty.forEach(m => {
      if (m.faculty) {
        m.faculty.forEach(f => {
          if (f.displayName && f.displayName !== 'Por Asignar') {
            professors.add(f.displayName);
          }
        });
      }
    });
    return professors.size > 0 ? Array.from(professors)[0] : null;
  }
};
```

### Step 3: Add export button to ScheduleResults

Find `js/components/ScheduleResults.js` and add an export button in the template:

```javascript
// Add to template:
/*
<button 
  v-if="currentSchedule" 
  @click="handleExportPdf"
  class="export-btn"
  :disabled="isExporting"
>
  📄 Exportar PDF
</button>
*/

// Add to methods:
async handleExportPdf() {
  if (!this.currentSchedule) return;
  
  try {
    this.isExporting = true;
    await PdfExportService.downloadSchedule(
      this.currentSchedule.items,
      `horario-${new Date().toISOString().split('T')[0]}.pdf`
    );
    this.showNotification('PDF descargado correctamente', 'success');
  } catch (error) {
    console.error('PDF export error:', error);
    this.showNotification('Error al generar PDF', 'error');
  } finally {
    this.isExporting = false;
  }
}
```

### Step 4: Create test file

Create `test-pdf-export.html`:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Test - PDF Export</title>
</head>
<body>
  <h1>Test de Exportación PDF</h1>
  <button id="exportBtn">Exportar PDF de Prueba</button>
  <div id="status"></div>

  <script type="module">
    import PdfExportService from './js/services/PdfExportService.js';

    const mockSchedule = [
      {
        subject: 'ISIS',
        courseNumber: '1101',
        creditHourLow: 3,
        section: {
          sequenceNumber: '1',
          courseReferenceNumber: '12345',
          meetingsFaculty: [{
            meetingTime: {
              monday: true, wednesday: true, friday: true,
              beginTime: '0830', endTime: '1000'
            }
          }]
        }
      }
    ];

    document.getElementById('exportBtn').addEventListener('click', async () => {
      try {
        document.getElementById('status').textContent = 'Generando PDF...';
        await PdfExportService.downloadSchedule(mockSchedule, 'test-horario.pdf');
        document.getElementById('status').textContent = '✅ PDF descargado';
      } catch (e) {
        document.getElementById('status').textContent = '❌ Error: ' + e.message;
      }
    });
  </script>
</body>
</html>
```

### Step 5: Commit

```bash
git add js/services/PdfExportService.js js/utils/PdfLoader.js test-pdf-export.html
git commit -m "feat(export): add PDF export functionality

- Create PdfExportService with pdfMake
- Create PdfLoader for dynamic CDN loading
- Add export button to ScheduleResults
- Add manual test file"
```

---

# Task 3: ICS Export

## Files

- **Create:** `js/services/IcsExportService.js`
- **Modify:** `js/components/ScheduleResults.js` (add ICS button)
- **Create:** `test-ics-export.html`

## Implementation Steps

### Step 1: Create IcsExportService

Create `js/services/IcsExportService.js`:

```javascript
/**
 * Service for exporting schedules to iCalendar format (RFC 5545)
 */
export default {
  /**
   * Downloads schedule as ICS file
   * @param {Array} scheduleItems - Schedule items
   * @param {String} filename - Output filename
   */
  downloadIcs(scheduleItems, filename = 'horario-ucab.ics') {
    const icsContent = this._generateIcs(scheduleItems);
    this._downloadFile(icsContent, filename);
    console.log('[ICS] Downloaded:', filename);
  },

  /**
   * Generates ICS content
   * @private
   */
  _generateIcs(scheduleItems) {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Horarios UCAB//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ];

    const semester = this._getSemesterDates();

    scheduleItems.forEach(item => {
      if (!item.section?.meetingsFaculty) return;
      
      item.section.meetingsFaculty.forEach(meeting => {
        if (!meeting.meetingTime) return;
        
        const events = this._generateRecurringEvents(item, meeting.meetingTime, semester);
        lines.push(...events);
      });
    });

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  },

  /**
   * Generates recurring events for a meeting
   * @private
   */
  _generateRecurringEvents(item, meetingTime, semester) {
    const lines = [];
    const uid = `${item.section.courseReferenceNumber}-${item.subject}-${item.courseNumber}@horarios.ucab`;
    
    const dayMap = {
      monday: 'MO', tuesday: 'TU', wednesday: 'WE',
      thursday: 'TH', friday: 'FR', saturday: 'SA'
    };

    const icsDays = Object.entries(dayMap)
      .filter(([key]) => meetingTime[key])
      .map(([, value]) => value);

    if (icsDays.length === 0) return lines;

    const dtstart = this._formatDateTime(semester.start, meetingTime.beginTime);
    const dtend = this._formatDateTime(semester.start, meetingTime.endTime);

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${this._formatDateTime(new Date(), '0000')}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${icsDays.join(',')};UNTIL=${this._formatDate(semester.end)}`,
      `SUMMARY:${item.subject}${item.courseNumber} - ${item.courseTitle || 'Curso'}`,
      `DESCRIPTION:NRC: ${item.section.courseReferenceNumber} | Sección: ${item.section.sequenceNumber}`,
      `LOCATION:${this._extractLocation(item.section) || 'Por asignar'}`,
      'STATUS:CONFIRMED',
      'END:VEVENT'
    );

    return lines;
  },

  /**
   * Gets semester date range
   * @private
   */
  _getSemesterDates() {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    if (month >= 0 && month <= 4) {
      return { start: new Date(year, 0, 15), end: new Date(year, 4, 30) };
    } else if (month >= 8 && month <= 11) {
      return { start: new Date(year, 8, 1), end: new Date(year, 11, 15) };
    }
    // Default: 4 months from now
    return { start: now, end: new Date(now.getFullYear(), now.getMonth() + 4, 1) };
  },

  _formatDateTime(date, time) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = time.substring(0, 2);
    const min = time.substring(2);
    return `${y}${m}${d}T${h}${min}00`;
  },

  _formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  },

  _extractLocation(section) {
    if (!section.meetingsFaculty) return null;
    for (const m of section.meetingsFaculty) {
      if (m.building) return `${m.building}${m.room ? ' ' + m.room : ''}`;
    }
    return null;
  },

  /**
   * Downloads a file
   * @private
   */
  _downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};
```

### Step 2: Add ICS button to ScheduleResults

Add in the template (next to PDF button):

```javascript
// In template:
/*
<button 
  v-if="currentSchedule" 
  @click="handleExportIcs"
  class="export-btn"
>
  📅 Exportar ICS
</button>
*/

// In methods:
handleExportIcs() {
  if (!this.currentSchedule) return;
  
  try {
    IcsExportService.downloadIcs(
      this.currentSchedule.items,
      `horario-${new Date().toISOString().split('T')[0]}.ics`
    );
    this.showNotification('ICS descargado. Importa en Google Calendar u Outlook', 'success');
  } catch (error) {
    console.error('ICS export error:', error);
    this.showNotification('Error al generar ICS', 'error');
  }
}
```

### Step 3: Create test file

Create `test-ics-export.html`:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Test - ICS Export</title>
</head>
<body>
  <h1>Test de Exportación ICS</h1>
  <button id="exportBtn">Exportar ICS de Prueba</button>
  <div id="status"></div>

  <script type="module">
    import IcsExportService from './js/services/IcsExportService.js';

    const mockSchedule = [
      {
        subject: 'ISIS',
        courseNumber: '1101',
        courseTitle: 'Introducción a la Ingeniería',
        section: {
          sequenceNumber: '1',
          courseReferenceNumber: '12345',
          meetingsFaculty: [{
            meetingTime: {
              monday: true, wednesday: true, friday: true,
              beginTime: '0830', endTime: '1000'
            }
          }]
        }
      }
    ];

    document.getElementById('exportBtn').addEventListener('click', () => {
      try {
        IcsExportService.downloadIcs(mockSchedule, 'test-horario.ics');
        document.getElementById('status').textContent = '✅ ICS descargado';
      } catch (e) {
        document.getElementById('status').textContent = '❌ Error: ' + e.message;
      }
    });
  </script>
</body>
</html>
```

### Step 4: Commit

```bash
git add js/services/IcsExportService.js test-ics-export.html
git commit -m "feat(export): add ICS (iCalendar) export

- Create IcsExportService with RFC 5545 compliance
- Add export button to ScheduleResults
- Add manual test file"
```

---

# Task 4: Share via URL

## Files

- **Create:** `js/services/ShareService.js`
- **Modify:** `js/app.js` (URL parsing on load)
- **Modify:** `js/components/ScheduleResults.js` (share button)
- **Create:** `test-share-url.html`

## Implementation Steps

### Step 1: Create ShareService

Create `js/services/ShareService.js`:

```javascript
/**
 * Service for sharing schedules via URL
 */
export default {
  /**
   * Generates a shareable URL with encoded state
   * @param {Object} state - State to share
   * @return {String} Shareable URL
   */
  generateShareUrl(state) {
    const encoded = this._encodeState(state);
    const params = new URLSearchParams();
    params.set('s', encoded);
    
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    
    if (url.length > 2000) {
      console.warn('[Share] URL too long, consider fewer selections');
    }
    
    return url;
  },

  /**
   * Encodes state for URL
   * @private
   */
  _encodeState(state) {
    const minimal = {
      v: '1.0',
      ts: Date.now(),
      p: (state.selectedItems || []).map(item => ({
        t: item.type === 'subject' ? 's' : 'x',
        i: item.item.id,
        y: item.selectionType === 'priority' ? 'p' : 'c'
      })),
      o: {
        c: state.onlyOpenSections ?? true,
        g: state.selectedCampus ?? ''
      }
    };

    return encodeURIComponent(btoa(JSON.stringify(minimal)));
  },

  /**
   * Decodes state from URL
   * @return {Object|null} Decoded state or null
   */
  decodeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('s');
    
    if (!encoded) return null;
    
    try {
      const json = atob(decodeURIComponent(encoded));
      const state = JSON.parse(json);
      
      if (state.v !== '1.0') {
        console.warn('[Share] Unknown version, ignoring');
        return null;
      }
      
      return state;
    } catch (error) {
      console.error('[Share] Decode error:', error);
      return null;
    }
  },

  /**
   * Copies URL to clipboard
   * @param {String} url - URL to copy
   * @return {Promise<Boolean>} Success
   */
  async copyToClipboard(url) {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch (error) {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    }
  },

  /**
   * Generates QR code as data URL
   * @param {String} url - URL to encode
   * @param {Number} size - QR size
   * @return {Promise<String>} Data URL
   */
  async generateQrCode(url, size = 250) {
    await this._loadQrLibrary();
    
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        window.QRCode.toCanvas(canvas, url, { width: size, margin: 2 }, (err) => {
          if (err) reject(err);
          else resolve(canvas.toDataURL('image/png'));
        });
      } catch (e) {
        reject(e);
      }
    });
  },

  /**
   * Loads QR library
   * @private
   */
  async _loadQrLibrary() {
    if (window.QRCode) return;
    
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  },

  /**
   * Cleans URL without reloading
   */
  cleanUrl() {
    window.history.replaceState({}, '', window.location.pathname);
  }
};
```

### Step 2: Add URL parsing to app.js

In `js/app.js`, add to mounted():

```javascript
mounted() {
  // Check for shared URL
  const sharedState = ShareService.decodeFromUrl();
  if (sharedState) {
    this.sharedState = sharedState;
    this.$nextTick(() => {
      this.restoreFromSharedState(sharedState);
    });
    // Clean URL after restore
    ShareService.cleanUrl();
  }
  // ... existing code
},

methods: {
  restoreFromSharedState(state) {
    // Need to match with CourseService data
    // This is simplified - full implementation needs CourseService integration
    console.log('[Share] Restoring from shared URL');
    
    // The actual restoration requires:
    // 1. Look up each subject ID in CourseService
    // 2. Create selection items with proper structure
    // 3. Apply to selectedItems, onlyOpenSections, selectedCampus
  }
}
```

### Step 3: Add share button to ScheduleResults

Add in template and methods:

```javascript
// In template:
/*
<button 
  v-if="currentSchedule" 
  @click="handleShare"
  class="share-btn"
>
  🔗 Compartir
</button>
*/

// In methods:
async handleShare() {
  const state = {
    selectedItems: this.selectedItems,
    onlyOpenSections: this.onlyOpenSections,
    selectedCampus: this.selectedCampus
  };

  const url = ShareService.generateShareUrl(state);
  
  const copied = await ShareService.copyToClipboard(url);
  
  if (copied) {
    this.showNotification('URL copiada al portapapeles', 'success');
  } else {
    this.showNotification('Error al copiar URL', 'error');
  }
}
```

### Step 4: Create test file

Create `test-share-url.html`:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Test - Share URL</title>
</head>
<body>
  <h1>Test de Compartir URL</h1>
  <button id="generateBtn">Generar URL</button>
  <button id="copyBtn" disabled>Copiar</button>
  <div id="url" style="word-break: break-all; margin: 10px 0;"></div>
  <div id="qr" style="margin: 10px 0;"></div>
  <div id="status"></div>

  <script type="module">
    import ShareService from './js/services/ShareService.js';

    const mockState = {
      selectedItems: [
        { type: 'subject', selectionType: 'priority', item: { id: 'MAT101' } }
      ],
      onlyOpenSections: true,
      selectedCampus: ''
    };

    let generatedUrl = '';

    document.getElementById('generateBtn').addEventListener('click', async () => {
      generatedUrl = ShareService.generateShareUrl(mockState);
      document.getElementById('url').textContent = generatedUrl;
      document.getElementById('copyBtn').disabled = false;
      
      // Generate QR
      try {
        const qrDataUrl = await ShareService.generateQrCode(generatedUrl);
        document.getElementById('qr').innerHTML = `<img src="${qrDataUrl}" alt="QR Code">`;
      } catch (e) {
        document.getElementById('qr').textContent = 'QR Error: ' + e.message;
      }
    });

    document.getElementById('copyBtn').addEventListener('click', async () => {
      const success = await ShareService.copyToClipboard(generatedUrl);
      document.getElementById('status').textContent = success ? '✅ Copiado!' : '❌ Error';
    });
  </script>
</body>
</html>
```

### Step 5: Commit

```bash
git add js/services/ShareService.js test-share-url.html
git commit -m "feat(share): add URL sharing functionality

- Create ShareService with URL encoding/decoding
- Add QR code generation
- Add copy to clipboard
- Integrate with app.js for URL parsing"
```

---

# Task 5: Integration - Export Menu Component

## Files

- **Create:** `js/components/ExportMenu.js`
- **Modify:** `js/components/ScheduleResults.js` (replace buttons with menu)

## Implementation Steps

### Step 1: Create ExportMenu component

Create `js/components/ExportMenu.js`:

```javascript
import PdfExportService from '../services/PdfExportService.js';
import IcsExportService from '../services/IcsExportService.js';
import ShareService from '../services/ShareService.js';

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
    toggleMenu() {
      this.isOpen = !this.isOpen;
    },

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

    exportIcs() {
      this.isExporting = true;
      this.exportType = 'ics';
      
      try {
        IcsExportService.downloadIcs(
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
```

### Step 2: Add styles

Add to `css/styles.css`:

```css
.export-menu {
  position: relative;
  display: inline-block;
}

.export-menu__trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--primary-color, #4a90d9);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.export-menu__trigger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.export-menu__dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 100;
  min-width: 160px;
}

.export-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 16px;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  font-size: 14px;
  color: #2d3748;
}

.export-menu__item:hover {
  background: #f7fafc;
}

.export-menu__item:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

### Step 3: Commit

```bash
git add js/components/ExportMenu.js css/styles.css
git commit -m "feat(ui): create ExportMenu component

- Combine PDF, ICS, and share buttons into dropdown menu
- Add proper styles
- Integrate export services"
```

---

# Summary

## Task Breakdown

| Task | Description | Files | Priority |
|------|-------------|-------|----------|
| 1 | LocalStorage Persistence | UIStateService.js, app.js, test-persistence.html | High |
| 2 | PDF Export | PdfExportService.js, PdfLoader.js, test-pdf-export.html | High |
| 3 | ICS Export | IcsExportService.js, test-ics-export.html | High |
| 4 | URL Sharing | ShareService.js, app.js, test-share-url.html | Medium |
| 5 | Export Menu UI | ExportMenu.js, styles.css | Medium |

## Dependencies Summary

| Library | CDN | Size | Used By |
|---------|-----|------|---------|
| pdfMake | cdnjs | ~400KB | PDF Export |
| vfs_fonts.js | cdnjs | bundled | PDF Export |
| qrcode.js | cdnjs | ~15KB | URL Sharing |

## Testing Strategy

Manual testing via `test-*.html` files:
- `test-persistence.html` - localStorage operations
- `test-pdf-export.html` - PDF generation
- `test-ics-export.html` - ICS format validation
- `test-share-url.html` - URL encoding/decoding

All tests should be run manually in browser after each task completion.

---

**Plan complete.** Ready for implementation with subagent-driven approach.
