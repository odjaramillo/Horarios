<script>
  import { planner } from '../state/planner.svelte.js';
  import { hueFor } from '../domain/palette.js';
  import { describeMeetings, usableSections } from '../domain/schedule.js';
  import Icon from './Icon.svelte';

  let { subject } = $props();

  let expanded = $state(false);

  const hue = $derived(hueFor(subject));
  const selected = $derived(planner.selectedIds.includes(subject.id));
  const locks = $derived(planner.sectionLocks[subject.id] ?? []);
  const optional = $derived(planner.isOptional(subject.id));
  const check = $derived(planner.eligibilityOf(subject));

  const usable = $derived(usableSections(subject, planner.constraints).length);

  const withoutSchedule = $derived(
    subject.sections.filter(section => section.meetings.length === 0).length
  );
</script>

<li
  class="overflow-hidden rounded-xl border transition-colors
         {selected ? 'border-brand/60 bg-brand-soft' : 'border-line bg-panel hover:border-line-strong'}"
>
  <button
    type="button"
    onclick={() => planner.toggle(subject.id)}
    aria-pressed={selected}
    class="flex w-full items-start gap-3 p-3 text-left"
  >
    <span
      class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors
             {selected ? 'border-brand bg-brand text-brand-ink' : 'border-line-strong text-transparent'}"
    >
      <Icon name="check" size={13} />
    </span>

    <span class="min-w-0 flex-1">
      <span class="flex items-baseline gap-2">
        <span class="size-2 shrink-0 rounded-full hued-dot" style="--h: {hue}"></span>
        <span class="tabular font-semibold tracking-tight">{subject.id}</span>
        {#if subject.semester}
          <span
            class="tabular rounded px-1.5 py-px text-[10px] font-bold text-ink-faint"
            style="background-color: oklch(0.955 0.045 {hue})"
            title={planner.areas[subject.area]?.label}
          >
            SEM {subject.semester}
          </span>
        {/if}
        <span class="ml-auto shrink-0 text-xs font-semibold text-ink-faint">{subject.credits} UC</span>
      </span>
      <span class="mt-0.5 block truncate text-sm text-ink-soft">{subject.title}</span>
    </span>
  </button>

  {#if selected}
    <div class="flex gap-1 border-t border-line/70 px-3 py-2">
      {#each [[false, 'Obligatoria'], [true, 'Si cabe']] as [value, label]}
        <button
          type="button"
          onclick={() => planner.setOptional(subject.id, value)}
          aria-pressed={optional === value}
          class="flex-1 rounded-lg border py-1 text-[11px] font-bold transition-colors
                 {optional === value
            ? value
              ? 'border-accent/60 bg-accent-soft text-accent'
              : 'border-brand/60 bg-brand text-brand-ink'
            : 'border-line bg-panel text-ink-faint hover:text-ink-soft'}"
        >
          {label}
        </button>
      {/each}
    </div>
  {/if}

  {#if check?.alreadyApproved}
    <p class="flex items-center gap-1.5 border-t border-line/70 bg-ok-soft px-3 py-1.5 text-xs font-medium text-ok">
      <Icon name="check" size={13} />
      Ya la aprobaste
    </p>
  {:else if check && !check.ok}
    <p class="flex items-start gap-1.5 border-t border-line/70 bg-accent-soft px-3 py-1.5 text-xs text-accent">
      <Icon name="warning" size={13} class="mt-px shrink-0" />
      <span>
        {#if check.missing.length > 0}
          Te falta {check.missing.map(id => planner.planName(id)).join(' y ')}
        {/if}
        {#if check.missing.length > 0 && check.creditsShort > 0}·{/if}
        {#if check.creditsShort > 0}
          Te faltan {check.creditsShort} UC para poder inscribirla
        {/if}
      </span>
    </p>
  {/if}

  <div class="flex items-center gap-2 border-t border-line/70 px-3 py-1.5 text-xs">
    {#if usable === 0}
      <span class="flex items-center gap-1 font-medium text-danger">
        <Icon name="warning" size={13} />
        Sin secciones disponibles
      </span>
    {:else}
      <span class="text-ink-faint">
        <span class="tabular font-semibold text-ink-soft">{usable}</span>
        de {subject.sections.length} secciones
        {#if withoutSchedule > 0}
          <span class="text-ink-faint">· {withoutSchedule} sin horario</span>
        {/if}
      </span>
    {/if}

    {#if locks.length > 0}
      <span class="flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 font-semibold text-accent">
        <Icon name="pin" size={11} />
        {locks.length} fijada{locks.length > 1 ? 's' : ''}
      </span>
    {/if}

    <button
      type="button"
      onclick={() => (expanded = !expanded)}
      aria-expanded={expanded}
      class="ml-auto flex shrink-0 items-center gap-0.5 font-semibold text-ink-soft transition-colors hover:text-brand"
    >
      Secciones
      <Icon
        name="chevronDown"
        size={14}
        class="transition-transform duration-200 {expanded ? 'rotate-180' : ''}"
      />
    </button>
  </div>

  {#if expanded}
    <ul class="border-t border-line/70 bg-panel-soft">
      {#each subject.sections as section (section.crn)}
        {@const pinned = locks.includes(section.crn)}
        <li>
          <button
            type="button"
            onclick={() => planner.toggleSection(subject.id, section.crn)}
            aria-pressed={pinned}
            class="flex w-full items-start gap-2.5 border-b border-line/50 px-3 py-2 text-left last:border-0
                   transition-colors hover:bg-panel"
          >
            <span
              class="mt-0.5 grid size-4 shrink-0 place-items-center rounded border transition-colors
                     {pinned ? 'border-accent bg-accent text-white' : 'border-line-strong text-transparent'}"
            >
              <Icon name="check" size={11} />
            </span>

            <span class="min-w-0 flex-1 text-xs">
              <span class="flex flex-wrap items-center gap-x-2">
                <span class="tabular font-semibold">SEC {section.seq}</span>
                <span class="tabular text-ink-faint">NRC {section.crn}</span>
                {#if !section.open}
                  <span class="rounded bg-danger-soft px-1.5 py-px font-semibold text-danger">Cerrada</span>
                {:else}
                  <span class="tabular text-ok">{section.seats.free} cupos</span>
                {/if}
              </span>
              <span class="mt-0.5 block text-ink-soft">{describeMeetings(section)}</span>
              {#if section.professors.length > 0}
                <span class="block truncate text-ink-faint">{section.professors.join(', ')}</span>
              {/if}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</li>
