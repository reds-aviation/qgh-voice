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
// Local visual/DOM regression check. Requires Playwright via NODE_PATH or installed locally.
// Transcript injection tests routing and feedback, not microphone recognition accuracy.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.QGH_QA_URL || 'http://127.0.0.1:4213/';
const out = path.resolve('artifacts/v4.3.0');
const viewports = [[1366,768],[1920,1080],[768,1024],[320,568],[360,800],[375,667],[390,844],[412,915],[430,932],[915,412],[683,384],[360,640]];
fs.mkdirSync(out, { recursive: true });

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const report = [];
  try {
    for (const [width,height] of viewports) for (const tactical of [false,true]) for (const us of [false,true]) {
      const name = `${tactical ? 'tactical' : 'single'}-${us ? 'us' : 'normal'}-${width}x${height}`;
      const page = await browser.newPage({ viewport: {width,height}, serviceWorkers: 'block', reducedMotion: width === 360 ? 'reduce' : 'no-preference' });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(new URL(tactical ? 'tactical.html' : 'single.html', base).href);
      if (us) await page.locator(tactical ? '#tProcedureUs' : '#us').click();
      await page.locator(tactical ? '#tStart' : '#startExercise').click();
      if (us) {
        const stop = page.locator(tactical ? '#tUsStop' : '#turnStop');
        if (await stop.isEnabled()) await stop.click();
      }
      const phrase = `${tactical ? 'falcon ' : ''}${us ? 'turn right now' : 'turn right two seven zero'}`;
      const result = await page.evaluate(text => QGHVoiceWorkspace.dispatchTranscript(text), phrase);
      assert.equal(result.ok, true, `${name}: voice routing`);
      const ack = page.locator(tactical ? '#tVoiceCommandAck' : '#voiceCommandAck');
      assert.match(await ack.textContent(), /^HEARD ·/);
      await page.waitForTimeout(280);
      assert.match(await ack.textContent(), /^(APPLIED|PILOT) ·/);
      const geometry = await page.evaluate(() => {
        const dock = document.querySelector('.voice-dock').getBoundingClientRect();
        const app = document.querySelector('.app, .tactical-app');
        const active = document.querySelector('.screen.active, .tactical-screen.active');
        return { overflow: document.documentElement.scrollWidth > innerWidth + 1 || app.scrollWidth > app.clientWidth + 1,
          dockInside: dock.left >= 0 && dock.right <= innerWidth + 1 && dock.top >= 0 && dock.bottom <= innerHeight + 1,
          separatePhoneDock: innerWidth > 600 || innerWidth > innerHeight ||
            parseFloat(getComputedStyle(app).paddingBottom) >= dock.height + 8,
          active: active.id };
      });
      assert.equal(geometry.overflow, false, `${name}: no horizontal overflow`);
      assert.equal(geometry.dockInside, true, `${name}: dock inside viewport`);
      assert.equal(geometry.separatePhoneDock, true, `${name}: reserved phone dock ${JSON.stringify(geometry)}`);
      if ((width === 360 || width === 1366) && !us) await page.screenshot({path:path.join(out,`${name}-exercise.png`)});
      // Manual operation must continue after a routed voice call, with no microphone/model requirement.
      await page.locator(tactical ? '#tAdvance' : '#advanceFlight').click();
      await page.locator(tactical ? '#tTerminate' : '#terminate').click();
      await page.locator(tactical ? '#tConfirmTerminate' : '#confirmTerminate').click();
      const speed = page.locator(tactical ? '[data-tactical-replay-speed="10"]' : '[data-replay-speed="10"]');
      await speed.click();
      assert.equal(await speed.getAttribute('aria-pressed'), 'true');
      const zoom = page.locator(tactical ? '#tZoomToggle' : '#zoomToggle');
      await zoom.click();
      assert.equal(await zoom.textContent(), 'ZOOM ON');
      const chart = page.locator(tactical ? '#tTacticalPlot' : '#plot');
      await chart.focus();
      await page.keyboard.press('+');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('0');
      await page.locator(tactical ? '#tFitReview' : '#fitReview').click();
      await page.locator(tactical ? '#tReplay' : '#replay').click();
      assert.equal(await page.locator(tactical ? '#tReplay' : '#replay').getAttribute('aria-pressed'), 'true');
      const reviewOverflow = await page.evaluate(() => {
        const app = document.querySelector('.app, .tactical-app');
        return document.documentElement.scrollWidth > innerWidth + 1 || app.scrollWidth > app.clientWidth + 1;
      });
      assert.equal(reviewOverflow, false, `${name}: review overflow`);
      if ((width === 360 || width === 1366) && !us) await page.screenshot({path:path.join(out,`${name}-review.png`)});
      await page.locator('.voice-settings-toggle').click();
      assert.equal(await page.locator('.voice-last-call').isVisible(), true);
      await page.locator('.voice-reset-position').click();
      await page.setViewportSize({ width:height, height:width });
      const rotated = await page.locator('.voice-dock').boundingBox();
      assert.ok(rotated.x >= 0 && rotated.y >= 0 && rotated.x + rotated.width <= height + 1 && rotated.y + rotated.height <= width + 1, `${name}: rotation recovery`);
      assert.deepEqual(errors, [], `${name}: runtime errors`);
      report.push({name, result:'pass', ...geometry});
      await page.close();
    }
    const offline = await browser.newContext();
    const page = await offline.newPage();
    const modelRequests = [];
    page.on('request', request => { if (/\.(zip|tar|gz)(\?|$)/.test(request.url())) modelRequests.push(request.url()); });
    await page.goto(base);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await offline.setOffline(true);
    await page.goto(new URL('single.html', base).href);
    await page.locator('#startExercise').click();
    await page.locator('#transmit').click();
    assert.notEqual(await page.locator('#bearing').textContent(), '---', 'manual D/F operates offline');
    assert.deepEqual(modelRequests, [], 'no unsolicited voice model download');
    await offline.close();
    fs.writeFileSync(path.join(out, 'browser-results.json'), JSON.stringify({flows:report, offlineReopen:'pass', unsolicitedModelRequests:0},null,2));
    console.log(`${report.length} exercise/review browser flows passed. Microphone and physical-device testing are separate.`);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
