// unbzip2-stream ships no type declarations and has no @types package on
// DefinitelyTyped. Minimal ambient shape covering the single default export
// this codebase uses: a factory that returns a through/transform stream
// decompressing bzip2 data written to it.
declare module "unbzip2-stream" {
  import type { Transform } from "node:stream";

  function unbzip2Stream(): Transform;
  export default unbzip2Stream;
}
