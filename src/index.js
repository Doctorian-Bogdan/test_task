import './styles.css';
import './components';
import {
  createRandomPolygon,
  findSafeTranslation,
  getContrastStroke,
  keepPolygonInside,
  pointInPolygon,
  polygonCentroid,
  translatePolygon
} from './geometry';
import { HistoryManager } from './history';
import { deepCloneState, distanceSq, randomColor } from './utils';

class PolygonEditorApp extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this.state = { polygons: [], selectedId: null };
    this.history = new HistoryManager();
    this.nextId = 1;
    this.drag = null;

    this.resizeObserver = null;
    this.toastTimer = null;
    this.frameHandle = 0;
    this.resizeFrame = 0;
    this.pendingRender = false;

    this.logicalWidth = 900;
    this.logicalHeight = 520;
  }

  connectedCallback() {
    this.render();
    this.cacheDom();
    this.bindEvents();
    this.syncUi(false);
    this.resizeCanvas();
    this.requestRender();
  }

  disconnectedCallback() {
    window.removeEventListener('keydown', this.onKeyDown);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.toolbar.removeEventListener('click', this.onToolbarClick);
    this.resizeObserver?.disconnect();
    cancelAnimationFrame(this.frameHandle);
    cancelAnimationFrame(this.resizeFrame);
    clearTimeout(this.toastTimer);
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          min-height: 100vh;
          padding: 20px;
          color: #e2e8f0;
        }

        .layout {
          display: grid;
          grid-template-rows: auto auto minmax(420px, 1fr);
          gap: 16px;
          min-height: calc(100vh - 40px);
        }

        .panel {
          background: rgba(15, 23, 42, 0.76);
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 22px;
          box-shadow: 0 12px 30px rgba(2, 8, 23, 0.28);
          backdrop-filter: blur(12px);
        }

        polygon-toolbar,
        polygon-info {
          display: block;
        }

        .toolbar {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 12px;
          padding: 16px;
        }

        button {
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: linear-gradient(180deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95));
          color: #e2e8f0;
          padding: 12px 14px;
          border-radius: 14px;
          box-shadow: 0 10px 24px rgba(2, 8, 23, 0.24);
          cursor: pointer;
          transition:
            transform 0.18s ease,
            box-shadow 0.18s ease,
            border-color 0.18s ease,
            opacity 0.18s ease;
        }

        button:hover:not(:disabled) {
          transform: translateY(-1px);
          border-color: rgba(56, 189, 248, 0.55);
          box-shadow: 0 14px 30px rgba(14, 165, 233, 0.14);
        }

        button:active:not(:disabled) {
          transform: translateY(0);
        }

        button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .primary {
          background: linear-gradient(180deg, rgba(14, 165, 233, 0.96), rgba(2, 132, 199, 0.96));
          border-color: rgba(125, 211, 252, 0.45);
        }

        .info-panel {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
          padding: 16px;
        }

        .info-chip {
          background: rgba(15, 23, 42, 0.58);
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 16px;
          padding: 12px 14px;
        }

        .label {
          display: block;
          margin-bottom: 6px;
          color: #94a3b8;
          font-size: 13px;
        }

        .canvas-wrap {
          position: relative;
          min-height: 420px;
          height: 100%;
          overflow: hidden;
        }

        .canvas-stage {
          position: relative;
          width: 100%;
          height: 100%;
          min-height: 420px;
        }

        canvas {
          display: block;
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border-radius: 22px;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01)),
            radial-gradient(circle at top, rgba(56, 189, 248, 0.08), transparent 35%),
            #0b1120;
        }

        .canvas-hint {
          position: absolute;
          right: 14px;
          bottom: 14px;
          font-size: 12px;
          color: #94a3b8;
          background: rgba(15, 23, 42, 0.65);
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 999px;
          padding: 8px 10px;
          pointer-events: none;
          z-index: 2;
        }

        .toast {
          position: fixed;
          left: 50%;
          bottom: 24px;
          transform: translateX(-50%) translateY(14px);
          background: rgba(15, 23, 42, 0.96);
          border: 1px solid rgba(248, 113, 113, 0.4);
          color: #fff;
          padding: 12px 16px;
          border-radius: 14px;
          box-shadow: 0 14px 26px rgba(2, 8, 23, 0.3);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.25s ease, transform 0.25s ease;
        }

        .toast.visible {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }

        @media (max-width: 720px) {
          :host {
            padding: 12px;
          }

          .layout {
            min-height: calc(100vh - 24px);
          }

          .canvas-hint {
            left: 14px;
            right: 14px;
            text-align: center;
            border-radius: 12px;
          }
        }
      </style>

      <div class="layout">
        <div class="panel">
          <polygon-toolbar></polygon-toolbar>
        </div>

        <div class="panel">
          <polygon-info></polygon-info>
        </div>

        <div class="panel canvas-wrap">
          <div class="canvas-stage">
            <canvas></canvas>
            <div class="canvas-hint">
              Клик - выбрать, переместить; Backspace - удалить
            </div>
          </div>
        </div>
      </div>

      <div class="toast" aria-live="polite"></div>
    `;
  }

  cacheDom() {
    this.canvas = this.shadowRoot.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.toolbar = this.shadowRoot.querySelector('polygon-toolbar');
    this.info = this.shadowRoot.querySelector('polygon-info');
    this.canvasWrap = this.shadowRoot.querySelector('.canvas-wrap');
    this.canvasStage = this.shadowRoot.querySelector('.canvas-stage');
    this.toast = this.shadowRoot.querySelector('.toast');
  }

  bindEvents() {
    this.onToolbarClick = (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;

      const { action } = button.dataset;
      if (action === 'generate') this.generatePolygon();
      if (action === 'delete') this.deleteSelected();
      if (action === 'delete-all') this.deleteAll();
      if (action === 'undo') this.undo();
      if (action === 'redo') this.redo();
    };

    this.onKeyDown = (event) => {
      console.log(event.key)
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        this.deleteSelected();
        return;
      }

      const isCtrl = event.ctrlKey || event.metaKey;
      if (!isCtrl) return;

      const key = event.key.toLowerCase();

      if (key === 'z' && event.shiftKey) {
        event.preventDefault();
        this.redo();
      } else if (key === 'z') {
        event.preventDefault();
        this.undo();
      } else if (key === 'y') {
        event.preventDefault();
        this.redo();
      }
    };

    this.onPointerDown = (event) => {
      const point = this.getCanvasPoint(event);
      const hit = this.findPolygonAtPoint(point);

      if (!hit) {
        this.setSelected(null);
        return;
      }

      this.bringToFront(hit.id);
      this.setSelected(hit.id);

      const polygon = this.getSelectedPolygon();
      this.drag = {
        id: polygon.id,
        startPointer: point,
        startPoints: polygon.points.map((p) => ({ ...p })),
        currentPoints: polygon.points.map((p) => ({ ...p })),
      };

      this.canvas.setPointerCapture?.(event.pointerId);
    };

    this.onPointerMove = (event) => {
      if (!this.drag) return;

      const point = this.getCanvasPoint(event);
      const dx = point.x - this.drag.startPointer.x;
      const dy = point.y - this.drag.startPointer.y;

      const selected = this.getSelectedPolygon();
      if (!selected || selected.id !== this.drag.id) return;

      const target = translatePolygon(this.drag.startPoints, dx, dy);
      const bounded = keepPolygonInside(target, this.logicalWidth, this.logicalHeight, 6);
      const others = this.state.polygons.filter((polygon) => polygon.id !== this.drag.id);
      const safePoints = findSafeTranslation(
          bounded,
          this.drag.startPoints,
          others,
          this.logicalWidth,
          this.logicalHeight
      );

      this.drag.currentPoints = safePoints.map((p) => ({ ...p }));
      selected.points = safePoints;
      selected.birthTime = 0;

      this.syncUi(false);
      this.requestRender();
    };

    this.onPointerUp = () => {
      if (!this.drag) return;

      const selected = this.getSelectedPolygon();

      const before = deepCloneState(this.state);
      before.polygons = before.polygons.map((polygon) =>
          polygon.id === this.drag.id
              ? { ...polygon, points: this.drag.startPoints.map((p) => ({ ...p })) }
              : polygon
      );

      const moved = this.drag.currentPoints.some(
          (point, index) => distanceSq(point, this.drag.startPoints[index]) > 0.04
      );

      if (selected && moved) {
        const after = deepCloneState(this.state);
        this.history.push(before, after, 'Move polygon');
      }

      this.drag = null;
      this.syncUi();
    };

    this.toolbar.addEventListener('click', this.onToolbarClick);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);

    this.resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = requestAnimationFrame(() => {
        const changed = this.resizeCanvas();
        if (changed) {
          this.requestRender();
        }
      });
    });

    this.resizeObserver.observe(this.canvasWrap);
  }

  resizeCanvas() {
    const rect = this.canvasWrap.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width));
    const height = Math.max(420, Math.floor(rect.height));

    if (!width || !height) return false;

    const ratio = window.devicePixelRatio || 1;
    const pixelWidth = Math.floor(width * ratio);
    const pixelHeight = Math.floor(height * ratio);

    const changed =
        this.canvas.width !== pixelWidth ||
        this.canvas.height !== pixelHeight ||
        this.logicalWidth !== width ||
        this.logicalHeight !== height;

    if (!changed) return false;

    this.logicalWidth = width;
    this.logicalHeight = height;

    this.canvas.width = pixelWidth;
    this.canvas.height = pixelHeight;
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    return true;
  }

  getCanvasPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  requestRender() {
    if (this.pendingRender) return;

    this.pendingRender = true;
    this.frameHandle = requestAnimationFrame(() => {
      this.pendingRender = false;
      this.renderScene();
    });
  }

  renderScene() {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);
    this.drawGrid(ctx);

    for (const polygon of this.state.polygons) {
      this.drawPolygon(ctx, polygon, polygon.id === this.state.selectedId);
    }
  }

  drawGrid(ctx) {
    const gap = 28;

    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;

    for (let x = 0; x <= this.logicalWidth; x += gap) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.logicalHeight);
      ctx.stroke();
    }

    for (let y = 0; y <= this.logicalHeight; y += gap) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.logicalWidth, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawPolygon(ctx, polygon, isSelected) {
    const age = polygon.birthTime ? performance.now() - polygon.birthTime : 1000;
    const progress = Math.min(1, age / 260);
    const scale = 0.72 + progress * 0.28;
    const alpha = 0.35 + progress * 0.65;
    const centroid = polygonCentroid(polygon.points);

    ctx.save();
    ctx.translate(centroid.x, centroid.y);
    ctx.scale(scale, scale);
    ctx.translate(-centroid.x, -centroid.y);
    ctx.globalAlpha = alpha;

    ctx.beginPath();
    polygon.points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();

    ctx.fillStyle = polygon.color || 'hsl(200, 80%, 55%)';
    ctx.shadowBlur = isSelected ? 18 : 10;
    ctx.shadowColor = isSelected
        ? 'rgba(125, 211, 252, 0.45)'
        : 'rgba(15, 23, 42, 0.35)';
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.lineWidth = isSelected ? 4 : 2.5;
    ctx.strokeStyle = isSelected ? '#ffffff' : getContrastStroke(polygon.color);
    ctx.stroke();

    if (isSelected) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  findPolygonAtPoint(point) {
    for (let i = this.state.polygons.length - 1; i >= 0; i -= 1) {
      const polygon = this.state.polygons[i];
      if (pointInPolygon(point, polygon.points)) return polygon;
    }
    return null;
  }

  getSelectedPolygon() {
    return this.state.polygons.find((polygon) => polygon.id === this.state.selectedId) || null;
  }

  setSelected(id) {
    this.state.selectedId = id;
    this.syncUi();
  }

  bringToFront(id) {
    const index = this.state.polygons.findIndex((polygon) => polygon.id === id);
    if (index === -1 || index === this.state.polygons.length - 1) return;

    const [polygon] = this.state.polygons.splice(index, 1);
    this.state.polygons.push(polygon);
  }

  generatePolygon() {
    const points = createRandomPolygon(
        this.logicalWidth,
        this.logicalHeight,
        this.state.polygons
    );

    if (!points) {
      this.showToast('Не удалось найти свободное место для нового полигона.');
      return;
    }

    const before = deepCloneState(this.state);

    const polygon = {
      id: `polygon-${this.nextId}`,
      name: `Polygon ${this.nextId}`,
      color: randomColor(),
      points,
      birthTime: performance.now(),
    };

    this.nextId += 1;
    this.state.polygons.push(polygon);
    this.state.selectedId = polygon.id;

    const after = deepCloneState(this.state);
    this.history.push(before, after, 'Generate polygon');

    this.syncUi();
  }

  deleteSelected() {
    if (!this.state.selectedId) {
      this.showToast('Полигон не выбран.');
      return;
    }

    const before = deepCloneState(this.state);
    this.state.polygons = this.state.polygons.filter(
        (polygon) => polygon.id !== this.state.selectedId
    );
    this.state.selectedId = null;

    const after = deepCloneState(this.state);
    this.history.push(before, after, 'Delete polygon');

    this.syncUi();
  }

  deleteAll() {
    if (this.state.polygons.length === 0) return;

    const before = deepCloneState(this.state);
    this.state.polygons = [];
    this.state.selectedId = null;
    const after = deepCloneState(this.state);

    this.history.push(before, after, 'Delete all');
    this.syncUi();
  }

  undo() {
    const nextState = this.history.undo(this.state);
    if (!nextState) return;

    this.state = nextState;
    this.syncUi();
  }

  redo() {
    const nextState = this.history.redo(this.state);
    if (!nextState) return;

    this.state = nextState;
    this.syncUi();
  }

  syncUi(renderNow = true) {
    this.toolbar.setAttribute('can-delete', String(Boolean(this.state.selectedId)));
    this.toolbar.setAttribute('can-undo', String(this.history.canUndo()));
    this.toolbar.setAttribute('can-redo', String(this.history.canRedo()));
    this.toolbar.render();

    const selected = this.getSelectedPolygon();
    this.info.setAttribute('count', String(this.state.polygons.length));
    this.info.setAttribute('selected', selected ? selected.name : 'Ничего не выбрано');
    this.info.render();

    if (renderNow) {
      this.requestRender();
    }
  }

  showToast(message) {
    clearTimeout(this.toastTimer);
    this.toast.textContent = message;
    this.toast.classList.add('visible');

    this.toastTimer = setTimeout(() => {
      this.toast.classList.remove('visible');
    }, 2200);
  }
}

customElements.define('polygon-editor-app', PolygonEditorApp);