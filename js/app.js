/* =============================================
   app.js v3 — Inicialización y estado global
   Panel de Investigación
   ============================================= */
'use strict';

const App = (() => {
  let state = Storage.defaultState();
  let confirmCallback = null;

  /* ══════════════════════════════════════════
     INIT
     ══════════════════════════════════════════ */
  function init() {
    const saved = Storage.load();
    if (saved) state = saved;

    // Merge saved settings with defaults — ensures new keys always exist
    state.settings = { ...Storage.defaultSettings(), ...(saved?.settings ?? {}) };

    applyTheme(state.theme || 'dark');
    applySettings(state.settings);

    Board.init();

    // Load active investigation OR show empty
    if (state.currentInvestigationId && state.investigations[state.currentInvestigationId]) {
      loadInvestigation(state.currentInvestigationId, false);
    } else {
      state.currentInvestigationId = null;
      renderInvestigationsList();
      updateTopbarName(null);
    }

    // Wire all UI — order matters (cards first, then app, to avoid double-binding)
    Cards.initModalEvents();
    _initSidebar();
    _initSettings();
    _initShare();
    _initExportImport();
    _initConfirmModal();
    _initGlobalModalClose();
    _initConnectionModal();

    // Auto-save every 30 s
    setInterval(() => saveState(), 30_000);
  }

  /* ══════════════════════════════════════════
     STATE
     ══════════════════════════════════════════ */
  function saveState()          { Storage.save(state); }
  function currentInvestigation() {
    if (!state.currentInvestigationId) return null;
    return state.investigations[state.currentInvestigationId] || null;
  }

  /* ══════════════════════════════════════════
     LOAD INVESTIGATION
     ══════════════════════════════════════════ */
  function loadInvestigation(id, showToast = true) {
    state.currentInvestigationId = id;
    const inv = state.investigations[id];
    if (!inv) return;

    Cards.renderAll();
    Board.restoreView(inv);
    Connections.renderAll();
    updateTopbarName(inv);
    renderInvestigationsList();     // refresh sidebar list (no duplication: innerHTML replaced)
    closeSidebar();
    saveState();
    if (showToast) toast(`"${inv.name}" cargada.`, 'success');
  }

  /* ══════════════════════════════════════════
     INVESTIGATIONS LIST
     ══════════════════════════════════════════ */
  function renderInvestigationsList() {
    const list = document.getElementById('investigations-list');
    if (!list) return;

    const invs = Object.values(state.investigations)
      .sort((a, b) => b.modified - a.modified);

    if (!invs.length) {
      list.innerHTML = `<div class="empty-state-sidebar">
        <span>Sin investigaciones</span><small>Crea tu primer caso</small>
      </div>`;
      return;
    }

    list.innerHTML = invs.map(inv => {
      const active = inv.id === state.currentInvestigationId;
      const count  = (inv.cards || []).length;
      const date   = new Date(inv.modified).toLocaleDateString('es', { month: 'short', day: 'numeric' });
      const icon   = inv.isPrivate ? '🔒' : '📁';
      return `<div class="investigation-item${active ? ' active' : ''}" data-inv-id="${inv.id}">
        <span class="inv-icon">${icon}</span>
        <div class="inv-info">
          <div class="inv-name">${escHtml(inv.name)}</div>
          <div class="inv-meta">${count} tarjeta${count !== 1 ? 's' : ''} · ${date}</div>
        </div>
        <div class="inv-actions">
          <button class="inv-action-btn edit-inv-btn"   data-inv-id="${inv.id}" title="Editar">✏️</button>
          <button class="inv-action-btn inv-delete-btn delete-inv-btn" data-inv-id="${inv.id}" title="Eliminar">🗑️</button>
        </div>
      </div>`;
    }).join('');

    // Events are attached once here — no duplicate registration possible
    list.querySelectorAll('.investigation-item').forEach(item => {
      item.addEventListener('click', e => {
        if (e.target.closest('.inv-action-btn')) return;
        loadInvestigation(item.dataset.invId);
      });
    });
    list.querySelectorAll('.edit-inv-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        openEditInvModal(btn.dataset.invId);
      });
    });
    list.querySelectorAll('.delete-inv-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        _confirmDeleteInv(btn.dataset.invId);
      });
    });
  }

  function updateTopbarName(inv) {
    const nameEl  = document.getElementById('investigation-name-display');
    const badgeEl = document.getElementById('investigation-privacy-badge');
    if (nameEl) nameEl.textContent = inv ? inv.name : 'Sin investigación activa';
    badgeEl?.classList.toggle('hidden', !inv?.isPrivate);
  }

  /* ══════════════════════════════════════════
     SIDEBAR OPEN / CLOSE
     ══════════════════════════════════════════ */
  function openSidebar() {
    document.getElementById('sidebar')?.classList.add('open');
    document.getElementById('sidebar-backdrop')?.classList.add('visible');
  }
  function closeSidebar() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-backdrop')?.classList.remove('visible');
  }

  /* ══════════════════════════════════════════
     SIDEBAR — INVESTIGATION MODAL
     ══════════════════════════════════════════ */
  let _editingInvId = null;

  function openNewInvModal() {
    _editingInvId = null;
    document.getElementById('modal-inv-title').textContent     = 'Nueva Investigación';
    document.getElementById('inv-name').value                  = '';
    document.getElementById('inv-description').value           = '';
    document.getElementById('inv-private').checked             = false;
    document.getElementById('save-investigation-btn').textContent = 'Crear investigación';
    document.getElementById('modal-investigation').classList.remove('hidden');
    setTimeout(() => document.getElementById('inv-name').focus(), 60);
  }

  function openEditInvModal(invId) {
    const inv = state.investigations[invId];
    if (!inv) return;
    _editingInvId = invId;
    document.getElementById('modal-inv-title').textContent     = 'Editar Investigación';
    document.getElementById('inv-name').value                  = inv.name || '';
    document.getElementById('inv-description').value           = inv.description || '';
    document.getElementById('inv-private').checked             = !!inv.isPrivate;
    document.getElementById('save-investigation-btn').textContent = 'Guardar cambios';
    document.getElementById('modal-investigation').classList.remove('hidden');
    setTimeout(() => document.getElementById('inv-name').focus(), 60);
  }

  function _saveInvestigation() {
    const name = document.getElementById('inv-name').value.trim();
    if (!name) { toast('El nombre es obligatorio.', 'error'); return; }

    if (_editingInvId) {
      const inv = state.investigations[_editingInvId];
      if (inv) {
        inv.name        = name;
        inv.description = document.getElementById('inv-description').value.trim();
        inv.isPrivate   = document.getElementById('inv-private').checked;
        inv.modified    = Date.now();
        saveState();
        renderInvestigationsList();
        updateTopbarName(state.currentInvestigationId === _editingInvId ? inv : currentInvestigation());
        toast('Investigación actualizada.', 'success');
      }
    } else {
      const inv = Storage.newInvestigation(
        name,
        document.getElementById('inv-description').value.trim(),
        document.getElementById('inv-private').checked
      );
      state.investigations[inv.id] = inv;
      saveState();
      loadInvestigation(inv.id);
      toast(`"${inv.name}" creada. ¡Empieza añadiendo tarjetas!`, 'success');
    }
    document.getElementById('modal-investigation').classList.add('hidden');
    _editingInvId = null;
  }

  function _confirmDeleteInv(invId) {
    const inv = state.investigations[invId];
    if (!inv) return;
    showConfirm(
      '¿Eliminar investigación?',
      `Se eliminará "${inv.name}" y todas sus tarjetas y conexiones. Esta acción no se puede deshacer.`,
      () => _deleteInv(invId)
    );
  }

  function _deleteInv(invId) {
    delete state.investigations[invId];
    if (state.currentInvestigationId === invId) {
      state.currentInvestigationId = null;
      const remaining = Object.keys(state.investigations);
      if (remaining.length) {
        loadInvestigation(remaining[0]);
      } else {
        Cards.renderAll();
        Connections.renderAll();
        updateTopbarName(null);
      }
    }
    saveState();
    renderInvestigationsList();
    toast('Investigación eliminada.', 'info');
  }

  /* ══════════════════════════════════════════
     SIDEBAR WIRE-UP
     ══════════════════════════════════════════ */
  function _initSidebar() {
    // Open / close
    document.getElementById('sidebar-toggle')?.addEventListener('click', openSidebar);
    document.getElementById('sidebar-close-btn')?.addEventListener('click', closeSidebar);
    document.getElementById('sidebar-backdrop')?.addEventListener('click', closeSidebar);

    // New investigation
    document.getElementById('new-investigation-btn')?.addEventListener('click', openNewInvModal);

    // Save investigation modal
    document.getElementById('save-investigation-btn')?.addEventListener('click', _saveInvestigation);
    document.getElementById('inv-name')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') _saveInvestigation();
    });

    // Sidebar export / import
    document.getElementById('sb-export-btn')?.addEventListener('click', () => {
      const inv = currentInvestigation();
      if (!inv) { toast('No hay investigación activa para exportar.', 'error'); return; }
      ExportManager.exportInvestigation(inv);
    });
    document.getElementById('import-btn')?.addEventListener('click', () => ExportManager.triggerImport());

    // Sidebar share
    document.getElementById('sb-share-btn')?.addEventListener('click', () => {
      if (!currentInvestigation()) { toast('Selecciona una investigación primero.', 'error'); return; }
      document.getElementById('modal-share').classList.remove('hidden');
    });

    // Topbar export shortcut
    document.getElementById('export-btn')?.addEventListener('click', () => {
      const inv = currentInvestigation();
      if (!inv) { toast('No hay investigación activa para exportar.', 'error'); return; }
      ExportManager.exportInvestigation(inv);
    });

    // Collapsible settings section
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsBody   = document.getElementById('settings-body');
    settingsToggle?.addEventListener('click', () => {
      const open = settingsBody.classList.toggle('open');
      settingsToggle.classList.toggle('open', open);
      settingsToggle.setAttribute('aria-expanded', open);
    });
  }

  /* ══════════════════════════════════════════
     SETTINGS — apply + wire-up
     ══════════════════════════════════════════ */
  function applySettings(settings) {
    const doc = document.documentElement;
    // Font scale
    doc.style.setProperty('--font-scale', settings.fontSize ?? 1);
    // Card border radius
    const radMap = { sharp: '4px', normal: '12px', rounded: '20px' };
    doc.style.setProperty('--card-radius-override', radMap[settings.cardRadius ?? 'normal'] ?? '12px');
    // Grid size
    doc.style.setProperty('--grid-size', (settings.gridSize ?? 40) + 'px');
    // Connection width
    doc.style.setProperty('--conn-width-override', settings.connectionWidth ?? 2.5);
    // Card animations
    if (settings.cardAnimations === false) {
      doc.style.setProperty('--card-anim', 'none');
    } else {
      doc.style.removeProperty('--card-anim');
    }
    // Reduce motion
    doc.setAttribute('data-reduce-motion', settings.reduceMotion ? 'on' : 'off');
    // High contrast
    doc.setAttribute('data-high-contrast', settings.highContrast ? 'on' : 'off');
    // Focus ring
    doc.style.setProperty('--focus-ring',
      settings.focusRing !== false ? '0 0 0 3px var(--accent-glow)' : 'none');
    // Tool labels
    doc.classList.toggle('tool-labels-visible', !!settings.toolLabels);
  }

  function _initSettings() {
    const s = state.settings;

    // Sync theme seg
    _syncThemeSeg(state.theme);

    // Topbar theme toggle
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      const next = state.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      _syncThemeSeg(next);
      saveState();
    });

    // Theme segmented control (sidebar)
    document.getElementById('theme-seg-btn')?.querySelectorAll('.tseg-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        applyTheme(opt.dataset.theme);
        _syncThemeSeg(opt.dataset.theme);
        saveState();
      });
    });

    // Select dropdowns
    const selects = {
      'setting-font-size':   v => { state.settings.fontSize = parseFloat(v); applySettings(state.settings); },
      'setting-card-radius': v => { state.settings.cardRadius = v;          applySettings(state.settings); },
      'setting-grid-size':   v => { state.settings.gridSize = parseInt(v);  applySettings(state.settings); Board.applyGrid?.(); },
      'setting-conn-width':  v => { state.settings.connectionWidth = parseFloat(v); applySettings(state.settings); Connections.renderAll(); }
    };
    Object.entries(selects).forEach(([id, handler]) => {
      const el = document.getElementById(id);
      if (!el) return;
      // Set initial value
      const key = el.dataset.setting;
      if (s[key] != null) el.value = s[key];
      el.addEventListener('change', () => { handler(el.value); saveState(); });
    });

    // Toggles
    const toggles = [
      ['setting-grid-check',    'defaultGrid',    (v) => Board.setGrid?.(v)],
      ['setting-snap-check',    'defaultSnap',    (v) => Board.setSnap?.(v)],
      ['setting-anim-check',    'cardAnimations', null],
      ['setting-reduce-motion', 'reduceMotion',   null],
      ['setting-high-contrast', 'highContrast',   null],
      ['setting-focus-ring',    'focusRing',      null],
      ['setting-tool-labels',   'toolLabels',     null],
    ];
    toggles.forEach(([id, key, handler]) => {
      const el = document.getElementById(id);
      if (!el) return;
      // Sync initial state
      el.checked = key === 'focusRing' ? s[key] !== false : !!s[key];
      if (key === 'cardAnimations') el.checked = s[key] !== false;
      el.addEventListener('change', () => {
        state.settings[key] = el.checked;
        applySettings(state.settings);
        if (handler) handler(el.checked);
        saveState();
      });
    });

    // Clear all data
    document.getElementById('clear-data-btn')?.addEventListener('click', () => {
      showConfirm(
        '¿Borrar todos los datos?',
        'Se eliminarán TODAS las investigaciones, tarjetas, conexiones y ajustes guardados. Esta acción es irreversible.',
        () => { Storage.clearAll(); location.reload(); }
      );
    });
  }

  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    // Topbar icons
    const moon = document.getElementById('theme-icon-moon');
    const sun  = document.getElementById('theme-icon-sun');
    if (moon) moon.style.display = theme === 'dark'  ? '' : 'none';
    if (sun)  sun.style.display  = theme === 'light' ? '' : 'none';
  }

  function _syncThemeSeg(theme) {
    document.querySelectorAll('#theme-seg-btn .tseg-opt').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.theme === theme);
    });
  }

  /* ══════════════════════════════════════════
     SHARE MODAL
     ══════════════════════════════════════════ */
  function _initShare() {
    // Download JSON
    document.getElementById('share-download-btn')?.addEventListener('click', () => {
      const inv = currentInvestigation();
      if (inv) ExportManager.exportInvestigation(inv);
    });

    // Copy to clipboard
    document.getElementById('share-clipboard-btn')?.addEventListener('click', async () => {
      const inv = currentInvestigation();
      if (!inv) return;
      try {
        const json = JSON.stringify(inv, null, 2);
        await navigator.clipboard.writeText(json);
        toast('JSON copiado al portapapeles.', 'success');
      } catch {
        toast('No se pudo copiar. Usa Exportar en su lugar.', 'error');
      }
    });
  }

  /* ══════════════════════════════════════════
     EXPORT / IMPORT
     ══════════════════════════════════════════ */
  function _initExportImport() {
    document.getElementById('import-file-input')?.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) ExportManager.handleImportFile(file);
      e.target.value = '';
    });
  }

  /* ══════════════════════════════════════════
     CONFIRM MODAL
     ══════════════════════════════════════════ */
  function showConfirm(title, message, onConfirm) {
    document.getElementById('confirm-title').textContent   = title;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('modal-confirm').classList.remove('hidden');
    confirmCallback = onConfirm;
  }

  function _initConfirmModal() {
    document.getElementById('confirm-action-btn')?.addEventListener('click', () => {
      document.getElementById('modal-confirm').classList.add('hidden');
      confirmCallback?.();
      confirmCallback = null;
    });
  }

  /* ══════════════════════════════════════════
     GLOBAL MODAL CLOSE (single registration)
     ══════════════════════════════════════════ */
  function _initGlobalModalClose() {
    // All [data-modal] buttons: close their target modal
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-modal]');
      if (!btn) return;
      const id = btn.dataset.modal;
      document.getElementById(id)?.classList.add('hidden');
    });

    // Click on the overlay itself
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.classList.add('hidden');
      });
    });

    // Escape key — close modals, menus, cancel connections
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      const anyModal = document.querySelector('.modal-overlay:not(.hidden)');
      if (anyModal) { anyModal.classList.add('hidden'); return; }
      document.querySelectorAll('.context-menu').forEach(m => m.classList.add('hidden'));
      Connections.cancelDrawing();
      closeSidebar();
    });

    // Delete key — remove selected card or connection
    document.addEventListener('keydown', e => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const active = document.activeElement;
      if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT') return;
      if (active.closest('.modal-overlay')) return;
      if (Cards.getSelectedId()) {
        // confirmDeleteCard handled inside Cards
        const id = Cards.getSelectedId();
        if (id) Cards.confirmDeleteCard(id);
      } else if (Connections.getSelected()) {
        Connections.deleteSelected();
      }
    });
  }

  /* ══════════════════════════════════════════
     CONNECTION EDIT MODAL
     ══════════════════════════════════════════ */
  function _initConnectionModal() {
    document.getElementById('save-connection-btn')?.addEventListener('click', () => {
      const connId = document.getElementById('save-connection-btn').dataset.connId;
      if (connId) Connections.saveConnectionEdit(connId);
      document.getElementById('modal-connection').classList.add('hidden');
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

    // Connection context menu
    document.getElementById('connection-context-menu')?.addEventListener('click', e => {
      const item   = e.target.closest('.cmenu-item');
      if (!item) return;
      const menu   = document.getElementById('connection-context-menu');
      const connId = menu.dataset.connId;
      menu.classList.add('hidden');
      if (item.dataset.action === 'edit-connection')   Connections.openEditModal(connId);
      if (item.dataset.action === 'delete-connection') Connections.deleteById(connId);
    });
  }

  /* ══════════════════════════════════════════
     TOAST
     ══════════════════════════════════════════ */
  function toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${escHtml(message)}</span>`;
    container.appendChild(el);
    setTimeout(() => { el.classList.add('fade-out'); setTimeout(() => el.remove(), 300); }, 3200);
  }

  /* ══════════════════════════════════════════
     HELPERS
     ══════════════════════════════════════════ */
  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ══════════════════════════════════════════
     BOOT
     ══════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', init);

  return {
    get state()  { return state; },
    set state(v) { state = v; },
    get board()  { return Board; },
    saveState,
    currentInvestigation,
    renderInvestigationsList,
    loadInvestigation,
    updateTopbarName,
    showConfirm,
    toast,
    openSidebar,
    closeSidebar
  };
})();
