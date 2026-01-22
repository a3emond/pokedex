export const API_BASE = "https://pokeapi.co/api/v2";

export async function fetchJson(url, signal) {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} (${url})`);
    return await res.json();
}