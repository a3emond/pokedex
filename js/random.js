import { API_BASE, fetchJson } from "./api.js";
import { el } from "./dom.js";
import { setError, setLoading, renderCard } from "./ui.js";

const randomBtn = el("random-btn");

let basePokemonList = null;

export function initRandom() {
    randomBtn?.addEventListener("click", runRandom);
}

async function runRandom() { // todo: include other range (10001...10325) for special forms
    setError("");
    setLoading(true);

    try {
        if (!basePokemonList) {
            basePokemonList = await fetchJson(
                `${API_BASE}/pokemon?limit=1025&offset=0` // limit 1025 to exclude special forms (10001...10325)
            );
        }

        const results = basePokemonList.results;
        const pick = results[Math.floor(Math.random() * results.length)];
        const p = await fetchJson(`${API_BASE}/pokemon/${pick.name}`);

        renderCard(p);
    } catch {
        setError("Failed to load random Pokémon.");
    } finally {
        setLoading(false);
    }
}