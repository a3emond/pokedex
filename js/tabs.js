import { el } from "./dom.js";
import { clearResult } from "./ui.js";

const tabButtons = Array.from(document.querySelectorAll(".header-tabs .tab"));

const tabToSection = {
    "tab-search": "search-section",
    "tab-random": "random-section",
    "tab-national": "national-section"
};

export function activateTab(tabId) {
    tabButtons.forEach(btn => {
        const active = btn.id === tabId;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-selected", active ? "true" : "false");
    });

    Object.entries(tabToSection).forEach(([btnId, sectionId]) => {
        el(sectionId).classList.toggle("hidden", btnId !== tabId);
    });

    clearResult();
}

export function initTabs() {
    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => activateTab(btn.id));
    });
}