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
