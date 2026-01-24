import { initTabs, activateTab } from "./tabs.js";
import { initTheme, applyTheme } from "./theme.js";
import { initSearch } from "./search.js";
import { initRandom } from "./random.js";
import { initNationalDex } from "./nationalDex.js";
import { el } from "./dom.js";

// Init core
initTabs();
initTheme();
initSearch();
initRandom();

// Lazy init National Dex
el("tab-national")?.addEventListener("click", initNationalDex);

// Default state
initNationalDex();
activateTab("tab-national");
applyTheme(false);