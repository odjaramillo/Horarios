<script>
  import { planner } from '../state/planner.svelte.js';
  import Icon from './Icon.svelte';

  let { onclose, welcome = false } = $props();

  let dialog;
  let scroller = $state(null);
  let scrollLeft = $state(0);
  let scrollWidth = $state(0);
  let clientWidth = $state(0);

  /** Un movimiento menor a esto sigue siendo un clic, no un arrastre */
  const DRAG_THRESHOLD = 5;

  let dragging = false;
  let dragged = false;
  let startX = 0;
  let startScroll = 0;

  const bySemester = $derived.by(() => {
    const groups = new Map();

    for (const subject of planner.planSubjects) {
      if (!groups.has(subject.semester)) groups.set(subject.semester, []);
      groups.get(subject.semester).push(subject);
    }

    return [...groups.entries()].sort(([a], [b]) => a - b);
  });

  const total = $derived(planner.data.plan?.totalCredits ?? 0);
  const percent = $derived(total > 0 ? Math.round((planner.earnedCredits / total) * 100) : 0);

  const atStart = $derived(scrollLeft <= 1);
  const atEnd = $derived(scrollLeft + clientWidth >= scrollWidth - 1);

  /** Anota la posición del carrusel para saber si quedan columnas a los lados */
  function measure() {
    if (!scroller) return;

    scrollLeft = scroller.scrollLeft;
    scrollWidth = scroller.scrollWidth;
    clientWidth = scroller.clientWidth;
  }

  /**
   * Desplaza el carrusel una pantalla hacia un lado
   * @param {Number} direction - -1 izquierda, 1 derecha
   */
  function nudge(direction) {
    scroller?.scrollBy({ left: direction * (clientWidth * 0.8), behavior: 'smooth' });
  }

  /**
   * Lleva un semestre al inicio de la vista
   * @param {Number} semester - Semestre al que saltar
   */
  function jumpTo(semester) {
    const column = scroller?.querySelector(`[data-semester="${semester}"]`);

    column?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
  }

  /**
   * Arrastrar el fondo mueve el carrusel; un clic sigue siendo un clic
   * @param {PointerEvent} event - Evento de puntero
   */
  function onPointerDown(event) {
    // Solo con ratón: con el dedo el navegador ya desplaza, y sumar el arrastre
    // haría que el carrusel se mueva al doble de lo que empujas.
    if (event.pointerType !== 'mouse' || event.button !== 0) return;

    dragging = true;
    dragged = false;
    startX = event.clientX;
    startScroll = scroller.scrollLeft;
  }

  function onPointerMove(event) {
    if (!dragging) return;

    const delta = event.clientX - startX;

    if (!dragged && Math.abs(delta) < DRAG_THRESHOLD) return;

    dragged = true;
    scroller.setPointerCapture?.(event.pointerId);
    scroller.scrollLeft = startScroll - delta;
  }

  function onPointerUp() {
    dragging = false;
  }

  /**
   * Si hubo arrastre, el clic que lo cierra no debe marcar una materia
   * @param {MouseEvent} event - Evento de clic en fase de captura
   */
  function onClickCapture(event) {
    if (!dragged) return;

    event.stopPropagation();
    event.preventDefault();
    dragged = false;
  }

  /**
   * Navegación con teclado dentro del carrusel
   * @param {KeyboardEvent} event - Evento de teclado
   */
  function onKeydown(event) {
    const moves = {
      ArrowRight: () => nudge(1),
      ArrowLeft: () => nudge(-1),
      Home: () => scroller.scrollTo({ left: 0, behavior: 'smooth' }),
      End: () => scroller.scrollTo({ left: scroller.scrollWidth, behavior: 'smooth' })
    };

    if (!moves[event.key] || event.target.closest('button')) return;

    event.preventDefault();
    moves[event.key]();
  }

  $effect(() => {
    const onKey = event => {
      if (event.key === 'Escape') onclose();
    };

    document.addEventListener('keydown', onKey);
    dialog?.focus();

    return () => document.removeEventListener('keydown', onKey);
  });

  $effect(() => {
    if (!scroller) return;

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(scroller);

    return () => observer.disconnect();
  });
</script>

<div
  class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
  onpointerdown={event => event.target === event.currentTarget && onclose()}
>
  <div
    bind:this={dialog}
    role="dialog"
    aria-modal="true"
    aria-labelledby="avance-titulo"
    tabindex="-1"
    class="flex max-h-[92vh] w-full min-w-0 max-w-7xl flex-col overflow-hidden rounded-t-2xl border border-line
           bg-panel shadow-panel outline-none sm:rounded-2xl"
  >
    <header class="flex flex-none items-start gap-3 border-b border-line p-4">
      <div class="min-w-0 flex-1">
        <h2 id="avance-titulo" class="font-display text-lg font-bold leading-tight">
          {welcome ? 'Antes de empezar' : 'Mi avance'}
        </h2>
        <p class="mt-0.5 text-xs text-ink-soft">
          {#if welcome}
            Marca lo que <strong class="font-semibold">ya aprobaste</strong> y la app te dirá qué puedes
            inscribir. Puedes saltarlo y hacerlo después.
          {:else}
            Marca lo que <strong class="font-semibold">ya aprobaste</strong>. Al marcar una materia se
            marcan también las que hacen falta para llegar a ella.
          {/if}
        </p>
      </div>

      <button
        type="button"
        onclick={onclose}
        class="grid size-8 shrink-0 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-panel-soft"
        aria-label={welcome ? 'Saltar por ahora' : 'Cerrar'}
      >
        <Icon name="close" />
      </button>
    </header>

    <nav class="flex flex-none flex-wrap items-center gap-1.5 border-b border-line px-4 py-2" aria-label="Ir a un semestre">
      <span class="mr-1 hidden text-[11px] font-bold uppercase tracking-wider text-ink-faint sm:block">
        Semestre
      </span>
      {#each bySemester as [semester, subjects] (semester)}
        {@const done = subjects.every(subject => planner.progress.approved.has(subject.id))}
        <button
          type="button"
          onclick={() => jumpTo(semester)}
          class="tabular grid size-7 place-items-center rounded-lg border text-xs font-bold transition-colors
                 {done ? 'border-ok/50 bg-ok-soft text-ok' : 'border-line text-ink-soft hover:bg-panel-soft'}"
          aria-label="Ir al semestre {semester}{done ? ', completo' : ''}"
        >
          {semester}
        </button>
      {/each}
    </nav>

    <div class="relative min-h-0 min-w-0 flex-1">
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div
        bind:this={scroller}
        role="group"
        aria-label="Materias por semestre"
        tabindex="0"
        onscroll={measure}
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
        onpointerup={onPointerUp}
        onpointercancel={onPointerUp}
        onclickcapture={onClickCapture}
        onkeydown={onKeydown}
        class="scrollbar-wide flex h-full snap-x snap-proximity gap-3 overflow-auto scroll-p-4 p-4 outline-none
               touch-pan-x {dragging ? 'cursor-grabbing select-none' : 'lg:cursor-grab'}"
      >
        {#each bySemester as [semester, subjects] (semester)}
          {@const credits = subjects.reduce((sum, subject) => sum + subject.credits, 0)}
          {@const done = subjects.every(subject => planner.progress.approved.has(subject.id))}
          <section data-semester={semester} class="flex w-56 flex-none snap-start flex-col gap-1.5">
            <header class="flex items-baseline justify-between gap-2 px-0.5">
              <h3 class="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                Sem {semester}
              </h3>
              <span class="tabular text-[11px] text-ink-faint">{credits} UC</span>
            </header>

            <button
              type="button"
              onclick={() => planner.approveUpTo(semester)}
              disabled={done}
              class="rounded-lg border border-line py-1 text-[11px] font-semibold text-ink-soft
                     transition-colors hover:bg-panel-soft disabled:opacity-40"
            >
              {done ? 'Completo' : 'Aprobé hasta aquí'}
            </button>

            {#each subjects as subject (subject.id)}
              {@const state = planner.approvalOf(subject.id)}
              <button
                type="button"
                onclick={() => planner.toggleApproved(subject.id)}
                aria-pressed={state !== null}
                class="hued rounded-lg border px-2 py-1.5 text-left text-[11px] leading-tight transition-all
                       {state === null
                  ? 'border-line bg-panel text-ink-soft hover:border-line-strong'
                  : state === 'deducida'
                    ? 'border-dashed opacity-80'
                    : ''}"
                style={state !== null ? `--h: ${subject.hue ?? 260}` : ''}
              >
                <span class="flex items-start gap-1.5">
                  <span class="mt-px shrink-0">
                    {#if state !== null}
                      <Icon name="check" size={12} />
                    {:else}
                      <span class="block size-3 rounded-sm border border-current opacity-40"></span>
                    {/if}
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block font-semibold">{subject.name}</span>
                    <span class="tabular block opacity-70">
                      {subject.credits} UC{subject.offered ? '' : ' · no se dicta'}
                    </span>
                    {#if state === 'deducida'}
                      <span class="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide opacity-70">
                        Marcada sola
                      </span>
                    {/if}
                  </span>
                </span>
              </button>
            {/each}
          </section>
        {/each}
      </div>

      <!-- Degradados y flechas: sin ellos nada indica que hay más columnas al lado -->
      {#if !atStart}
        <div class="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-panel to-transparent"></div>
        <button
          type="button"
          onclick={() => nudge(-1)}
          class="absolute left-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full border
                 border-line bg-panel text-ink-soft shadow-panel transition-colors hover:text-ink"
          aria-label="Ver semestres anteriores"
        >
          <Icon name="chevronLeft" />
        </button>
      {/if}

      {#if !atEnd}
        <div class="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-panel to-transparent"></div>
        <button
          type="button"
          onclick={() => nudge(1)}
          class="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full border
                 border-line bg-panel text-ink-soft shadow-panel transition-colors hover:text-ink"
          aria-label="Ver semestres siguientes"
        >
          <Icon name="chevronRight" />
        </button>
      {/if}
    </div>

    <footer class="flex flex-none flex-wrap items-center gap-3 border-t border-line p-4">
      <div class="min-w-0 flex-1">
        <div class="flex items-baseline gap-2">
          <span class="tabular text-sm font-bold">{planner.earnedCredits} de {total} UC</span>
          <span class="tabular text-xs text-ink-faint">{percent}%</span>
          {#if planner.progress.inferred.size > 0}
            <span class="text-xs text-ink-faint">
              · {planner.progress.inferred.size} marcadas solas
            </span>
          {/if}
        </div>
        <p class="mt-1 text-[11px] leading-snug text-ink-faint">
          Las prerrelaciones están transcritas de la malla impresa y solo cubren las cadenas
          directas. Si falta alguna, márcala a mano.
        </p>
        <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-soft">
          <div class="h-full rounded-full bg-brand transition-all" style="width: {percent}%"></div>
        </div>
      </div>

      {#if planner.approvedIds.length > 0}
        <button
          type="button"
          onclick={() => planner.clearApproved()}
          class="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft
                 transition-colors hover:text-danger"
        >
          Empezar de cero
        </button>
      {:else if welcome}
        <button
          type="button"
          onclick={onclose}
          class="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-brand-ink transition-opacity hover:opacity-90"
        >
          Voy empezando, saltar
        </button>
      {:else}
        <p class="text-xs text-ink-faint">Si vas empezando la carrera, no marques nada.</p>
      {/if}
    </footer>
  </div>
</div>
