import { state } from "../state.js";
import { $ } from "../utils.js";

export function validateManifest(manifest) {
  if (!Array.isArray(manifest?.datasets)) throw new Error('manifest.json benötigt eine datasets-Liste.');
  const ids = new Set();
  for (const entry of manifest.datasets) {
    if (!entry || typeof entry.id !== 'string' || !entry.id.trim() || ids.has(entry.id))
      throw new Error('Datensatz-ID fehlt oder ist doppelt. Manifest-Vorlage nur einmal einfügen.');
    ids.add(entry.id);
    const urls = Array.isArray(entry.json) ? entry.json : [entry.json];
    if (!urls.length || urls.some(url => typeof url !== 'string' || !url.trim()))
      throw new Error(`JSON-Pfad fehlt für ${entry.id}. Beiliegende Manifest-Vorlage prüfen.`);
  }
  return manifest;
}

export async function loadManifest() {
  try {
    const res = await fetch("datasets/manifest.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`manifest.json HTTP ${res.status}`);
    state.manifest = validateManifest(await res.json());
    state.manifestError = null;
  } catch (e) {
    state.manifest = null;
    state.manifestError = e.message;
    console.warn("Manifest konnte nicht geladen werden:", e);
  }
}

export function populateDatasetSelect() {
  const sel = $("datasetSelect");
  sel.innerHTML = "";
  const datasets = (state.manifest && state.manifest.datasets)
    ? state.manifest.datasets.filter(d => d.enabled !== false)
    : [];
  for (const d of datasets) {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = d.label || d.id;
    sel.appendChild(opt);
  }
  const hint = $('datasetMetaHint');
  if (hint && !datasets.length) hint.textContent = state.manifestError
    ? `Datenarchiv nicht geladen: ${state.manifestError}`
    : 'Noch kein Datensatz eingetragen. Ordner nach datasets/ kopieren und manifest-entry.example.json in datasets/manifest.json übernehmen.';
}

export function getSelectedDataset() {
  const datasets = (state.manifest && state.manifest.datasets)
    ? state.manifest.datasets.filter(d => d.enabled !== false)
    : [];
  const id = $("datasetSelect").value;
  return datasets.find(d => d.id === id) || null;
}
