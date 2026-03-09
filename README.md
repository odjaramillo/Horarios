# Planificador de Horarios UCAB

> Una aplicación web para planificar horarios académicos de la Universidad Católica Andrés Bello (UCAB).

[![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub%20Pages-blue)](https://oscaralvaro.github.io/Horarios/)
[![Vue 3](https://img.shields.io/badge/Vue-3.3.4-green)](https://vuejs.org)
[![License](https://img.shields.io/badge/License-ISC-yellow)](LICENSE)

## ✨ Características

### Core
- **Selección de materias**: Explora las materias disponibles y selecciónalas según tus necesidades
- **Selección por secciones**: Elige secciones específicas de cada materia
- **Generación automática**: Crea todas las combinaciones posibles de horarios sin conflictos
- **Sin conflictos garantizados**: El algoritmo verifica que no haya superposición de horarios

### Filtros
- **Por campus**: Caracas, Valencia, San Cristóbal
- **Solo secciones abiertas**: Oculta secciones con cupos llenos
- **Búsqueda**: Por código, nombre o título de materia

### Tipos de Selección
- **Prioritarias**: Materias que deben aparecer en todos los horarios generados
- **Candidatas**: Materias opcionales que se incluirán si no generan conflictos

### Exportación (En desarrollo)
- [ ] Exportar a PDF
- [ ] Exportar a ICS (calendario)
- [ ] Compartir enlace

### Persistencia (En desarrollo)
- [ ] Guardar selección automáticamente
- [ ] Horarios favoritos

---

## 🚀 Demo

**Accede a la aplicación:** [https://oscaralvaro.github.io/Horarios/](https://oscaralvaro.github.io/Horarios/)

---

## 📖 Cómo Usar

1. **Selecciona tus materias**: Haz clic en las materias que deseas cursar
2. **Elige secciones específicas** (opcional): Expande una materia y selecciona secciones particulares
3. **Configura opciones**: Activa "Solo secciones abiertas" y selecciona tu sede preferida
4. **Genera horarios**: Haz clic en "Generar Horarios" y explora las combinaciones disponibles
5. **Navega**: Usa los botones anterior/siguiente para ver todas las combinaciones

---

## 🛠️ Desarrollo

### Requisitos Previos

- Node.js 18+ 
- npm 9+

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/oscaralvaro/Horarios.git
cd Horarios

# Instalar dependencias
npm install
```

### Comandos Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run serve` | Iniciar servidor local (http://localhost:3000) |
| `npm run build` | Build para producción |
| `npm run deploy` | Desplegar a GitHub Pages |

---

## 📁 Estructura del Proyecto

```
/
├── index.html              # Punto de entrada
├── js/
│   ├── app.js            # Aplicación Vue principal
│   ├── components/       # Componentes Vue
│   │   ├── SectionSelector.js
│   │   ├── SubjectCard.js
│   │   ├── ScheduleResults.js
│   │   └── ...
│   ├── services/         # Lógica de negocio
│   │   ├── ScheduleGeneratorService.js
│   │   ├── CourseService.js
│   │   └── ...
│   └── utils/            # Utilidades
├── css/                   # Estilos
├── results.json          # Datos de cursos
├── docs/                 # Documentación
│   ├── PRD.md           # Product Requirements
│   ├── UIRD.md          # UI/UX Requirements  
│   └── TRD.md           # Technical Requirements
└── html-to-json.js      # Script para scraping
```

---

## 📚 Documentación

- [Product Requirements Document (PRD)](docs/PRD.md) - Visión de producto y roadmap
- [UI/UX Requirements (UIRD)](docs/UIRD.md) - Especificaciones de diseño
- [Technical Requirements (TRD)](docs/TRD.md) - Arquitectura y technical specs

---

## 🗺️ Roadmap

### Fase 1: Quick Wins
- [ ] Nueva tipografía y paleta de colores
- [ ] Corregir accesibilidad WCAG
- [ ] Vue production build

### Fase 2: Funcionalidades Core
- [ ] Persistencia local (localStorage)
- [ ] Exportar a PDF
- [ ] Exportar a ICS
- [ ] Compartir horario

### Fase 3: Experiencia Premium
- [ ] Rediseño visual completo
- [ ] Migración a Vite + Vue
- [ ] Analytics

### Fase 4: Growth
- [ ] Landing page
- [ ] Métricas y análisis
- [ ] Considerar otras universidades

---

## 🔧 Tecnologías

| Tecnología | Uso |
|------------|-----|
| Vue 3 | Framework UI |
| ES Modules | Módulos JS nativos |
| Bootstrap 5 | Estilos base |
| FontAwesome | Iconos |
| html2canvas | Exportar a PDF |

---

## 📊 Métricas

| Métrica | Target |
|---------|--------|
| Tasa de generación exitosa | > 70% |
| Tiempo hasta primer horario | < 30s |
| Rebote | < 50% |

---

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/amazing-feature`)
3. Commit tus cambios (`git commit -m 'Add amazing feature'`)
4. Push a la rama (`git push origin feature/amazing-feature`)
5. Abre un Pull Request

---

## 📄 Licencia

ISC License - mira el archivo [LICENSE](LICENSE) para detalles.

---

## ⚠️ Notas

- Los datos de cursos se actualizan manualmente desde `results.json`
- La aplicación funciona sin backend - todos los datos se procesan en el navegador
- Compatible con Chrome, Firefox, Safari y Edge (versiones actuales)

---

## 🙏 Agradecimientos

- Universidad Católica Andrés Bello (UCAB) por los datos
- Comunidad Vue.js por el framework
