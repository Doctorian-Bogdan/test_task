export class PolygonToolbar extends HTMLElement {
  connectedCallback() {
    this.render();
  }

  render() {
    const canDelete = this.getAttribute('can-delete') === 'true';
    const canUndo = this.getAttribute('can-undo') === 'true';
    const canRedo = this.getAttribute('can-redo') === 'true';

    this.innerHTML = `
      <div class="toolbar">
        <button data-action="generate" class="primary">Сгенерировать полигон</button>
        <button data-action="delete" ${canDelete ? '' : 'disabled'}>Удалить выбранный</button>
        <button data-action="delete-all">Удалить все</button>
        <button data-action="undo" ${canUndo ? '' : 'disabled'}>Отменить</button>
        <button data-action="redo" ${canRedo ? '' : 'disabled'}>Повторить</button>
      </div>
    `;
  }
}

export class PolygonInfo extends HTMLElement {
  connectedCallback() {
    this.render();
  }

  render() {
    const count = this.getAttribute('count') || '0';
    const selected = this.getAttribute('selected') || 'Ничего не выбрано';

    this.innerHTML = `
      <div class="info-panel">
        <div class="info-chip">
          <span class="label">Полигонов</span>
          <strong>${count}</strong>
        </div>
        <div class="info-chip wide">
          <span class="label">Выбор</span>
          <strong>${selected}</strong>
        </div>
      </div>
    `;
  }
}

customElements.define('polygon-toolbar', PolygonToolbar);
customElements.define('polygon-info', PolygonInfo);
