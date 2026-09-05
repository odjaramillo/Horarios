<script>
  import { planner } from '../state/planner.svelte.js';
  import { toasts } from '../state/toasts.svelte.js';
  import Icon from './Icon.svelte';

  let naming = $state(false);
  let draftName = $state('');

  const saved = $derived(planner.matchingFavorite());

  /** Guarda el horario visible con el nombre escrito */
  function save() {
    try {
      const favorite = planner.saveFavorite(draftName);
      toasts.push(`Horario «${favorite.name}» guardado.`, 'ok');
      naming = false;
      draftName = '';
    } catch (error) {
      toasts.push(error.message, 'error');
    }
  }

  /**
   * Abre un horario guardado
   * @param {Object} favorite - Favorito elegido
   */
  function load(favorite) {
    const restored = planner.loadFavorite(favorite.id);
    const missing = favorite.entries.length - restored;

    toasts.push(
      missing > 0
        ? `«${favorite.name}» abierto, pero ${missing} materia${missing > 1 ? 's ya no existen' : ' ya no existe'} en este período.`
        : `«${favorite.name}» abierto.`,
      missing > 0 ? 'info' : 'ok'
    );
  }
</script>

{#if planner.current}
  <div class="flex flex-none items-center gap-2 border-b border-line bg-panel-soft px-3 py-2">
    {#if planner.favorites.length > 0}
      <span
        class="hidden shrink-0 items-center gap-1 text-[11px] font-bold uppercase tracking-wider
               text-ink-faint sm:flex"
      >
        Guardados
      </span>
    {/if}

    {#if naming}
      <!-- svelte-ignore a11y_autofocus -->
      <input
        type="text"
        bind:value={draftName}
        onkeydown={event => {
          if (event.key === 'Enter') save();
          if (event.key === 'Escape') naming = false;
        }}
        placeholder="Nombre del horario"
        autofocus
        class="min-w-0 flex-1 rounded-lg border border-line bg-panel px-2.5 py-1 text-xs
               placeholder:text-ink-faint focus:border-brand focus:outline-none"
      />
      <button
        type="button"
        onclick={save}
        class="shrink-0 rounded-lg bg-brand px-2.5 py-1 text-xs font-semibold text-brand-ink"
      >
        Guardar
      </button>
      <button
        type="button"
        onclick={() => (naming = false)}
        class="shrink-0 rounded-lg border border-line px-2 py-1 text-xs font-semibold text-ink-soft"
      >
        Cancelar
      </button>
    {:else}
      <div class="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
        {#each planner.favorites as favorite (favorite.id)}
          <span
            class="flex flex-none items-center gap-1 rounded-full border py-1 pl-2.5 pr-1 text-xs font-semibold
                   {saved?.id === favorite.id
              ? 'border-brand/60 bg-brand-soft text-brand'
              : 'border-line bg-panel'}"
          >
            <button type="button" onclick={() => load(favorite)} class="transition-colors hover:text-brand">
              {favorite.name}
            </button>
            <button
              type="button"
              onclick={() => {
                planner.deleteFavorite(favorite.id);
                toasts.push(`«${favorite.name}» eliminado.`, 'info');
              }}
              class="grid size-4 place-items-center rounded-full text-ink-faint transition-colors
                     hover:bg-danger-soft hover:text-danger"
              aria-label="Eliminar el horario {favorite.name}"
            >
              <Icon name="close" size={11} />
            </button>
          </span>
        {/each}
      </div>

      <button
        type="button"
        onclick={() => {
          draftName = saved?.name ?? '';
          naming = true;
        }}
        class="flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold
               transition-colors {saved
          ? 'border-accent/60 bg-accent-soft text-accent'
          : 'border-line bg-panel text-ink-soft hover:text-ink'}"
      >
        <Icon name="star" size={13} />
        {saved ? 'Guardado' : 'Guardar horario'}
      </button>
    {/if}
  </div>
{/if}
