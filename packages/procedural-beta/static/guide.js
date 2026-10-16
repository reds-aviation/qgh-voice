/*
The contents of this file are subject to the Common Public Attribution License Version 1.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at https://opensource.org/license/cpal_1-0. The License is based on the Mozilla Public License Version 1.1 but Sections 14 and 15 have been added to cover use of software over a computer network and provide for limited attribution for the Original Developer. In addition, Exhibit A has been modified to be consistent with Exhibit B.
Software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the specific language governing rights and limitations under the License.
The Original Code is ATS SIM BOX.
The Original Developer is the Initial Developer.
The Initial Developer of the Original Code is Balaram Reddy. All portions of the code written by Balaram Reddy are Copyright (c) 2026 Balaram Reddy. All Rights Reserved.
Contributor(s): None designated in this initial notice.
No alternative licence is designated for this CPAL version. Historical MIT releases retain the permissions described in COPYRIGHT.md.
*/

const search = document.querySelector("#guide-search");
const sections = Array.from(document.querySelectorAll(".guide-section"));
const links = Array.from(document.querySelectorAll(".guide-nav a"));
const searchable = sections.map((section) => ({
    section,
    text: section.textContent.toLocaleLowerCase(),
}));
function filterGuide() {
    const words = search.value
        .trim()
        .toLocaleLowerCase()
        .split(/\s+/)
        .filter(Boolean);
    let count = 0;
    for (const { section, text } of searchable) {
        section.hidden = !words.every((word) => text.includes(word));
        if (!section.hidden)
            count++;
    }
    for (const link of links) {
        link.hidden = document.querySelector(link.hash).hidden;
    }
    document.querySelector("#guide-results").textContent = words.length
        ? `${count} of ${sections.length} sections match your search`
        : `${sections.length} guide sections`;
    document.querySelector("#guide-empty").hidden = count > 0;
}
function revealSection(hash) {
    const target = sections.find((section) => `#${section.id}` === hash);
    if (target?.hidden) {
        search.value = "";
        filterGuide();
        target.scrollIntoView();
    }
}
function showLinkedSection() {
    for (const link of links) {
        if (link.hash === location.hash)
            link.setAttribute("aria-current", "location");
        else
            link.removeAttribute("aria-current");
    }
    revealSection(location.hash);
}
document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element))
        return;
    const link = event.target.closest('a[href^="#"]');
    if (link)
        revealSection(link.hash);
});
search.addEventListener("input", filterGuide);
document.querySelector("#clear-search").addEventListener("click", () => {
    search.value = "";
    filterGuide();
    search.focus();
});
const printButton = document.querySelector("#print-guide");
printButton.addEventListener("click", () => window.print());
printButton.hidden = false;
document.querySelector("#guide-search-tools").hidden = false;
window.addEventListener("hashchange", showLinkedSection);
// Expand disclosures only for printing, then restore the reader's choices.
let expandedForPrint = [];
window.addEventListener("beforeprint", () => {
    expandedForPrint = Array.from(document.querySelectorAll("details:not([open])"));
    expandedForPrint.forEach((detail) => (detail.open = true));
});
window.addEventListener("afterprint", () => {
    expandedForPrint.forEach((detail) => (detail.open = false));
    expandedForPrint = [];
});
showLinkedSection();
export {};
