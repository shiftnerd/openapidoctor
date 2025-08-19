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

  // ---- Keep payload schemas safely ----
function safeKeyFrom(path, method, operationId) {
    const base = operationId && String(operationId).trim()
      ? operationId.trim()
      : `${method}_${String(path).replace(/[^0-9A-Za-z]+/g, '_')}`;
    return base.slice(0, 120);
  }
  
  function resolveComponentRef(spec, ref) {
    if (typeof ref !== 'string' || !ref.startsWith('#/components/')) return null;
    const parts = ref.replace(/^#\//, '').split('/');
    let cur = spec;
    for (const p of parts) {
      if (!cur || typeof cur !== 'object') return null;
      cur = cur[p];
    }
    return cur || null;
  }
  
  // Collect #/components/schemas/* refs from a JSON Schema
  function collectSchemaRefs(schema, outSet = new Set(), seen = new Set()) {
    if (!schema || typeof schema !== 'object') return outSet;
    if (seen.has(schema)) return outSet;
    seen.add(schema);
  
    if (typeof schema.$ref === 'string') {
      const m = schema.$ref.match(/^#\/components\/schemas\/([^\/]+)$/);
      if (m) outSet.add(m[1]);
    }
  
    const recurseKeys = [
      'allOf','oneOf','anyOf','not','if','then','else','items','additionalItems',
      'properties','patternProperties','additionalProperties','unevaluatedProperties',
      'prefixItems','contains','propertyNames','dependentSchemas'
    ];
    for (const k of recurseKeys) {
      const v = schema[k];
      if (!v) continue;
      if (Array.isArray(v)) v.forEach(x => collectSchemaRefs(x, outSet, seen));
      else if (typeof v === 'object') {
        if (k === 'properties' || k === 'patternProperties') {
          for (const sub of Object.values(v)) collectSchemaRefs(sub, outSet, seen);
        } else {
          collectSchemaRefs(v, outSet, seen);
        }
      }
    }
    return outSet;
  }
  
  // Expand transitive schema deps and copy them over
  function copyNeededSchemas(spec, out, neededSchemas) {
    if (!spec?.components?.schemas || !neededSchemas?.size) return;
    const src = spec.components.schemas;
    const have = new Set();
    let changed = true;
    while (changed) {
      changed = false;
      for (const name of Array.from(neededSchemas)) {
        if (have.has(name)) continue;
        const s = src[name];
        if (!s) continue;
        if (!out.components.schemas) out.components.schemas = {};
        out.components.schemas[name] = s; // shallow copy is ok
        have.add(name);
        // pull nested schema refs
        const nested = collectSchemaRefs(s);
        for (const n of nested) {
          if (!neededSchemas.has(n)) {
            neededSchemas.add(n);
            changed = true;
          }
        }
      }
    }
  }
  
  // Keep only JSON content; collect schema refs
  function pickJsonContent(content, neededSchemas) {
    if (!content || typeof content !== 'object') return undefined;
    const json = content['application/json'];
    if (!json || typeof json !== 'object') return undefined;
  
    const out = {};
    const dest = {};
    if (json.schema && typeof json.schema === 'object') {
      dest.schema = json.schema; // keep as-is; refs copied later
      collectSchemaRefs(dest.schema, neededSchemas);
    }
    // (optional) pass through example(s) if present
    if ('example' in json) dest.example = json.example;
    if ('examples' in json) dest.examples = json.examples;
  
    out['application/json'] = dest;
    return out;
  }
  
  // Merge original op params (path/query/header) + required path stubs
  function mergeParamsWithPathStubs(operation, pathLevelParams, pathKey) {
    const out = [];
    const byKey = new Map(); // `${in}:${name}` -> index
  
    const allow = new Set(['path','query','header']);
    const srcParams = Array.isArray(operation.parameters) ? operation.parameters : [];
    for (const p of srcParams) {
      if (!p || typeof p !== 'object') continue;
      if (p.$ref) {
        // Keep component refs as-is
        out.push({ $ref: p.$ref });
        byKey.set(`$ref:${p.$ref}`, out.length - 1);
        continue;
      }
      if (!allow.has(p.in)) continue;
      const copy = JSON.parse(JSON.stringify(p));
      if (copy.in === 'path') {
        copy.required = true;
        if (!copy.description || !String(copy.description).trim()) {
          copy.description = `Path parameter ${copy.name}.`;
        }
        if (!copy.schema || typeof copy.schema !== 'object') {
          copy.schema = { type: 'string' };
        } else if (!copy.schema.type) {
          copy.schema.type = 'string';
        }
      }
      out.push(copy);
      byKey.set(`${copy.in}:${copy.name}`, out.length - 1);
    }
  
    // ensure all {params} in the path exist
    const needed = extractPathParams(pathKey);
    const pathParams = Array.isArray(pathLevelParams) ? pathLevelParams : [];
    for (const name of needed) {
      const k1 = `path:${name}`;
      if (byKey.has(k1)) {
        // ensure required + description on existing
        const idx = byKey.get(k1);
        const existing = out[idx];
        if (existing && !existing.required) existing.required = true;
        if (existing && (!existing.description || !String(existing.description).trim())) {
          existing.description = `Path parameter ${name}.`;
        }
        if (existing && (!existing.schema || !existing.schema.type)) {
          existing.schema = existing.schema || {};
          existing.schema.type = 'string';
        }
        continue;
      }
      const src =
        srcParams.find(p => p && p.in === 'path' && p.name === name) ||
        pathParams.find(p => p && p.in === 'path' && p.name === name);
      out.push(makePathParamStub(name, src));
    }
  
    return out.length ? out : undefined;
  }
  
function ensureResponseRef(out, code, optionalDescription, sourceResponse, keySuffix, neededSchemas) {
    if (!out.components) out.components = {};
    if (!out.components.responses) out.components.responses = {};
  
    const hasPayload = !!(sourceResponse &&
      (sourceResponse.content || sourceResponse.headers));
  
    // Use generic key when no payload; otherwise make it per-operation to avoid collisions
    const baseKey = responseComponentNameFor(code);
    const key = hasPayload && keySuffix ? `${baseKey}__${String(keySuffix).replace(/[^0-9A-Za-z_]+/g, '_')}` : baseKey;
  
    const desc = (typeof optionalDescription === 'string' && optionalDescription.trim())
      ? optionalDescription.trim()
      : (GENERIC_RESPONSES[code] || 'Response');
  
    if (!out.components.responses[key]) out.components.responses[key] = {};
    const comp = out.components.responses[key];
  
    if (!comp.description || !String(comp.description).trim()) {
      comp.description = desc;
    }
  
    // Carry JSON content schema (and response headers) if present
    if (sourceResponse) {
      if (sourceResponse.content) {
        const json = pickJsonContent(sourceResponse.content, neededSchemas);
        if (json) comp.content = json;
      }
      if (sourceResponse.headers && typeof sourceResponse.headers === 'object') {
        comp.headers = sourceResponse.headers;
        // Collect potential schema refs from header schemas
        for (const h of Object.values(comp.headers)) {
          if (h && h.schema) collectSchemaRefs(h.schema, neededSchemas);
        }
      }
    }
  
    return key;
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

// Ensure info.title and info.description exist and are not identical.
// Prompts only if missing/equal; remembers last answers in localStorage.
function ensureInfoTitleAndDescription(existingTitle, existingDescription) {
    const fallbackTitle = 'Reduced API';
    const fallbackDesc  = 'Reduced OpenAPI for automation pipelines.';
    const sanitize = (s) => (typeof s === 'string' ? s.trim() : '');
    const norm = (s) => sanitize(s).replace(/\s+/g, ' ').toLowerCase();
  
    let title = sanitize(existingTitle);
    let desc  = sanitize(existingDescription);
  
    try {
      if (!title) {
        const last = localStorage.getItem('schemaDoctor.lastTitle') || fallbackTitle;
        title = window.prompt('API Title (cannot equal Description):', last) || last;
        title = sanitize(title) || fallbackTitle;
        localStorage.setItem('schemaDoctor.lastTitle', title);
      }
      if (!desc) {
        const lastD = localStorage.getItem('schemaDoctor.lastDescription') || fallbackDesc;
        desc = window.prompt('API Description (cannot equal Title):', lastD) || lastD;
        desc = sanitize(desc) || fallbackDesc;
        localStorage.setItem('schemaDoctor.lastDescription', desc);
      }
    } catch (_) {
      // In case prompts are blocked (e.g., popup settings), fall back silently.
      if (!title) title = fallbackTitle;
      if (!desc)  desc  = fallbackDesc;
    }
  
    // Enforce distinct values (case/whitespace-insensitive)
    if (norm(title) === norm(desc)) {
      try {
        const attempt = window.prompt('Title and Description must be different. Enter a new Description:', desc);
        const cleaned = sanitize(attempt);
        if (cleaned && norm(title) !== norm(cleaned)) {
          desc = cleaned;
          localStorage.setItem('schemaDoctor.lastDescription', desc);
        } else {
          // Final fallback to make them distinct without re-prompting again
          desc = desc + ' (description)';
        }
      } catch (_) {
        desc = desc + ' (description)';
      }
    }
  
    return { title, description: desc };
  }
function pickStringTags(arr) {
    if (!Array.isArray(arr)) return [];
    const cleaned = arr
      .map(t => (typeof t === 'string' ? t.trim() : ''))
      .filter(Boolean);
    return Array.from(new Set(cleaned)); // de-dupe, stable-ish
  }

  function reduceOpenAPI(spec) {
    const ensured = ensureInfoTitleAndDescription(spec?.info?.title, spec?.info?.description);

    const out = {
      openapi: typeof spec.openapi === 'string' ? spec.openapi : '3.0.0',
      info: {
        title: ensured.title,
        version: spec?.info?.version || '1.0.0',
        description: ensured.description
      },
      paths: {},
      components: {}
    };
  
    // ---- servers (OAS) or construct from Swagger 2.0 ----
    if (Array.isArray(spec.servers) && spec.servers.length) {
      out.servers = spec.servers;
    } else if (spec.swagger === '2.0' && (spec.host || spec.basePath)) {
      const scheme = Array.isArray(spec.schemes) && spec.schemes.length ? spec.schemes[0] : 'https';
      const host = spec.host || '';
      const basePath = spec.basePath || '';
      out.servers = [{ url: `${scheme}://${host}${basePath}` }];
    }
  
    // Root security (optional)
    if (Array.isArray(spec.security)) out.security = spec.security;
  
    // securitySchemes passthrough
    if (spec.components && typeof spec.components === 'object' && spec.components.securitySchemes) {
      out.components.securitySchemes = spec.components.securitySchemes;
    }
  
    // ---- Tag metadata index (preserve tag descriptions when used) ----
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
  
    // ---- Track components we must carry over ----
    const neededSchemas = new Set();
    const neededParameters = new Set();
    const neededRequestBodies = new Set();
  
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
  
          // tags
          const opTags = pickStringTags(operation.tags);
          if (opTags.length) {
            reducedOp.tags = opTags;
            opTags.forEach(n => usedTagNames.add(n));
          }
  
          // parameters: retain path/query/header; ensure path requirements; add missing path stubs
          const mergedParams = mergeParamsWithPathStubs(operation, pathLevelParams, pathKey);
          if (mergedParams) {
            reducedOp.parameters = mergedParams;
            // collect component param refs
            for (const p of mergedParams) {
              if (p && p.$ref) {
                const m = p.$ref.match(/^#\/components\/parameters\/([^\/]+)$/);
                if (m) neededParameters.add(m[1]);
              } else if (p && p.schema) {
                collectSchemaRefs(p.schema, neededSchemas);
              }
            }
          }
  
          // requestBody: keep only application/json (inline or $ref)
          if (operation.requestBody) {
            if (operation.requestBody.$ref) {
              reducedOp.requestBody = { $ref: operation.requestBody.$ref };
              const m = operation.requestBody.$ref.match(/^#\/components\/requestBodies\/([^\/]+)$/);
              if (m) neededRequestBodies.add(m[1]);
            } else if (operation.requestBody.content) {
              const rb = { };
              if (typeof operation.requestBody.description === 'string' && operation.requestBody.description.trim()) {
                rb.description = operation.requestBody.description.trim();
              }
              if (typeof operation.requestBody.required === 'boolean') {
                rb.required = operation.requestBody.required;
              }
              const json = pickJsonContent(operation.requestBody.content, neededSchemas);
              if (json) {
                rb.content = json;
                reducedOp.requestBody = rb;
              }
            }
          }
  
          // Responses: $ref to components; carry JSON schema + headers when present
          const srcResponses = (operation.responses && typeof operation.responses === 'object') ? operation.responses : null;
          const codes = srcResponses ? Object.keys(srcResponses) : [];
          const finalCodes = codes.length ? codes : ['200'];
          reducedOp.responses = {};
  
          for (const code of finalCodes) {
            let src = srcResponses ? srcResponses[code] : null;
            if (src && src.$ref) {
              const resolved = resolveComponentRef(spec, src.$ref);
              if (resolved) src = resolved;
            }
            const desc = (src && typeof src.description === 'string' && src.description.trim())
              ? src.description.trim()
              : undefined;
  
            const opKey = safeKeyFrom(pathKey, method, operation.operationId);
            const compKey = ensureResponseRef(out, code, desc, src, opKey, neededSchemas);
            reducedOp.responses[code] = { $ref: `#/components/responses/${compKey}` };
          }
  
          reducedPathItem[method] = reducedOp;
        }
  
        if (Object.keys(reducedPathItem).length) {
          out.paths[pathKey] = reducedPathItem;
        }
      }
    }
  
    // ---- top-level tags actually used ----
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
  
    // ---- bring over needed components: parameters, requestBodies, schemas (closure) ----
    if (neededParameters.size && spec?.components?.parameters) {
      for (const name of neededParameters) {
        const p = spec.components.parameters[name];
        if (p) {
          if (!out.components.parameters) out.components.parameters = {};
          out.components.parameters[name] = p;
          // collect schema refs from component parameter
          if (p.schema) collectSchemaRefs(p.schema, neededSchemas);
        }
      }
    }
  
    if (neededRequestBodies.size && spec?.components?.requestBodies) {
      for (const name of neededRequestBodies) {
        const rb = spec.components.requestBodies[name];
        if (rb) {
          if (!out.components.requestBodies) out.components.requestBodies = {};
          const kept = {};
          if (typeof rb.description === 'string' && rb.description.trim()) kept.description = rb.description.trim();
          if (typeof rb.required === 'boolean') kept.required = rb.required;
          const json = pickJsonContent(rb.content, neededSchemas);
          if (json) kept.content = json;
          out.components.requestBodies[name] = kept;
        }
      }
    }
  
    copyNeededSchemas(spec, out, neededSchemas);
  
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
