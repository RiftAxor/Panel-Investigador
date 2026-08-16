/* =============================================
   connections.js v2
   Sistema de hilos SVG entre tarjetas
   - Bezier inteligente según el lado de conexión
   - Drag-based: mousedown → drag → mouseup
   - Highlighting de tarjeta objetivo
   - Labels con fondo
   - Selección + edición
   ============================================= */
'use strict';

const Connections = (() => {
  const svg = document.getElementById('connections-svg');

  const COLOR_HEX = {
    red:    '#ef4444',
    yellow: '#eab308',
    blue:   '#3b82f6',
    green:  '#22c55e',
    white:  '#cbd5e1'
  };

  let selectedConnectionId = null;

  // Drawing state
  let drawing       = false;
  let drawFromCardId = null;
  let drawFromSide   = null;
  let tempPathEl     = null;
  let tempDotEl      = null;   // dot at cursor end

  /* ═══════════════════════════════════════════
     COORDINATE HELPERS
     ═══════════════════════════════════════════ */

  /** World-space position of a card's connection point */
  function connPointWorld(card, side) {
    const { x, y, width: w, height: h } = card;
    switch (side) {
      case 'n': return { x: x + w / 2,  y };
      case 's': return { x: x + w / 2,  y: y + h };
      case 'e': return { x: x + w,       y: y + h / 2 };
      case 'w': return { x,              y: y + h / 2 };
      default:  return { x: x + w / 2,  y: y + h / 2 };
    }
  }

  /** World → SVG screen coords */
  function worldToScreen(wx, wy) {
    const b = App.board;
    return { x: wx * b.scale + b.tx, y: wy * b.scale + b.ty };
  }

  /** Screen coords → SVG space (same as screen for fixed SVG) */
  function clientToSVG(clientX, clientY) {
    const r = svg.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }

  /* ═══════════════════════════════════════════
     BEZIER PATH  (side-aware, looks natural)
     ═══════════════════════════════════════════ */

  /**
   * Direction vector for each side.
   * The handle extends outward from the card.
   */
  const SIDE_DIR = { n: [0,-1], s: [0,1], e: [1,0], w: [-1,0] };

  function sideAwareBezier(x1, y1, side1, x2, y2, side2) {
    const dist  = Math.hypot(x2 - x1, y2 - y1);
    const pull  = Math.max(50, Math.min(dist * 0.45, 220));

    const [dx1, dy1] = SIDE_DIR[side1] || [1, 0];
    const [dx2, dy2] = SIDE_DIR[side2] || [-1, 0];

    const cx1 = x1 + dx1 * pull;
    const cy1 = y1 + dy1 * pull;
    const cx2 = x2 + dx2 * pull;
    const cy2 = y2 + dy2 * pull;

    return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
  }

  /** Bezier for temp line (no target side known yet) */
  function tempBezier(x1, y1, side1, x2, y2) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const pull = Math.max(40, Math.min(dist * 0.45, 200));
    const [dx, dy] = SIDE_DIR[side1] || [1, 0];
    const cx1 = x1 + dx * pull;
    const cy1 = y1 + dy * pull;
    const cx2 = x2 - (x2 - x1) * 0.2;
    const cy2 = y2 - (y2 - y1) * 0.2;
    return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
  }

  /* ═══════════════════════════════════════════
     RENDER ALL CONNECTIONS
     ═══════════════════════════════════════════ */

  function renderAll() {
    svg.querySelectorAll('.conn-group').forEach(el => el.remove());
    const inv = App.currentInvestigation();
    if (!inv) return;
    inv.connections.forEach(conn => _renderOne(conn, inv));
  }

  function updateForCard(cardId) {
    const inv = App.currentInvestigation();
    if (!inv) return;
    inv.connections
      .filter(c => c.fromCard === cardId || c.toCard === cardId)
      .forEach(conn => _renderOne(conn, inv));
  }

  function _renderOne(conn, inv) {
    if (!inv) inv = App.currentInvestigation();
    if (!inv) return;

    const fromCard = inv.cards.find(c => c.id === conn.fromCard);
    const toCard   = inv.cards.find(c => c.id === conn.toCard);
    if (!fromCard || !toCard) return;

    const pFrom = worldToScreen(
      ...Object.values(connPointWorld(fromCard, conn.fromSide))
    );
    const pTo = worldToScreen(
      ...Object.values(connPointWorld(toCard, conn.toSide))
    );

    // Remove old render
    svg.querySelector(`.conn-group[data-conn-id="${conn.id}"]`)?.remove();

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('conn-group');
    g.setAttribute('data-conn-id', conn.id);

    // ── Invisible thick hit zone (easier to click) ──
    const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitPath.setAttribute('d', sideAwareBezier(
      pFrom.x, pFrom.y, conn.fromSide,
      pTo.x,   pTo.y,   conn.toSide
    ));
    hitPath.setAttribute('fill', 'none');
    hitPath.setAttribute('stroke', 'transparent');
    hitPath.setAttribute('stroke-width', '18');
    hitPath.style.cursor = 'pointer';
    hitPath.style.pointerEvents = 'stroke';

    // ── Visible path ──
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', sideAwareBezier(
      pFrom.x, pFrom.y, conn.fromSide,
      pTo.x,   pTo.y,   conn.toSide
    ));
    path.classList.add('connection-path', `color-${conn.color}`);
    if (conn.style === 'dashed') path.classList.add('style-dashed');
    if (conn.id === selectedConnectionId) path.classList.add('selected');
    path.setAttribute('data-conn-id', conn.id);
    path.style.pointerEvents = 'none';  // hit zone handles events

    // ── Dot at source ──
    const dotFrom = _makeDot(pFrom.x, pFrom.y, COLOR_HEX[conn.color] || '#ef4444');
    const dotTo   = _makeDot(pTo.x,   pTo.y,   COLOR_HEX[conn.color] || '#ef4444');

    // Click / context on hit zone
    hitPath.addEventListener('click', (e) => {
      e.stopPropagation();
      selectConnection(conn.id);
    });
    hitPath.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      selectConnection(conn.id);
      openEditModal(conn.id);
    });
    hitPath.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectConnection(conn.id);
      _showConnContextMenu(e.clientX, e.clientY, conn.id);
    });

    g.appendChild(path);
    g.appendChild(hitPath);
    g.appendChild(dotFrom);
    g.appendChild(dotTo);

    // ── Label ──
    if (conn.label) {
      _appendLabel(g, pFrom, pTo, conn.label);
    }

    svg.appendChild(g);
  }

  function _makeDot(cx, cy, color) {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', 3.5);
    c.setAttribute('fill', color);
    c.style.pointerEvents = 'none';
    return c;
  }

  function _appendLabel(g, pFrom, pTo, text) {
    const midX = (pFrom.x + pTo.x) / 2;
    const midY = (pFrom.y + pTo.y) / 2;

    const PAD_X = 8, PAD_Y = 4;

    const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textEl.setAttribute('x', midX);
    textEl.setAttribute('y', midY);
    textEl.setAttribute('text-anchor', 'middle');
    textEl.setAttribute('dominant-baseline', 'middle');
    textEl.classList.add('connection-label');
    textEl.textContent = text;

    // Temporarily append to measure
    svg.appendChild(textEl);
    const bb = textEl.getBBox();
    svg.removeChild(textEl);

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', bb.x - PAD_X);
    rect.setAttribute('y', bb.y - PAD_Y);
    rect.setAttribute('width', bb.width + PAD_X * 2);
    rect.setAttribute('height', bb.height + PAD_Y * 2);
    rect.setAttribute('rx', '6'); rect.setAttribute('ry', '6');
    rect.classList.add('connection-label-bg');
    rect.style.pointerEvents = 'none';
    textEl.style.pointerEvents = 'none';

    g.appendChild(rect);
    g.appendChild(textEl);
  }

  /* ═══════════════════════════════════════════
     DRAWING — drag-based
     ═══════════════════════════════════════════ */

  function startDrawing(cardId, side, clientX, clientY) {
    if (drawing) cancelDrawing();
    drawing       = true;
    drawFromCardId = cardId;
    drawFromSide   = side;

    // ── Temp bezier line ──
    tempPathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempPathEl.classList.add('connection-temp');
    svg.appendChild(tempPathEl);

    // ── Cursor dot ──
    tempDotEl = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    tempDotEl.setAttribute('r', 5);
    tempDotEl.classList.add('connection-temp-dot');
    svg.appendChild(tempDotEl);

    // Mark source card
    document.getElementById(`card-${cardId}`)?.classList.add('conn-source');

    updateDrawing(clientX, clientY);
  }

  function updateDrawing(clientX, clientY) {
    if (!drawing || !tempPathEl) return;

    const inv = App.currentInvestigation();
    const fromCard = inv?.cards.find(c => c.id === drawFromCardId);
    if (!fromCard) return;

    const pFrom = worldToScreen(
      ...Object.values(connPointWorld(fromCard, drawFromSide))
    );
    const svgPos = clientToSVG(clientX, clientY);

    tempPathEl.setAttribute('d', tempBezier(
      pFrom.x, pFrom.y, drawFromSide, svgPos.x, svgPos.y
    ));
    tempDotEl?.setAttribute('cx', svgPos.x);
    tempDotEl?.setAttribute('cy', svgPos.y);

    // Highlight card under cursor
    _highlightTargetCard(clientX, clientY);
  }

  function finishDrawing(toCardId, toSide) {
    if (!drawing) return;

    const fromId   = drawFromCardId;
    const fromSide = drawFromSide;
    _cleanupDrawingVisuals();

    if (!toCardId || toCardId === fromId) return;

    const inv = App.currentInvestigation();
    if (!inv) return;

    // Avoid duplicate connections between the same cards in same direction
    const exists = inv.connections.find(c =>
      (c.fromCard === fromId && c.toCard === toCardId) ||
      (c.fromCard === toCardId && c.toCard === fromId)
    );
    if (exists) {
      App.toast('Ya existe una conexión entre esas tarjetas.', 'info');
      return;
    }

    const conn = Storage.newConnection(fromId, fromSide, toCardId, toSide);
    inv.connections.push(conn);
    inv.modified = Date.now();
    App.saveState();
    renderAll();

    // Brief highlight on new connection
    const el = svg.querySelector(`.conn-group[data-conn-id="${conn.id}"] .connection-path`);
    el?.classList.add('conn-just-created');
    setTimeout(() => el?.classList.remove('conn-just-created'), 800);

    App.toast('✓ Conexión creada.', 'success');
  }

  function cancelDrawing() {
    if (!drawing) return;
    _cleanupDrawingVisuals();
  }

  function _cleanupDrawingVisuals() {
    drawing = false;
    tempPathEl?.remove(); tempPathEl = null;
    tempDotEl?.remove();  tempDotEl = null;
    drawFromCardId = null; drawFromSide = null;
    document.querySelectorAll('.conn-source').forEach(el => el.classList.remove('conn-source'));
    document.querySelectorAll('.conn-target-hover').forEach(el => el.classList.remove('conn-target-hover'));
    document.querySelectorAll('.conn-point').forEach(pt => pt.classList.remove('pt-target'));
  }

  let _lastHighlightedCard = null;
  function _highlightTargetCard(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    const card = el?.closest('.card');

    if (_lastHighlightedCard && _lastHighlightedCard !== card) {
      _lastHighlightedCard.classList.remove('conn-target-hover');
      _lastHighlightedCard.querySelectorAll('.conn-point').forEach(pt => pt.classList.remove('pt-target'));
      _lastHighlightedCard = null;
    }

    if (card && card.id !== `card-${drawFromCardId}`) {
      card.classList.add('conn-target-hover');
      card.querySelectorAll('.conn-point').forEach(pt => pt.classList.add('pt-target'));
      _lastHighlightedCard = card;
    }
  }

  function isDrawing()         { return drawing; }
  function getDrawFromCardId() { return drawFromCardId; }

  /* ═══════════════════════════════════════════
     SELECTION
     ═══════════════════════════════════════════ */

  function selectConnection(connId) {
    selectedConnectionId = connId;
    renderAll();
  }

  function deselect() {
    if (!selectedConnectionId) return;
    selectedConnectionId = null;
    renderAll();
  }

  function deleteSelected() {
    if (!selectedConnectionId) return;
    deleteById(selectedConnectionId);
  }

  function deleteById(connId) {
    const inv = App.currentInvestigation();
    if (!inv) return;
    inv.connections = inv.connections.filter(c => c.id !== connId);
    if (selectedConnectionId === connId) selectedConnectionId = null;
    App.saveState();
    renderAll();
    App.toast('Conexión eliminada.', 'info');
  }

  function getSelected() { return selectedConnectionId; }

  /* ═══════════════════════════════════════════
     EDIT MODAL
     ═══════════════════════════════════════════ */

  function openEditModal(connId) {
    const inv  = App.currentInvestigation();
    const conn = inv?.connections.find(c => c.id === connId);
    if (!conn) return;

    document.getElementById('connection-label').value = conn.label || '';

    document.querySelectorAll('#connection-color-picker .conn-color-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.color === conn.color);
    });
    document.querySelectorAll('#connection-style-selector .style-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.style === conn.style);
    });

    document.getElementById('modal-connection').classList.remove('hidden');
    document.getElementById('save-connection-btn').dataset.connId = connId;
    document.getElementById('connection-label').focus();
  }

  function saveConnectionEdit(connId) {
    const inv  = App.currentInvestigation();
    const conn = inv?.connections.find(c => c.id === connId);
    if (!conn) return;

    conn.label = document.getElementById('connection-label').value.trim();
    const activeColor = document.querySelector('#connection-color-picker .conn-color-btn.active');
    if (activeColor) conn.color = activeColor.dataset.color;
    const activeStyle = document.querySelector('#connection-style-selector .style-btn.active');
    if (activeStyle) conn.style = activeStyle.dataset.style;

    inv.modified = Date.now();
    App.saveState();
    renderAll();
    App.toast('Conexión actualizada.', 'success');
  }

  /* ═══════════════════════════════════════════
     CONTEXT MENU
     ═══════════════════════════════════════════ */

  function _showConnContextMenu(x, y, connId) {
    const menu = document.getElementById('connection-context-menu');
    menu.style.left = x + 'px';
    menu.style.top  = y + 'px';
    menu.classList.remove('hidden');
    menu.dataset.connId = connId;
    requestAnimationFrame(() => {
      const r = menu.getBoundingClientRect();
      if (r.right  > window.innerWidth)  menu.style.left = (x - r.width) + 'px';
      if (r.bottom > window.innerHeight) menu.style.top  = (y - r.height) + 'px';
    });
  }

  /* ═══════════════════════════════════════════
     PUBLIC API
     ═══════════════════════════════════════════ */
  return {
    renderAll,
    updateForCard,
    startDrawing,
    updateDrawing,
    finishDrawing,
    cancelDrawing,
    isDrawing,
    getDrawFromCardId,
    selectConnection,
    deselect,
    deleteSelected,
    deleteById,
    getSelected,
    openEditModal,
    saveConnectionEdit
  };
})();
