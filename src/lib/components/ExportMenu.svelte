<script>
  import { planner } from '../state/planner.svelte.js';
  import { toasts } from '../state/toasts.svelte.js';
  import { downloadIcs } from '../export/ics.js';
  import { downloadPng, downloadPdf, downloadNrcText } from '../export/files.js';
  import { nrcCodes } from '../export/nrc.js';
  import Icon from './Icon.svelte';

  let open = $state(false);
  let busy = $state(null);
  let container;

  const ACTIONS = [
    {
      id: 'png',
      icon: 'image',
      label: 'Descargar imagen',
      hint: 'PNG listo para mandar por chat',
      run: () => downloadPng(planner.current, planner.data.term),
      done: 'Imagen descargada.'
    },
    {
      id: 'pdf',
      icon: 'file',
      label: 'Descargar PDF',
      hint: 'Una página A4, para imprimir',
      run: () => downloadPdf(planner.current, planner.data.term),
      done: 'PDF descargado.'
    },
    {
      id: 'ics',
      icon: 'calendar',
      label: 'Agregar al calendario',
      hint: 'Google Calendar, Outlook o Apple',
      run: () => downloadIcs(planner.current, planner.data.term),
      done: 'Calendario descargado. Ábrelo para importarlo.'
    },
    {
      id: 'nrc',
      icon: 'copy',
      label: 'Copiar los NRC',
      hint: 'Solo los números, listos para pegar',
      run: () => navigator.clipboard.writeText(nrcCodes(planner.current)),
      done: () => `Copiado: ${nrcCodes(planner.current)}`
    },
    {
      id: 'txt',
      icon: 'file',
      label: 'Descargar el detalle',
      hint: 'TXT con materias, secciones y horas',
      run: () => downloadNrcText(planner.current, planner.data.term),
      done: 'Detalle descargado.'
    }
  ];

  /**
   * Ejecuta una acción del menú informando el resultado
   * @param {Object} action - Acción elegida
   */
  async function run(action) {
    busy = action.id;

    try {
      await action.run();
      toasts.push(typeof action.done === 'function' ? action.done() : action.done, 'ok');
      open = false;
    } catch (error) {
      toasts.push(error.message ?? 'No se pudo completar la descarga.', 'error');
    } finally {
      busy = null;
    }
  }

  $effect(() => {
    if (!open) return;

    const onPointer = event => {
      if (!container.contains(event.target)) open = false;
    };
    const onKey = event => {
      if (event.key === 'Escape') open = false;
    };

    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  });
</script>

<div class="relative" bind:this={container}>
  <button
    type="button"
    onclick={() => (open = !open)}
    aria-haspopup="menu"
    aria-expanded={open}
    class="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-semibold
           text-ink-soft transition-colors hover:bg-panel-soft hover:text-ink"
  >
    <Icon name="download" size={15} />
    <span class="hidden sm:inline">Exportar</span>
    <Icon name="chevronDown" size={13} class="transition-transform {open ? 'rotate-180' : ''}" />
  </button>

  {#if open}
    <div
      role="menu"
      class="absolute right-0 z-40 mt-1.5 w-72 overflow-hidden rounded-2xl border border-line bg-panel
             shadow-panel"
    >
      {#each ACTIONS as action (action.id)}
        <button
          type="button"
          role="menuitem"
          onclick={() => run(action)}
          disabled={busy !== null}
          class="flex w-full items-center gap-3 border-b border-line/60 px-3 py-2.5 text-left
                 transition-colors last:border-0 hover:bg-panel-soft disabled:opacity-50"
        >
          <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
            <Icon name={busy === action.id ? 'sync' : action.icon} size={16} />
          </span>
          <span class="min-w-0">
            <span class="block text-[13px] font-semibold leading-tight">{action.label}</span>
            <span class="block truncate text-[11px] text-ink-faint">{action.hint}</span>
          </span>
        </button>
      {/each}
    </div>
  {/if}
</div>
