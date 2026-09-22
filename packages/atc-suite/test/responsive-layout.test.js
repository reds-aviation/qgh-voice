const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const css = readFileSync(join(__dirname, '..', 'suite.css'), 'utf8');

test('suite protects iPhone safe areas and narrow layouts', () => {
  assert.match(css, /viewport-fit=cover|safe-area-inset-bottom/);
  assert.match(css, /@media\s*\(max-width:\s*680px\)/);
  assert.match(css, /overflow-x:\s*hidden/);
});

test('radar portrait gate is a replacement state rather than an overlay', () => {
  assert.match(css, /body\.narrow-radar[^}]*--active-workspace[^}]*display:\s*none/s);
  assert.match(css, /body\.narrow-radar[^}]*orientation-gate[^}]*display:\s*grid/s);
});

test('instructor console preserves a compact, scrollable aircraft selector and adjacent wide control rail', () => {
  assert.match(css, /\.console-toolbar\s*\{[^}]*position:\s*sticky/s);
  assert.match(css, /\.aircraft-tabs\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /\.aircraft-tabs\s*\{[^}]*scroll-snap-type:\s*x\s+proximity/s);
  assert.match(css, /@media\s*\(min-width:\s*1200px\)[\s\S]*?\.instructor-console\s*\{[^}]*grid-template-columns:[^}]*330px/s);
  assert.match(css, /@media\s*\(min-width:\s*1200px\)[\s\S]*?\.console-control-rail\s*\{[^}]*position:\s*sticky/s);
  assert.match(css, /@media\s*\(max-width:\s*680px\)[\s\S]*?\.console-control-rail\s*\{[^}]*grid-template-columns:\s*1fr/s);
});
