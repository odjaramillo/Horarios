# AGENTS.md - Horarios Project Guidelines

## Project Overview
This is a **Vue 3** browser-based application for scheduling (UCAB university course scheduler). It uses vanilla JavaScript with ES modules, loaded directly from CDN. No build step is required.

---

## Commands

### Development
```bash
npm run serve   # Start local static file server (npx serve .)
```

### Testing
This project has **no automated test framework** configured. Manual testing is done via HTML test files:
- `test-*.html` files in root directory
- Open directly in browser or serve with `npm run serve`

To add testing in the future, consider:
```bash
npm install --save-dev jest @vue/vue3-jest @vue/test-utils
# Or use Vitel/Vite for proper Vue 3 testing
```

### No Linting/Formatting Currently
There is **no ESLint or Prettier** configured. Code style is enforced manually (see guidelines below).

---

## Code Style Guidelines

### General Principles
- **Language**: Spanish for user-facing text and JSDoc comments; English for code identifiers
- **JavaScript Version**: ES2020+ (browser modern features)
- **Module System**: ES Modules (import/export), loaded via `<script type="module">`

### File Organization
```
js/
├── app.js                    # Main Vue app entry point
├── components/              # Vue components (Options API)
│   ├── SubjectCard.js
│   ├── SubjectSelector.js
│   ├── SelectionPanel.js
│   └── ...
├── services/                 # Business logic (plain JS objects)
│   ├── ScheduleGeneratorService.js
│   ├── CourseService.js
│   └── ...
└── utils/                    # Utility functions
    └── HtmlUtils.js
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case | `schedule-generator-service.js` |
| Vue Components | PascalCase | `SubjectCard.js`, `SelectionPanel.js` |
| Variables | camelCase | `selectedItems`, `generatedSchedules` |
| Functions | camelCase | `generateSchedules()`, `filterSubjects()` |
| Constants | UPPER_SNAKE_CASE | `MAX_COMBINATIONS` |
| CSS Classes | BEM-like | `subject-card__header`, `section-card--selected` |
| Vue Props | camelCase | `onlyOpenSections`, `selectedCampus` |

### Import/Export Style
```javascript
// Named imports from CDN Vue
import { createApp } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';

// Relative imports (no file extension needed for ES modules in browsers)
import CourseList from './components/CourseList.js';
import ScheduleGeneratorService from '../services/ScheduleGeneratorService.js';

// Export default for Vue components
export default {
  // component definition
};

// Named exports for services/utilities
export { decodeHtmlEntities };
```

### Vue Component Structure
Use **Options API** (not Composition API):
```javascript
export default {
  // 1. Props with validation
  props: {
    subject: { type: Object, required: true },
    isSelected: { type: Boolean, default: false },
    selectionType: {
      type: String,
      default: null,
      validator: value => value === null || ['priority', 'candidate'].includes(value)
    }
  },

  // 2. Emits
  emits: ['toggle-selection', 'section-selection'],

  // 3. Data
  data() {
    return { currentView: 'hybrid-selector' };
  },

  // 4. Computed
  computed: {
    priorityItems() {
      return this.selectedItems.filter(item => item.selectionType === 'priority');
    }
  },

  // 5. Methods
  methods: {
    handleCardClick() {
      this.$emit('toggle-selection', this.subject);
    }
  },

  // 6. Template (inline)
  template: `...`
};
```

### JSDoc Comments (Spanish)
```javascript
/**
 * Genera todos los horarios posibles a partir de las materias seleccionadas
 * @param {Array} selectedSubjects - Materias seleccionadas (agrupadas)
 * @param {Boolean} onlyOpenSections - Si solo se consideran secciones abiertas
 * @param {String} selectedCampus - Campus para filtrar (opcional)
 * @return {Array} Combinaciones válidas de horarios
 */
generatePossibleSchedules(selectedSubjects, onlyOpenSections = true, selectedCampus = '') {
  // ...
}
```

### Error Handling
- Use `console.log()` for informational messages
- Return error objects with descriptive messages:
```javascript
return {
  schedules: [],
  errors: ['Debes seleccionar al menos una materia para generar horarios.']
};
```
- Validate props with validators for early failure detection

### Vue Template Guidelines
- Use kebab-case for attribute binding:
  ```html
  <component :prop-name="value" @event-name="handler" />
  ```
- Use v-bind for dynamic classes:
  ```html
  <div :class="['base-class', { 'modifier': isActive }]"></div>
  ```
- Always provide keys for v-for loops:
  ```html
  <div v-for="section in subject.sections" :key="section.id">
  ```

### CSS Guidelines
- Keep CSS in separate files: `css/component-name.css`
- Use BEM naming for component-specific styles
- Use CSS custom properties (variables) for theming:
  ```css
  :root {
    --primary-color: #4a90d9;
    --card-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
  ```

---

## Important Notes for Agents

1. **No Build Required**: Edit `.js` files directly; browser loads ES modules
2. **Testing**: Open `test-*.html` files in browser for manual testing
3. **Data Files**: three generated artifacts, none edited by hand.
   - `npm run plan` reads `data/plan-de-estudio.pdf` (the official curriculum) and writes `data/malla-informatica.json`. Page 1 of that PDF is a table whose "Prelaciones" column spells out every prerequisite, so nothing is transcribed from the diagram. Visual placement — area colour and row — lives in `data/diagrama-informatica.json`, which is hand-maintained and only ever read.
   - `npm run merge` reads the paginated `data/searchResults*` responses downloaded from Banner, joins the curriculum, and writes `public/courses.json`. It validates the join against the credit totals the curriculum declares per semester and warns on any mismatch.
   - `npm run ucab` calls the two public RPCs behind the School's enrolment page and writes `data/ucab-schedules.json`. Banner returns an empty `faculty` array for every section, so this is the only source for the lecturer's name and for the P/V modality; it also lists sections Banner's search never returned. `npm run merge` folds it in by CRN, and skips it with a warning when the file is absent.
   - Requires `pdftotext` (poppler-utils) for `npm run plan` only.
4. **No TypeScript**: Use JSDoc and plain JavaScript
5. **Browser Compatibility**: Target modern browsers (Chrome, Firefox, Safari, Edge)

---

## Future Improvements to Consider
- Add ESLint + Prettier for code quality
- Set up Vitest or Jest for unit testing
- Consider migrating to TypeScript
- Add a proper build system (Vite)
