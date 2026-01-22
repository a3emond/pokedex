import { API_BASE, fetchJson } from "./api.js";
import { el } from "./dom.js";
import { setError, setLoading } from "./ui.js";

/* ======================================================
   NATIONAL DEX MODULE
   ====================================================== */

// DOM
const dexTbody = el("dex-tbody");
const dexPrevBtn = el("dex-prev");
const dexNextBtn = el("dex-next");
const dexPageInfo = el("dex-page-info");
const dexPageSize = el("dex-page-size");
const dexFilter = el("dex-filter");
const dexCount = el("dex-count");

// State
const dexState = {
    initialized: false,
    all: [],
    filtered: [],
    page: 1,
    pageSize: 25,
    cache: new Map(),
    genMap: new Map(),
    abort: null
};

/* ======================================================
   HELPERS
   ====================================================== */

function parseIdFromUrl(url) {
    const m = url.match(/\/pokemon\/(\d+)\/?$/);
    return m ? Number(m[1]) : null;
}

function applyFilter() {
    const q = dexFilter.value.trim().toLowerCase();

    if (!q) {
        dexState.filtered = dexState.all.slice();
    } else {
        const isNumeric = /^[0-9]+$/.test(q);
        dexState.filtered = dexState.all.filter(p =>
            isNumeric ? p.idFromUrl === Number(q) : p.name.includes(q)
        );
    }

    dexState.page = 1;
}

function totalPages() {
    return Math.max(1, Math.ceil(dexState.filtered.length / dexState.pageSize));
}

function pageSlice() {
    const start = (dexState.page - 1) * dexState.pageSize;
    return dexState.filtered.slice(start, start + dexState.pageSize);
}

// TODO: add jump to page  <<prev ... 1 2 3 4 5 ... 25 next>>
function setPagerUi() {
    const tp = totalPages();
    dexPrevBtn.disabled = dexState.page <= 1;
    dexNextBtn.disabled = dexState.page >= tp;
    dexPageInfo.textContent = `Page ${dexState.page} / ${tp}`;
    dexCount.textContent = `${dexState.filtered.length} Pokémon`;
}

// TODO: attach click event on rows for details
function renderRows(rows) {
    dexTbody.innerHTML = rows.map(p => {
        const data = dexState.cache.get(p.name);
        const id = data?.id ?? p.idFromUrl ?? "";
        const art = data?.artwork ?? "";
        const types = data?.types ?? [];
        const gen = dexState.genMap.get(p.name) ?? ""; // TODO: debug -> value empty 2026-02-22 15h20

        return `
        <tr>
            <td>${gen ? `Gen ${gen}` : ""}</td>
            <td>#${String(id).padStart(4, "0")}</td>
            <td>${art ? `<img class="dex-art" src="${art}">` : ""}</td>
            <td class="dex-name">${p.name}</td>
            <td>
                <div class="dex-types">
                    ${types.map(t =>
                        `<span class="type" data-type="${t}">${t}</span>`
                    ).join("")}
                </div>
            </td>
        </tr>`;
    }).join("");
}

/* ======================================================
   FETCHING
   ====================================================== */

async function ensureDetails(rows, signal) {
    const missing = rows.filter(p => !dexState.cache.has(p.name));
    if (!missing.length) return;

    const settled = await Promise.allSettled(
        missing.map(p => fetchJson(`${API_BASE}/pokemon/${p.name}`, signal))
    );

    settled.forEach((res, i) => {
        if (res.status !== "fulfilled") return;
        const p = res.value;
        dexState.cache.set(missing[i].name, {
            id: p.id,
            types: p.types.map(t => t.type.name),
            artwork:
                p.sprites?.other?.["official-artwork"]?.front_default ||
                p.sprites?.front_default ||
                ""
        });
    });
}

async function renderPage() {
    if (dexState.abort) dexState.abort.abort();
    dexState.abort = new AbortController();

    setLoading(true);
    try {
        const rows = pageSlice();
        renderRows(rows);
        await ensureDetails(rows, dexState.abort.signal);
        renderRows(rows);
        setPagerUi();
    } catch {
        setError("Failed to load National Pokédex.");
    } finally {
        setLoading(false);
    }
}

/* ======================================================
   INIT (EXPORTED)
   ====================================================== */

export async function initNationalDex() {
    if (dexState.initialized) return;
    dexState.initialized = true;

    setLoading(true);
    try {
        const list = await fetchJson(`${API_BASE}/pokemon?limit=2000`);
        dexState.all = list.results.map(r => ({
            name: r.name,
            idFromUrl: parseIdFromUrl(r.url)
        }));

        applyFilter();
        await renderPage();
    } catch {
        setError("Failed to initialize National Pokédex.");
    } finally {
        setLoading(false);
    }

    dexPrevBtn.addEventListener("click", () => {
        dexState.page--;
        renderPage();
    });

    dexNextBtn.addEventListener("click", () => {
        dexState.page++;
        renderPage();
    });

    dexPageSize.addEventListener("change", () => {
        dexState.pageSize = Number(dexPageSize.value);
        dexState.page = 1;
        renderPage();
    });

    dexFilter.addEventListener("input", () => {
        applyFilter();
        renderPage();
    });
}