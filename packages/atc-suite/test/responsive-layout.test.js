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
  assert.match(css, /@media\s*\(max-width:\s*680px\)[\s\S]*?\.session-card-actions\s*\{[^}]*grid-template-columns:\s*1fr/s);
});

// These are the selectors matching each live mobile node. Check the cascade,
// since an unqualified mobile rule previously lost to the desktop class rule.
function winningDeclaration(property, matchingSelectors) {
  let winner = null;
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g);
  for (const [, selectors, declarations] of rules) {
    const value = declarations.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`))?.[1]?.trim();
    if (!value) continue;
    for (const selector of selectors.split(',').map(item => item.trim())) {
      const specificity = matchingSelectors[selector];
      if (specificity != null && (!winner || specificity >= winner.specificity)) winner = {specificity, value};
    }
  }
  return winner?.value;
}

test('mobile titles keep a complete row and radar controls keep compact spacing despite more specific desktop rules', () => {
  for (const [head, page] of [['workspace-head', 'instructor-page'], ['student-head', 'student-page']]) {
    const selectors = {[`.${head} > div:first-child`]: 21, [`.${page} .${head} > div:first-child`]: 31};
    assert.equal(winningDeclaration('flex', selectors), '1 1 100%', `${page} title must not shrink beside the clock and buttons`);
    assert.equal(winningDeclaration('width', selectors), '100%');
  }
  assert.equal(winningDeclaration('gap', {
    '.radar-scope > header > .instrument-controls': 21,
    '.student-page .instrument-controls': 20,
    '.student-page .radar-scope > header > .instrument-controls': 31,
  }), '5px');
  const page = readFileSync(join(__dirname, '..', 'student.html'), 'utf8');
  const orientation = page.match(/<section class="orientation-gate"[\s\S]*?<\/section>/)[0];
  assert.match(orientation, /surveillance\/vectoring and SRA/);
  assert.doesNotMatch(orientation, /PAR/);
});
