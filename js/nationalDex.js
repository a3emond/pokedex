import { API_BASE, fetchJson } from "./api.js";
import { el } from "./dom.js";
import { setError, setLoading } from "./ui.js";
import { openPokemonModal } from "./modal.js";

/* ======================================================
   NATIONAL DEX MODULE
   ======================================================
   Goal:
   - Render a fast, paginated National Pokédex table.
   - Provide flexible filtering (text, id range, generation, types).
   - Keep network usage reasonable by loading details lazily, then
     progressively enriching results when a filter requires extra data.

   Key strategy:
   - Always render something immediately from the list endpoint (name + id).
   - Cache per-pokémon detail (types/artwork) and per-pokémon generation.
   - When a filter requires data we do not have yet (types/gen), fetch it for
     the current candidate set, then re-apply the filter and re-render.
   ====================================================== */

/* ======================================================
   DOM REFERENCES (MATCHES CURRENT index.html)
   ====================================================== */
const dexTbody = el("dex-tbody");
const dexPrevBtn = el("dex-prev");
const dexNextBtn = el("dex-next");
const dexPageLinks = el("dex-page-links");

const dexPageSize = el("dex-page-size");
const dexFilter = el("dex-filter");
const dexCount = el("dex-count");

const dexMinId = el("dex-min-id");
const dexMaxId = el("dex-max-id");
const dexGen = el("dex-gen");

const dexTypeFilter = document.querySelector(".dex-types-filter");
const dexClearBtn = el("dex-clear-filters");

/* Optional collapsible filters */
const filtersToggle = document.querySelector(".dex-filters-toggle");
const filtersExtra = document.querySelector(".dex-filters-extra");

/* ======================================================
   STATE
   ====================================================== */
const dexState = {
    initialized: false,

    all: [],
    filtered: [],

    page: 1,
    pageSize: 25,

    filters: {
        text: "",
        minId: null,
        maxId: null,
        generation: null,
        types: new Set()
    },

    cache: new Map(),
    genMap: new Map(),

    abort: null
};

/* ======================================================
   VALIDATION
   ====================================================== */
function assertDom() {
    const required = [
        ["dexTbody", dexTbody],
        ["dexPrevBtn", dexPrevBtn],
        ["dexNextBtn", dexNextBtn],
        ["dexPageLinks", dexPageLinks],
        ["dexPageSize", dexPageSize],
        ["dexFilter", dexFilter],
        ["dexCount", dexCount],
        ["dexMinId", dexMinId],
        ["dexMaxId", dexMaxId],
        ["dexGen", dexGen],
    ];

    const missing = required.filter(([, node]) => !node).map(([name]) => name);
    if (missing.length) {
        throw new Error(`National Dex markup missing: ${missing.join(", ")}`);
    }
}

/* ======================================================
   HELPERS
   ====================================================== */
function parseIdFromUrl(url) {
    const m = url.match(/\/pokemon\/(\d+)\/?$/);
    return m ? Number(m[1]) : null;
}

function totalPages() {
    return Math.max(1, Math.ceil(dexState.filtered.length / dexState.pageSize));
}

function clampPage() {
    const tp = totalPages();
    if (dexState.page < 1) dexState.page = 1;
    if (dexState.page > tp) dexState.page = tp;
}

function pageSlice() {
    const start = (dexState.page - 1) * dexState.pageSize;
    return dexState.filtered.slice(start, start + dexState.pageSize);
}

function isNumericString(s) {
    return /^\d+$/.test(s);
}

/* ======================================================
   FILTERING LOGIC
   ====================================================== */
function applyFilter() {
    const f = dexState.filters;

    dexState.filtered = dexState.all.filter(p => {
        const id = p.idFromUrl;

        if (f.text) {
            if (isNumericString(f.text)) {
                if (id !== Number(f.text)) return false;
            } else {
                if (!p.name.includes(f.text)) return false;
            }
        }

        if (f.minId !== null && id < f.minId) return false;
        if (f.maxId !== null && id > f.maxId) return false;

        if (f.generation) {
            const gen = dexState.genMap.get(p.name);
            if (!gen || gen !== f.generation) return false;
        }

        if (f.types.size) {
            const d = dexState.cache.get(p.name);
            if (!d) return false;

            for (const t of f.types) {
                if (!d.types.includes(t)) return false;
            }
        }

        return true;
    });

    clampPage();
}



/* ======================================================
   PAGINATION UI
   ====================================================== */
function getPageWindow(current, total, delta = 2) {
    const pages = [];
    const start = Math.max(1, current - delta);
    const end = Math.min(total, current + delta);

    if (start > 1) pages.push(1);
    if (start > 2) pages.push("…");

    for (let i = start; i <= end; i++) pages.push(i);

    if (end < total - 1) pages.push("…");
    if (end < total) pages.push(total);

    return pages;
}

function renderPager() {
    const tp = totalPages();

    dexPrevBtn.disabled = dexState.page <= 1;
    dexNextBtn.disabled = dexState.page >= tp;

    dexCount.textContent = `${dexState.filtered.length} Pokémon`;

    const pages = getPageWindow(dexState.page, tp);

    dexPageLinks.innerHTML = pages.map(p => {
        if (p === "…") return `<span class="pager-ellipsis">…</span>`;
        const active = p === dexState.page ? "active" : "";
        return `<button class="dex-page-btn ${active}" type="button" data-page="${p}">${p}</button>`;
    }).join("");
}

/* ======================================================
   RENDERING
   ====================================================== */
function renderRows(rows) {
    dexTbody.innerHTML = rows.map(p => {
        const d = dexState.cache.get(p.name);
        const id = d?.id ?? p.idFromUrl ?? "";
        const art = d?.artwork ?? "";
        const types = d?.types ?? [];
        const gen = dexState.genMap.get(p.name) ?? "";

        return `
            <tr>
                <td class="dex-gen">${gen}</td>
                <td>#${String(id).padStart(4, "0")}</td>
                <td>${art ? `<img class="dex-art" src="${art}" alt="${p.name}">` : ""}</td>
                <td class="dex-name">${p.name}</td>
                <td>
                    <div class="dex-types">
                        ${types.map(t =>
            `<span class="type readonly" data-type="${t}">${t}</span>`
        ).join("")}
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

/* ======================================================
   ENRICHMENT
   ====================================================== */
async function ensureDetailsForNames(names, signal) {
    const missing = names.filter(n => !dexState.cache.has(n));
    if (!missing.length) return;

    const settled = await Promise.allSettled(
        missing.map(n => fetchJson(`${API_BASE}/pokemon/${n}`, signal))
    );

    settled.forEach((res, i) => {
        if (res.status !== "fulfilled") return;
        const p = res.value;
        dexState.cache.set(missing[i], {
            id: p.id,
            types: p.types.map(t => t.type.name),
            artwork:
                p.sprites?.other?.["official-artwork"]?.front_default ||
                p.sprites?.front_default ||
                ""
        });
    });
}

async function ensureGenerationsForIds(pairs, signal) {
    const missing = pairs.filter(x => !dexState.genMap.has(x.name));
    if (!missing.length) return;

    const settled = await Promise.allSettled(
        missing.map(x => fetchJson(`${API_BASE}/pokemon-species/${x.idFromUrl}`, signal))
    );

    settled.forEach((res, i) => {
        if (res.status !== "fulfilled") return;
        const genName = res.value.generation?.name ?? "";
        const gen = genName ? genName.replace("generation-", "").toUpperCase() : "";
        dexState.genMap.set(missing[i].name, gen);
    });
}

/* ======================================================
   FILTER-DEPENDENT PREFETCH
   ====================================================== */
async function ensureFilterDependencies(signal) {
    const f = dexState.filters;

    const candidates = dexState.all.filter(p => {
        const id = p.idFromUrl;

        if (f.text) {
            if (isNumericString(f.text)) {
                if (id !== Number(f.text)) return false;
            } else {
                if (!p.name.includes(f.text)) return false;
            }
        }

        if (f.minId !== null && id < f.minId) return false;
        if (f.maxId !== null && id > f.maxId) return false;

        return true;
    });

    if (f.generation) {
        await ensureGenerationsForIds(
            candidates.map(c => ({ name: c.name, idFromUrl: c.idFromUrl })),
            signal
        );
    }

    if (f.types.size) {
        await ensureDetailsForNames(candidates.map(c => c.name), signal);
    }
}

/* ======================================================
   PAGE RENDER PIPELINE
   ====================================================== */
async function renderPage() {
    if (dexState.abort) dexState.abort.abort();
    dexState.abort = new AbortController();
    const signal = dexState.abort.signal;

    setLoading(true);
    try {
        await ensureFilterDependencies(signal);

        applyFilter();
        clampPage();

        const rows = pageSlice();
        renderRows(rows);

        await Promise.all([
            ensureDetailsForNames(rows.map(r => r.name), signal),
            ensureGenerationsForIds(rows.map(r => ({ name: r.name, idFromUrl: r.idFromUrl })), signal)
        ]);

        renderRows(rows);
        renderPager();
    } catch (e) {
        if (e?.name !== "AbortError") {
            setError("Failed to load National Pokédex.");
        }
    } finally {
        setLoading(false);
    }
}

/* ======================================================
   EVENT WIRING
   ====================================================== */
function wireEvents() {
    /* Row click -> modal */
    dexTbody.addEventListener("click", e => {
        const row = e.target.closest("tr");
        if (!row) return;

        const name = row.querySelector(".dex-name")?.textContent;
        if (name) openPokemonModal(name.toLowerCase());
    });

    /* Text filter */
    dexFilter.addEventListener("input", e => {
        dexState.filters.text = e.target.value.trim().toLowerCase();
        dexState.page = 1;
        renderPage();
    });

    /* ID range */
    dexMinId.addEventListener("input", e => {
        const v = Number(e.target.value);
        dexState.filters.minId = Number.isFinite(v) && v > 0 ? v : null;
        dexState.page = 1;
        renderPage();
    });

    dexMaxId.addEventListener("input", e => {
        const v = Number(e.target.value);
        dexState.filters.maxId = Number.isFinite(v) && v > 0 ? v : null;
        dexState.page = 1;
        renderPage();
    });

    /* Generation */
    dexGen.addEventListener("change", e => {
        dexState.filters.generation = e.target.value || null;
        dexState.page = 1;
        renderPage();
    });

    /* Types – max 2 enforced */
    if (dexTypeFilter) {
        dexTypeFilter.addEventListener("click", e => {
            const pill = e.target.closest(".type");
            if (!pill) return;

            const type = pill.dataset.type;
            if (!type) return;

            if (dexState.filters.types.has(type)) {
                dexState.filters.types.delete(type);
                pill.classList.remove("active");
            } else {
                if (dexState.filters.types.size >= 2) return;
                dexState.filters.types.add(type);
                pill.classList.add("active");
            }

            const checkbox = pill.closest("label")?.querySelector("input[type=checkbox]");
            if (checkbox) checkbox.checked = pill.classList.contains("active");

            dexState.page = 1;
            renderPage();
        });
    }

    /* Clear filters */
    dexClearBtn?.addEventListener("click", () => {
        dexState.filters.text = "";
        dexState.filters.minId = null;
        dexState.filters.maxId = null;
        dexState.filters.generation = null;
        dexState.filters.types.clear();

        dexFilter.value = "";
        dexMinId.value = "";
        dexMaxId.value = "";
        dexGen.value = "";

        dexTypeFilter?.querySelectorAll(".type").forEach(t => t.classList.remove("active"));
        dexTypeFilter?.querySelectorAll("input[type=checkbox]").forEach(c => c.checked = false);

        dexState.page = 1;
        renderPage();
    });

    /* Filter collapse toggle */
    filtersToggle?.addEventListener("click", () => {
        const open = !filtersExtra.classList.contains("hidden");
        filtersExtra.classList.toggle("hidden");
        filtersToggle.setAttribute("aria-expanded", String(!open));
    });

    /* Pagination */
    dexPrevBtn.addEventListener("click", () => {
        dexState.page--;
        clampPage();
        renderPage();
    });

    dexNextBtn.addEventListener("click", () => {
        dexState.page++;
        clampPage();
        renderPage();
    });

    dexPageSize.addEventListener("change", () => {
        dexState.pageSize = Number(dexPageSize.value) || 25;
        dexState.page = 1;
        renderPage();
    });

    dexPageLinks.addEventListener("click", e => {
        const btn = e.target.closest("[data-page]");
        if (!btn) return;

        const p = Number(btn.dataset.page);
        if (!Number.isFinite(p)) return;

        dexState.page = p;
        clampPage();
        renderPage();
    });
}

/* ======================================================
   INIT
   ====================================================== */
export async function initNationalDex() {
    if (dexState.initialized) return;
    dexState.initialized = true;

    assertDom();
    wireEvents();

    setLoading(true);
    try {
        const list = await fetchJson(`${API_BASE}/pokemon?limit=2000`);
        dexState.all = list.results
            .map(r => ({ name: r.name, idFromUrl: parseIdFromUrl(r.url) }))
            .filter(x => Number.isFinite(x.idFromUrl));

        dexState.filters.text = dexFilter.value.trim().toLowerCase();
        dexState.pageSize = Number(dexPageSize.value) || 25;

        await renderPage();
    } catch {
        setError("Failed to initialize National Pokédex.");
    } finally {
        setLoading(false);
    }
}
