# Guía de Desarrollo

Este documento describe cómo desarrollar y contribuir al proyecto.

---

## Requisitos Previos

- **Node.js** 18+ 
- **npm** 9+

---

## Comandos Disponibles

### Desarrollo Local

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Iniciar servidor local (puerto por defecto) |
| `npm run serve` | Iniciar servidor local en puerto 3000 |
| `npm run serve:open` | Iniciar servidor y abrir navegador |

### Despliegue

| Comando | Descripción |
|---------|-------------|
| `npm run deploy` | Desplegar a GitHub Pages (rama gh-pages) |
| `npm run deploy:ci` | Desplegar desde CI/CD (sin prompts) |

### Datos

| Comando | Descripción |
|---------|-------------|
| `npm run scrape` | Ejecutar script de scraping para actualizar datos |
| `npm run scrape:check` | Verificar sintaxis del script de scraping |

### Calidad de Código

| Comando | Descripción |
|---------|-------------|
| `npm run lint` | Verificar código (pendiente configurar) |
| `npm run format` | Formatear código (pendiente configurar) |
| `npm run test` | Ejecutar tests (pendiente configurar) |

---

## Flujo de Desarrollo

### 1. Iniciar Desarrollo

```bash
# Instalar dependencias (primera vez)
npm install

# Iniciar servidor de desarrollo
npm run serve
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

### 2. Hacer Cambios

1. Edita los archivos en `js/` para lógica
2. Edita los archivos en `css/` para estilos
3. Los cambios se recargan automáticamente con el servidor

### 3. Actualizar Datos

```bash
# Ejecutar scraping de datos
npm run scrape
```

Esto actualiza `results.json` con los últimos datos de la UCAB.

### 4. Desplegar

```bash
# Desplegar a GitHub Pages
npm run deploy
```

---

## Estructura de Archivos

```
/
├── index.html          # Entry point
├── package.json        # Configuración npm
├── js/
│   ├── app.js         # Vue app principal
│   ├── components/     # Componentes Vue
│   ├── services/       # Lógica de negocio
│   └── utils/         # Utilidades
├── css/               # Estilos
├── results.json       # Datos de cursos
├── html-to-json.js   # Script de scraping
└── docs/             # Documentación
```

---

## Migración Futura a Vite

Cuando se migre a Vite, los comandos cambiarán:

```bash
# Nuevo package.json incluirá:
npm run dev        # Dev server con HMR
npm run build      # Build de producción
npm run preview   # Preview del build
```

Consulta [TRD.md](TRD.md) para detalles de la migración.

---

## Tips de Desarrollo

### Debug en Navegador

- Abre DevTools (F12)
- Los console logs aparecen en la consola
- Usa `Vue Developer Tools` para inspeccionar componentes

### Añadir Dependencias

```bash
# Dependencia de producción
npm install <package>

# Dependencia de desarrollo
npm install -D <package>
```

### Actualizar Cheerio (scraper)

```bash
npm update cheerio
```

---

## Problemas Comunes

### El servidor no inicia

```bash
# Verificar que el puerto no esté en uso
lsof -i :3000

# Usar otro puerto
npm run dev -- -p 3001
```

### Los cambios no se reflejan

- Recarga la página manualmente (Ctrl+F5)
- Verifica que el servidor esté corriendo

### Error al hacer deploy

- Asegúrate de tener acceso al repositorio
- Verifica que no haya archivos grandes en `.gitignore`

---

## Recursos

- [Documentación Vue 3](https://vuejs.org/guide/)
- [Vue 3 CDN](https://unpkg.com/vue@3/dist/vue.esm-browser.js)
- [GitHub Pages](https://pages.github.com/)
- [gh-pages](https://github.com/tschaub/gh-pages)
