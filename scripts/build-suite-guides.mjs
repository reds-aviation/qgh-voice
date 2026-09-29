import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const knowledge = require('../packages/procedural-beta/static/guide-knowledge.js');
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function renderCurrentGuide(topic, prefix = '', version = knowledge.revision) {
  const entries = knowledge.entries.filter(entry => entry.topics.includes(topic));
  return `<section class="guide-section section current-flow-guide" id="current-flow" data-guide-revision="${escape(version)}">
    <h2>Current suite flow &amp; controls</h2><p>Guide update ${escape(version)} · generated with this release.</p>
    <ol>${knowledge.flow.map(step => `<li><a href="${prefix}${step.href}"><strong>${escape(step.title)}</strong></a> — ${escape(step.text)}</li>`).join('')}</ol>
    ${entries.map(entry => `<details><summary>${escape(entry.title)}</summary><p>${escape(entry.text)}</p></details>`).join('')}
    <h3>Connection &amp; screens</h3><p><strong>This device / offline:</strong> same PC AND same browser profile, separate windows. Recommended: two monitors, Windows + P → Extend; instructor on screen 1, student on screen 2. Duplicate exposes the instructor picture. One PC shares its keyboard focus and mouse pointer.</p><p><strong>Online room:</strong> different PCs/devices; internet required on both. Choose Online room on both → matching PIN → Admit → Ready → Start/Run. The offline kit cannot share one exercise across separate PCs.</p>
    <h3>Guided screen tours</h3><p>Choose Guided tour before starting or while paused. Next highlights each visible control. Close or Escape exits without changing the exercise.</p>
    <h3>Ask Gyani</h3><p>Choose the fox in the navigation or scope tool rail. Gyani answers from these guides and never changes the exercise. Collapse it with × or Escape. Help is tucked away while an exercise runs; pause to consult it.</p>
    <p>${escape(knowledge.learning)} If the guides do not resolve your question, contact the creator for clarification.</p>
  </section>`;
}

export async function buildSuiteGuides(outputRoot, sourceRoot, version) {
  if (version !== knowledge.revision) throw new Error('Guide knowledge revision must match the Procedural release');
  const procedural = await readFile(resolve(sourceRoot, 'packages/procedural-beta/static/procedural.html'), 'utf8');
  const tourSources = { procedural, single: await readFile(resolve(sourceRoot,'packages/qgh-engine/single.html'),'utf8'), tactical: await readFile(resolve(sourceRoot,'packages/qgh-engine/tactical.html'),'utf8'), instructor: await readFile(resolve(sourceRoot,'packages/atc-suite/instructor.html'),'utf8'), student: await readFile(resolve(sourceRoot,'packages/atc-suite/student.html'),'utf8') };
  for (const step of knowledge.tours || []) for (const page of step.pages) {
    if (/^#[a-zA-Z0-9-]+$/.test(step.selector) && !tourSources[page]?.includes(`id="${step.selector.slice(1)}"`)) throw new Error(`Tour references missing ${page} control: ${step.selector}`);
  }
  for (const entry of knowledge.entries) for (const id of entry.controls) {
    if (!procedural.includes(`id="${id}"`)) throw new Error(`Guide references missing control: ${id}`);
  }
  const controlled = [...procedural.matchAll(/id="(quick-[a-z-]+|resume|pause|step|bearing-type|terminate|terminate-quick)"/g)].map(match => match[1]).filter(id => !['quick-aircraft-info', 'quick-more'].includes(id));
  const documented = new Set(knowledge.entries.flatMap(entry => entry.controls));
  for (const id of controlled) if (!documented.has(id)) throw new Error(`Add guide knowledge for new quick control: ${id}`);
  const guides = [
    ['training-centre.html', 'qgh-individual', ''],
    ['user-guide.html', 'qgh-individual', ''],
    ['instructor-led/training-guide.html', 'qgh-instructor', '../'],
    ['procedural-beta/procedural-guide.html', 'procedural', '../'],
  ];
  for (const [page, topic, prefix] of guides) {
    const path = resolve(outputRoot, page);
    let html = await readFile(path, 'utf8');
    if (!html.includes('</main>')) throw new Error(`Missing guide container: ${page}`);
    html = html.replace('</main>', renderCurrentGuide(topic, prefix, version) + '</main>');
    html = html.replace('</head>', `<link rel="stylesheet" href="${prefix}procedural-beta/current-flow-guide.css"></head>`);
    html = html.replace(/(<h1\b[^>]*>[\s\S]*?<\/h1>)/, '$1<p><a href="#current-flow">Current suite flow &amp; controls ↓</a></p>');
    await writeFile(path, html);
  }
}
