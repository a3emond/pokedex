# Pokédex — Technical README

## Overview

This project is a vanilla JavaScript Pokédex built for revision and technical validation purposes. It deliberately avoids frameworks and relies on explicit state management, DOM wiring, and controlled network access to demonstrate clean architecture and predictable behavior.

The application exposes three main views:

* National Pokédex (paginated, filterable table)
* Search (direct lookup)
* Random Pokémon

The two most complex parts of the system are:

1. The National Dex module (pagination + filtering + progressive enrichment)
2. The Pokémon detail modal (multi-endpoint aggregation with cancellation)

This document focuses strictly on those two areas.

---

## Architectural Principles

* Vanilla JS only (no framework, no virtual DOM)
* Explicit, centralized state objects
* Progressive rendering: show something immediately, enrich later
* Deterministic pagination and filtering
* Abortable fetches to prevent race conditions
* DOM validation at startup to fail fast

---

## National Dex Module

### Responsibility

The National Dex module is responsible for:

* Fetching the full Pokémon index once
* Rendering a paginated table
* Applying multiple independent filters
* Lazily enriching rows with extra data (types, artwork, generation)
* Keeping pagination stable and predictable

It does **not**:

* Fetch full Pokémon details eagerly
* Re-fetch already cached data
* Mutate DOM outside its own scope

---

### Core State

The entire module is driven by a single state object:

* `all`: raw Pokémon list (name + id)
* `filtered`: result of applying filters to `all`
* `page`, `pageSize`: pagination state
* `filters`: user-defined constraints
* `cache`: per-Pokémon detail cache (types, artwork, id)
* `genMap`: per-Pokémon generation cache
* `abort`: active AbortController for in-flight requests

This guarantees that rendering is always derived from state, never the DOM.

---

### Data Flow

Initialization:

1. Fetch `/pokemon?limit=2000`
2. Extract `{ name, idFromUrl }`
3. Store once in `dexState.all`

Rendering a page:

1. Cancel previous render if still running
2. Ensure filter-dependent data exists
3. Apply filters to `all` → `filtered`
4. Clamp page bounds
5. Render table rows immediately
6. Enrich visible rows (details + generation)
7. Re-render rows and pagination

This two-pass render ensures fast perceived performance.

---

### Filtering Strategy

Filtering is deterministic and order-independent.

Supported filters:

* Text (name or exact id)
* ID range
* Generation
* Types (up to 2, AND logic)

Important rules:

* Filters never mutate `all`
* Filters operate only on cached data
* Missing data causes temporary exclusion until enriched

When a filter requires unavailable data (generation or types), the module:

* Identifies candidate Pokémon
* Fetches only what is missing
* Re-applies filters

---

### Pagination Logic

Pagination is entirely state-driven.

Key invariants:

* `filtered` is the single source of truth
* Page clamping always occurs after filtering
* Page resets occur only when filters or page size change

The pager UI is computed via a sliding window:

* Always shows current page context
* Uses ellipsis for large ranges
* Never renders invalid page numbers

Event handlers never directly touch the DOM; they only mutate state and re-render.

---

### Abort Handling

Every render cycle creates a new `AbortController`.

If a new render starts:

* The previous controller is aborted
* All pending fetches are cancelled

This prevents:

* Race conditions
* Late responses overwriting newer state
* UI flicker

---

## Pokémon Detail Modal

### Responsibility

The modal is responsible for:

* Displaying a complete Pokémon profile
* Aggregating data from multiple endpoints
* Handling open/close lifecycle cleanly

It does **not**:

* Cache data globally
* Interact with pagination or filters
* Persist state across openings

---

### Data Sources

Opening the modal triggers three sequential fetches:

1. `/pokemon/{id|name}`
2. `pokemon.species.url`
3. `species.evolution_chain.url`

These are intentionally chained to preserve logical dependency.

---

### Abort Strategy

The modal maintains its own `AbortController`.

Rules:

* Opening a modal aborts any previous modal request
* Closing the modal aborts active requests
* Escape key and backdrop click are supported

This guarantees that stale responses never update the modal content.

---

### Rendering Strategy

Rendering is done in a single pass once all data is available.

Computed values:

* Height and weight normalized to meters / kilograms
* Base stat total (BST)
* English flavor text extraction
* Evolution chain flattened to a linear sequence

No incremental rendering is used here by design, since the modal is explicitly user-triggered.

---

## Error and Loading Handling

Both modules rely on shared helpers:

* `setLoading(true|false)` for global UI feedback
* `setError(message)` for non-fatal failures

Errors:

* Do not crash the app
* Do not leave partial UI states
* Always reset loading indicators

---

## Why This Design

This architecture prioritizes:

* Predictability over cleverness
* Explicit state over implicit DOM coupling
* Debuggability over abstraction

It is intentionally verbose to make data flow and responsibilities obvious, which is the primary goal of this project.

---

## Scope Limitations

Deliberately excluded:

* Global caching across views
* URL routing
* Framework abstractions
* Optimistic rendering

These omissions are intentional and align with the educational and validation goals of the project.
