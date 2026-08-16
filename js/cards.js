/* =============================================
   cards.js — Gestión de tarjetas del tablero
   ============================================= */
'use strict';

const Cards = (() => {
  let selectedCardId = null;
  let editingCardId  = null;
  let contextCardId  = null;
  let noteColor      = '#fef9c3';
  let imageDataUrl   = '';

  /* ─── RENDER ALL CARDS ─────────────────────── */
  function renderAll() {
    const world = document.getElementById('board-world');
    world.innerHTML = '';
    const inv = App.currentInvestigation();
    if (!inv) return;
    inv.cards.forEach(card => createCardDOM(card));

    // Show/hide empty state
    const empty = document.getElementById('board-empty-state');
    if (empty) empty.style.display = inv.cards.length ? 'none' : '';
  }

  /* ─── CREATE CARD DOM ──────────────────────── */
  function createCardDOM(card) {
    const el = document.createElement('div');
    el.className = `card card-${card.type}`;
    el.id = `card-${card.id}`;
    el.style.left   = card.x + 'px';
    el.style.top    = card.y + 'px';
    el.style.width  = card.width + 'px';
    el.style.height = card.height + 'px';

    if (card.type === 'note' && card.data.color) {
      el.setAttribute('data-color', card.data.color);
    }

    el.innerHTML = buildCardHTML(card);
    setupCardEvents(el, card);
    document.getElementById('board-world').appendChild(el);
    return el;
  }

  /* ─── BUILD CARD HTML ──────────────────────── */
  function buildCardHTML(card) {
    const actions = `
      <div class="card-actions">
        <button class="card-action-btn edit-btn" data-card-id="${card.id}" title="Editar">✏️</button>
        <button class="card-action-btn delete delete-btn" data-card-id="${card.id}" title="Eliminar">✕</button>
      </div>`;
    const connPoints = `
      <div class="conn-point conn-point-n" data-card-id="${card.id}" data-side="n"></div>
      <div class="conn-point conn-point-s" data-card-id="${card.id}" data-side="s"></div>
      <div class="conn-point conn-point-e" data-card-id="${card.id}" data-side="e"></div>
      <div class="conn-point conn-point-w" data-card-id="${card.id}" data-side="w"></div>`;
    const resizeHandle = `<div class="card-resize-handle" data-card-id="${card.id}"></div>`;

    let header = '';
    let body   = '';

    switch (card.type) {
      case 'note': {
        const d = card.data;
        const titleClass = d.title ? '' : ' card-title-empty';
        header = `<div class="card-header">
          <span class="card-type-icon">📝</span>
          <span class="card-title${titleClass}">${escHtml(d.title || 'Sin título')}</span>
          ${actions}
        </div>`;
        body = `<div class="card-body">${escHtml(d.content || '')}</div>`;
        break;
      }
      case 'person': {
        const d = card.data;
        const roleLabel = getRoleLabel(d.role);
        const initial = (d.name || '?').charAt(0).toUpperCase();
        const avatarInner = d.photoUrl
          ? `<img src="${escHtml(d.photoUrl)}" alt="${escHtml(d.name)}" onerror="this.style.display='none'">`
          : initial;
        header = `<div class="card-header">
          <span class="card-type-icon">👤</span>
          <span class="card-title">${escHtml(d.name || 'Sin nombre')}</span>
          ${actions}
        </div>`;
        body = `<div class="card-body">
          <div class="person-card-inner">
            <div class="person-avatar">${avatarInner}</div>
            <div class="person-info">
              <div class="person-name">${escHtml(d.name || 'Sin nombre')}</div>
              <span class="person-role-badge role-${d.role || 'unknown'}">${roleLabel}</span>
              <div class="person-desc">${escHtml(d.description || '')}</div>
            </div>
          </div>
        </div>`;
        break;
      }
      case 'image': {
        const d = card.data;
        const src = d.dataUrl || d.url || '';
        const imgEl = src
          ? `<img class="image-card-img" src="${escHtml(src)}" alt="${escHtml(d.title)}" onerror="this.style.display='none'">`
          : `<div class="image-placeholder">🖼️</div>`;
        header = `<div class="card-header">
          <span class="card-type-icon">📸</span>
          <span class="card-title">${escHtml(d.title || 'Imagen')}</span>
          ${actions}
        </div>`;
        body = `<div class="card-body">${imgEl}<div class="image-card-desc">${escHtml(d.description || '')}</div></div>`;
        break;
      }
      case 'event': {
        const d = card.data;
        const dateStr = d.date ? formatDate(d.date) : '';
        const timeStr = d.time || '';
        const dtStr = [dateStr, timeStr].filter(Boolean).join(' · ');
        header = `<div class="card-header">
          <span class="card-type-icon">📅</span>
          <span class="card-title">${escHtml(d.title || 'Evento')}</span>
          ${actions}
        </div>`;
        body = `<div class="card-body">
          ${dtStr ? `<div class="event-datetime">📆 ${escHtml(dtStr)}</div>` : ''}
          ${d.location ? `<div class="event-location">📍 ${escHtml(d.location)}</div>` : ''}
          <div class="event-description">${escHtml(d.description || '')}</div>
          <span class="event-importance importance-${d.importance || 'medium'}">${getImportanceLabel(d.importance)}</span>
        </div>`;
        break;
      }
      case 'link': {
        const d = card.data;
        const displayUrl = d.url ? truncateUrl(d.url) : 'Sin URL';
        header = `<div class="card-header">
          <span class="card-type-icon">🔗</span>
          <span class="card-title">${escHtml(d.title || 'Link')}</span>
          ${actions}
        </div>`;
        body = `<div class="card-body">
          <div class="link-url-display">${escHtml(displayUrl)}</div>
          <div class="link-desc">${escHtml(d.description || '')}</div>
          ${d.url ? `<a class="link-open-btn" href="${escHtml(d.url)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">↗ Abrir</a>` : ''}
        </div>`;
        break;
      }
      case 'timeline': {
        const d = card.data;
        const sorted = (d.events || []).slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        const eventsHtml = sorted.map(ev => `
          <div class="timeline-card-item">
            <div class="tl-item-date">${escHtml(ev.date ? formatDate(ev.date) : 'Sin fecha')}</div>
            <div class="tl-item-text">${escHtml(ev.text || '')}</div>
          </div>`).join('');
        header = `<div class="card-header">
          <span class="card-type-icon">🗓️</span>
          <span class="card-title">${escHtml(d.title || 'Línea de tiempo')}</span>
          ${actions}
        </div>`;
        body = `<div class="card-body">
          <div class="timeline-card-list">${eventsHtml || '<div style="color:var(--text-muted);font-size:12px">Sin eventos</div>'}</div>
        </div>`;
        break;
      }
    }

    return header + body + connPoints + resizeHandle;
  }

  /* ─── SETUP CARD EVENTS ────────────────────── */
  function setupCardEvents(el, card) {
    // Drag
    const header = el.querySelector('.card-header');
    if (header) {
      header.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (e.target.closest('.card-action-btn')) return;
        e.stopPropagation();
        startDrag(e, card.id);
      });
    }

    // Edit button
    el.querySelector('.edit-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal(card.id);
    });

    // Delete button
    el.querySelector('.delete-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      confirmDeleteCard(card.id);
    });

    // Double click to edit
    el.addEventListener('dblclick', (e) => {
      if (e.target.closest('.conn-point')) return;
      if (e.target.closest('.link-open-btn')) return;
      e.stopPropagation();
      openEditModal(card.id);
    });

    // Select on click
    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('.conn-point')) return;
      e.stopPropagation();
      selectCard(card.id);
    });

    // Context menu
    el.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.conn-point')) return;
      e.preventDefault();
      e.stopPropagation();
      selectCard(card.id);
      contextCardId = card.id;
      showCardContextMenu(e.clientX, e.clientY);
    });

    // Connection points — drag-based drawing
    el.querySelectorAll('.conn-point').forEach(pt => {
      const cardId = card.id;
      const side   = pt.dataset.side;

      // START drawing on mousedown
      pt.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        Connections.startDrawing(cardId, side, e.clientX, e.clientY);
      });

      // FINISH drawing on mouseup (while dragging from another card)
      pt.addEventListener('mouseup', (e) => {
        e.stopPropagation();
        if (Connections.isDrawing() && Connections.getDrawFromCardId() !== cardId) {
          Connections.finishDrawing(cardId, side);
        }
      });

      // Highlight as target when hovering while drawing
      pt.addEventListener('mouseenter', () => {
        if (Connections.isDrawing() && Connections.getDrawFromCardId() !== cardId) {
          pt.classList.add('pt-target');
        }
      });
      pt.addEventListener('mouseleave', () => {
        pt.classList.remove('pt-target');
      });
    });

    // Resize handle
    const resizeHandle = el.querySelector('.card-resize-handle');
    if (resizeHandle) {
      resizeHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        startResize(e, card.id);
      });
    }
  }

  /* ─── DRAG ─────────────────────────────────── */
  function startDrag(e, cardId) {
    selectCard(cardId);
    const inv = App.currentInvestigation();
    const card = inv?.cards.find(c => c.id === cardId);
    if (!card) return;

    const board = App.board;
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startCardX  = card.x;
    const startCardY  = card.y;

    const el = document.getElementById(`card-${cardId}`);
    el?.classList.add('dragging');
    document.body.classList.add('no-select');

    function onMove(e) {
      const dx = (e.clientX - startMouseX) / board.scale;
      const dy = (e.clientY - startMouseY) / board.scale;
      let newX = startCardX + dx;
      let newY = startCardY + dy;

      if (board.snapToGrid) {
        newX = Math.round(newX / board.gridSize) * board.gridSize;
        newY = Math.round(newY / board.gridSize) * board.gridSize;
      }

      card.x = Math.round(newX);
      card.y = Math.round(newY);

      if (el) {
        el.style.left = card.x + 'px';
        el.style.top  = card.y + 'px';
      }

      Connections.updateForCard(cardId);
    }

    function onUp() {
      el?.classList.remove('dragging');
      document.body.classList.remove('no-select');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      inv.modified = Date.now();
      App.saveState();
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  /* ─── RESIZE ────────────────────────────────── */
  function startResize(e, cardId) {
    const inv = App.currentInvestigation();
    const card = inv?.cards.find(c => c.id === cardId);
    if (!card) return;

    const board = App.board;
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startW = card.width;
    const startH = card.height;

    document.body.classList.add('no-select');

    function onMove(e) {
      const dx = (e.clientX - startMouseX) / board.scale;
      const dy = (e.clientY - startMouseY) / board.scale;
      card.width  = Math.max(160, Math.round(startW + dx));
      card.height = Math.max(120, Math.round(startH + dy));

      const el = document.getElementById(`card-${cardId}`);
      if (el) {
        el.style.width  = card.width + 'px';
        el.style.height = card.height + 'px';
      }
      Connections.updateForCard(cardId);
    }

    function onUp() {
      document.body.classList.remove('no-select');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      inv.modified = Date.now();
      App.saveState();
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  /* ─── SELECT ────────────────────────────────── */
  function selectCard(cardId) {
    // Deselect previous
    if (selectedCardId) {
      document.getElementById(`card-${selectedCardId}`)?.classList.remove('selected');
    }
    Connections.deselect();
    selectedCardId = cardId;
    document.getElementById(`card-${cardId}`)?.classList.add('selected');
  }

  function deselectAll() {
    if (selectedCardId) {
      document.getElementById(`card-${selectedCardId}`)?.classList.remove('selected');
      selectedCardId = null;
    }
    Connections.deselect();
  }

  /* ─── ADD CARD ──────────────────────────────── */
  function addCard(type, worldX, worldY) {
    const inv = App.currentInvestigation();
    if (!inv) {
      App.toast('Crea o selecciona una investigación primero.', 'error');
      return;
    }
    const card = Storage.newCard(type, worldX, worldY);
    inv.cards.push(card);
    inv.modified = Date.now();
    App.saveState();
    createCardDOM(card);

    // Hide empty state
    const empty = document.getElementById('board-empty-state');
    if (empty) empty.style.display = 'none';

    // Open edit modal immediately
    openEditModal(card.id);
  }

  /* ─── DUPLICATE CARD ────────────────────────── */
  function duplicateCard(cardId) {
    const inv = App.currentInvestigation();
    const orig = inv?.cards.find(c => c.id === cardId);
    if (!orig) return;
    const dupe = Storage.newCard(orig.type, orig.x + 24, orig.y + 24);
    dupe.data = JSON.parse(JSON.stringify(orig.data));
    dupe.width  = orig.width;
    dupe.height = orig.height;
    inv.cards.push(dupe);
    inv.modified = Date.now();
    App.saveState();
    createCardDOM(dupe);
    selectCard(dupe.id);
    App.toast('Tarjeta duplicada.', 'success');
  }

  /* ─── DELETE CARD ───────────────────────────── */
  function confirmDeleteCard(cardId) {
    App.showConfirm(
      '¿Eliminar tarjeta?',
      'Esta acción no se puede deshacer. También se eliminarán sus conexiones.',
      () => deleteCard(cardId)
    );
  }

  function deleteCard(cardId) {
    const inv = App.currentInvestigation();
    if (!inv) return;
    inv.cards = inv.cards.filter(c => c.id !== cardId);
    inv.connections = inv.connections.filter(c => c.fromCard !== cardId && c.toCard !== cardId);
    inv.modified = Date.now();
    App.saveState();
    document.getElementById(`card-${cardId}`)?.remove();
    Connections.renderAll();
    if (selectedCardId === cardId) selectedCardId = null;

    // Show empty state if no cards left
    if (inv.cards.length === 0) {
      const empty = document.getElementById('board-empty-state');
      if (empty) empty.style.display = '';
    }
    App.toast('Tarjeta eliminada.', 'info');
  }

  /* ─── EDIT MODALS ───────────────────────────── */
  function openEditModal(cardId) {
    const inv = App.currentInvestigation();
    const card = inv?.cards.find(c => c.id === cardId);
    if (!card) return;
    editingCardId = cardId;

    closeAllModals();

    switch (card.type) {
      case 'note':     openNoteModal(card); break;
      case 'person':   openPersonModal(card); break;
      case 'image':    openImageModal(card); break;
      case 'event':    openEventModal(card); break;
      case 'link':     openLinkModal(card); break;
      case 'timeline': openTimelineModal(card); break;
    }
  }

  function openNoteModal(card) {
    document.getElementById('note-title').value   = card.data.title || '';
    document.getElementById('note-content').value = card.data.content || '';
    noteColor = card.data.color || '#fef9c3';
    document.querySelectorAll('#note-color-picker .color-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.color === noteColor);
    });
    document.getElementById('modal-note').classList.remove('hidden');
    document.getElementById('note-title').focus();
  }

  function saveNote() {
    const card = getEditingCard();
    if (!card) return;
    card.data.title   = document.getElementById('note-title').value.trim();
    card.data.content = document.getElementById('note-content').value;
    card.data.color   = noteColor;
    commitEdit(card);
  }

  function openPersonModal(card) {
    document.getElementById('person-name').value        = card.data.name || '';
    document.getElementById('person-role').value        = card.data.role || 'unknown';
    document.getElementById('person-description').value = card.data.description || '';
    document.getElementById('person-photo-url').value   = card.data.photoUrl || '';
    updatePersonAvatarPreview(card.data.photoUrl, card.data.name);
    document.getElementById('modal-person').classList.remove('hidden');
    document.getElementById('person-name').focus();
  }

  function updatePersonAvatarPreview(url, name) {
    const preview = document.getElementById('person-avatar-preview');
    if (url) {
      preview.innerHTML = `<img src="${escHtml(url)}" alt="" onerror="this.parentElement.textContent='?'">`;
    } else {
      preview.textContent = name ? name.charAt(0).toUpperCase() : '?';
    }
  }

  function savePerson() {
    const card = getEditingCard();
    if (!card) return;
    card.data.name        = document.getElementById('person-name').value.trim();
    card.data.role        = document.getElementById('person-role').value;
    card.data.description = document.getElementById('person-description').value.trim();
    card.data.photoUrl    = document.getElementById('person-photo-url').value.trim();
    commitEdit(card);
  }

  function openImageModal(card) {
    document.getElementById('image-title').value       = card.data.title || '';
    document.getElementById('image-url').value         = card.data.url || '';
    document.getElementById('image-description').value = card.data.description || '';
    imageDataUrl = card.data.dataUrl || '';
    updateImagePreview(imageDataUrl || card.data.url);
    document.getElementById('modal-image').classList.remove('hidden');
    document.getElementById('image-title').focus();
  }

  function updateImagePreview(src) {
    const preview = document.getElementById('image-preview');
    const img     = document.getElementById('image-preview-img');
    if (src) {
      img.src = src;
      preview.classList.remove('hidden');
      document.getElementById('image-upload-area').style.display = 'none';
    } else {
      preview.classList.add('hidden');
      document.getElementById('image-upload-area').style.display = '';
    }
  }

  function saveImage() {
    const card = getEditingCard();
    if (!card) return;
    card.data.title       = document.getElementById('image-title').value.trim();
    card.data.url         = document.getElementById('image-url').value.trim();
    card.data.dataUrl     = imageDataUrl;
    card.data.description = document.getElementById('image-description').value.trim();
    commitEdit(card);
  }

  function openEventModal(card) {
    document.getElementById('event-title').value       = card.data.title || '';
    document.getElementById('event-date').value        = card.data.date || '';
    document.getElementById('event-time').value        = card.data.time || '';
    document.getElementById('event-location').value    = card.data.location || '';
    document.getElementById('event-description').value = card.data.description || '';

    const importance = card.data.importance || 'medium';
    document.querySelectorAll('#importance-selector .importance-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.level === importance);
    });
    document.getElementById('modal-event').classList.remove('hidden');
    document.getElementById('event-title').focus();
  }

  function saveEvent() {
    const card = getEditingCard();
    if (!card) return;
    card.data.title       = document.getElementById('event-title').value.trim();
    card.data.date        = document.getElementById('event-date').value;
    card.data.time        = document.getElementById('event-time').value;
    card.data.location    = document.getElementById('event-location').value.trim();
    card.data.description = document.getElementById('event-description').value.trim();
    const activeImp = document.querySelector('#importance-selector .importance-btn.active');
    card.data.importance  = activeImp ? activeImp.dataset.level : 'medium';
    commitEdit(card);
  }

  function openLinkModal(card) {
    document.getElementById('link-title').value       = card.data.title || '';
    document.getElementById('link-url').value         = card.data.url || '';
    document.getElementById('link-description').value = card.data.description || '';
    document.getElementById('modal-link').classList.remove('hidden');
    document.getElementById('link-url').focus();
  }

  function saveLink() {
    const card = getEditingCard();
    if (!card) return;
    card.data.title       = document.getElementById('link-title').value.trim();
    card.data.url         = document.getElementById('link-url').value.trim();
    card.data.description = document.getElementById('link-description').value.trim();
    commitEdit(card);
  }

  function openTimelineModal(card) {
    document.getElementById('timeline-title').value = card.data.title || '';
    const listEl = document.getElementById('timeline-events-list');
    listEl.innerHTML = '';
    (card.data.events || []).forEach(ev => addTimelineEventRow(ev.date, ev.text));
    document.getElementById('modal-timeline').classList.remove('hidden');
    document.getElementById('timeline-title').focus();
  }

  function addTimelineEventRow(date = '', text = '') {
    const listEl = document.getElementById('timeline-events-list');
    const row = document.createElement('div');
    row.className = 'timeline-event-row';
    row.innerHTML = `
      <input type="date" class="tl-ev-date" value="${escHtml(date)}" placeholder="Fecha">
      <input type="text" class="tl-ev-text" value="${escHtml(text)}" placeholder="Descripción del evento...">
      <button class="remove-tl-event-btn" type="button" title="Quitar">✕</button>
    `;
    row.querySelector('.remove-tl-event-btn').addEventListener('click', () => row.remove());
    listEl.appendChild(row);
    row.querySelector('.tl-ev-text').focus();
  }

  function saveTimeline() {
    const card = getEditingCard();
    if (!card) return;
    card.data.title = document.getElementById('timeline-title').value.trim();
    const rows = document.querySelectorAll('#timeline-events-list .timeline-event-row');
    card.data.events = Array.from(rows).map(row => ({
      date: row.querySelector('.tl-ev-date').value,
      text: row.querySelector('.tl-ev-text').value.trim()
    })).filter(ev => ev.text || ev.date);
    commitEdit(card);
  }

  /* ─── COMMIT EDIT ───────────────────────────── */
  function commitEdit(card) {
    const inv = App.currentInvestigation();
    if (!inv) return;
    inv.modified = Date.now();
    App.saveState();

    // Re-render the card DOM
    const el = document.getElementById(`card-${card.id}`);
    if (el) {
      el.innerHTML = buildCardHTML(card);
      if (card.type === 'note' && card.data.color) el.setAttribute('data-color', card.data.color);
      setupCardEvents(el, card);
    }

    Connections.renderAll();
    closeAllModals();
    editingCardId = null;
    App.toast('Tarjeta guardada.', 'success');
  }

  /* ─── CONTEXT MENU ──────────────────────────── */
  function showCardContextMenu(x, y) {
    const menu = document.getElementById('card-context-menu');
    menu.style.left = x + 'px';
    menu.style.top  = y + 'px';
    menu.classList.remove('hidden');
    requestAnimationFrame(() => {
      const r = menu.getBoundingClientRect();
      if (r.right  > window.innerWidth)  menu.style.left = (x - r.width)  + 'px';
      if (r.bottom > window.innerHeight) menu.style.top  = (y - r.height) + 'px';
    });
  }

  /* ─── HELPERS ───────────────────────────────── */
  function getEditingCard() {
    const inv = App.currentInvestigation();
    return inv?.cards.find(c => c.id === editingCardId) || null;
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    } catch { return dateStr; }
  }

  function truncateUrl(url) {
    try {
      const u = new URL(url);
      return u.hostname + (u.pathname !== '/' ? u.pathname : '');
    } catch { return url; }
  }

  function getRoleLabel(role) {
    const labels = {
      suspect: 'Sospechoso', witness: 'Testigo', victim: 'Víctima',
      detective: 'Detective', accomplice: 'Cómplice',
      unknown: 'Desconocido', other: 'Otro'
    };
    return labels[role] || 'Otro';
  }

  function getImportanceLabel(imp) {
    const labels = {
      low: '▪ Baja', medium: '▲ Media', high: '⚠ Alta', critical: '⚡ Crítica'
    };
    return labels[imp] || '▲ Media';
  }

  /* ─── IMAGE UPLOAD ──────────────────────────── */
  function initImageUpload() {
    const area    = document.getElementById('image-upload-area');
    const fileIn  = document.getElementById('image-file');
    const clearBtn = document.getElementById('clear-image-btn');

    area?.addEventListener('click', () => fileIn.click());
    area?.addEventListener('dragover', (e) => { e.preventDefault(); area.style.borderColor = 'var(--accent)'; });
    area?.addEventListener('dragleave', () => { area.style.borderColor = ''; });
    area?.addEventListener('drop', (e) => {
      e.preventDefault();
      area.style.borderColor = '';
      const file = e.dataTransfer.files[0];
      if (file) processImageFile(file);
    });

    fileIn?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) processImageFile(file);
    });

    // URL input auto-preview
    document.getElementById('image-url')?.addEventListener('blur', (e) => {
      const url = e.target.value.trim();
      if (url && !imageDataUrl) updateImagePreview(url);
    });

    clearBtn?.addEventListener('click', () => {
      imageDataUrl = '';
      document.getElementById('image-url').value = '';
      updateImagePreview('');
    });
  }

  function processImageFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      imageDataUrl = e.target.result;
      updateImagePreview(imageDataUrl);
    };
    reader.readAsDataURL(file);
  }

  /* ─── INIT MODAL EVENTS ─────────────────────── */
  function initModalEvents() {
    // Note modal
    document.getElementById('save-note-btn')?.addEventListener('click', saveNote);
    document.querySelectorAll('#note-color-picker .color-option').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#note-color-picker .color-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        noteColor = btn.dataset.color;
      });
    });

    // Person modal
    document.getElementById('save-person-btn')?.addEventListener('click', savePerson);
    document.getElementById('preview-photo-btn')?.addEventListener('click', () => {
      const url  = document.getElementById('person-photo-url').value.trim();
      const name = document.getElementById('person-name').value.trim();
      updatePersonAvatarPreview(url, name);
    });

    // Image modal
    document.getElementById('save-image-btn')?.addEventListener('click', saveImage);
    initImageUpload();

    // Event modal
    document.getElementById('save-event-btn')?.addEventListener('click', saveEvent);
    document.querySelectorAll('#importance-selector .importance-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#importance-selector .importance-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Link modal
    document.getElementById('save-link-btn')?.addEventListener('click', saveLink);

    // Timeline modal
    document.getElementById('save-timeline-btn')?.addEventListener('click', saveTimeline);
    document.getElementById('add-timeline-event-btn')?.addEventListener('click', () => addTimelineEventRow());

    // Connection modal
    document.getElementById('save-connection-btn')?.addEventListener('click', () => {
      const connId = document.getElementById('save-connection-btn').dataset.connId;
      if (connId) {
        Connections.saveConnectionEdit(connId);
        closeAllModals();
      }
    });
    document.querySelectorAll('#connection-color-picker .conn-color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#connection-color-picker .conn-color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
    document.querySelectorAll('#connection-style-selector .style-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#connection-style-selector .style-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Card context menu actions (unique to cards module)
    document.getElementById('card-context-menu')?.addEventListener('click', e => {
      const action = e.target.closest('.cmenu-item')?.dataset.action;
      if (!action || !contextCardId) return;
      document.getElementById('card-context-menu').classList.add('hidden');
      switch (action) {
        case 'edit':      openEditModal(contextCardId); break;
        case 'duplicate': duplicateCard(contextCardId);  break;
        case 'delete':    confirmDeleteCard(contextCardId); break;
      }
      contextCardId = null;
    });

    // Reset editingCardId on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.add('hidden');
          editingCardId = null;
        }
      });
    });

    // Keep editingCardId in sync when Escape closes a modal
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') editingCardId = null;
    });
  }

  return {
    renderAll, addCard, deleteCard, openEditModal, deselectAll, confirmDeleteCard,
    getSelectedId: () => selectedCardId,
    getContextCardId: () => contextCardId,
    initModalEvents
  };
})();
