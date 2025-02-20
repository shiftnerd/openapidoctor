# API Schema Doctor

The OpenAPI Schema Editor is a web-based tool for editing and manipulating OpenAPI schemas in JSON or YAML format. It provides a user-friendly interface for loading, editing, and applying various transformations to OpenAPI schemas.

## Features

- Loading OpenAPI schemas directly from their URLs (from URLs ending in `.json` or `.yaml`)
- Converting valid YAML schemas to JSON format
- Validate JSON schema format.
- Beautifying JSON schemas for better readability
- Setting default descriptions for empty description fields
- Adding missing `operationId` values to API operations
- Fixing paths ending with a trailing slash
- Handling circular references in the schema
- Dark and light theme support
- Detailed change log to track modifications

## Usage

1. Open the OpenAPI Schema Editor in a web browser.
2. Enter a URL ending in `.json` or `.yaml` in the provided input field.
3. Click the "Load" button to load the schema from the specified URL.
   - If the URL points to a different domain and the loading fails due to the same-origin policy restriction, you will be prompted to use a proxy server.
4. Once the schema is loaded, you can use the available options to manipulate and transform the schema:
   - **Convert YAML to JSON**: Converts a YAML schema to JSON format.
   - **Validate JSON**: Validates the loaded JSON schema.
   - **Beautify JSON**: Formats the JSON schema for better readability.
   - **Set Default Descriptions**: Sets default descriptions for empty description fields.
   - **Add Missing OperationIds**: Adds missing `operationId` values to API operations.
   - **Fix Paths Ending with Slash**: Removes trailing slashes from API paths.
   - **Handle Circular References**: Identifies and logs circular references in the schema.
   - **Run All Options**: Executes all available options in sequence.
5. The change log section displays a log of the modifications made to the schema.
6. You can switch between the dark and light themes using the theme selector.

## Dependencies

The OpenAPI Schema Editor relies on the following libraries:

- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - Code editor for JSON and YAML
- [Bulma](https://bulma.io/) - CSS framework for styling
- [js-yaml](https://github.com/nodeca/js-yaml) - JavaScript YAML parser and dumper
- [Lodash](https://lodash.com/) - JavaScript utility library

## Contributing

Contributions to the OpenAPI Schema Editor project are welcome! If you find any issues or have suggestions for improvement, please open an issue or submit a pull request.

## License

This project is licensed under the [MIT License](LICENSE).
