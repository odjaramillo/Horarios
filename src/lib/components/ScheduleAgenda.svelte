<script>
  import { DAYS, describeMeetings, formatTime } from '../domain/schedule.js';
  import { hueFor } from '../domain/palette.js';

  let { schedule } = $props();

  /** En pantallas angostas una lista por día se lee mejor que una grilla. */
  const byDay = $derived.by(() => {
    const map = new Map();

    for (const { subject, section } of schedule) {
      for (const meeting of section.meetings) {
        if (!map.has(meeting.day)) map.set(meeting.day, []);
        map.get(meeting.day).push({ subject, section, meeting });
      }
    }

    return [...map.entries()]
      .sort(([a], [b]) => a - b)
      .map(([day, blocks]) => [day, blocks.sort((a, b) => a.meeting.start - b.meeting.start)]);
  });
</script>

<div class="space-y-5 p-3">
  {#each byDay as [day, blocks]}
    <section>
      <h3 class="mb-2 text-xs font-bold uppercase tracking-wider text-ink-faint">{DAYS[day]}</h3>
      <ul class="space-y-2">
        {#each blocks as block (block.section.crn + block.meeting.start)}
          <li
            class="hued flex gap-3 rounded-xl border px-3 py-2.5"
            style="--h: {hueFor(block.subject)}"
          >
            <div class="tabular w-16 shrink-0 text-xs font-bold leading-tight">
              <div>{formatTime(block.meeting.start)}</div>
              <div class="opacity-60">{formatTime(block.meeting.end)}</div>
            </div>
            <div class="min-w-0 flex-1">
              <h4 class="truncate text-sm font-bold leading-tight">{block.subject.title}</h4>
              <p class="tabular mt-0.5 text-xs opacity-75">
                {block.subject.id} · NRC {block.section.crn} · SEC {block.section.seq}
              </p>
              {#if block.section.professors.length > 0}
                <p class="truncate text-xs opacity-70">{block.section.professors[0]}</p>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</div>
