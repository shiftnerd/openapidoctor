# 🩺 Schema Doctor

[![Website](https://img.shields.io/badge/Website-SchemaDoctor-blue?style=flat-square&logo=google-chrome)](https://schemadoctor.com)
[![License](https://img.shields.io/github/license/shiftnerd/openapidoctor?style=flat-square)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/shiftnerd/openapidoctor?style=flat-square&logo=github)](https://github.com/shiftnerd/openapidoctor)

**Schema Doctor** is a web-based tool to **validate, clean, and manipulate OpenAPI schemas** in JSON or YAML format.  
It provides a user-friendly interface for editing and transforming schemas — making them automation-ready for platforms like Rewst, n8n, and others.  

---

## 🚀 Features
- Load OpenAPI schemas directly from URLs (`.json` or `.yaml`)  
- Convert valid YAML schemas to JSON format  
- Validate JSON schema format  
- Beautify JSON schemas for better readability  
- Set default descriptions for empty description fields  
- Add missing `operationId` values to API operations  
- Fix paths ending with a trailing slash  
- Handle circular references in the schema  
- Run **all transformations at once**  
- Dark and light theme support  
- Detailed change log to track modifications  

---

## 🌐 Try Schema Doctor Online
👉 [Use Schema Doctor here](https://schemadoctor.com)  

---

## 📖 Usage
1. **Open the app**  
   Clone the repository and open `index.html` in your browser. No server or backend is required — everything runs client-side.

2. **Load a schema**  
   Choose one of the following methods:
   - **Fetch by URL**: Enter a link ending in `.json` or `.yaml` and click **Fetch**.  
   - **Upload file**: Drag & drop an OpenAPI file into the drop zone or browse to select one.  
   - **Paste**: Copy JSON or YAML into the text area and press **Load Paste**.

3. **Generate a reduced schema**  
   Click **Generate Reduced Schema**.  
   - The left editor shows the original schema (read-only).  
   - The right editor shows the reduced output in JSON format, ready for use.

4. **Optional filtering**  
   Expand the **Endpoint Filter** panel to include/exclude endpoints:
   - Filter by HTTP methods, path patterns (including regex), or tags.  
   - Pending changes are applied when you re-generate the reduced schema.  
   - Metrics below the filter show how many lines and actions were reduced.

5. **Copy or download results**  
   - Use **📋 Copy** to copy the reduced JSON to your clipboard.  
   - Use **⬇️ Download** to save it as `reduced.json` locally.

6. **Adjust the view**  
   - Drag or keyboard-resize the vertical splitter to change the editor layout.  
   - Toggle between dark and light themes with the 🌗 **Theme** button.

---

## 📦 Dependencies

The OpenAPI Schema Editor relies on the following libraries:

- [Monaco Editor](https://microsoft.github.io/monaco-editor/) — code editor for JSON and YAML  
- [js-yaml](https://github.com/nodeca/js-yaml) — YAML parser and dumper  
- [Ajv](https://ajv.js.org/) — JSON Schema validator (used for OpenAPI 3.0/3.1 validation)  
- [FileSaver.js](https://github.com/eligrey/FileSaver.js/) — client-side file saving utility  

---

## 🤝 Contributing
We welcome pull requests, issues, and feature requests!  
If you find any bugs or have suggestions for improvement, please open an issue or submit a PR.  

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.  

---

## 📜 License
Distributed under the MIT License. See [LICENSE](LICENSE) for details.
