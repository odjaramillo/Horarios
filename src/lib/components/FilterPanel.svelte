<script>
  import { planner } from '../state/planner.svelte.js';
  import { toasts } from '../state/toasts.svelte.js';
  import { DAYS, DAYS_INITIAL } from '../domain/schedule.js';
  import Icon from './Icon.svelte';

  let open = $state(false);
  let naming = $state(false);
  let draftName = $state('');

  const AVAILABILITY = [
    ['open', 'Solo abiertas'],
    ['all', 'Todas'],
    ['closed', 'Solo cerradas']
  ];

  /** Guarda los filtros actuales con el nombre escrito */
  function save() {
    try {
      const preset = planner.savePreset(draftName);
      toasts.push(`Filtro «${preset.name}» guardado.`, 'ok');
      naming = false;
      draftName = '';
    } catch (error) {
      toasts.push(error.message, 'error');
    }
  }

  /**
   * Borra un preset y lo avisa
   * @param {Object} preset - Preset a borrar
   */
  function remove(preset) {
    planner.deletePreset(preset.id);
    toasts.push(`Filtro «${preset.name}» eliminado.`, 'info');
  }
</script>

<div class="space-y-2.5">
  <div class="relative">
    <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">
      <Icon name="search" />
    </span>
    <input
      type="search"
      bind:value={planner.filters.query}
      placeholder="Materia, código o NRC"
      aria-label="Buscar materias"
      class="w-full rounded-xl border border-line bg-panel py-2.5 pl-10 pr-3 text-sm
             placeholder:text-ink-faint focus:border-brand focus:outline-none"
    />
  </div>

  <div class="flex items-center gap-2">
    <button
      type="button"
      onclick={() => (open = !open)}
      aria-expanded={open}
      class="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors
             {planner.activeFilterCount > 0
        ? 'border-brand/60 bg-brand-soft text-brand'
        : 'border-line text-ink-soft hover:bg-panel-soft'}"
    >
      <Icon name="list" size={14} />
      Filtros
      {#if planner.activeFilterCount > 0}
        <span class="tabular grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] text-brand-ink">
          {planner.activeFilterCount}
        </span>
      {/if}
      <Icon name="chevronDown" size={13} class="transition-transform {open ? 'rotate-180' : ''}" />
    </button>

    {#if planner.activeFilterCount > 0}
      <button
        type="button"
        onclick={() => planner.resetFilters()}
        class="text-xs font-semibold text-ink-faint transition-colors hover:text-danger"
      >
        Quitar filtros
      </button>
    {/if}
  </div>

  {#if planner.presets.length > 0}
    <div class="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
      {#each planner.presets as preset (preset.id)}
        <span
          class="flex flex-none items-center gap-1 rounded-full border border-line bg-panel-soft py-1 pl-2.5 pr-1
                 text-xs font-semibold"
        >
          <button
            type="button"
            onclick={() => planner.applyPreset(preset.id)}
            class="transition-colors hover:text-brand"
          >
            {preset.name}
          </button>
          <button
            type="button"
            onclick={() => remove(preset)}
            class="grid size-4 place-items-center rounded-full text-ink-faint transition-colors
                   hover:bg-danger-soft hover:text-danger"
            aria-label="Eliminar el filtro {preset.name}"
          >
            <Icon name="close" size={11} />
          </button>
        </span>
      {/each}
    </div>
  {/if}

  {#if open}
    <div class="space-y-3 rounded-xl border border-line bg-panel-soft p-3">
      <div class="grid gap-2 sm:grid-cols-2">
        <label class="block">
          <span class="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink-faint">
            Profesor
          </span>
          <input
            type="text"
            bind:value={planner.filters.professor}
            placeholder="Apellido"
            class="w-full rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs
                   placeholder:text-ink-faint focus:border-brand focus:outline-none"
          />
        </label>

        <label class="block">
          <span class="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink-faint">
            Departamento
          </span>
          <select
            bind:value={planner.filters.department}
            class="w-full rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs font-medium"
          >
            <option value="">Todos</option>
            {#each planner.departments as department}
              <option value={department}>{department}</option>
            {/each}
          </select>
        </label>

        {#if planner.semesters.length > 0}
          <label class="block">
            <span class="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink-faint">
              Semestre del plan
            </span>
            <select
              bind:value={planner.filters.semester}
              class="w-full rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs font-medium"
            >
              <option value="">Todos</option>
              {#each planner.semesters as semester}
                <option value={String(semester)}>Semestre {semester}</option>
              {/each}
              <option value="sin-plan">Fuera del plan de Informática</option>
            </select>
          </label>
        {/if}

        <label class="block">
          <span class="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink-faint">
            Sede
          </span>
          <select
            bind:value={planner.filters.campus}
            class="w-full rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs font-medium"
          >
            <option value="">Todas</option>
            {#each planner.campuses as campus}
              <option value={campus}>{campus}</option>
            {/each}
          </select>
        </label>

        <label class="block">
          <span class="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink-faint">
            Cupos
          </span>
          <select
            bind:value={planner.filters.availability}
            class="w-full rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs font-medium"
          >
            {#each AVAILABILITY as [value, label]}
              <option {value}>{label}</option>
            {/each}
          </select>
        </label>
      </div>

      {#if planner.approvedIds.length > 0}
        <label
          class="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-panel px-2.5 py-2
                 text-xs font-medium"
        >
          <input type="checkbox" bind:checked={planner.filters.eligibleOnly} class="accent-[var(--brand)]" />
          Solo las que puedo inscribir ahora
          <span class="tabular ml-auto text-ink-faint">{planner.eligibleNow.length}</span>
        </label>
      {/if}

      <fieldset>
        <legend class="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
          Días que no quiero clase
        </legend>
        <div class="flex gap-1">
          {#each DAYS as name, day}
            {@const off = planner.filters.avoidDays.includes(day)}
            <button
              type="button"
              onclick={() => planner.toggleDay(day)}
              aria-pressed={off}
              aria-label={name}
              class="tabular grid h-8 flex-1 place-items-center rounded-lg border text-xs font-bold
                     transition-colors {off
                ? 'border-danger/50 bg-danger-soft text-danger'
                : 'border-line bg-panel text-ink-soft hover:border-line-strong'}"
            >
              {DAYS_INITIAL[day]}
            </button>
          {/each}
        </div>
      </fieldset>

      <div class="grid grid-cols-2 gap-2">
        <label class="block">
          <span class="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink-faint">
            No antes de
          </span>
          <input
            type="time"
            bind:value={planner.filters.earliest}
            class="tabular w-full rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs"
          />
        </label>
        <label class="block">
          <span class="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink-faint">
            No después de
          </span>
          <input
            type="time"
            bind:value={planner.filters.latest}
            class="tabular w-full rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs"
          />
        </label>
      </div>

      <p class="text-[11px] leading-snug text-ink-faint">
        Los días y las horas no esconden materias: descartan las secciones que no te sirven, así el
        horario se arma solo con las que sí.
      </p>

      {#if naming}
        <div class="flex gap-1.5">
          <!-- svelte-ignore a11y_autofocus -->
          <input
            type="text"
            bind:value={draftName}
            onkeydown={event => event.key === 'Enter' && save()}
            placeholder="Nombre del filtro"
            autofocus
            class="flex-1 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs
                   placeholder:text-ink-faint focus:border-brand focus:outline-none"
          />
          <button
            type="button"
            onclick={save}
            class="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-ink"
          >
            Guardar
          </button>
          <button
            type="button"
            onclick={() => (naming = false)}
            class="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-soft"
          >
            Cancelar
          </button>
        </div>
      {:else}
        <button
          type="button"
          onclick={() => (naming = true)}
          disabled={planner.activeFilterCount === 0}
          class="w-full rounded-lg border border-line bg-panel py-1.5 text-xs font-semibold text-ink-soft
                 transition-colors hover:bg-panel-soft disabled:opacity-40 disabled:hover:bg-panel"
        >
          Guardar estos filtros
        </button>
      {/if}
    </div>
  {/if}
</div>
