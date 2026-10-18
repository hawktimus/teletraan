// The real Sanity validation of a document, run against the schemas of studio/schemas on a scratch copy of the studio folder
// that borrows the installed packages. Gives back null when the packages are not installed, and the test then skips its
// checks. The copy is removed by close().
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function openValidation(root) {
  const modules = [path.join(root, 'studio', 'node_modules'), path.join(root, '..', 'teletraan', 'studio', 'node_modules')].find(folder => fs.existsSync(path.join(folder, '@sanity', 'validation')));
  if (!modules) return null;

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-validate-'));
  const studio = path.join(scratch, 'studio');
  fs.cpSync(path.join(root, 'studio'), studio, { recursive: true, filter: source => !source.includes('node_modules') });
  fs.symlinkSync(modules, path.join(studio, 'node_modules'));
  const need = createRequire(path.join(studio, 'x.js'));
  const { Schema } = await import(pathToFileURL(need.resolve('@sanity/schema')).href);
  const { validateDocument } = await import(pathToFileURL(need.resolve('@sanity/validation')).href);
  const schemas = await import(pathToFileURL(path.join(studio, 'schemas', 'index.js')).href);
  const schema = Schema.compile({ name: 'teletraan', types: schemas.schemaTypes || schemas.default });

  return {
    // The errors of one document as 'path: message', only for paths that start with one of the names in only (all when empty)
    async problems(document, only) {
      const result = await validateDocument({ document: document, schema: schema, client: {}, getDocumentExists: async () => true });
      return result.markers
        .filter(marker => marker.level === 'error' && (!only || only.includes(marker.path[0])))
        .map(marker => marker.path.map(part => (typeof part === 'object' ? part._key : part)).join('.') + ': ' + marker.message);
    },
    close() {
      fs.rmSync(scratch, { recursive: true, force: true });
    },
  };
}
