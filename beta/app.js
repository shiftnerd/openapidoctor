/* Schema Doctor: Reducer Edition — app.js
 * Static, client-side only. No backend required.
 */

// Global state
let originalEditor, reducedEditor, ajvInstance = null;
const HTTP_METHODS = new Set(['get','post','put','patch','delete','head','options','trace']);
// (near the top of app.js, after HTTP_METHODS)
const GENERIC_RESPONSES = {
    "200": "OK",
    "201": "Created",
    "202": "Accepted",
    "204": "No Content",
    "400": "Bad Request",
    "401": "Unauthorized",
    "403": "Forbidden",
    "404": "Not Found",
    "409": "Conflict",
    "429": "Too Many Requests",
    "500": "Internal Server Error",
    "503": "Service Unavailable"
  };
  
  function responseComponentNameFor(code) {
    const safe = String(code).replace(/[^0-9A-Za-z]+/g, '_');
    return `Response_${safe}`;
  }
  
  function ensureResponseRef(out, code, optionalDescription) {
    if (!out.components) out.components = {};
    if (!out.components.responses) out.components.responses = {};
    const key = responseComponentNameFor(code);
  
    const desc = (typeof optionalDescription === 'string' && optionalDescription.trim())
      ? optionalDescription.trim()
      : (GENERIC_RESPONSES[code] || 'Response');
  
    if (!out.components.responses[key]) {
      out.components.responses[key] = { description: desc };
    } else if (
      !out.components.responses[key].description ||
      typeof out.components.responses[key].description !== 'string' ||
      !out.components.responses[key].description.trim()
    ) {
      out.components.responses[key].description = desc;
    }
  }
  
  function extractPathParams(path) {
    return Array.from(String(path).matchAll(/\{([^}]+)\}/g)).map(m => m[1]);
  }
  
  function makePathParamStub(name, from) {
    const description = (from && typeof from.description === 'string' && from.description.trim())
      ? from.description.trim()
      : `Path parameter ${name}.`;
    const type = (from && from.schema && typeof from.schema.type === 'string' && from.schema.type.trim())
      ? from.schema.type.trim()
      : 'string';
    return {
      name,
      in: 'path',
      required: true,
      schema: { type },
      description
    };
  }
// Utility: set status text
function setStatus(msg, type = 'info') {
  const el = document.getElementById('status');
  el.textContent = msg || '';
  el.className = `status ${type}`;
}

// ---- Metrics helpers ----
function countLines(text) {
    if (!text) return 0;
    const m = text.match(/\r\n|\r|\n/g);
    return (m ? m.length : 0) + 1;
  }
  
  function countActionsFromSpec(spec) {
    let count = 0;
    if (spec && spec.paths && typeof spec.paths === 'object') {
      for (const item of Object.values(spec.paths || {})) {
        if (!item || typeof item !== 'object') continue;
        for (const k of Object.keys(item)) {
          if (HTTP_METHODS.has(k.toLowerCase())) count++;
        }
      }
    }
    return count;
  }
  
  /** Append line + action counts to the status line */
  function updateMetricsDisplay(reducedObj) {
    const origText = originalEditor ? originalEditor.getValue() : '';
    const redText  = reducedEditor  ? reducedEditor.getValue()  : '';
  
    const origObj = parseMaybeYamlOrJson(origText) || {};
    const linesMsg = `Lines ${countLines(origText)}→${countLines(redText)}`;
    const actionsMsg = `Actions ${countActionsFromSpec(origObj)}/${countActionsFromSpec(reducedObj)}`;
  
    const el = document.getElementById('status');
    if (el) el.textContent = (el.textContent || '').replace(/\s*$/, '') + ` • ${linesMsg} • ${actionsMsg}`;
  }

// Utility: detect & parse JSON or YAML
function parseMaybeYamlOrJson(text) {
  // Try JSON first (fast path)
  try { return JSON.parse(text); } catch {}
  // Fallback to YAML
  try { return jsyaml.load(text); } catch {}
  return null;
}

// Initialize Monaco editors
function initEditors() {
  require(['vs/editor/editor.main'], function() {
    originalEditor = monaco.editor.create(document.getElementById('originalEditor'), {
      value: `{
  "openapi": "3.0.0",
  "info": { "title": "Ticketing API", "version": "1.0.0" },
  "paths": { "/tickets": { "get": { "summary": "List tickets", "operationId": "listTickets", "responses": { "200": {} } } } }
}`,
      language: 'json',
      readOnly: true,
      automaticLayout: true,
      minimap: { enabled: false },
      theme: document.body.classList.contains('theme-dark') ? 'vs-dark' : 'vs'
    });

    reducedEditor = monaco.editor.create(document.getElementById('reducedEditor'), {
      value: '{\n  "openapi": "3.0.0",\n  "info": { "title": "", "version": "" },\n  "paths": {}\n}',
      language: 'json',
      readOnly: false,
      automaticLayout: true,
      minimap: { enabled: false },
      theme: document.body.classList.contains('theme-dark') ? 'vs-dark' : 'vs'
    });
  });
}

// Theme toggle
function setTheme(dark) {
  document.body.classList.toggle('theme-dark', dark);
  if (window.monaco && monaco.editor) {
    monaco.editor.setTheme(dark ? 'vs-dark' : 'vs');
  }
}

// Load from URL
async function fetchSchemaFromUrl() {
  const url = document.getElementById('schemaUrl').value.trim();
  if (!url) return setStatus('Please enter a schema URL.', 'warn');
  setStatus('Fetching…');
  try {
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const obj = parseMaybeYamlOrJson(text);
    if (!obj) throw new Error('Could not parse as JSON or YAML.');
    originalEditor.setValue(JSON.stringify(obj, null, 2));
    setStatus('Loaded schema from URL.');
  } catch (e) {
    console.error(e);
    setStatus(`Fetch failed: ${e.message}. If this is a CORS issue, download the file and use Upload/Paste.`, 'error');
  }
}

// Load from paste area
function loadFromPaste() {
  const text = document.getElementById('pasteArea').value.trim();
  if (!text) return setStatus('Nothing to load from paste area.', 'warn');
  const obj = parseMaybeYamlOrJson(text);
  if (!obj) return setStatus('Paste is not valid JSON or YAML.', 'error');
  originalEditor.setValue(JSON.stringify(obj, null, 2));
  setStatus('Loaded schema from paste.');
}

// Drag & drop / file input
function initDropZone() {
  const dz = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');

  const openPicker = () => fileInput.click();

  dz.addEventListener('click', openPicker);
  dz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); } });

  ['dragenter','dragover'].forEach(evt => dz.addEventListener(evt, e => {
    e.preventDefault(); e.stopPropagation(); dz.classList.add('dragging');
  }));
  ['dragleave','drop'].forEach(evt => dz.addEventListener(evt, e => {
    e.preventDefault(); e.stopPropagation(); dz.classList.remove('dragging');
  }));

  dz.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) readFile(file);
  });
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) readFile(file);
  });
}

function readFile(file) {
  setStatus(`Reading ${file.name}…`);
  const reader = new FileReader();
  reader.onload = () => {
    const text = reader.result;
    const obj = parseMaybeYamlOrJson(text);
    if (!obj) return setStatus('File is not valid JSON or YAML.', 'error');
    originalEditor.setValue(JSON.stringify(obj, null, 2));
    setStatus('Loaded schema from file.');
  };
  reader.onerror = () => setStatus('Could not read file.', 'error');
  reader.readAsText(file);
}

function pickStringTags(arr) {
    if (!Array.isArray(arr)) return [];
    const cleaned = arr
      .map(t => (typeof t === 'string' ? t.trim() : ''))
      .filter(Boolean);
    return Array.from(new Set(cleaned)); // de-dupe, stable-ish
  }

function reduceOpenAPI(spec) {
  const out = {
    openapi: typeof spec.openapi === 'string' ? spec.openapi : '3.0.0',
    info: {
      title: spec?.info?.title || 'Reduced API',
      version: spec?.info?.version || '1.0.0',
      description:
        (spec?.info && typeof spec.info.description === 'string' && spec.info.description.trim())
          ? spec.info.description.trim()
          : 'Reduced OpenAPI for automation pipelines.'
    },
    paths: {},
    components: {}
  };

  if (Array.isArray(spec.security)) {
    out.security = spec.security;
  }

  if (spec.components && typeof spec.components === 'object' && spec.components.securitySchemes) {
    out.components.securitySchemes = spec.components.securitySchemes;
  }

  // ---- Tag metadata index from source (so we can preserve descriptions) ----
  const sourceTagIndex = new Map();
  if (Array.isArray(spec.tags)) {
    for (const t of spec.tags) {
      if (t && typeof t.name === 'string' && t.name.trim()) {
        sourceTagIndex.set(t.name.trim(), {
          name: t.name.trim(),
          description: (typeof t.description === 'string' && t.description.trim()) ? t.description.trim() : undefined,
          externalDocs: (t.externalDocs && typeof t.externalDocs === 'object') ? t.externalDocs : undefined
        });
      }
    }
  }
  const usedTagNames = new Set();

  // ---- Paths & methods ----
  if (spec.paths && typeof spec.paths === 'object') {
    for (const [pathKey, pathItem] of Object.entries(spec.paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue;
      const reducedPathItem = {};
      const pathLevelParams = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];

      for (const [maybeMethod, operation] of Object.entries(pathItem)) {
        const method = maybeMethod.toLowerCase();
        if (!HTTP_METHODS.has(method)) continue;
        if (!operation || typeof operation !== 'object') continue;

        const reducedOp = {};
        if (operation.summary) reducedOp.summary = operation.summary;
        if (operation.description) reducedOp.description = operation.description;
        if (operation.operationId) reducedOp.operationId = operation.operationId;

        // Preserve tags (categories) on the action
        const opTags = pickStringTags(operation.tags);
        if (opTags.length) {
          reducedOp.tags = opTags;
          opTags.forEach(n => usedTagNames.add(n));
        }

        // Enforce required path params for any {param} placeholders in the path
        const neededParams = extractPathParams(pathKey);
        if (neededParams.length) {
          const opParams = Array.isArray(operation.parameters) ? operation.parameters : [];
          const collected = [];
          for (const name of neededParams) {
            const src =
              opParams.find(p => p && p.in === 'path' && p.name === name) ||
              pathLevelParams.find(p => p && p.in === 'path' && p.name === name);
            collected.push(makePathParamStub(name, src));
          }
          if (collected.length) reducedOp.parameters = collected;
        }

        // Responses: $ref-only, with components.responses entries that have descriptions
        const srcResponses = (operation.responses && typeof operation.responses === 'object')
          ? operation.responses
          : null;

        const codes = srcResponses ? Object.keys(srcResponses) : [];
        const finalCodes = codes.length ? codes : ['200'];

        reducedOp.responses = {};
        for (const code of finalCodes) {
          const maybeSource = srcResponses ? srcResponses[code] : null;
          const desc = (maybeSource && typeof maybeSource.description === 'string' && maybeSource.description.trim())
            ? maybeSource.description.trim()
            : undefined;

          ensureResponseRef(out, code, desc);
          reducedOp.responses[code] = { $ref: `#/components/responses/${responseComponentNameFor(code)}` };
        }

        reducedPathItem[method] = reducedOp;
      }

      if (Object.keys(reducedPathItem).length) {
        out.paths[pathKey] = reducedPathItem;
      }
    }
  }

  // ---- Emit top-level tags list for the categories actually used ----
  if (usedTagNames.size) {
    out.tags = [...usedTagNames].map(name => {
      const meta = sourceTagIndex.get(name);
      if (meta) {
        const t = { name: meta.name };
        if (meta.description) t.description = meta.description;
        if (meta.externalDocs) t.externalDocs = meta.externalDocs;
        return t;
      }
      return { name };
    });
  }

  return out;
}

// Ajv validation (optional, best‑effort). Loads OAS schema 3.0/3.1 dynamically if possible.
async function validateWithAjv(oas) {
  // Try to detect Ajv constructor from available globals
  const AjvCtor = (window.ajv7 && (window.ajv7.default || window.ajv7)) || window.Ajv;
  if (!AjvCtor) return { ok: true, errors: [] };
  try {
    if (!ajvInstance) ajvInstance = new AjvCtor({ strict: false, allErrors: true });

    const version = (oas.openapi || '').toString();
    const is31 = version.startsWith('3.1');

    // Official OAS JSON Schemas (served with CORS by spec.openapis.org)
    const schemaUrl = is31
      ? 'https://spec.openapis.org/oas/3.1/schema/2022-10-07'
      : 'https://spec.openapis.org/oas/3.0/schema/2021-09-28';

    const res = await fetch(schemaUrl, { cache: 'force-cache' });
    if (!res.ok) throw new Error('Could not load OpenAPI JSON Schema');
    const schema = await res.json();

    const validate = ajvInstance.compile(schema);
    const ok = validate(oas);
    return { ok, errors: ok ? [] : validate.errors };
  } catch (e) {
    console.warn('Validation skipped:', e.message);
    return { ok: true, errors: [] }; // non‑blocking
  }
}

// Generate reduced schema from the original editor
async function generateReduced() {
  setStatus('Reducing…');
  try {
    const text = originalEditor.getValue();
    const obj = parseMaybeYamlOrJson(text);
    if (!obj) throw new Error('Original editor content is not valid JSON/YAML.');

    const reduced = reduceOpenAPI(obj);

    // Optional validation
    const { ok, errors } = await validateWithAjv(reduced);

    reducedEditor.setValue(JSON.stringify(reduced, null, 2));
    if (ok) setStatus('Reduced schema ready.');
    else setStatus(`Reduced schema generated with validation notes (${errors.length}).`, 'warn');
  } catch (e) {
    console.error(e);
    setStatus(e.message || 'Reduction failed.', 'error');
  }
}

// Clipboard copy
async function copyReduced() {
  try {
    const text = reducedEditor.getValue();
    await navigator.clipboard.writeText(text);
    setStatus('Copied reduced JSON to clipboard.');
  } catch (e) {
    setStatus('Copy failed (clipboard may require HTTPS).', 'error');
  }
}

// Download reduced.json
function downloadReduced() {
  try {
    const text = reducedEditor.getValue();
    if (!text || !text.trim()) throw new Error('No reduced schema to download.');
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const filename = 'reduced-openapi.json';

    // Prefer FileSaver if present; otherwise use an <a download> fallback
    if (typeof window.saveAs === 'function') {
      window.saveAs(blob, filename);
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 0);
    }

    setStatus(`Downloaded ${filename}`);
  } catch (e) {
    console.error(e);
    setStatus(`Download failed: ${e.message || 'Unknown error'}`, 'error');
  }
}

// Wire up UI
function initUI() {
  document.getElementById('fetchBtn').addEventListener('click', fetchSchemaFromUrl);
  document.getElementById('loadPasteBtn').addEventListener('click', loadFromPaste);
  document.getElementById('reduceBtn').addEventListener('click', generateReduced);
  document.getElementById('copyBtn').addEventListener('click', copyReduced);
  document.getElementById('downloadBtn').addEventListener('click', downloadReduced);

  const themeBtn = document.getElementById('themeToggle');
  themeBtn.addEventListener('click', () => setTheme(!document.body.classList.contains('theme-dark')));

  initDropZone();
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  initEditors();
  initUI();
  setStatus('Ready. Load a schema to begin.');
});