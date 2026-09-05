import { generateSchedules, parseTime } from '../domain/schedule.js';
import {
  approvedCredits,
  electiveEligibility,
  eligibility,
  expandApproved,
  openElectiveSlots,
  withoutApproved
} from '../domain/progress.js';

const PLAN_KEY = 'horarios:plan';
const PRESETS_KEY = 'horarios:presets';
const FAVORITES_KEY = 'horarios:favoritos';
const APPROVED_KEY = 'horarios:aprobadas';
const PLAN_VERSION = 3;

/** Filtros y restricciones, con sus valores de partida */
const DEFAULT_FILTERS = {
  query: '',
  professor: '',
  department: '',
  semester: '',
  campus: '',
  availability: 'open',
  progress: '',
  avoidDays: [],
  earliest: '',
  latest: ''
};

/**
 * Codifica un objeto para viajar en la URL.
 * Usa el alfabeto base64url porque el base64 clásico incluye "+", y al leer la
 * query ese "+" se convierte en espacio y rompe la decodificación.
 * @param {Object} value - Estado a compartir
 * @return {String} Cadena segura para una URL
 */
function encodeState(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));

  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

/**
 * Recupera el objeto guardado en una URL compartida
 * @param {String} encoded - Cadena base64url
 * @return {Object|null} Estado, o null si no se puede leer
 */
function decodeState(encoded) {
  try {
    const binary = atob(encoded.replaceAll('-', '+').replaceAll('_', '/'));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));

    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

/**
 * Normaliza texto para buscar sin acentos ni mayúsculas
 * @param {String} text - Texto a normalizar
 * @return {String} Texto comparable
 */
function normalize(text) {
  return (text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Estado único de la aplicación.
 *
 * Todo lo que se ve en pantalla sale de acá. Los horarios no se "generan y se
 * guardan": se derivan de la selección, así que no existe la posibilidad de que
 * la lista y el horario muestren cosas distintas.
 */
class Planner {
  /** @type {{subjects: Array, term: Object|null}} */
  data = $state({ subjects: [], term: null });

  /** @type {'loading'|'ready'|'error'} */
  status = $state('loading');
  error = $state(null);

  /**
   * Filtros y restricciones en un solo objeto: así un preset se guarda y se
   * aplica de una pieza, sin enumerar campos en tres lugares distintos.
   */
  filters = $state({ ...DEFAULT_FILTERS });

  /** @type {Array<{id: String, name: String, filters: Object}>} */
  presets = $state([]);

  /**
   * Horarios guardados. Se almacenan como pares materia/NRC concretos, no como
   * la selección que los produjo: un horario favorito es una decisión tomada,
   * y debe abrirse igual aunque después cambies los filtros.
   * @type {Array<{id: String, name: String, savedAt: String, entries: Array}>}
   */
  favorites = $state([]);

  /** Identificadores de materia, en el orden en que se eligieron */
  selectedIds = $state([]);

  /** Materias que entran solo si caben; el resto son obligatorias */
  optionalIds = $state([]);

  /** Secciones fijadas a mano: {subjectId: [crn]}. Vacío = todas valen. */
  sectionLocks = $state({});

  optionIndex = $state(0);

  /**
   * Materias aprobadas, solo las que el estudiante marcó a mano. Las deducidas
   * se calculan; guardar la deducción convertiría un dato inferido en un hecho.
   * Nunca viaja en el enlace para compartir: es historia académica personal.
   */
  approvedIds = $state([]);

  #subjectsById = $derived(new Map(this.data.subjects.map(subject => [subject.id, subject])));

  departments = $derived([...new Set(this.data.subjects.map(subject => subject.subject))].sort());

  /** Áreas de formación del plan, para colorear y etiquetar */
  areas = $derived(this.data.plan?.areas ?? {});

  /** Semestres presentes en las materias que se dictan */
  semesters = $derived(
    [...new Set(this.data.subjects.map(subject => subject.semester).filter(Boolean))].sort(
      (a, b) => a - b
    )
  );

  /** Materias del plan de estudios, se dicten o no este período */
  planSubjects = $derived(this.data.plan?.subjects ?? []);

  /** Lo aprobado, separando lo marcado de lo deducido por prerrequisitos */
  progress = $derived(expandApproved(this.approvedIds, this.planSubjects));

  earnedCredits = $derived(approvedCredits(this.progress.approved, this.planSubjects));

  /** Ranuras de electiva del plan que siguen libres */
  openElectives = $derived(openElectiveSlots(this.planSubjects, this.progress.approved));

  /**
   * Materias que se dictan y que el avance actual habilita.
   * Se cuenta sobre el catálogo, no sobre el plan, para que el número coincida
   * con lo que el filtro deja ver: las electivas concretas también entran.
   */
  eligibleNow = $derived(this.data.subjects.filter(subject => this.eligibilityOf(subject)?.ok));

  campuses = $derived(
    [...new Set(this.data.subjects.flatMap(subject => subject.sections.map(section => section.campus)))]
      .filter(Boolean)
      .sort()
  );

  /** Restricciones que le tocan al generador, ya traducidas a su unidad */
  constraints = $derived({
    availability: this.filters.availability,
    campus: this.filters.campus,
    avoidDays: this.filters.avoidDays,
    earliest: parseTime(this.filters.earliest),
    latest: parseTime(this.filters.latest)
  });

  /** Cuántas restricciones están activas, para avisarlo en la interfaz */
  activeFilterCount = $derived(
    Object.entries(this.filters).filter(([key, value]) => {
      if (key === 'availability') return value !== DEFAULT_FILTERS.availability;
      return Array.isArray(value) ? value.length > 0 : Boolean(value);
    }).length
  );

  visibleSubjects = $derived.by(() => {
    const needle = normalize(this.filters.query);
    const teacher = normalize(this.filters.professor);

    return this.data.subjects.filter(subject => {
      if (this.filters.department && subject.subject !== this.filters.department) return false;

      if (this.filters.progress) {
        const check = this.eligibilityOf(subject);
        if (!check) return false;

        if (this.filters.progress === 'aprobadas' && !check.alreadyApproved) return false;
        if (this.filters.progress === 'pendientes' && check.alreadyApproved) return false;
        if (this.filters.progress === 'inscribibles' && !check.ok) return false;
      }

      if (this.filters.semester) {
        const wanted = this.filters.semester;
        const actual = subject.semester ?? 'sin-plan';

        if (String(actual) !== String(wanted)) return false;
      }

      if (
        this.filters.campus &&
        !subject.sections.some(section => section.campus === this.filters.campus)
      ) {
        return false;
      }

      if (
        teacher &&
        !subject.sections.some(section =>
          section.professors.some(name => normalize(name).includes(teacher))
        )
      ) {
        return false;
      }

      if (!needle) return true;

      return (
        normalize(subject.id).includes(needle) ||
        normalize(subject.title).includes(needle) ||
        subject.sections.some(section => normalize(section.crn).includes(needle))
      );
    });
  });

  selected = $derived(this.selectedIds.map(id => this.#subjectsById.get(id)).filter(Boolean));

  /** El resultado se recalcula solo cuando cambia algo que lo afecta. */
  result = $derived(
    generateSchedules(this.selected, {
      ...this.constraints,
      sectionLocks: this.sectionLocks,
      optionalIds: this.optionalIds
    })
  );

  current = $derived(this.result.schedules[this.optionIndex] ?? null);

  totalCredits = $derived(this.selected.reduce((sum, subject) => sum + (subject.credits ?? 0), 0));

  /**
   * Carga el catálogo de materias
   * @return {Promise<void>}
   */
  async load() {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}courses.json`);

      if (!response.ok) throw new Error(`El servidor respondió ${response.status}`);

      this.data = await response.json();
      this.status = 'ready';
      this.#restore();
    } catch (error) {
      this.error = error.message;
      this.status = 'error';
    }
  }

  /**
   * Agrega o quita una materia de la selección
   * @param {String} id - Identificador de materia
   */
  toggle(id) {
    const wasSelected = this.selectedIds.includes(id);

    this.selectedIds = wasSelected
      ? this.selectedIds.filter(current => current !== id)
      : [...this.selectedIds, id];

    if (wasSelected) {
      const { [id]: _removed, ...rest } = this.sectionLocks;
      this.sectionLocks = rest;
      this.optionalIds = this.optionalIds.filter(current => current !== id);
    }

    this.optionIndex = 0;
  }

  /**
   * Fija o libera una sección concreta de una materia
   * @param {String} subjectId - Identificador de materia
   * @param {String} crn - NRC de la sección
   */
  toggleSection(subjectId, crn) {
    if (!this.selectedIds.includes(subjectId)) this.toggle(subjectId);

    const locked = this.sectionLocks[subjectId] ?? [];
    const next = locked.includes(crn) ? locked.filter(entry => entry !== crn) : [...locked, crn];

    if (next.length === 0) {
      const { [subjectId]: _removed, ...rest } = this.sectionLocks;
      this.sectionLocks = rest;
    } else {
      this.sectionLocks = { ...this.sectionLocks, [subjectId]: next };
    }

    this.optionIndex = 0;
  }

  /**
   * Indica si una sección está fijada
   * @param {String} subjectId - Identificador de materia
   * @param {String} crn - NRC de la sección
   * @return {Boolean} true si el usuario la fijó
   */
  isLocked(subjectId, crn) {
    return (this.sectionLocks[subjectId] ?? []).includes(crn);
  }

  /**
   * Marca o desmarca una materia como aprobada
   * @param {String} id - Identificador de materia
   */
  toggleApproved(id) {
    // Marcar sube por los prerrequisitos; desmarcar baja por lo que depende.
    // Son la misma regla leída en las dos direcciones.
    this.approvedIds = this.progress.approved.has(id)
      ? withoutApproved(this.approvedIds, id, this.planSubjects)
      : [...this.approvedIds, id];

    this.#save(APPROVED_KEY, this.approvedIds);
  }

  /**
   * Marca como aprobado todo hasta el semestre indicado, incluido
   * @param {Number} semester - Último semestre aprobado
   */
  approveUpTo(semester) {
    const ids = this.planSubjects
      .filter(subject => subject.semester <= semester)
      .map(subject => subject.id);

    this.approvedIds = [...new Set([...this.approvedIds, ...ids])];
    this.#save(APPROVED_KEY, this.approvedIds);
  }

  /** Olvida todo el avance marcado */
  clearApproved() {
    this.approvedIds = [];
    this.#save(APPROVED_KEY, this.approvedIds);
  }

  /**
   * Indica si una materia está aprobada, y si fue por marca o por deducción
   * @param {String} id - Identificador de materia
   * @return {'declarada'|'deducida'|null} Cómo quedó aprobada
   */
  approvalOf(id) {
    if (this.progress.inferred.has(id)) return 'deducida';

    return this.progress.approved.has(id) ? 'declarada' : null;
  }

  /**
   * Motivos por los que una materia no se puede inscribir todavía
   * @param {Object} subject - Materia del plan o del catálogo
   * @return {Object|null} Resultado de la comprobación, o null si no está en el plan
   */
  eligibilityOf(subject) {
    const entry = this.planSubjects.find(current => current.id === subject.id);

    if (entry) return eligibility(entry, this.progress.approved, this.earnedCredits);

    // La práctica se inscribe aparte, pero es la misma materia del plan: si
    // puedes con la teoría, puedes con ella.
    if (subject.practiceOf) {
      const theory = this.planSubjects.find(current => current.id === subject.practiceOf);

      if (theory) return eligibility(theory, this.progress.approved, this.earnedCredits);
    }

    // Una electiva concreta no figura en el plan, pero llena la ranura de su
    // clase: las de INFO y FING la de Informática, el resto la Complementaria.
    if (subject.elective) {
      return electiveEligibility(this.openElectives, this.earnedCredits, subject.electiveKind);
    }

    return null;
  }

  /**
   * Nombre legible de una materia del plan
   * @param {String} id - Identificador
   * @return {String} Nombre, o el propio identificador si no se encuentra
   */
  planName(id) {
    return this.planSubjects.find(subject => subject.id === id)?.name ?? id;
  }

  /**
   * Decide si una materia es obligatoria o entra solo si cabe
   * @param {String} id - Identificador de materia
   * @param {Boolean} optional - true para "si cabe"
   */
  setOptional(id, optional) {
    this.optionalIds = optional
      ? [...new Set([...this.optionalIds, id])]
      : this.optionalIds.filter(current => current !== id);

    this.optionIndex = 0;
  }

  /**
   * Indica si una materia entra solo si cabe
   * @param {String} id - Identificador de materia
   * @return {Boolean} true si es opcional
   */
  isOptional(id) {
    return this.optionalIds.includes(id);
  }

  /**
   * Marca o desmarca un día como no disponible
   * @param {Number} day - 0 = lunes … 5 = sábado
   */
  toggleDay(day) {
    const days = this.filters.avoidDays;

    this.filters.avoidDays = days.includes(day)
      ? days.filter(entry => entry !== day)
      : [...days, day].sort((a, b) => a - b);

    this.optionIndex = 0;
  }

  /** Devuelve los filtros a su estado inicial, sin tocar la selección */
  resetFilters() {
    this.filters = { ...DEFAULT_FILTERS };
    this.optionIndex = 0;
  }

  /** Cantidad de secciones fijadas a mano */
  lockedCount = $derived(Object.values(this.sectionLocks).reduce((sum, list) => sum + list.length, 0));

  /**
   * Suelta todas las secciones fijadas sin tocar la selección de materias.
   *
   * Abrir un horario guardado fija cada sección, y sin esto el resultado queda
   * clavado en "1 de 1" sin forma de volver a explorar.
   */
  unlockAll() {
    this.sectionLocks = {};
    this.optionIndex = 0;
  }

  /** Vacía la selección completa */
  clear() {
    this.selectedIds = [];
    this.optionalIds = [];
    this.sectionLocks = {};
    this.optionIndex = 0;
  }

  /**
   * Mueve el índice de la opción mostrada, dando la vuelta en los extremos
   * @param {Number} step - +1 o -1
   */
  step(step) {
    const total = this.result.schedules.length;
    if (total === 0) return;

    this.optionIndex = (this.optionIndex + step + total) % total;
  }

  /**
   * Guarda los filtros actuales con un nombre. Si el nombre ya existe, lo pisa.
   * @param {String} name - Nombre elegido por el usuario
   * @return {Object} El preset guardado
   */
  savePreset(name) {
    const clean = name.trim();
    if (!clean) throw new Error('Ponle un nombre al filtro para poder guardarlo.');

    const preset = { id: crypto.randomUUID(), name: clean, filters: $state.snapshot(this.filters) };
    const existing = this.presets.findIndex(entry => entry.name.toLowerCase() === clean.toLowerCase());

    if (existing >= 0) {
      this.presets = this.presets.map((entry, index) =>
        index === existing ? { ...preset, id: entry.id } : entry
      );
    } else {
      this.presets = [...this.presets, preset];
    }

    this.#savePresets();

    return preset;
  }

  /**
   * Aplica un preset guardado
   * @param {String} id - Identificador del preset
   */
  applyPreset(id) {
    const preset = this.presets.find(entry => entry.id === id);
    if (!preset) return;

    this.filters = { ...DEFAULT_FILTERS, ...preset.filters };
    this.optionIndex = 0;
  }

  /**
   * Borra un preset guardado
   * @param {String} id - Identificador del preset
   */
  deletePreset(id) {
    this.presets = this.presets.filter(entry => entry.id !== id);
    this.#savePresets();
  }

  /**
   * Guarda el horario que se está viendo
   * @param {String} name - Nombre elegido por el usuario
   * @return {Object} El favorito guardado
   */
  saveFavorite(name) {
    const clean = name.trim();
    if (!clean) throw new Error('Ponle un nombre al horario para poder guardarlo.');
    if (!this.current) throw new Error('No hay ningún horario que guardar.');

    const favorite = {
      id: crypto.randomUUID(),
      name: clean,
      savedAt: new Date().toISOString(),
      entries: this.current.map(entry => ({ s: entry.subject.id, c: entry.section.crn }))
    };

    const existing = this.favorites.findIndex(entry => entry.name.toLowerCase() === clean.toLowerCase());

    this.favorites =
      existing >= 0
        ? this.favorites.map((entry, index) =>
            index === existing ? { ...favorite, id: entry.id } : entry
          )
        : [...this.favorites, favorite];

    this.#save(FAVORITES_KEY, this.favorites);

    return favorite;
  }

  /**
   * Abre un horario guardado.
   *
   * Fija cada sección y suelta las restricciones de generación, porque si no un
   * filtro puesto después podría dejar el favorito en pantalla vacía.
   * @param {String} id - Identificador del favorito
   */
  loadFavorite(id) {
    const favorite = this.favorites.find(entry => entry.id === id);
    if (!favorite) return;

    const known = new Set(this.data.subjects.map(subject => subject.id));
    const entries = favorite.entries.filter(entry => known.has(entry.s));

    this.selectedIds = entries.map(entry => entry.s);
    this.optionalIds = [];
    this.sectionLocks = Object.fromEntries(entries.map(entry => [entry.s, [entry.c]]));
    this.filters = { ...this.filters, availability: 'all', campus: '', avoidDays: [], earliest: '', latest: '' };
    this.optionIndex = 0;

    return entries.length;
  }

  /**
   * Borra un horario guardado
   * @param {String} id - Identificador del favorito
   */
  deleteFavorite(id) {
    this.favorites = this.favorites.filter(entry => entry.id !== id);
    this.#save(FAVORITES_KEY, this.favorites);
  }

  /**
   * Indica si el horario en pantalla ya está guardado
   * @return {Object|null} El favorito que coincide, si existe
   */
  matchingFavorite() {
    if (!this.current) return null;

    const signature = entries =>
      entries.map(entry => `${entry.s ?? entry.subject.id}:${entry.c ?? entry.section.crn}`).sort().join('|');

    const now = signature(this.current);

    return this.favorites.find(favorite => signature(favorite.entries) === now) ?? null;
  }

  /**
   * Arma el enlace para compartir el plan actual.
   * Incluye las restricciones, porque sin ellas el horario que abre la otra
   * persona no sería el mismo que estás viendo.
   * @return {String} URL absoluta
   */
  shareUrl() {
    return `${location.origin}${location.pathname}#p=${encodeState(this.#snapshot())}`;
  }

  /** Estado serializable, usado tanto por localStorage como por el enlace */
  #snapshot() {
    return {
      v: PLAN_VERSION,
      s: $state.snapshot(this.selectedIds),
      o: $state.snapshot(this.optionalIds),
      l: $state.snapshot(this.sectionLocks),
      f: $state.snapshot(this.filters)
    };
  }

  /**
   * Aplica un estado guardado, descartando materias que ya no existen
   * @param {Object} saved - Estado leído del enlace o del almacenamiento
   */
  #apply(saved) {
    if (saved?.v !== PLAN_VERSION) return;

    const known = new Set(this.data.subjects.map(subject => subject.id));

    this.selectedIds = (saved.s ?? []).filter(id => known.has(id));
    this.optionalIds = (saved.o ?? []).filter(id => this.selectedIds.includes(id));
    this.sectionLocks = Object.fromEntries(
      Object.entries(saved.l ?? {}).filter(([id]) => known.has(id))
    );
    this.filters = { ...DEFAULT_FILTERS, ...(saved.f ?? {}) };
    this.optionIndex = 0;
  }

  /** El enlace compartido gana sobre lo guardado en el navegador */
  #restore() {
    for (const [key, apply] of [
      [PRESETS_KEY, value => (this.presets = value)],
      [FAVORITES_KEY, value => (this.favorites = value)],
      [APPROVED_KEY, value => (this.approvedIds = value)]
    ]) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) apply(JSON.parse(stored));
      } catch {
        // Una colección ilegible no debe impedir usar la aplicación
      }
    }

    const fromUrl = location.hash.startsWith('#p=') ? decodeState(location.hash.slice(3)) : null;

    if (fromUrl) {
      this.#apply(fromUrl);
      return;
    }

    try {
      const stored = localStorage.getItem(PLAN_KEY);
      if (stored) this.#apply(JSON.parse(stored));
    } catch {
      // Un plan ilegible tampoco
    }
  }

  /**
   * Escribe una colección en el almacenamiento del navegador
   * @param {String} key - Clave
   * @param {*} value - Valor a serializar
   */
  #save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify($state.snapshot(value)));
    } catch {
      // Sin espacio: la colección sigue viva en memoria durante la sesión
    }
  }

  #savePresets() {
    this.#save(PRESETS_KEY, this.presets);
  }

  /**
   * Conecta la persistencia. Se llama una vez desde el componente raíz.
   *
   * El evento "storage" solo lo reciben las OTRAS pestañas, nunca la que
   * escribió. Por eso no hay riesgo de que guardar dispare una relectura que
   * vuelva a guardar.
   * @return {Function} Función de limpieza
   */
  persist() {
    $effect(() => {
      const snapshot = this.#snapshot();

      try {
        localStorage.setItem(PLAN_KEY, JSON.stringify(snapshot));
      } catch {
        // Sin espacio en el navegador: el plan sigue funcionando en memoria
      }
    });

    const onStorage = event => {
      if (event.key === PLAN_KEY && event.newValue) this.#apply(JSON.parse(event.newValue));
      if (event.key === PRESETS_KEY && event.newValue) this.presets = JSON.parse(event.newValue);
      if (event.key === FAVORITES_KEY && event.newValue) this.favorites = JSON.parse(event.newValue);
      if (event.key === APPROVED_KEY && event.newValue) this.approvedIds = JSON.parse(event.newValue);
    };

    window.addEventListener('storage', onStorage);

    return () => window.removeEventListener('storage', onStorage);
  }
}

export const planner = new Planner();
