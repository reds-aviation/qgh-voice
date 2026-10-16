/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

'use strict';

// Reproducible high-density captures for the narrated Training Centre guides.
// Capture real release pages at device scale so small simulator labels remain
// readable after editorial framing and video encoding.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const base = process.env.QGH_CAPTURE_URL || 'http://127.0.0.1:4272/';
const output = path.resolve(process.env.QGH_CAPTURE_OUTPUT || 'docs/qa/v5-media-captures/fresh');
fs.mkdirSync(output, { recursive: true });

async function ready(page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts?.ready || Promise.resolve());
  await page.waitForTimeout(120);
}

async function openPage(context, route) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(new URL(route, base).href);
  await ready(page);
  page._qghErrors = errors;
  return page;
}

async function snap(page, name, selector) {
  const target = path.join(output, `${name}.png`);
  if (selector) {
    const locator = page.locator(selector);
    await locator.waitFor({ state: 'visible' });
    await locator.screenshot({ path: target, animations: 'disabled', scale: 'device' });
  } else {
    await page.screenshot({ path: target, animations: 'disabled', scale: 'device' });
  }
  if (page._qghErrors.length) throw new Error(`${name}: ${page._qghErrors.join('; ')}`);
  console.log(`Captured ${name}`);
}

async function terminateSingle(page) {
  await page.locator('#terminate').click();
  await page.locator('#confirmTerminate').click();
  await page.locator('#analysis.active').waitFor({ state: 'visible' });
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const desktop = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      serviceWorkers: 'block',
      reducedMotion: 'reduce'
    });
    await desktop.addInitScript(() => {
      localStorage.setItem('qgh-guided-familiarisation-v1', 'seen');
      localStorage.removeItem('qgh-guided-familiarisation-pending');
    });

    let page = await openPage(desktop, 'index.html');
    await snap(page, 'entry', '.entry-stage');
    await page.close();

    page = await openPage(desktop, 'single.html');
    await snap(page, 'setup', '#setup');
    await page.locator('#setupPilotReadbacks').click();
    await snap(page, 'voice', '.headphone-dialog');
    await page.close();

    page = await openPage(desktop, 'single.html');
    await page.locator('#callsign').fill('430');
    await page.locator('#startExercise').click();
    await page.locator('#turnHeadingRight').click();
    await page.locator('#transmit').click();
    await page.waitForTimeout(180);
    await snap(page, 'normal', '#console');
    await page.close();

    page = await openPage(desktop, 'single.html');
    await page.locator('#us').click();
    await page.locator('#startExercise').click();
    await page.locator('.voice-settings-toggle').click();
    await snap(page, 'voice-settings');
    await page.locator('.voice-settings-toggle').click();
    await page.locator('#turnRight').click();
    await page.locator('#transmit').click();
    await page.waitForTimeout(180);
    await snap(page, 'us', '#console');
    await page.close();

    page = await openPage(desktop, 'single.html');
    await page.locator('#startExercise').click();
    await page.locator('#headingInput').fill('230');
    await page.locator('#turnHeadingRight').click();
    await page.locator('#advanceFlight').click();
    await page.locator('#headingInput').fill('065');
    await page.locator('#turnHeadingLeft').click();
    await page.locator('#advanceFlight').click();
    await terminateSingle(page);
    await snap(page, 'review', '.review-main');
    await snap(page, 'review-log', '.log-panel');
    await page.close();

    page = await openPage(desktop, 'tactical.html');
    await page.locator('#tFleet4').click();
    await page.locator('#tFormationOn').click();
    await page.locator('#tStart').click();
    await page.locator('#tTransmit').click();
    await page.waitForTimeout(180);
    await snap(page, 'tactical', '#tConsole');
    await page.close();

    page = await openPage(desktop, 'training-centre.html');
    await page.locator('#quick-start').scrollIntoViewIfNeeded();
    await snap(page, 'training');
    await page.locator('#calls').scrollIntoViewIfNeeded();
    await page.locator('#callSearch').fill('heading');
    await page.waitForTimeout(100);
    await snap(page, 'catalogue');
    await page.close();
    await desktop.close();

    const phone = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      serviceWorkers: 'block',
      reducedMotion: 'reduce'
    });
    await phone.addInitScript(() => localStorage.setItem('qgh-guided-familiarisation-v1', 'seen'));
    page = await openPage(phone, 'single.html');
    await page.locator('#startExercise').click();
    await snap(page, 'phone');
    await page.close();
    await phone.close();
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
