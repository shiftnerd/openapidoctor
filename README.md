# 🩺 Schema Doctor

[![Website](https://img.shields.io/badge/Website-SchemaDoctor-blue?style=flat-square&logo=google-chrome)](https://schemadoctor.com)
[![License](https://img.shields.io/github/license/youruser/schema-doctor?style=flat-square)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/youruser/schema-doctor?style=flat-square&logo=github)](https://github.com/shiftnerd/openapidoctor)

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
1. Open the OpenAPI Schema Editor in a web browser.  
2. Enter a URL ending in `.json` or `.yaml` in the provided input field.  
3. Click **Load** to load the schema from the specified URL.  
   - If the URL is cross-domain and fails due to same-origin restrictions, you will be prompted to use a proxy server.  
4. Once loaded, use the available options to manipulate and transform the schema:  
   - **Convert YAML to JSON** → Converts YAML schema to JSON format  
   - **Validate JSON** → Validates the loaded JSON schema  
   - **Beautify JSON** → Formats the JSON schema for readability  
   - **Set Default Descriptions** → Fills in missing descriptions  
   - **Add Missing OperationIds** → Ensures API operations have IDs  
   - **Fix Paths Ending with Slash** → Removes trailing slashes  
   - **Handle Circular References** → Identifies and logs circular references  
   - **Run All Options** → Executes all available options in sequence  
5. The **change log section** displays a record of modifications.  
6. Switch between dark and light themes using the theme selector.  

---

## 📚 Dependencies
The OpenAPI Schema Editor relies on the following libraries:
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) — code editor for JSON and YAML  
- [Bulma](https://bulma.io/) — CSS framework for styling  
- [js-yaml](https://github.com/nodeca/js-yaml) — YAML parser and dumper  
- [Lodash](https://lodash.com/) — JavaScript utility library  

---

## 🤝 Contributing
We welcome pull requests, issues, and feature requests!  
If you find any bugs or have suggestions for improvement, please open an issue or submit a PR.  

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.  

---

## 📜 License
Distributed under the MIT License. See [LICENSE](LICENSE) for details.
