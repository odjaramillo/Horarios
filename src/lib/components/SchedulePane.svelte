<script>
  import { planner } from '../state/planner.svelte.js';
  import { toasts } from '../state/toasts.svelte.js';
  import { totalCredits, weeklyHours } from '../domain/schedule.js';
  import ExportMenu from './ExportMenu.svelte';
  import FavoritesBar from './FavoritesBar.svelte';
  import ScheduleGrid from './ScheduleGrid.svelte';
  import ScheduleAgenda from './ScheduleAgenda.svelte';
  import Icon from './Icon.svelte';

  /** En pantalla angosta la lista por día se lee mejor que la grilla. */
  let view = $state('agenda');

  const result = $derived(planner.result);
  const current = $derived(planner.current);

  /** Copia el enlace del plan actual al portapapeles */
  async function share() {
    const url = planner.shareUrl();

    try {
      await navigator.clipboard.writeText(url);
      location.hash = url.slice(url.indexOf('#'));
      toasts.push('Enlace copiado. Quien lo abra verá esta misma selección.', 'ok');
    } catch {
      toasts.push('El navegador no dejó copiar. El enlace quedó en la barra de direcciones.', 'info');
      location.hash = url.slice(url.indexOf('#'));
    }
  }

</script>

<div class="flex h-full flex-col">
  <header class="flex flex-none flex-wrap items-center gap-2 border-b border-line p-3">
    {#if result.schedules.length > 0}
      <div class="flex items-center gap-1 rounded-xl border border-line p-0.5">
        <button
          type="button"
          onclick={() => planner.step(-1)}
          class="grid size-8 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-panel-soft"
          aria-label="Opción anterior"
        >
          <Icon name="chevronLeft" />
        </button>
        <span class="tabular min-w-24 text-center text-sm font-semibold" aria-live="polite">
          {planner.optionIndex + 1} de {result.schedules.length}{result.truncated ? '+' : ''}
        </span>
        <button
          type="button"
          onclick={() => planner.step(1)}
          class="grid size-8 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-panel-soft"
          aria-label="Opción siguiente"
        >
          <Icon name="chevronRight" />
        </button>
      </div>

      <div class="tabular flex items-center gap-3 text-xs font-semibold text-ink-soft">
        <span>{totalCredits(current)} UC</span>
        <span class="text-ink-faint">·</span>
        <span>{weeklyHours(current)} h/sem</span>
      </div>

      <div class="ml-auto flex items-center gap-1">
        <div class="mr-1 flex items-center rounded-xl border border-line p-0.5 lg:hidden">
          <button
            type="button"
            onclick={() => (view = 'grid')}
            aria-pressed={view === 'grid'}
            class="grid size-8 place-items-center rounded-lg transition-colors
                   {view === 'grid' ? 'bg-brand text-brand-ink' : 'text-ink-soft'}"
            aria-label="Ver como grilla semanal"
          >
            <Icon name="calendar" size={16} />
          </button>
          <button
            type="button"
            onclick={() => (view = 'agenda')}
            aria-pressed={view === 'agenda'}
            class="grid size-8 place-items-center rounded-lg transition-colors
                   {view === 'agenda' ? 'bg-brand text-brand-ink' : 'text-ink-soft'}"
            aria-label="Ver como lista por día"
          >
            <Icon name="list" size={16} />
          </button>
        </div>

        <ExportMenu />

        <button
          type="button"
          onclick={share}
          class="flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-brand-ink
                 transition-opacity hover:opacity-90"
        >
          <Icon name="share" size={15} />
          <span class="hidden sm:inline">Compartir</span>
        </button>
      </div>
    {:else}
      <h2 class="text-sm font-semibold text-ink-soft">Tu horario</h2>
    {/if}
  </header>

  <FavoritesBar />

  <div class="scrollbar-thin flex-1 overflow-y-auto">
    {#if planner.selectedIds.length === 0}
      <div class="grid h-full place-items-center p-8 text-center">
        <div class="max-w-xs">
          <div class="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">
            <Icon name="calendar" size={26} />
          </div>
          <h3 class="font-display text-lg font-bold">Elige tus materias</h3>
          <p class="mt-1.5 text-sm text-ink-soft">
            El horario se arma solo, y se vuelve a armar cada vez que cambias algo. No hay botón que
            apretar.
          </p>
        </div>
      </div>
    {:else if result.schedules.length === 0}
      <div class="grid h-full place-items-center p-6 text-center">
        <div class="max-w-md">
          <div class="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-danger-soft text-danger">
            <Icon name="warning" size={26} />
          </div>
          <h3 class="font-display text-lg font-bold">No hay ningún horario posible</h3>

          {#if result.unschedulable.length > 0}
            <p class="mt-2 text-sm text-ink-soft">
              Estas materias no tienen ninguna sección utilizable con los filtros de ahora:
            </p>
            <ul class="mt-2 space-y-1">
              {#each result.unschedulable as subject}
                <li class="tabular text-sm font-semibold">{subject.id} — {subject.title}</li>
              {/each}
            </ul>
            {#if planner.onlyOpen}
              <button
                type="button"
                onclick={() => (planner.onlyOpen = false)}
                class="mt-3 rounded-xl border border-line px-3 py-2 text-xs font-semibold
                       transition-colors hover:bg-panel-soft"
              >
                Incluir también las secciones cerradas
              </button>
            {/if}
          {/if}

          {#if result.blocking.length > 0}
            <p class="mt-2 text-sm text-ink-soft">
              Estos pares se pisan en todas sus combinaciones:
            </p>
            <ul class="mt-2 space-y-1">
              {#each result.blocking as pair}
                <li class="tabular text-sm">
                  <span class="font-semibold">{pair.a.id}</span>
                  <span class="text-ink-faint">y</span>
                  <span class="font-semibold">{pair.b.id}</span>
                </li>
              {/each}
            </ul>
            <p class="mt-2 text-xs text-ink-faint">
              Quita una de las dos, o fija otra sección desde el panel de materias.
            </p>
          {/if}
        </div>
      </div>
    {:else}
      {#if result.unschedulable.length > 0}
        <div class="flex items-start gap-2.5 border-b border-danger/30 bg-danger-soft px-4 py-3">
          <span class="mt-px shrink-0 text-danger"><Icon name="warning" size={17} /></span>
          <div class="min-w-0 flex-1 text-xs">
            <p class="font-bold text-danger">
              Este horario no incluye
              <span class="tabular">
                {result.unschedulable.map(subject => subject.id).join(', ')}
              </span>
            </p>
            <p class="mt-0.5 text-ink-soft">
              Ninguna de sus secciones pasa los filtros de ahora. El horario de abajo es el de las
              demás materias.
            </p>
            <div class="mt-2 flex flex-wrap gap-1.5">
              {#if planner.filters.availability === 'open'}
                <button
                  type="button"
                  onclick={() => (planner.filters.availability = 'all')}
                  class="rounded-lg border border-line bg-panel px-2.5 py-1 font-semibold
                         transition-colors hover:bg-panel-soft"
                >
                  Incluir secciones cerradas
                </button>
              {/if}
              {#if planner.filters.avoidDays.length > 0 || planner.filters.earliest || planner.filters.latest}
                <button
                  type="button"
                  onclick={() => {
                    planner.filters.avoidDays = [];
                    planner.filters.earliest = '';
                    planner.filters.latest = '';
                  }}
                  class="rounded-lg border border-line bg-panel px-2.5 py-1 font-semibold
                         transition-colors hover:bg-panel-soft"
                >
                  Quitar los límites de día y hora
                </button>
              {/if}
            </div>
          </div>
        </div>
      {/if}

      <div class="hidden lg:block">
        <ScheduleGrid schedule={current} />
      </div>
      <div class="lg:hidden">
        {#if view === 'grid'}
          <ScheduleGrid schedule={current} />
        {:else}
          <ScheduleAgenda schedule={current} />
        {/if}
      </div>

      {#if result.droppedOptional.length > 0}
        <p class="border-t border-line px-4 py-2.5 text-xs text-ink-faint">
          No cupieron, y por eso quedaron afuera:
          <span class="tabular font-semibold text-ink-soft">
            {result.droppedOptional.map(subject => subject.id).join(', ')}
          </span>
        </p>
      {/if}

      {#if result.truncated}
        <p class="border-t border-line px-4 py-2.5 text-xs text-ink-faint">
          Hay más combinaciones de las que mostramos. Fija alguna sección para reducir las opciones.
        </p>
      {/if}
    {/if}
  </div>
</div>
