// Local development entrypoint for OpenCode v2.
//
// Point the global config at this directory to load the built plugin:
//
//   { "plugins": ["/absolute/path/to/opencode-conductor-v2/.opencode/plugins/conductor"] }
//
// Run `npm run build` first; this file only re-exports the compiled entrypoint.
export { default } from "../../../dist/index.js";
