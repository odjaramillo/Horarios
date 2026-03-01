# Technical Requirements Document (TRD)

## Document Info

| Field | Value |
|-------|-------|
| Project | Planificador de Horarios UCAB |
| Version | 1.0 |
| Status | Draft |
| Last Updated | 2026-02-28 |

---

## 1. Tech Stack Overview

### Current State (CDN-based)

```
├── Vue 3.3.4 (CDN: unpkg)
├── Bootstrap 5.3.0 (CDN: jsdelivr)
├── FontAwesome 6.4.0 (CDN: cdnjs)
├── html2canvas (CDN)
├── results.json (static data)
└── GitHub Pages (hosting)
```

### Recommended Future State (Vite + Vue)

```
├── Vue 3.4+ (ESM via Vite)
├── Vite 5.x (build tool)
├── CSS custom (sin Bootstrap completo)
├── Heroicons o Phosphor Icons
├── TypeScript (opcional, gradual migration)
├── Vitest (testing)
└── GitHub Pages (hosting con build)
```

---

## 2. Architecture Decision: CDN vs Vite

### Analysis Summary

| Factor | CDN Actual | Vite + Vue |
|--------|------------|------------|
| **Setup complexity** | Ninguna | Baja (1 semana) |
| **Bundle size** | ~90KB Vue completo | ~30KB tree-shaken |
| **Dev experience** | Basic (live reload manual) | Excelente (HMR) |
| **Production optimization** | Ninguna | Automática |
| **Tree shaking** | ❌ No | ✅ Sí |
| **Code splitting** | ❌ No | ✅ Sí |
| **Minificación** | ❌ No | ✅ Sí |
| **ES modules** | ✅ Sí (ya usa) | ✅ Mejor |

### Recommendation

**Migrar a Vite** con estrategia gradual:
1. Mantener archivos .js actuales
2. Agregar build step con Vite
3. Migrar componentes a .vue gradualmente

---

## 3. Migration Plan to Vite

### Phase 1: Setup (1-2 días)

```bash
# Install dependencies
npm init -y
npm install vite @vitejs/plugin-vue --save-dev

# Create vite.config.js
```

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  base: process.env.NODE_ENV === 'production' ? '/Horarios/' : '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['vue'],
          'utils': ['./js/utils/HtmlUtils.js']
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': '/js'
    }
  }
});
```

### Phase 2: Configuration (1 día)

```json
// package.json
{
  "name": "horarios-ucab",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "npm run build && npx gh-pages -d dist"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "@vitejs/plugin-vue": "^5.0.0"
  }
}
```

### Phase 3: Folder Structure

```
horarios/
├── index.html              # Entry point (actual)
├── src/
│   ├── main.js             # Vue app mount
│   ├── App.vue             # Root component
│   ├── components/         # Vue components
│   │   ├── SectionSelector.vue
│   │   ├── SubjectCard.vue
│   │   ├── ScheduleResults.vue
│   │   └── ...
│   ├── services/          # Business logic
│   │   ├── ScheduleGeneratorService.js
│   │   ├── CourseService.js
│   │   └── ...
│   ├── utils/
│   │   └── HtmlUtils.js
│   └── styles/
│       ├── main.css
│       └── variables.css
├── public/
│   ├── results.json        # Static data
│   └── favicon.svg
├── vite.config.js
└── package.json
```

### Phase 4: Migration Checklist

| Task | Effort | Priority |
|------|--------|----------|
| Crear vite.config.js | Bajo | P0 |
| Actualizar package.json | Bajo | P0 |
| Mover archivos a src/ | Bajo | P0 |
| Crear App.vue wrapper | Medio | P1 |
| Convertir componentes a .vue | Alto | P2 |
| Agregar TypeScript (opt) | Alto | P3 |
| Agregar Vitest | Medio | P3 |

---

## 4. Performance Optimization

### Current Performance Analysis

| Resource | Size (CDN) | Optimization Opportunity |
|----------|------------|--------------------------|
| Vue 3 (esm-browser) | ~500KB | ✅ Tree-shake con Vite |
| Bootstrap CSS | ~200KB | ✅ CSS custom (ahorrar ~150KB) |
| FontAwesome | ~100KB | ✅ Iconos específicos o alternativa |
| Roboto font | ~20KB | ✅ DM Sans (similar) |
| html2canvas | ~150KB | Load on-demand |
| Custom CSS | ~50KB | Minification |
| JS app | ~40KB | Tree-shake |

### Target Metrics

| Metric | Current | Target | Priority |
|--------|---------|--------|----------|
| LCP | ~3s | < 2.5s | Alta |
| TTI | ~4s | < 3s | Alta |
| Bundle size | ~1MB | < 300KB | Media |
| Time to first schedule | N/A | < 3s | Alta |

### Implementation

#### 1. Vue Production Build

```html
<!-- Cambiar de: -->
<script src="https://cdn.jsdelivr.net/npm/vue@3.3.4/dist/vue.global.js"></script>

<!-- A: -->
<script src="https://cdn.jsdelivr.net/npm/vue@3.3.4/dist/vue.global.prod.js"></script>
```

#### 2. Lazy Loading de Componentes

```javascript
// En app.js
import { createApp, defineAsyncComponent } from 'vue';

const ScheduleResults = defineAsyncComponent(() => 
  import('./components/ScheduleResults.js')
);

const CourseList = defineAsyncComponent(() => 
  import('./components/CourseList.js')
);
```

#### 3. html2canvas On-Demand

```javascript
// Solo cargar cuando se necesite exportar
window.loadHtml2Canvas = async () => {
  if (!window.html2canvas) {
    const module = await import('https://html2canvas.hertzen.com/dist/html2canvas.min.js');
    window.html2canvas = module.default;
  }
  return window.html2canvas;
};
```

#### 4. Data Caching

```javascript
// Session storage con TTL
const CACHE_TTL = 3600000; // 1 hora

async function loadCoursesWithCache() {
  const cacheKey = 'ucab_courses_cache';
  const cached = sessionStorage.getItem(cacheKey);
  
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_TTL) {
      return data;
    }
  }
  
  const response = await fetch('results.json');
  const data = await response.json();
  
  sessionStorage.setItem(cacheKey, JSON.stringify({
    data,
    timestamp: Date.now()
  }));
  
  return data;
}
```

---

## 5. Security & Compliance

### Security Checklist

| Requirement | Status | Notes |
|-------------|--------|-------|
| HTTPS en todos los recursos | ✅ Ya implementado | GitHub Pages proporciona |
| No almacenar datos sensibles | ✅ Cumple | Solo localStorage |
| CSP headers | ⚠️ Por implementar | GitHub Pages limita |
| Sanitizar inputs | ✅ Ya implementado | Vue escaping por defecto |
| Dependencias actualizadas | 🔄 Mantener | Revisar regularmente |

### Content Security Policy (Opcional)

```html
<!-- En index.html -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://html2canvas.hertzen.com; 
               style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; 
               font-src 'self' https://fonts.gstatic.com; 
               img-src 'self' data:;">
```

---

## 6. Browser Support

### Supported Browsers

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 90+ | ✅ Full |
| Firefox | 88+ | ✅ Full |
| Safari | 14+ | ✅ Full |
| Edge | 90+ | ✅ Full |

### Polyfills (if needed)

```javascript
// polyfills.js - solo cargar si es necesario
import 'core-js/stable';
import 'regenerator-runtime/runtime';
```

---

## 7. Build & Deployment

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### Alternative: Simple Deploy Script

```json
// package.json
{
  "scripts": {
    "deploy": "npm run build && npx gh-pages -d dist -m 'chore: deploy to GitHub Pages'"
  }
}
```

---

## 8. Third-Party Dependencies

### Current Dependencies

| Package | Version | Purpose | Alternative |
|---------|---------|---------|-------------|
| Vue 3 | 3.3.4 | Framework | N/A (core) |
| Bootstrap 5 | 5.3.0 | CSS framework | CSS custom |
| FontAwesome | 6.4.0 | Icons | Heroicons |
| html2canvas | latest | PDF export | jspdf |

### Dependency Management

| License | Allowed | Notes |
|---------|---------|-------|
| MIT | ✅ Yes | Principal |
| Apache 2.0 | ✅ Yes | Principal |
| BSD-3 | ✅ Yes | Principal |
| GPL | ⚠️ Caution | Avoid unless isolated |
| Proprietary | ❌ No | Not allowed |

### Dependency Updates

```json
// renovate.json
{
  "extends": ["config:base"],
  "packageRules": [
    {
      "matchPackagePatterns": ["*"],
      "matchUpdateTypes": ["minor", "patch"],
      "groupName": "all non-major dependencies",
      "groupSlug": "all-minor-patch"
    }
  ]
}
```

---

## 9. Code Quality

### ESLint Configuration (Future)

```javascript
// .eslintrc.cjs
module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    'vue/multi-word-component-names': 'off',
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off'
  }
};
```

### Prettier Configuration (Future)

```json
// .prettierrc
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "none",
  "printWidth": 100
}
```

---

## 10. Testing Strategy (Future)

### Testing Pyramid

```
        /\
       /E2E\      ← Playwright (critical flows)
      /-----\
     /ITests\    ← Vitest (component integration)
    /-------\
   /UTests \    ← Vitest (unit tests)
  /----------\
```

### Unit Tests (Vitest)

```javascript
// test/ScheduleGeneratorService.test.js
import { describe, it, expect } from 'vitest';
import { generateSchedules } from '../src/services/ScheduleGeneratorService.js';

describe('ScheduleGeneratorService', () => {
  it('should generate valid schedules', () => {
    const subjects = [
      { id: '1', sections: [{ meetingsFaculty: [{ meetingTime: { monday: true, beginTime: '0700', endTime: '0830' } }] }] }
    ];
    
    const result = generateSchedules(subjects, true);
    
    expect(result.schedules).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });
});
```

---

## 11. Monitoring & Analytics

### Analytics Implementation

```javascript
// utils/analytics.js
const analytics = {
  track(event, properties = {}) {
    console.log(`[Analytics] ${event}`, properties);
    // GA4 implementation here when ID available
    // gtag('event', event, properties);
  },
  
  pageview(pagePath) {
    console.log(`[Pageview] ${pagePath}`);
    // gtag('config', 'GA_MEASUREMENT_ID', { page_path: pagePath });
  }
};

// Usage
analytics.pageview(window.location.pathname);
analytics.track('subject_selected', { 
  subjectId: 'INF-101', 
  selectionType: 'priority' 
});
```

### Events to Track

| Event | Trigger | Properties |
|-------|---------|------------|
| page_loaded | App mounts | timestamp |
| subject_selected | Click on subject | subjectId, type |
| generate_clicked | Click generate | priorityCount, candidateCount |
| schedule_generated | Generation complete | count, duration |
| export_pdf | Export initiated | scheduleIndex |
| export_ics | Export initiated | scheduleIndex |

---

## 12. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Migration rompe producción | Alto | Baja | Mantener CDN como fallback |
| Build size aumenta | Medio | Baja | Monitorear bundle size |
| GitHub Pages downtime | Medio | Muy baja | CDN fallback |
| Dependencias vulnerables | Alto | Media | Dependabot alerts |
| Breaking changes Vue | Medio | Baja | Version pinning |

---

## Approval

| Role | Name | Date |
|------|------|------|
| Technical Lead | Oscar | 2026-02-28 |
| Product Manager | | |
| Engineering Lead | | |
