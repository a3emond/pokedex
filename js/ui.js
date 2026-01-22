import { el } from "./dom.js";

const loadingEl = el("loading");
const errorEl = el("error");
const resultEl = el("result");

export function setLoading(isLoading) {
    loadingEl.classList.toggle("hidden", !isLoading);
}

export function setError(message) {
    if (!message) {
        errorEl.textContent = "";
        errorEl.classList.add("hidden");
        return;
    }
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
}

export function clearResult() {
    resultEl.innerHTML = "";
}

export function renderCard(p) {
    const types = p.types.map(t => t.type.name);

    const artwork =
        p.sprites?.other?.["official-artwork"]?.front_default
        || p.sprites?.front_default
        || "";

    // API values are decimeters / hectograms
    const heightMeters = (p.height / 10).toFixed(1);
    const weightKg = (p.weight / 10).toFixed(1);

    resultEl.innerHTML = `
        <article class="card">
            <span class="card-id">#${String(p.id).padStart(4, "0")}</span>

            ${artwork ? `<img src="${artwork}" alt="${p.name}">` : ""}

            <h2 class="card-name">${capitalize(p.name)}</h2>

            <div class="types">
                ${types.map(t =>
        `<span class="type" data-type="${t}">${t}</span>`
    ).join("")}
            </div>

            <div class="card-stats">
                <div class="stat">
                    <span class="stat-label">Height</span>
                    <span class="stat-value">${heightMeters} m</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Weight</span>
                    <span class="stat-value">${weightKg} kg</span>
                </div>
            </div>
        </article>
    `;
}

function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}