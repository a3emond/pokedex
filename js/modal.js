import { API_BASE, fetchJson } from "./api.js";
import { el } from "./dom.js";
import { setLoading, setError } from "./ui.js";

const overlay = el("pokemon-overlay");
const content = el("modal-content");
const closeBtn = overlay.querySelector(".modal-close");

let abort = null;

/* ======================================================
   PUBLIC API
   ====================================================== */
export function openPokemonModal(nameOrId) {
    if (abort) abort.abort();
    abort = new AbortController();

    overlay.classList.remove("hidden");
    content.innerHTML = "";
    setLoading(true);

    loadFullPokemon(nameOrId, abort.signal)
        .catch(() => setError("Failed to load Pokémon details."))
        .finally(() => setLoading(false));
}

export function closePokemonModal() {
    if (abort) abort.abort();
    overlay.classList.add("hidden");
    content.innerHTML = "";
}

/* ======================================================
   CORE LOAD
   ====================================================== */
async function loadFullPokemon(id, signal) {
    const pokemon = await fetchJson(`${API_BASE}/pokemon/${id}`, signal);
    const species = await fetchJson(pokemon.species.url, signal);
    const evoChain = await fetchJson(species.evolution_chain.url, signal);

    renderPokemon(pokemon, species, evoChain);
}

/* ======================================================
   RENDER
   ====================================================== */
function renderPokemon(p, species, evoChain) {
    const artwork =
        p.sprites?.other?.["official-artwork"]?.front_default ||
        p.sprites?.front_default ||
        "";

    const heightMeters = (p.height / 10).toFixed(1);
    const weightKg = (p.weight / 10).toFixed(1);

    const baseStatTotal = p.stats.reduce((s, x) => s + x.base_stat, 0);

    const flavor = species.flavor_text_entries
        .find(e => e.language.name === "en")
        ?.flavor_text.replace(/\f/g, " ");

    content.innerHTML = `
        ${artwork ? `<img src="${artwork}" alt="${p.name}">` : ""}

        <h2>${p.name}</h2>

        <div class="types">
            ${p.types.map(t =>
        `<span class="type" data-type="${t.type.name}">
                    ${t.type.name}
                 </span>`
    ).join("")}
        </div>

        <p class="dex-flavor">${flavor ?? ""}</p>

        <div class="card-stats">
            ${statBox("Height", `${heightMeters} m`)}
            ${statBox("Weight", `${weightKg} kg`)}
            ${statBox("Base Exp", p.base_experience ?? "—")}
            ${statBox("BST", baseStatTotal)}
            ${statBox("Catch Rate", species.capture_rate)}
            ${statBox("Growth", species.growth_rate?.name)}
        </div>

        <h3>Abilities</h3>
        <div class="types">
            ${p.abilities.map(a => `
                <span class="type"
                      data-type="${a.is_hidden ? "dark" : "normal"}">
                    ${a.ability.name}${a.is_hidden ? " (hidden)" : ""}
                </span>
            `).join("")}
        </div>

        <h3>Base Stats</h3>
        <div class="stats">
            ${p.stats.map(renderStatBar).join("")}
        </div>

        <h3>Evolution Chain</h3>
        <div class="evolution">
            ${renderEvolutionChain(evoChain.chain)}
        </div>
    `;
}

/* ======================================================
   HELPERS
   ====================================================== */
function statBox(label, value) {
    return `
        <div class="stat">
            <span class="stat-label">${label}</span>
            <span class="stat-value">${value ?? "—"}</span>
        </div>
    `;
}

function renderStatBar(s) {
    const value = s.base_stat;
    const percent = Math.min(100, Math.round((value / 255) * 100));

    return `
        <div class="stat-bar">
            <div class="stat-bar-header">
                <span>${formatStat(s.stat.name)}</span>
                <span>${value}</span>
            </div>
            <div class="stat-track">
                <div class="stat-fill" style="--value:${percent}"></div>
            </div>
        </div>
    `;
}

function renderEvolutionChain(node) {
    const names = [];
    let current = node;

    while (current) {
        names.push(current.species.name);
        current = current.evolves_to[0];
    }

    return `
        <div class="evo-line">
            ${names.map(n =>
        `<span class="evo-item">${n}</span>`
    ).join(" → ")}
        </div>
    `;
}

function formatStat(s) {
    return s.replace("-", " ").toUpperCase();
}

/* ======================================================
   CLOSE HANDLERS
   ====================================================== */
closeBtn.addEventListener("click", closePokemonModal);

overlay.addEventListener("click", e => {
    if (e.target === overlay) closePokemonModal();
});

document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !overlay.classList.contains("hidden")) {
        closePokemonModal();
    }
});
