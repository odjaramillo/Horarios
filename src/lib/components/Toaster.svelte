<script>
  import { toasts } from '../state/toasts.svelte.js';
  import Icon from './Icon.svelte';

  const TONES = {
    ok: { icon: 'check', classes: 'border-ok/40 bg-ok-soft text-ok' },
    error: { icon: 'warning', classes: 'border-danger/40 bg-danger-soft text-danger' },
    info: { icon: 'info', classes: 'border-line bg-panel text-ink' }
  };
</script>

<div
  class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4
         sm:left-auto sm:right-4 sm:items-end"
  role="status"
  aria-live="polite"
>
  {#each toasts.items as toast (toast.id)}
    <div
      class="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border px-3.5 py-2.5
             text-sm font-medium shadow-panel {TONES[toast.tone].classes}"
    >
      <Icon name={TONES[toast.tone].icon} class="mt-px shrink-0" />
      <span class="flex-1">{toast.message}</span>
      <button
        type="button"
        onclick={() => toasts.dismiss(toast.id)}
        class="shrink-0 opacity-60 transition-opacity hover:opacity-100"
        aria-label="Cerrar aviso"
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  {/each}
</div>
