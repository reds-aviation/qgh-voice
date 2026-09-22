import { access, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const suiteRoot = resolve(repositoryRoot, 'packages', 'atc-suite');
const engineRoot = resolve(repositoryRoot, 'packages', 'qgh-engine');
const suiteWebRoot = resolve(repositoryRoot, 'apps', 'suite-web');
const staticRoot = resolve(suiteWebRoot, 'static');
const sharedIconRoot = resolve(repositoryRoot, 'apps', 'web', 'static', 'icons');
const outputRoot = resolve(suiteWebRoot, 'dist');

const suiteFiles = [
  'index.html',
  'instructor.html',
  'student.html',
  'suite.css',
  'suite-core.js',
  'suite-instructor.js',
  'suite-review.js',
  'suite-sensors.js',
  'suite-session.js',
  'suite-student.js',
];
const sharedEngineFiles = [
  'simulator-core.js',
  'procedure-core.js',
  'fonts/ibm-plex-mono-500.ttf',
  'fonts/ibm-plex-sans-400.ttf',
  'fonts/ibm-plex-sans-600.ttf',
  'fonts/OFL-1.1.txt',
];
const staticFiles = [
  'manifest.webmanifest',
  'service-worker.js',
  'pwa-register.js',
  'pwa.css',
  'app-version.json',
];
const sharedIcons = [
  'icon-192.png',
  'icon-512.png',
];
const pageFiles = ['index.html', 'instructor.html', 'student.html'];

async function copyFrom(sourceRoot, relativePath, destinationPath = relativePath) {
  const destination = resolve(outputRoot, destinationPath);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(resolve(sourceRoot, relativePath), destination);
}

async function readSuiteVersion() {
  const versionFile = resolve(staticRoot, 'app-version.json');
  const { version } = JSON.parse(await readFile(versionFile, 'utf8'));
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(version)) {
    throw new Error('apps/suite-web/static/app-version.json must contain a safe semantic version string.');
  }
  return version;
}

function preparePage(source, version) {
  let html = source;
  if (!html.includes('pwa.css')) {
    html = html.replace('</head>', '  <link rel="stylesheet" href="pwa.css">\n</head>');
  }
  html = html.replace(
    /BETA PROJECT · UNDER DEVELOPMENT · USER TRIALS · [0-9]+\.[0-9]+\.[0-9]+(?:[-+][a-zA-Z0-9.-]+)?/g,
    `BETA PROJECT · UNDER DEVELOPMENT · USER TRIALS · ${version}`
  );
  return html.replace(
    /((?:src|href)=")([^"#?]+\.(?:js|css))("\s*)/g,
    `$1$2?v=${version}$3`
  );
}

async function applyBuildVersion(version) {
  const workerPath = resolve(outputRoot, 'service-worker.js');
  const worker = await readFile(workerPath, 'utf8');
  if (!worker.includes('__ATC_SUITE_VERSION__')) {
    throw new Error('The ATC Suite service worker is missing its version token.');
  }
  await writeFile(workerPath, worker.replaceAll('__ATC_SUITE_VERSION__', version), 'utf8');

  await Promise.all(pageFiles.map(async page => {
    const pagePath = resolve(outputRoot, page);
    const html = await readFile(pagePath, 'utf8');
    await writeFile(pagePath, preparePage(html, version), 'utf8');
  }));
}

async function build() {
  const version = await readSuiteVersion();
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });

  await Promise.all([
    ...suiteFiles.map(file => copyFrom(suiteRoot, file)),
    ...sharedEngineFiles.map(file => copyFrom(engineRoot, file)),
    ...staticFiles.map(file => copyFrom(staticRoot, file)),
    ...sharedIcons.map(file => copyFrom(sharedIconRoot, file, `icons/${file}`)),
  ]);
  await applyBuildVersion(version);

  const expectedOutput = [
    ...suiteFiles,
    ...sharedEngineFiles,
    ...staticFiles,
    ...sharedIcons.map(file => `icons/${file}`),
  ];
  await Promise.all(expectedOutput.map(async file => {
    try {
      await access(resolve(outputRoot, file));
    } catch {
      throw new Error(`ATC Suite build is missing required output: ${file}`);
    }
  }));

  console.log(`Built Reds ATC Training Suite v${version} at ${outputRoot}`);
}

await build();
