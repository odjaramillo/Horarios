<script>
  import Icon from './Icon.svelte';

  let dark = $state(document.documentElement.classList.contains('dark'));

  /** Alterna el tema y lo recuerda para la próxima visita */
  function toggle() {
    dark = !dark;
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('horarios:theme', dark ? 'dark' : 'light');
  }
</script>

<button
  type="button"
  onclick={toggle}
  class="grid size-9 place-items-center rounded-full border border-line text-ink-soft
         transition-colors hover:bg-panel-soft hover:text-ink"
  aria-label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
  aria-pressed={dark}
>
  <Icon name={dark ? 'moon' : 'sun'} />
</button>
