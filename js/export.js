/* =============================================
   export.js — Exportar / Importar investigaciones
   ============================================= */
'use strict';

const ExportManager = (() => {
  /** Exports an investigation as a JSON file download */
  function exportInvestigation(investigation) {
    if (!investigation) {
      App.toast('No hay investigación activa para exportar.', 'error');
      return;
    }
    const payload = {
      _format: 'panel-investigacion-v1',
      exportedAt: new Date().toISOString(),
      investigation: JSON.parse(JSON.stringify(investigation))
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (investigation.name || 'investigacion').replace(/[^a-z0-9_\-]/gi, '_').toLowerCase();
    a.href = url;
    a.download = `panel_${safeName}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    App.toast(`Investigación "${investigation.name}" exportada.`, 'success');
  }

  /** Opens a file picker to import a JSON investigation */
  function triggerImport() {
    const input = document.getElementById('import-file-input');
    input.value = '';
    input.click();
  }

  /** Processes the selected JSON file */
  function handleImportFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data._format || !data.investigation) {
          App.toast('Archivo no válido. Asegúrate de importar un archivo de Panel.', 'error');
          return;
        }
        const inv = data.investigation;
        // Give it a new ID to avoid conflicts
        inv.id = Storage.generateId();
        inv.name = inv.name + ' (importada)';
        inv.imported = true;
        inv.importedAt = Date.now();

        App.state.investigations[inv.id] = inv;
        App.state.currentInvestigationId = inv.id;
        App.saveState();
        App.renderInvestigationsList();
        App.loadInvestigation(inv.id);
        App.toast(`Investigación "${inv.name}" importada con éxito.`, 'success');
      } catch (err) {
        App.toast('Error al leer el archivo JSON.', 'error');
        console.error('[Import]', err);
      }
    };
    reader.readAsText(file);
  }

  return { exportInvestigation, triggerImport, handleImportFile };
})();
