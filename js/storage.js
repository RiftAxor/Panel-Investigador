/* =============================================
   storage.js — Persistencia en localStorage
   ============================================= */
'use strict';

const Storage = (() => {
  const KEY = 'panel_investigacion_v1';

  /** Returns the full app state from localStorage */
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.error('[Storage] Error loading state:', e);
      return null;
    }
  }

  /** Saves the full app state to localStorage */
  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.error('[Storage] Error saving state:', e);
    }
  }

  /** Returns the default empty app state */
  function defaultState() {
    return {
      theme: 'dark',
      currentInvestigationId: null,
      investigations: {},
      settings: defaultSettings()
    };
  }

  /** Returns default settings object */
  function defaultSettings() {
    return {
      // Appearance
      defaultGrid:      false,
      defaultSnap:      false,
      fontSize:         1,
      cardRadius:       'normal',
      // Board
      gridSize:         40,
      connectionWidth:  2.5,
      // Animations
      cardAnimations:   true,
      reduceMotion:     false,
      // Accessibility
      highContrast:     false,
      focusRing:        true,
      toolLabels:       false
    };
  }

  /** Creates a blank investigation object */
  function newInvestigation(name, description = '', isPrivate = false) {
    return {
      id: generateId(),
      name: name.trim(),
      description: description.trim(),
      isPrivate,
      created: Date.now(),
      modified: Date.now(),
      viewX: 0,
      viewY: 0,
      viewScale: 1,
      cards: [],
      connections: []
    };
  }

  /** Creates a blank card */
  function newCard(type, x, y) {
    const defaults = {
      note:     { width: 220, height: 160, color: '#fef9c3', title: 'Nueva nota', content: '' },
      person:   { width: 240, height: 180, name: 'Sin nombre', role: 'unknown', description: '', photoUrl: '' },
      image:    { width: 240, height: 200, title: 'Imagen', url: '', dataUrl: '', description: '' },
      event:    { width: 240, height: 180, title: 'Nuevo evento', date: '', time: '', location: '', description: '', importance: 'medium' },
      link:     { width: 240, height: 160, title: 'Link', url: '', description: '' },
      timeline: { width: 280, height: 200, title: 'Línea de tiempo', events: [] }
    };
    const data = defaults[type] || {};
    return {
      id: generateId(),
      type,
      x: Math.round(x),
      y: Math.round(y),
      width: data.width || 240,
      height: data.height || 160,
      data: { ...data }
    };
  }

  /** Creates a connection between two cards */
  function newConnection(fromCardId, fromSide, toCardId, toSide) {
    return {
      id: generateId(),
      fromCard: fromCardId,
      fromSide,
      toCard: toCardId,
      toSide,
      label: '',
      color: 'red',
      style: 'solid'
    };
  }

  function generateId() {
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  /** Wipes all data from localStorage */
  function clearAll() {
    try { localStorage.removeItem(KEY); } catch (e) { console.error('[Storage] clearAll error:', e); }
  }

  return { load, save, defaultState, defaultSettings, newInvestigation, newCard, newConnection, generateId, clearAll };
})();
