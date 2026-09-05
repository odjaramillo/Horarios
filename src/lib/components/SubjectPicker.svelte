<script>
  import { planner } from '../state/planner.svelte.js';
  import FilterPanel from './FilterPanel.svelte';
  import SubjectItem from './SubjectItem.svelte';
  import Icon from './Icon.svelte';
</script>

<div class="flex h-full flex-col">
  <div class="flex-none border-b border-line p-3">
    <FilterPanel />

    <div class="mt-2.5 flex items-center justify-between text-xs text-ink-faint">
      <span aria-live="polite">
        {planner.visibleSubjects.length} de {planner.data.subjects.length} materias
      </span>

      {#if planner.selectedIds.length > 0}
        <button
          type="button"
          onclick={() => planner.clear()}
          class="flex items-center gap-1 font-semibold text-ink-soft transition-colors hover:text-danger"
        >
          <Icon name="trash" size={13} />
          Limpiar {planner.selectedIds.length}
        </button>
      {/if}
    </div>
  </div>

  <ul class="scrollbar-thin flex-1 space-y-2 overflow-y-auto overscroll-contain p-3">
    {#each planner.visibleSubjects as subject (subject.id)}
      <SubjectItem {subject} />
    {:else}
      <li class="px-2 py-10 text-center text-sm text-ink-faint">
        Ninguna materia coincide con los filtros de ahora.
      </li>
    {/each}
  </ul>
</div>
