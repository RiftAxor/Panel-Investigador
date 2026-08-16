/* =============================================
   board.js v2 — Pan, Zoom, Grid, Herramientas
   (actualizado para nuevo layout flotante)
   ============================================= */
'use strict';

const Board = (() => {
  const container = document.getElementById('board-container');
  const world     = document.getElementById('board-world');

  let tx = 0, ty = 0, scale = 1;
  let tool = 'select';
  let showGrid    = false;
  let snapToGrid  = false;
  const MIN_SCALE = 0.12;
  const MAX_SCALE = 4;

  // gridSize reads from settings (CSS var also updates)
  function getGridSize() {
    return App?.state?.settings?.gridSize ?? 40;
  }

  let isPanning = false;
  let panStartX = 0, panStartY = 0;
  let panStartTx = 0, panStartTy = 0;

  /* ─── TRANSFORM ─────────────────────────── */
  function applyTransform() {
    world.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
    container.style.setProperty('--zoom', scale);
    container.style.setProperty('--tx', tx + 'px');
    container.style.setProperty('--ty', ty + 'px');
    const zl = document.getElementById('zoom-level');
    if (zl) zl.textContent = Math.round(scale * 100) + '%';
    Connections.renderAll();
  }

  /* ─── ZOOM ──────────────────────────────── */
  function zoom(delta, centerX, centerY) {
    const prev = scale;
    scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * (1 + delta)));
    if (centerX !== undefined) {
      const r = container.getBoundingClientRect();
      const cx = centerX - r.left, cy = centerY - r.top;
      tx = cx - (cx - tx) * (scale / prev);
      ty = cy - (cy - ty) * (scale / prev);
    }
    applyTransform();
    saveView();
  }

  function zoomIn()  { zoom(0.12, container.offsetWidth/2, container.offsetHeight/2); }
  function zoomOut() { zoom(-0.12, container.offsetWidth/2, container.offsetHeight/2); }

  function resetView() { tx = 0; ty = 0; scale = 1; applyTransform(); saveView(); }

  function centerOnCards() {
    const inv = App.currentInvestigation();
    if (!inv || !inv.cards.length) { resetView(); return; }
    const xs = inv.cards.map(c => c.x + c.width/2);
    const ys = inv.cards.map(c => c.y + c.height/2);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const r  = container.getBoundingClientRect();
    tx = r.width/2  - cx * scale;
    ty = r.height/2 - cy * scale;
    applyTransform(); saveView();
  }

  /* ─── PAN ───────────────────────────────── */
  function startPan(e) {
    isPanning = true;
    panStartX = e.clientX; panStartY = e.clientY;
    panStartTx = tx; panStartTy = ty;
    container.classList.add('panning');
    document.body.classList.add('no-select');
  }
  function updatePan(e) {
    if (!isPanning) return;
    tx = panStartTx + (e.clientX - panStartX);
    ty = panStartTy + (e.clientY - panStartY);
    applyTransform();
  }
  function endPan() {
    if (!isPanning) return;
    isPanning = false;
    container.classList.remove('panning');
    document.body.classList.remove('no-select');
    saveView();
  }

  /* ─── TOOL ──────────────────────────────── */
  function setTool(newTool) {
    tool = newTool;
    document.querySelectorAll('.tool-btn[data-tool]').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === tool);
    });
    container.className = container.className.replace(/\btool-\w+\b/g,'').trim();
    container.classList.add(`tool-${tool}`);
  }

  /* ─── GRID / SNAP ───────────────────────── */
  function setGrid(visible) {
    showGrid = visible;
    const el = document.getElementById('board-grid');
    if (el) el.style.display = visible ? '' : 'none';
    document.getElementById('grid-toggle-btn')?.classList.toggle('active', visible);

    const check = document.getElementById('setting-grid-check');
    if (check && check.checked !== visible) {
      check.checked = visible;
      if (typeof App !== 'undefined' && App.state) {
        App.state.settings.defaultGrid = visible;
        App.saveState();
      }
    }
  }
  function toggleGrid() {
    setGrid(!showGrid);
  }

  function setSnap(active) {
    snapToGrid = active;
    document.getElementById('snap-toggle-btn')?.classList.toggle('active', active);

    const check = document.getElementById('setting-snap-check');
    if (check && check.checked !== active) {
      check.checked = active;
      if (typeof App !== 'undefined' && App.state) {
        App.state.settings.defaultSnap = active;
        App.saveState();
      }
    }
  }
  function toggleSnap() {
    setSnap(!snapToGrid);
    App.toast(snapToGrid ? 'Snap activado.' : 'Snap desactivado.', 'info');
  }

  function applyGrid() {
    // Called when grid size setting changes
    if (showGrid) { setGrid(false); setGrid(true); }
  }

  /* ─── COORDS ────────────────────────────── */
  function screenToWorld(screenX, screenY) {
    const r = container.getBoundingClientRect();
    return { x: (screenX - r.left - tx) / scale, y: (screenY - r.top - ty) / scale };
  }

  /* ─── EVENTS ────────────────────────────── */
  function initEvents() {
    // Wheel zoom
    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      zoom(-e.deltaY * 0.001, e.clientX, e.clientY);
    }, { passive: false });

    // Mouse down on board
    container.addEventListener('mousedown', (e) => {
      if (e.button === 1) { e.preventDefault(); startPan(e); return; }
      if (e.button !== 0) return;

      const onCard     = e.target.closest('.card');
      const onConnPt   = e.target.closest('.conn-point');
      const onConnPath = e.target.closest('.connections-svg path');

      // Close menus
      document.querySelectorAll('.context-menu').forEach(m => m.classList.add('hidden'));
      closeFab();

      // Connection points are handled by cards.js, don't interfere
      if (onConnPt) return;

      // If still drawing (shouldn't normally happen), cancel
      if (Connections.isDrawing()) {
        Connections.cancelDrawing();
        return;
      }

      if (tool === 'pan') { startPan(e); return; }
      if (tool === 'select' && !onCard && !onConnPath) {
        Cards.deselectAll();
      }
    });

    // Mouse move — update pan AND connection drawing temp line
    container.addEventListener('mousemove', (e) => {
      updatePan(e);
      if (Connections.isDrawing()) {
        Connections.updateDrawing(e.clientX, e.clientY);
      }
    });

    // Mouse up — end pan; cancel drawing if not on a conn point
    window.addEventListener('mouseup', (e) => {
      endPan();
      if (Connections.isDrawing()) {
        // If mouseup on a conn-point, cards.js handles finish
        if (!e.target.closest('.conn-point')) {
          Connections.cancelDrawing();
        }
      }
    });

    // Right-click board context menu
    container.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.card')) return;
      e.preventDefault();
      const wp = screenToWorld(e.clientX, e.clientY);
      const menu = document.getElementById('context-menu');
      positionMenu(menu, e.clientX, e.clientY);
      menu.dataset.worldX = wp.x;
      menu.dataset.worldY = wp.y;
      menu.classList.remove('hidden');
    });

    // Double click → add note
    container.addEventListener('dblclick', (e) => {
      if (e.target.closest('.card')) return;
      const wp = screenToWorld(e.clientX, e.clientY);
      Cards.addCard('note', wp.x - 110, wp.y - 80);
    });

    // Board context menu actions
    document.getElementById('context-menu')?.addEventListener('click', (e) => {
      const item = e.target.closest('.cmenu-item');
      if (!item) return;
      const menu = document.getElementById('context-menu');
      const wx = parseFloat(menu.dataset.worldX) || 0;
      const wy = parseFloat(menu.dataset.worldY) || 0;
      menu.classList.add('hidden');
      const map = {
        'add-note':     () => Cards.addCard('note', wx-110, wy-80),
        'add-person':   () => Cards.addCard('person', wx-120, wy-90),
        'add-image':    () => Cards.addCard('image', wx-120, wy-100),
        'add-event':    () => Cards.addCard('event', wx-120, wy-90),
        'add-link':     () => Cards.addCard('link', wx-120, wy-80),
        'add-timeline': () => Cards.addCard('timeline', wx-140, wy-100),
        'zoom-reset':   centerOnCards,
        'zoom-in':      zoomIn,
        'zoom-out':     zoomOut,
      };
      map[item.dataset.action]?.();
    });

    // FAB card buttons
    document.querySelectorAll('.fab-card-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        const r  = container.getBoundingClientRect();
        const wp = screenToWorld(r.left + r.width/2, r.top + r.height/2);
        Cards.addCard(type, wp.x - 120, wp.y - 90);
        closeFab();
      });
    });

    // FAB main button
    document.getElementById('fab-main')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFab();
    });

    // Tool panel buttons
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => setTool(btn.dataset.tool));
    });

    // Zoom buttons
    document.getElementById('zoom-in-btn')?.addEventListener('click', zoomIn);
    document.getElementById('zoom-out-btn')?.addEventListener('click', zoomOut);
    document.getElementById('zoom-reset-btn')?.addEventListener('click', centerOnCards);

    // Grid / Snap
    document.getElementById('grid-toggle-btn')?.addEventListener('click', toggleGrid);
    document.getElementById('snap-toggle-btn')?.addEventListener('click', toggleSnap);

    // Close context menus on outside click
    document.addEventListener('mousedown', (e) => {
      if (!e.target.closest('.context-menu'))
        document.querySelectorAll('.context-menu').forEach(m => m.classList.add('hidden'));
      if (!e.target.closest('.add-fab-wrap'))
        closeFab();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      const active = document.activeElement;
      if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT') return;
      if (active.closest('.modal')) return;

      switch (e.key.toLowerCase()) {
        case 'v': setTool('select'); break;
        case 'c': setTool('connect'); break;
        case 'h': setTool('pan'); break;
        case 'g': toggleGrid(); break;
        case 's': if (!e.ctrlKey && !e.metaKey) toggleSnap(); break;
        case '=': case '+': zoomIn(); break;
        case '-': zoomOut(); break;
        case '0': centerOnCards(); break;
      }

      // Space for temporary pan
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        container.classList.add('tool-pan');
        const onUp = (ev) => {
          if (ev.code === 'Space') {
            container.classList.remove('tool-pan');
            endPan();
            document.removeEventListener('keyup', onUp);
          }
        };
        document.addEventListener('keyup', onUp);
      }
    });

    // Space + drag
    container.addEventListener('mousedown', (e) => {
      if (e.button === 0 && container.classList.contains('tool-pan') && tool === 'select') {
        if (!e.target.closest('.card')) startPan(e);
      }
    });
  }

  /* ─── FAB ───────────────────────────────── */
  let fabOpen = false;
  function toggleFab() {
    fabOpen = !fabOpen;
    const menu    = document.getElementById('fab-menu');
    const mainBtn = document.getElementById('fab-main');
    menu?.classList.toggle('open', fabOpen);
    mainBtn?.classList.toggle('open', fabOpen);
    mainBtn?.setAttribute('aria-expanded', fabOpen);
    const plus  = document.getElementById('fab-icon-plus');
    const close = document.getElementById('fab-icon-close');
    if (plus)  plus.style.display  = fabOpen ? 'none' : '';
    if (close) close.style.display = fabOpen ? '' : 'none';
  }
  function closeFab() {
    if (!fabOpen) return;
    fabOpen = false;
    document.getElementById('fab-menu')?.classList.remove('open');
    const mainBtn = document.getElementById('fab-main');
    mainBtn?.classList.remove('open');
    mainBtn?.setAttribute('aria-expanded', 'false');
    const plus  = document.getElementById('fab-icon-plus');
    const close = document.getElementById('fab-icon-close');
    if (plus)  plus.style.display  = '';
    if (close) close.style.display = 'none';
  }

  /* ─── HELPERS ───────────────────────────── */
  function positionMenu(menu, x, y) {
    menu.style.left = x + 'px';
    menu.style.top  = y + 'px';
    // Prevent overflow
    requestAnimationFrame(() => {
      const r = menu.getBoundingClientRect();
      if (r.right  > window.innerWidth)  menu.style.left = (x - r.width)  + 'px';
      if (r.bottom > window.innerHeight) menu.style.top  = (y - r.height) + 'px';
    });
  }

  /* ─── SAVE VIEW ─────────────────────────── */
  function saveView() {
    const inv = App.currentInvestigation();
    if (!inv) return;
    inv.viewX = tx; inv.viewY = ty; inv.viewScale = scale;
    App.saveState();
  }

  function restoreView(inv) {
    if (!inv) return;
    tx = inv.viewX || 0; ty = inv.viewY || 0; scale = inv.viewScale || 1;
    applyTransform();
  }

  /* ─── INIT ──────────────────────────────── */
  function init() {
    setTool('select');
    initEvents();
    applyTransform();
    // Apply defaults from settings
    const s = App?.state?.settings ?? {};
    if (s.defaultGrid) setGrid(true);
    if (s.defaultSnap) setSnap(true);
  }

  return {
    init, applyTransform, resetView, centerOnCards,
    screenToWorld, restoreView, applyGrid,
    setGrid, setSnap,
    get tool()      { return tool; },
    get scale()     { return scale; },
    get tx()        { return tx; },
    get ty()        { return ty; },
    get gridSize()  { return getGridSize(); },
    get snapToGrid(){ return snapToGrid; },
    get showGrid()  { return showGrid; }
  };
})();
