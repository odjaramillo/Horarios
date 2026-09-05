<script>
  import { planner } from './lib/state/planner.svelte.js';
  import SubjectPicker from './lib/components/SubjectPicker.svelte';
  import SchedulePane from './lib/components/SchedulePane.svelte';
  import ThemeToggle from './lib/components/ThemeToggle.svelte';
  import Toaster from './lib/components/Toaster.svelte';
  import ProgressPanel from './lib/components/ProgressPanel.svelte';
  import Icon from './lib/components/Icon.svelte';

  /** En móvil solo cabe un panel a la vez */
  let pane = $state('materias');
  let showProgress = $state(false);

  /** La bienvenida se muestra una sola vez, y solo si no hay nada marcado */
  const WELCOME_KEY = 'horarios:bienvenida';
  let welcome = $state(false);

  /** Cierra el panel y recuerda que ya se mostró la bienvenida */
  function closeProgress() {
    if (welcome) {
      try {
        localStorage.setItem(WELCOME_KEY, '1');
      } catch {
        // Sin espacio: como mucho vuelve a saludar la próxima vez
      }
    }

    showProgress = false;
    welcome = false;
  }

  planner.load();

  $effect(() => planner.persist());

  $effect(() => {
    if (planner.status !== 'ready' || planner.planSubjects.length === 0) return;
    if (planner.approvedIds.length > 0) return;

    try {
      if (localStorage.getItem(WELCOME_KEY)) return;
    } catch {
      return;
    }

    welcome = true;
    showProgress = true;
  });
</script>

<div class="flex h-full flex-col">
  <header class="flex flex-none items-center gap-3 border-b border-line bg-panel px-4 py-2.5">
    <div class="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-brand-ink">
      <Icon name="calendar" size={19} />
    </div>

    <div class="min-w-0">
      <h1 class="font-display truncate text-[15px] font-bold leading-tight">Planificador UCAB</h1>
      {#if planner.data.term}
        <p class="truncate text-xs text-ink-faint">{planner.data.term.label}</p>
      {/if}
    </div>

    <div class="ml-auto flex items-center gap-3">
      {#if planner.selectedIds.length > 0}
        <div class="tabular hidden text-right sm:block">
          <div class="text-sm font-bold leading-tight">{planner.totalCredits} UC</div>
          <div class="text-[11px] text-ink-faint">
            {planner.selectedIds.length} materia{planner.selectedIds.length > 1 ? 's' : ''}
          </div>
        </div>
      {/if}
      {#if planner.planSubjects.length > 0}
        <button
          type="button"
          onclick={() => (showProgress = true)}
          class="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold
                 text-ink-soft transition-colors hover:bg-panel-soft hover:text-ink"
        >
          <Icon name="check" size={14} />
          <span class="hidden sm:inline">Mi avance</span>
          {#if planner.earnedCredits > 0}
            <span class="tabular text-brand">{planner.earnedCredits} UC</span>
          {/if}
        </button>
      {/if}

      <ThemeToggle />
    </div>
  </header>

  {#if planner.status === 'loading'}
    <div class="grid flex-1 place-items-center">
      <p class="text-sm text-ink-faint">Cargando materias…</p>
    </div>
  {:else if planner.status === 'error'}
    <div class="grid flex-1 place-items-center p-6 text-center">
      <div class="max-w-sm">
        <div class="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-danger-soft text-danger">
          <Icon name="warning" size={26} />
        </div>
        <h2 class="font-display text-lg font-bold">No se pudieron cargar las materias</h2>
        <p class="mt-1.5 text-sm text-ink-soft">{planner.error}</p>
        <p class="mt-3 text-xs text-ink-faint">
          Si estás en tu máquina, revisa que <code class="font-mono">public/courses.json</code> exista;
          se genera con <code class="font-mono">npm run merge</code>.
        </p>
      </div>
    </div>
  {:else}
    <main class="flex min-h-0 flex-1 lg:gap-3 lg:p-3">
      <section
        class="min-h-0 min-w-0 flex-1 border-line bg-panel lg:max-w-[24rem] lg:flex-none lg:rounded-2xl lg:border
               lg:shadow-panel {pane === 'materias' ? 'flex' : 'hidden'} lg:flex"
        aria-label="Selección de materias"
      >
        <div class="min-w-0 flex-1"><SubjectPicker /></div>
      </section>

      <section
        class="min-h-0 min-w-0 flex-1 border-line bg-panel lg:rounded-2xl lg:border lg:shadow-panel
               {pane === 'horario' ? 'flex' : 'hidden'} lg:flex"
        aria-label="Horario generado"
      >
        <div class="min-w-0 flex-1"><SchedulePane /></div>
      </section>
    </main>

    <nav
      class="flex flex-none border-t border-line bg-panel pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Cambiar de panel"
    >
      {#each [['materias', 'list', 'Materias'], ['horario', 'calendar', 'Horario']] as [id, icon, label]}
        <button
          type="button"
          onclick={() => (pane = id)}
          aria-current={pane === id ? 'page' : undefined}
          class="relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold
                 transition-colors {pane === id ? 'text-brand' : 'text-ink-faint'}"
        >
          <span class="relative">
            <Icon name={icon} size={19} />
            {#if id === 'materias' && planner.selectedIds.length > 0}
              <span
                class="tabular absolute -right-2.5 -top-1.5 grid min-w-4 place-items-center rounded-full
                       bg-brand px-1 text-[10px] font-bold leading-4 text-brand-ink"
              >
                {planner.selectedIds.length}
              </span>
            {/if}
          </span>
          {label}
        </button>
      {/each}
    </nav>
  {/if}

  {#if showProgress}
    <ProgressPanel onclose={closeProgress} {welcome} />
  {/if}

  <Toaster />
</div>
