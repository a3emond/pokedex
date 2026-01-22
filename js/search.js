import { API_BASE, fetchJson } from "./api.js";
import { el } from "./dom.js";
import { setError, setLoading, renderCard } from "./ui.js";

const searchInput = el("search-input");
const searchBtn = el("search-btn");

export function initSearch() {
    searchBtn?.addEventListener("click", run);
    searchInput?.addEventListener("keydown", e => {
        if (e.key === "Enter") run();
    });
}

async function run() {
    setError("");
    setLoading(true);
    try {
        const q = searchInput.value.trim().toLowerCase();
        if (!q) return;

        const p = await fetchJson(`${API_BASE}/pokemon/${encodeURIComponent(q)}`);
        renderCard(p);
    } catch {
        setError("Pokémon not found.");
    } finally {
        setLoading(false);
    }
}