<script>
  import { DAYS, DAYS_SHORT, activeDays, formatTime, scheduleBounds } from '../domain/schedule.js';
  import { hueFor } from '../domain/palette.js';

  let { schedule } = $props();

  /**
   * Alto de una hora y ancho de una columna viven en CSS (`.schedule-grid`),
   * porque en un teléfono tienen que encoger. Aquí solo se calcula en horas, y
   * el navegador las multiplica por la medida que toque en cada pantalla.
   */
  const bounds = $derived(scheduleBounds(schedule));
  const days = $derived(activeDays(schedule));
  const hours = $derived(
    Array.from({ length: bounds.to - bounds.from }, (_, index) => bounds.from + index)
  );

  /** A partir de esta altura, en horas, la tarjeta tiene sitio para más datos */
  const ROOM_FOR_NRC = 0.9;
  const ROOM_FOR_PROFESSOR = 1.4;

  /**
   * Los bloques se ubican por minuto, no por fila.
   * Así una clase de 9:00 a 10:50 ocupa exactamente su altura, en vez de
   * estirarse a dos casillas de una hora.
   */
  const byDay = $derived.by(() => {
    const map = new Map(days.map(day => [day, []]));

    for (const { subject, section } of schedule) {
      for (const meeting of section.meetings) {
        if (!map.has(meeting.day)) continue;

        map.get(meeting.day).push({
          key: `${section.crn}-${meeting.day}-${meeting.start}`,
          subject,
          section,
          meeting,
          top: (meeting.start - bounds.from * 60) / 60,
          height: (meeting.end - meeting.start) / 60
        });
      }
    }

    return map;
  });

  const columns = $derived(`var(--gutter) repeat(${days.length}, minmax(var(--col), 1fr))`);
</script>

<div class="schedule-grid scrollbar-thin overflow-x-auto">
  <div class="min-w-max">
    <div
      class="sticky top-0 z-10 grid border-b border-line bg-panel/95 backdrop-blur"
      style="grid-template-columns: {columns}"
    >
      <div class="py-2"></div>
      {#each days as day}
        <div class="px-1 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-ink-faint">
          <span class="hidden sm:inline">{DAYS[day]}</span>
          <span class="sm:hidden">{DAYS_SHORT[day]}</span>
        </div>
      {/each}
    </div>

    <div
      class="relative mt-2 grid"
      style="grid-template-columns: {columns}; height: calc({hours.length} * var(--hour))"
    >
      <div class="relative border-r border-line">
        {#each hours as hour, index}
          <span
            class="tabular absolute right-1.5 -translate-y-1/2 text-[10px] font-medium text-ink-faint sm:right-2 sm:text-[11px]"
            style="top: calc({index} * var(--hour))"
          >
            {formatTime(hour * 60)}
          </span>
        {/each}
      </div>

      {#each days as day}
        <div class="relative border-r border-line/60 last:border-r-0">
          {#each hours as _, index}
            <div
              class="absolute inset-x-0 border-t border-line/50"
              style="top: calc({index} * var(--hour))"
            ></div>
          {/each}

          {#each byDay.get(day) as block (block.key)}
            <article
              class="hued absolute inset-x-0.5 overflow-hidden rounded-lg border px-1.5 py-1
                     sm:inset-x-1 sm:px-2 sm:py-1.5"
              style="--h: {hueFor(block.subject)}; top: calc({block.top} * var(--hour));
                     height: calc({block.height} * var(--hour) - 3px)"
            >
              <h4 class="line-clamp-2 text-[11px] font-bold leading-tight sm:text-[13px]">
                {block.subject.title}
              </h4>
              <p class="tabular truncate text-[10px] font-medium opacity-80 sm:text-[11px]">
                {formatTime(block.meeting.start)}–{formatTime(block.meeting.end)}
              </p>
              {#if block.height >= ROOM_FOR_NRC}
                <p class="tabular truncate text-[10px] opacity-70 sm:text-[11px]">
                  <!-- En el teléfono no cabe la palabra: el número basta -->
                  <span class="hidden sm:inline">NRC&nbsp;</span>{block.section.crn}
                  · <span class="hidden sm:inline">SEC&nbsp;</span>{block.section.seq}
                </p>
              {/if}
              {#if block.height >= ROOM_FOR_PROFESSOR && block.section.professors.length > 0}
                <p class="truncate text-[10px] opacity-70 sm:text-[11px]">
                  {block.section.professors[0]}
                </p>
              {/if}
            </article>
          {/each}
        </div>
      {/each}
    </div>
  </div>
</div>
