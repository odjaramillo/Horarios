<script>
  import { DAYS, DAYS_SHORT, activeDays, formatTime, scheduleBounds } from '../domain/schedule.js';
  import { hueFor } from '../domain/palette.js';

  let { schedule } = $props();

  /** Alto de una hora. Es la única medida fija; el resto se deriva de ella. */
  const HOUR = 64;

  const bounds = $derived(scheduleBounds(schedule));
  const days = $derived(activeDays(schedule));
  const hours = $derived(
    Array.from({ length: bounds.to - bounds.from }, (_, index) => bounds.from + index)
  );

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
          top: ((meeting.start - bounds.from * 60) / 60) * HOUR,
          height: ((meeting.end - meeting.start) / 60) * HOUR
        });
      }
    }

    return map;
  });
</script>

<div class="scrollbar-thin overflow-x-auto">
  <div class="min-w-max">
    <div
      class="sticky top-0 z-10 grid border-b border-line bg-panel/95 backdrop-blur"
      style="grid-template-columns: 3.5rem repeat({days.length}, minmax(8.5rem, 1fr))"
    >
      <div class="py-2"></div>
      {#each days as day}
        <div class="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-ink-faint">
          <span class="hidden sm:inline">{DAYS[day]}</span>
          <span class="sm:hidden">{DAYS_SHORT[day]}</span>
        </div>
      {/each}
    </div>

    <div
      class="relative mt-2 grid"
      style="grid-template-columns: 3.5rem repeat({days.length}, minmax(8.5rem, 1fr)); height: {hours.length *
        HOUR}px"
    >
      <div class="relative border-r border-line">
        {#each hours as hour, index}
          <span
            class="tabular absolute right-2 -translate-y-1/2 text-[11px] font-medium text-ink-faint"
            style="top: {index * HOUR}px"
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
              style="top: {index * HOUR}px"
            ></div>
          {/each}

          {#each byDay.get(day) as block (block.key)}
            <article
              class="hued absolute inset-x-1 overflow-hidden rounded-lg border px-2 py-1.5"
              style="--h: {hueFor(block.subject)}; top: {block.top}px; height: {block.height - 3}px"
            >
              <h4 class="line-clamp-2 text-[13px] font-bold leading-tight">{block.subject.title}</h4>
              <p class="tabular truncate text-[11px] font-medium opacity-80">
                {formatTime(block.meeting.start)}–{formatTime(block.meeting.end)}
              </p>
              {#if block.height > 56}
                <p class="tabular truncate text-[11px] opacity-70">
                  NRC {block.section.crn} · SEC {block.section.seq}
                </p>
              {/if}
              {#if block.height > 78 && block.section.professors.length > 0}
                <p class="truncate text-[11px] opacity-70">{block.section.professors[0]}</p>
              {/if}
            </article>
          {/each}
        </div>
      {/each}
    </div>
  </div>
</div>
