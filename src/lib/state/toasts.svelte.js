let nextId = 0;

/**
 * Avisos efímeros. Es el único canal de feedback de la app: nada de alert(),
 * nada de errores que solo llegan a la consola.
 */
class Toasts {
  items = $state([]);

  /**
   * Muestra un aviso
   * @param {String} message - Texto para el usuario
   * @param {'info'|'ok'|'error'} tone - Intención del aviso
   */
  push(message, tone = 'info') {
    const id = nextId;
    nextId += 1;

    this.items = [...this.items, { id, message, tone }];
    setTimeout(() => this.dismiss(id), 4500);
  }

  /**
   * Quita un aviso antes de que expire
   * @param {Number} id - Identificador del aviso
   */
  dismiss(id) {
    this.items = this.items.filter(item => item.id !== id);
  }
}

export const toasts = new Toasts();
