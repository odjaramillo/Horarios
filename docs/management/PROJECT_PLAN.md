# Project Plan - Horarios UCAB

## Sprint Progress

**Current Sprint:** Sprint 2 (Week 2 - Mar 2026)
**Start Date:** 2026-03-01
**End Date:** 2026-03-07

### Sprint Goals
- [ ] Persistencia local (localStorage) - Need fixes
- [x] Exportar a PDF - Working (Grid layout)
- [x] Exportar a ICS - Working
- [x] Compartir horario - Working (WhatsApp)

---

## Known Issues (Sprint 2)

### Persistencia localStorage
- **Status**: Parcialmente funcionando
- **Issues**:
  - La restauración desde localStorage al cargar usa formato incorrecto
  - El watcher actual guarda pero puede tener race conditions

### Exportar a PDF
- **Status**: ✅ Working
- **Notes**: pdfMake 0.2.12 desde CDN, layout convertido a tabla de horarios.

### Exportar a ICS  
- **Status**: ✅ Working
- **Notes**: Genera archivo válido en fechas correspondientes del semestre.

### Compartir horario
- **Status**: ✅ Working
- **Notes**: Se reemplazó el link con texto dinámico directo a WhatsApp para compartir más fácil.

---

## Backlog

### Sprint 2 (Current - Issues to Fix)

| Task | Status | Priority | Notes |
|------|--------|----------|-------|
| Persistencia local | ⚠️ Need Fixes | High | Pendiente validación de restauración |
| Exportar a PDF | ✅ Working | High | Layout grid completado |
| Exportar a ICS | ✅ Working | High | - |
| Compartir horario | ✅ Working | Medium | WhatsApp feature añadido |

### Sprint 3

| Task | Priority |
|------|----------|
| Fix Sprint 2 issues | High |
| Rediseño visual completo | ✅ Working | High | Rebuilt into Pro Max Light Mode UI |
| Migración a Vite + Vue | High |
| ARIA labels y focus management | High |

---

## Completed Milestones

| Milestone | Date Completed | Notes |
|-----------|---------------|-------|
| MVP | 2026-02-28 | Core features working |
| Fase 1: Quick Wins | 2026-02-28 | 3/4 tasks done |
| Sprint 2: Core Features | 2026-03-01 | Parcial - necesita fixes |

---

## Notes

- Sprint 2 features implementadas pero con bugs conocidos
- Rama `fix/export-fixes` tiene los últimos cambios
- Necesita más testing antes de merge a main
