# ATC Training Suite — completely offline PC setup

**Release __SUITE_RELEASE__ · Prepared 29 September 2026.** This handbook is for someone starting with no hardware or networking knowledge. It covers QGH individual practice, QGH instructor-led / ATSS and Procedural. QGH means the cloud-breaking procedure in this suite. The equipment figures below are practical procurement recommendations, not measured minimum requirements or an operational equipment specification.

**The recommended first installation: one Windows PC, two monitors, one instructor and one student, with no internet connection at the training location.** The simulator files live on that PC. A small local file server opens them in the browser. Both instructor and student windows run on the same PC and browser profile. An internet-connected preparation computer is used elsewhere to obtain the complete files and installers, then they are transferred by USB. The training PC itself need never go online after it has been correctly provisioned.

## 01. What works without internet

| Activity | On one offline PC | Important condition |
| --- | --- | --- |
| QGH Single and Tactical | Yes | Run the supplied local site; manual controls work without speech recognition. |
| QGH instructor-led, SRA and PAR | Yes, same PC | Open both windows in the same browser profile and use the PIN, Admit and Ready flow. |
| Procedural instructor and student | Yes, same PC | Choose **This device**, not Online room. Keep the instructor desk open. |
| Separate independent exercises on several PCs | Yes | Install a full copy on every PC. Each PC runs its own exercise. |
| One shared live exercise across different offline PCs | **Not delivered in this release** | A local classroom session backend and secure local connections are still required. A switch or shared folder alone does not add this capability. |
| Supabase Online room | No | This is the internet-based Procedural service. It cannot reach the hosted project when disconnected. |
| Gyani | Yes | It is a fast local guide, not an internet chatbot or an LLM. No GPU is needed for Gyani. |
| Training guides, fonts, decorative images, included charts | Yes | They must be present in the copied site folder. |
| QGH optional offline voice recognition | Yes, subject to local microphone test | The included Vosk model must be prepared from the local site before use. No cloud recognizer is required. |
| QGH bundled pilot voice pack | Yes | Prepare the included pack on the actual training PC and browser profile; test with headphones. |
| Procedural / instructor-led optional pilot voice | Depends on installed device voices | Install an offline English speech voice before disconnection. Captions and bearing displays work if speech is unavailable. |
| Live AIP, NOTAM, weather, new routes or external guide links | No | Use instructor-prepared, dated reference files. The suite does not obtain current information offline. |

**Two screens are not two independent computers.** Windows normally has one active keyboard focus and one mouse pointer. A second USB mouse controls the same pointer. For a first offline station, the instructor operates the aircraft and the student gives verbal instructions while viewing the student screen. Take turns for student PIN entry, Ready and typed calls. This is suitable for an instructor-led demonstration or exercise. If both people must type and use their own mouse simultaneously in one shared exercise, that needs separate PCs and a future offline networking release; do not buy extra keyboards expecting independent seats on one Windows desktop.

## 02. The exact first-station shopping list

| Item | Quantity | Recommended specification and purpose |
| --- | --- | --- |
| Desktop PC | 1 | Windows 11 compatible x86-64 PC, recent 6-core CPU, 16 GB RAM, 512 GB SSD, graphics supporting two independent displays. Ask for manufacturer-supported Windows and display drivers. |
| Monitors | 2 | 24-inch IPS, 1920 × 1080, 60 Hz, matte surface, height-adjustable stand, HDMI or DisplayPort. Instructor on screen 1; student on screen 2. |
| Optional third monitor | 0 initially; 1 optional | For strips or reference material only. It needs a third supported display output, another video cable and another power outlet. It does not create another controller seat. |
| Video cables | 2 | One correctly matched cable per monitor, usually 1.5–2 metres. Buy HDMI-to-HDMI or DisplayPort-to-DisplayPort to match the actual sockets. |
| Wired USB keyboard | 1 | Standard full-size keyboard. A number pad is helpful for headings and levels. |
| Wired USB mouse + mat | 1 each | Reliable left and right buttons and a scroll wheel. No special flight-simulator controller is required. |
| USB headset with microphone | 1 | Recommended for individual QGH voice practice. Wired avoids charging, pairing and wireless dropouts. A microphone is optional for manual control exercises. |
| Optional second headset / voice intercom | 0 initially | Only if instructor and student need an intercom or both must hear audio privately. It is separate from simulator session networking. |
| UPS | 1 | Starting recommendation: 1000 VA, at least 600 W output, sufficient battery-backed outlets for PC + two monitors. Check the manufacturer's runtime at the actual load. |
| Approved grounded power distribution | 1 if needed | Compatible with the UPS outlet type and local supply, with enough sockets; have the supplier/electrician specify it. Do not daisy-chain extension boards. |
| Adjustable chairs | 2 | One per person; stable five-point base, adjustable seat height and back/lumbar support, armrests that fit under the desk. |
| Desks | 2 small or 1 large | Two desks about 120 × 75 cm each in an L arrangement; alternatively one desk around 180 × 80 cm. Check legroom and screen sightlines before ordering. |
| Optional screen divider | 1 if needed | Position it so the student cannot see instructor truth traffic. Use Extend, not Duplicate, on the displays. |
| Transfer USB drive | 1 | 32 GB minimum; 64 GB USB 3 recommended, labelled INSTALL MEDIA. Holds site package, full installers, drivers and handbook. |
| Backup USB drive | 1 | 32 GB minimum, labelled EXERCISE BACKUP. Keep separately from the PC and installation media. |
| Cable ties / labels / cable tray | 1 set | Label PC, INSTRUCTOR SCREEN, STUDENT SCREEN, HEADSET and UPS. Keep cables off walking routes and away from chair wheels. |
| Paper materials | 1 set | Printed quick-start instructions, notebook, pens, flight-strip holder or clipboard if your exercise uses paper strips. |

**You do not need for this first station:** internet router, SIM card, broadband subscription, network switch, separate server computer, Windows Server licence, rack, RAID controller, gaming GPU, VR headset, GPU server, load balancer, Supabase subscription, GitHub login on the training PC, Node.js, npm or Docker. Python is the small local file-server runtime used by the supplied launcher; it must be installed beforehand using a full offline installer.

## 03. CPU, RAM, GPU, storage and operating system

| Component | Existing-PC trial level | Recommended purchase | When to increase |
| --- | --- | --- | --- |
| CPU / processor | Windows-supported 64-bit CPU with 4 cores; test the actual exercise | Recent 6-core Intel Core i5 / Core 5 or AMD Ryzen 5 class CPU | More cores are useful for recording, many browser windows or other software. Do not buy by the word i5 alone; check generation and exact model. |
| RAM / working memory | 8 GB for an initial manual-control trial, with other apps closed | 16 GB, preferably upgradeable and dual-channel | 32 GB if recording video, preparing large charts or running several exercises. These are recommendations, not a concurrency guarantee. |
| GPU / graphics | Integrated graphics with current supported driver | Integrated Intel or AMD graphics with two independent 1080p outputs | Dedicated graphics only if the chosen PC cannot drive the required monitors, or separate graphics-heavy software will run. No CUDA, RTX or AI GPU is needed for this 2D suite. |
| GPU memory / VRAM | Integrated graphics may share system RAM | No separate VRAM target for this simulator | Avoid buying a card solely for a large VRAM number. Screen-output compatibility matters more. |
| Storage / SSD | 256 GB SSD with at least 10 GB free for suite installation and browser data | 512 GB SSD, keep at least 20 GB free after installation | 1 TB if keeping many videos, recordings, chart sets and backups. Separate backup media still required. |
| OS | A supported, correctly provisioned 64-bit Windows installation | Windows 11, compatible CPU, TPM 2.0 and Secure Boot support | Pro is useful for organisational administration but is not required by the simulator. Ask the supplier to handle offline-domain/local-account provisioning under your policy. |
| Browser | Supported stable Edge or Chrome with SharedWorker, IndexedDB and WebAssembly | A current stable 64-bit Edge or Chrome, prepared and tested before transfer | Keep a tested full installer for the chosen version on USB. Browser updates can be carried in later; do not update mid-exercise. |
| Local runtime | Python 3.12 or newer, 64-bit | Full offline Windows installer from python.org; include launcher and Add to PATH options | No Python packages or pip downloads are needed by the supplied file server. An install manager/bootstrapper that downloads Python later is insufficient. |
| Cooling | Working fan and clear vents | Standard manufacturer cooling; keep PC vents clear | Consider room heat/dust. No water cooling is needed. |

The site package is roughly a few hundred MB or less at this release; use the actual archive size supplied with your release. QGH's included recognition model is about 41 MB compressed. Browser caches, speech packs, copied updates and exported scenarios take additional space. These are not large 3D flight-simulator hardware requirements. Confirm performance with a complete 24-aircraft Procedural exercise on the exact machine before ordering multiple stations.

Windows 11 Home and Pro for personal use may require internet/account steps during initial Windows setup. Buying a new sealed PC is therefore not the same as buying a PC ready to run in an isolated room. Have authorised IT or the supplier provision, activate and test Windows and drivers before delivery; if the machine must never connect at any stage, use your organisation's approved offline provisioning process. Do not rely on an activation bypass. [Microsoft Windows requirements](https://support.microsoft.com/en-us/windows/experience/compatibility/windows-11-system-requirements).

## 04. Screens, physical sockets and every cable

**Read the PC's technical specification before ordering.** It must support two monitors at the same time, as separate extended displays. Two visible sockets are not sufficient evidence if a manufacturer limits simultaneous outputs. A CPU without integrated graphics needs a working graphics card; a motherboard HDMI socket may be inactive in that configuration. A laptop's built-in screen can be screen 1, with one external screen as screen 2, if its graphics supports that arrangement.

| Physical socket | How many to plan | What plugs into it |
| --- | --- | --- |
| HDMI / DisplayPort video output on PC | 2 independent outputs | One monitor cable per output. A splitter usually mirrors one picture and does not provide an independent instructor/student desktop. |
| USB-A / USB-C | 4 usable ports minimum; 6 convenient | Keyboard 1, mouse 1, USB headset 1, transfer/backup USB 1. Extra port for UPS monitoring, spare equipment or a printer. |
| USB-C used for a monitor | Only if explicitly supported | The PC port must support video output such as DisplayPort Alt Mode/Thunderbolt, and the dock/cable must support both requested displays. An ordinary USB data/charging port may not carry video. |
| 3.5 mm audio | Optional | Alternative analogue headphones/microphone. A combined headset jack differs from separate headphone and microphone jacks; a proper adapter may be needed. USB is easier. |
| RJ45 Ethernet | 0 needed for the first station | Optional 1 Gigabit Ethernet socket for later isolated-network work or file transfer. It is not a monitor connector. |
| PC mains power inlet | 1 | PC power lead to a battery-backed UPS outlet. |
| Monitor power inlets | 2 | Each monitor needs its own power lead and outlet. HDMI alone does not power an ordinary desktop monitor. |
| UPS mains input | 1 approved wall outlet | UPS to a properly grounded wall supply; UPS output to PC and screens. |

Prefer direct monitor cables. If an adapter is necessary, confirm its direction: a DisplayPort source to an HDMI monitor is not the same problem as HDMI source to DisplayPort monitor. Ask the supplier to demonstrate both screens at native resolution before accepting the equipment. Retain all stand screws, power adapters and supplied cables. [Microsoft multiple-display guidance](https://support.microsoft.com/en-us/windows/hardware/display-graphics/how-to-use-multiple-monitors-in-windows).

## 05. Furniture, placement, lighting and power

Start with space for two seated people and a clear exit route; roughly a 3 × 3 metre area is a planning allowance, not a mandated room size. Leave clearance behind chairs. Use an L layout or angled screens so the student sees only the controller picture. Keep the instructor monitor and keyboard within easy reach; put the PC where both video cables reach without stretching. Do not seal it inside an unventilated cabinet.

Adjust each chair so feet are supported and shoulders are relaxed. Place the screen directly in front of its user, approximately an arm's length away, and keep the top around eye level or lower. Avoid glare from windows and overhead lights. Use blinds and diffuse room lighting; a dark radar screen does not require a dark room. Footrests help if seat height leaves feet unsupported. [OSHA workstation evaluation](https://www.osha.gov/etools/computer-workstations/checklists/evaluation), [desk placement](https://www.osha.gov/etools/computer-workstations/components/desks).

For power planning, use the nameplate and measured consumption of the actual equipment. Example only: PC 150 W + two 30 W monitors = 210 W; add 30% headroom = 273 W. A 600 W rated UPS can support that example load, but its battery runtime depends on the battery and load curve. VA is not the same as watts. Ask for at least 10–15 minutes of measured runtime at your actual load if you need time to export and shut down. Verify connector type and battery-backed rather than surge-only outlets. Do not put a laser printer or room heater on this UPS. Have a qualified electrician assess earthing, circuit loading and any fixed wiring; this handbook is not a wiring instruction.

## 06. What to put on the preparation USB

Use a separate internet-connected preparation PC, or ask your IT supplier to provide these files on approved media. Nothing in this list should depend on downloading more files at the training room.

1. The complete **ATC-Suite-Offline** folder/ZIP built from this release, not just the GitHub repository source and not a browser Save page copy. It contains `site`, `Start-ATC.cmd`, `serve.py`, `START-HERE.txt` and a file-check manifest.
2. A **full 64-bit offline installer** for the chosen browser, if it is not already correctly installed. Microsoft offers Edge for Business installer downloads; download the full Windows installer on the preparation PC. [Official Edge download](https://www.microsoft.com/en-us/edge/business/download).
3. A **full Windows 64-bit Python 3.12-or-newer installer**, not only Python Install Manager. Use the official release's Windows installer download and test it with the preparation PC disconnected. Do not select options that fetch debugging symbols or other optional online components. [Official Python Windows downloads](https://www.python.org/downloads/windows/), [Python Windows installation guidance](https://docs.python.org/3/using/windows.html).
4. Manufacturer-provided offline drivers for the exact PC: graphics, chipset and audio; dock drivers if you selected a dock. Keep their licences and version details. Windows installation/activation should already be completed by the supplier.
5. Your instructor's authorised charts, LFA images, routes, scenarios and briefing notes. Keep source and effective-date details beside the files. An imported map is an exercise reference, not an automatic live AIP update.
6. This handbook in printed form or locally saved PDF. Also keep the built-in QGH, instructor-led and Procedural training guides included in the site folder.
7. A text inventory recording suite release, browser version, Python version, Windows build, PC model/serial, monitor models and cable types. Keep purchase invoices and warranty information outside the public site.

Use approved malware checks on transfer media and verify the supplied checksums. No email password, Supabase key with privileged access or GitHub credential belongs on this USB. The offline package disables online-room configuration; it needs no cloud account or sign-in. Its external reference links cannot work without internet, but the written operating instructions and bundled assets are local.

## 07. Installation on the disconnected Windows PC

1. Put the desks and chairs in place. Connect both monitors, keyboard, mouse and headset. Connect PC and monitor power to the UPS. Power up the UPS, then the PC.
2. Disconnect Ethernet and turn Wi-Fi off. Confirm Windows is already provisioned and the display/audio drivers are installed. Keep it disconnected for the following installation and test.
3. Create a folder named `C:\ATC-Suite-Offline`. Copy the complete contents of the supplied offline folder there. If you received a ZIP, right-click it and choose **Extract All**; do not run the simulator from inside the ZIP or directly from the USB drive.
4. Check that `C:\ATC-Suite-Offline\Start-ATC.cmd`, `serve.py` and `site\index.html` exist. Windows may hide file extensions; in File Explorer choose View → Show → File name extensions if needed.
5. If Python is absent, run the full offline installer from the USB. Include its launcher and **Add Python to PATH**, then install. A restart or a new terminal may be needed for PATH changes. The supplied launcher tries `py -3`, then `python`.
6. Install the prepared browser only if required. Use a normal, persistent Edge or Chrome profile called ATC Training. Private/InPrivate/Incognito mode is unsuitable for preserving exercises. Use the same browser profile for both roles.
7. Double-click **Start-ATC.cmd**. The local server first verifies the packaged site files against its manifest. Leave the server window open. It opens `http://127.0.0.1:8765/` in your default browser. If that is not your selected browser, copy this address into Edge or Chrome manually.
8. Open **Offline PC & classroom setup** from a landing page footer to read this guide locally. It is the same guide as the USB copy.
9. Bookmark `http://127.0.0.1:8765/` and make a desktop shortcut to Start-ATC.cmd. Start the launcher each day before opening the bookmark. Continue using this exact address and port.
10. If the launcher reports port 8765 is in use, check whether an earlier ATC server window is already open. Close that old server with Ctrl+C and restart. If a different application owns the port, ask IT to identify it; do not kill an unknown process or change firewall settings at random.

The server binds only to **127.0.0.1**, meaning this computer itself. It serves the simulator files; the exercise calculations still run in the browser. It is not a shared classroom backend. No administrator permission, router configuration, inbound network firewall rule or server account should be necessary for this loopback-only operation. If organisational policy blocks local servers or script execution, give IT this handbook and the launcher files for review rather than switching security protections off.

Do not double-click `site\index.html` to run the exercise: `file://` delivery is not the supported worker/storage setup. `http://127.0.0.1` is a trusted local context in supported browsers, allowing the local features to operate without internet or a public HTTPS certificate. [MDN secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts).

## 08. Configure the two displays and browser

1. Right-click the Windows desktop → **Display settings**. Select **Identify** so numbers appear on the monitors. Drag the numbered rectangles to match their physical left/right arrangement.
2. Press **Windows + P** and choose **Extend**. Do not select Duplicate: that would show the instructor's complete traffic picture to the student.
3. Set both screens to their native resolution, normally 1920 × 1080, and 60 Hz. Begin with Windows display scaling at 100% or 125%, whichever makes labels comfortably readable. Keep browser zoom at 100% initially.
4. Set the instructor monitor as the main display. Open the instructor page there. Open the student page in a new tab of the **same browser profile**, then drag that tab out into a separate window and move it to the second monitor. Windows + Shift + Left/Right Arrow can move the active window between monitors.
5. Maximise both windows. Use F11 for browser full screen if it improves the layout; F11 exits it. Each display needs the appropriate instructor or student page, not two copies of the instructor page.
6. In Windows Power settings, prevent sleep while plugged in during an exercise. Disable browser sleeping tabs / efficiency suspension for the local training site using the browser's exception settings. Keep the instructor window open and visible. Do not minimise or close it during an exercise.
7. Set your wired headset as the desired Windows output and input. Play a local test sound and speak into the microphone test. Set a comfortable volume before wearing the headset.
8. If voice recognition is used, grant microphone access only to the local simulator in the selected browser. Manual controls require no microphone permission. Do not enable a cloud speech fallback.

A second browser profile, Edge versus Chrome, another Windows login and a separate PC do not share the same local-room storage. The same numerical PIN cannot bridge those boundaries. Keep both windows on the same exact site address, port, browser and profile. Clearing browsing data can remove saved exercises and prepared voice caches.

## 09. Start each kind of exercise offline

### QGH individual practice

1. Open suite home → QGH → **Individual practice** → Single aircraft or Tactical.
2. Complete the setup fields, choose Normal QGH or U/S Compass, then start. Manual flight controls and visual pilot captions work without internet.
3. For optional speech recognition, open the QGH voice setup and prepare the included offline recognition pack from the local site. Its download is from the PC's `site\voice-models` folder, not the internet. Test one simple call before relying on it.
4. Prepare the bundled pilot voice pack if desired and give the explicit headphone/audio consent. Test spoken replies; keep captions visible. End the exercise to review.

### QGH instructor-led / ATSS (SRA, PAR)

1. Open suite home → QGH **Instructor-led** → Instructor console.
2. Choose QGH, SRA or PAR, configure the aircraft and create the session. Use the displayed session PIN.
3. Open the controller position in the same browser profile, move it to the student monitor, enter the PIN, then admit that request on the instructor side.
4. Select Ready on the student screen, then start on the instructor. The student observes the selected equipment picture; the instructor manages the aircraft.
5. Continue to use manual controls and captions if the optional installed-device speech voice is unavailable offline. SRA/PAR need adequate display width; use the full desktop monitor.

### Procedural

1. Open suite home → Procedural. Leave **Exercise connection = This device · offline capable**.
2. Open instructor setup, enter 1–24 aircraft and prepare the airspace. Create the session and keep it paused until the student is ready.
3. Open Session → student tab, keep the same browser profile, move the window to the student screen, enter the displayed PIN and student name.
4. Instructor chooses **Admit**; student chooses **Ready**; instructor selects **Run**.
5. Use the instructor scope and aircraft controls. The student receives the procedural picture, selected overlays, pilot replies and transmission-driven bearing information. Use **Pause** for briefing or help; Gyani is tucked away during running exercises.
6. Before changing or closing an exercise, export the scenario and map from **Edit airspace → Save & restore scenario → Download scenario + map**. Import it later to prepare a paused exercise. An exported scenario is not a promise that every transient radio queue, running clock or review event will resume exactly as before.

## 10. Port numbers and the meaning of a server

There are two different meanings of port: a **physical socket** such as HDMI or USB, and a **software port number** used by a network service. They are unrelated.

| Setting | First offline station | Meaning |
| --- | --- | --- |
| Local address | `127.0.0.1` | Loopback: this PC itself. Traffic does not leave through Wi-Fi or Ethernet. |
| Software port | `8765/TCP` | The supplied local file server listens here. Only one program can own this same address/port at a time. |
| Full browser address | `http://127.0.0.1:8765/` | Includes scheme, address and port. It is not an internet website. |
| HTTP standard port 80 | Not used | No need to open it. |
| HTTPS standard port 443 | Not needed for the standalone copy | The public GitHub/Supabase service uses internet HTTPS; not part of this offline setup. |
| Database ports 5432 / 6379 | Not used | No PostgreSQL or Redis server is needed for same-PC training. |
| Router port forwarding / public IP | Not used | Leave unchanged. Do not expose the local file server to the internet. |
| Load balancer | Not needed | There is one local PC serving its own files. More hardware does not add a shared session backend. |

The supplied server cannot be reached from another device using its own `127.0.0.1`; that address always refers to the device on which the browser runs. Changing the server to listen on every interface would expose files, but still would not make the local browser-room mechanism into a shared offline exercise service.

## 11. If you later build a classroom

**Available now:** replicate one self-contained PC station per instructor/student pair. For four pairs plan 4 PCs, 8 screens, 8 chairs, 4 keyboard/mouse sets, 8 video cables and 4 appropriately sized UPS units. Each pair runs an independent exercise. Scale the furniture and power plan accordingly; do not infer electrical-circuit capacity from this equipment count. No network is needed between independent stations.

**Future option, requiring software work:** a shared exercise across an instructor PC and separate student PCs on an isolated LAN. Internet and LAN are different: a wired local network can operate with no internet. A future deployment needs a supported local session backend, room isolation/admission, controller-only projections, reconnect handling, backups, and HTTPS/certificate provisioning trusted by every classroom PC. It is not supplied by the present static offline kit. Hosted Supabase settings cannot simply be copied into a disconnected room.

For planning only, reserve a Gigabit Ethernet switch with at least one port per PC/server plus spares, one Cat6 cable per device and UPS capacity for the network equipment. For 1 instructor PC + 4 student PCs + 1 separate server, that is 6 switch ports and 6 cables; an 8-port switch leaves 2 spares. A proposed local server baseline could be 4–6 CPU cores, 16 GB RAM and a 512 GB SSD with integrated graphics; capacity must be measured with the chosen backend before procurement. No public IP or port forwarding is necessary. The local service would normally expose one agreed HTTPS endpoint; its internal database ports should not be open to trainees. Exact ports, installer and certificates must be defined by that future release, not guessed now.

A networked classroom provides separate keyboard/mouse control. A central server alone does not supply desks, screens or computers to students. Remote Desktop/multi-seat Windows is a separate licensed design and is not a supported shortcut for this release.

## 12. Acceptance test with every network disconnected

Conduct this test on the actual training machine before signing off the installation. The current release's source/browser checks are useful, but they do not replace a cold-start test on your hardware or real microphone/headset testing.

1. Shut down both browser and local server. Unplug Ethernet and turn Wi-Fi off. Restart the PC.
2. Run Start-ATC.cmd. Confirm the file-integrity check succeeds and the complete home page opens at the local address. Confirm all three training branches and all guide pages open with images and fonts.
3. Open QGH Single, start, change heading/speed, transmit, switch QDM/QTE, terminate and open review. Open Tactical and check two aircraft independently.
4. Open QGH instructor-led. Create a session, join on screen 2, Admit and Ready, start QGH and test a pilot transmission. Repeat a short SRA/PAR display check if those modes will be used.
5. Create a local Procedural exercise with 24 aircraft. Run for 15 minutes while panning, zooming, selecting aircraft, transmitting and using turns. Confirm no stalls that prevent instruction, the two windows stay connected and the student does not see instructor truth blips.
6. Pause, change one selected route in Declutter and confirm the student receives the change. Resume; confirm radar sweep and clock continue. End and inspect the available review information.
7. Export a scenario/map, close the exercise, import it again and confirm the expected traffic and chart return paused. Keep this exported file as a known-good test scenario.
8. If voice will be used, prepare it from the local files, restart the browser while still disconnected and repeat actual microphone and pilot-audio tests. If speech is absent, record that limitation and use manual controls/captions.
9. Close the server and browser, reboot once more, and repeat a short offline start. A successful page already open in memory is not enough.
10. Ask the supplier/IT to demonstrate safe UPS operation at actual load and the export/shutdown procedure. Record measured runtime; do not treat the VA label as minutes of backup.

Record PC/browser versions, test date, reviewer name, failures and fixes. Do not purchase a classroom quantity until one complete station passes. These are installation tests, not additional tests presented to trainees during an exercise.

## 13. Daily startup, shutdown, backups and updates

**Startup:** turn on UPS and screens, start PC, launch Start-ATC.cmd, open the bookmarked local page, place instructor/student windows, verify the chart/date and audio if needed, prepare a fresh session, then Admit → Ready → Run. Close unrelated heavy applications. Keep the instructor visible.

**Shutdown:** pause or end training, export any scenario you need, copy it to `Documents\ATC Exercises\YYYY-MM-DD`, copy essential exports to the backup USB, close browser windows, then press Ctrl+C in the server window. Shut down Windows normally; only then turn off screens/UPS if that is the local routine. Browser storage is convenient recovery, not your only backup.

**Updates:** obtain a new complete tested release on the preparation PC; transfer it by approved USB. Export scenarios first. Close browser and server. Keep the previous full offline folder as a rollback copy. Extract the new release into a separate folder, verify its manifest and start it at the same normal local address/port. Finish existing exercises before applying any browser update prompt. Check that the new release and guide version appear. Repeat the disconnected acceptance test before regular use. Never replace files underneath a running exercise.

**Rollback:** stop the new server and close the browser, start the previous saved folder, and check the displayed release. If cached new assets remain, use IT help to remove the local site's cached data only after exporting required records; that can remove local exercises, maps and voice preparation too. Reimport a compatible scenario and reprepare packs. Compatibility of every future scenario format is not guaranteed.

**Maintenance:** keep approved spare keyboard/mouse/video cable, inspect the UPS battery on the manufacturer's schedule, clear dust according to the PC instructions, and carry Windows/browser security updates via your authorised offline maintenance process. No auto-updates or new online charts arrive at an isolated PC.

## 14. Troubleshooting in plain language

| Symptom | Check and action |
| --- | --- |
| Browser says this site cannot be reached | Start-ATC.cmd must be running. Use the exact local address and port. Look for an error in its window. A GitHub bookmark will not work offline unless cached; use the local site instead. |
| Python not found / Store opens | The full Python runtime was not installed or PATH/launcher is absent. Run the prepared offline installer with launcher/Add to PATH; reopen the launcher. An app-store shortcut is not the runtime. |
| File check reports missing or changed files | Recopy/extract the complete original release; check it was not run inside the ZIP. Do not ignore the mismatch or mix files from different versions. Keep exercise exports outside the site folder. |
| Both monitors show the same picture | Press Windows + P → Extend. Check you did not buy a mirroring splitter. Move a separate student browser window to screen 2. |
| Second screen blank | Check power, selected monitor input and both cable ends; confirm the PC supports both outputs simultaneously. Check that the video socket is active for its installed GPU. |
| PIN cannot find the exercise | Same PC, exact local URL, same port, same browser profile, instructor still open, This device mode. Recreate/join if the old session expired. A PIN is not a server address. |
| Student stuck waiting | Instructor must Admit, student must Ready, then instructor Run/Start. Check the correct room and role. |
| Aircraft or clock stops | Check Pause/Run, instructor window visibility, Windows sleep and browser tab suspension. A student cannot keep an absent instructor's simulation running. |
| Old design after an update | Finish/export and close exercises, use the offered update, restart browser/local server and check the release. Clearing storage is a last step because it removes saved local state. |
| No pilot sound | Check mute, audio consent, Windows output device, headset volume and installed offline voice/pack. Captions and D/F should remain usable. |
| Microphone call not recognised | Verify the local pack is prepared, browser microphone permission, correct input, headset and PTT. Use an accepted phrase from the guide. Manual controls remain available. |
| Student can see instructor traffic | Confirm the student page is on their monitor and Extend is selected. Adjust desk/monitor angle or add a divider. |
| Controls too small or clipped | Maximise the window, use native monitor resolution, start browser zoom at 100%, then choose a comfortable Windows scale. Keep SRA/PAR on a wide screen. |
| Another PC cannot join | This is the same-PC offline build. Hardware networking alone is insufficient. Use a separate independent installation, or arrange the future local-session backend. |

## 15. Purchase and handover checklist

Give the supplier this wording: **Supply one standalone ATC browser-training station: Windows 11 compatible 64-bit desktop, recent 6-core CPU, 16 GB upgradeable RAM, 512 GB SSD, integrated graphics capable of two independent 1920 × 1080 displays at 60 Hz, two compatible physical video outputs, at least four usable USB ports, two 24-inch matte IPS height-adjustable monitors, two matching video cables, wired keyboard and mouse, USB headset/microphone, appropriately rated UPS, two adjustable chairs and suitable desks. Provision OS, display/audio drivers, browser and full Python runtime before delivery. Demonstrate both extended displays and the supplied simulator with all internet connections disconnected. No dedicated gaming GPU or internet service is required.**

Before payment/acceptance, record the exact CPU and RAM specification, SSD capacity, number/type of active display outputs, monitor power and signal cables, UPS watt rating and measured runtime, spare ports, warranties and contact details. Check that original installers, drivers, local site package, printed handbook, test scenario and backup procedure are handed over. Pricing depends on supplier and location; this guide does not contain invented quotes.

## 16. What has and has not been verified

The implementation is designed for local browser execution and already separates individual exercises. The offline distribution includes the simulation files, local fonts/images, packaged QGH voice resources and training media, and disables hosted online rooms. Its manifest and loopback file serving are checked during preparation. This handbook does not certify a particular PC, monitor, UPS, headset, microphone, speech accent or classroom capacity. Final acceptance requires the completely disconnected, rebooted, two-monitor test above on the actual equipment.

The suite is an independent training simulator. Decorative QGH/cloud images are illustrations, not flown procedure diagrams. Local instructor-approved exercise data and training criteria remain the basis of the exercise.
