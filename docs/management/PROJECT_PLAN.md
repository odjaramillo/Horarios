# Project Plan - Horarios UCAB

## Sprint Progress

**Current Sprint:** Sprint 2 (Week 2 - Mar 2026)
**Start Date:** 2026-03-01
**End Date:** 2026-03-07

### Sprint Goals
- [ ] Persistencia local (localStorage) - Need fixes
- [x] Exportar a PDF - Working
- [ ] Exportar a ICS - Partial (hora incorrecta)
- [ ] Compartir horario - Partial (restauración no funciona)

---

## Known Issues (Sprint 2)

### Persistencia localStorage
- **Status**: Parcialmente funcionando
- **Issues**:
  - La restauración desde localStorage al cargar usa formato incorrecto
  - El watcher actual guarda pero puede tener race conditions

### Exportar a PDF
- **Status**: ✅ Working
- **Notes**: pdfMake 0.2.12 desde CDN funciona

### Exportar a ICS  
- **Status**: ⚠️ Parcial
- **Issues**:
  - La hora se calcula incorrectamente (19:00 vs 08:30)
  - Fechas usan UTC en vez de hora local

### Compartir horario
- **Status**: ⚠️ Parcial
- **Issues**:
  - URL se genera correctamente
  - Restauración desde URL no funciona completamente
  - Falta integrarse con CourseService para buscar materias

---

## Backlog

### Sprint 2 (Current - Issues to Fix)

| Task | Status | Priority | Notes |
|------|--------|----------|-------|
| Persistencia local | ⚠️ Need Fixes | High | Restauración no funciona |
| Exportar a PDF | ✅ Working | High | - |
| Exportar a ICS | ⚠️ Need Fixes | High | Hora incorrecta |
| Compartir horario | ⚠️ Need Fixes | Medium | Restauración falla |

### Sprint 3

| Task | Priority |
|------|----------|
| Fix Sprint 2 issues | High |
| Rediseño visual completo | Medium |
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
