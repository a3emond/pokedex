import { el } from "./dom.js";

const themeToggle = el("theme-toggle");

export function applyTheme(isDark) {
    document.documentElement.setAttribute(
        "data-theme",
        isDark ? "dark" : "light"
    );
}

export function initTheme() {
    themeToggle?.addEventListener("change", () => {
        applyTheme(themeToggle.checked);
    });
}