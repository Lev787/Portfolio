const FAVORITES_KEY = "starwars-console-favorites";
const THEME_KEY = "starwars-console-theme";
const IS_FILE_MODE = window.location.protocol === "file:";
const SNAPSHOT_CATALOG = window.STAR_WARS_SNAPSHOT || null;
const API_BASE = "https://starwars-databank-server.onrender.com/api/v1";

const CATEGORY_CONFIG = [
  {
    key: "characters",
    label: "Characters",
    blurb: "Commanders, legends, rogues, and unforgettable faces from the saga.",
    limit: 6,
  },
  {
    key: "droids",
    label: "Droids",
    blurb: "Mechanical minds, battlefield units, and our custom hover-art droids.",
    limit: 6,
  },
  {
    key: "vehicles",
    label: "Vehicles",
    blurb: "Speed demons, walkers, and warships built for galactic spectacle.",
    limit: 6,
  },
];

const CUSTOM_DROID_ART = [
  { src: "./assets/droids/holo-scout.svg", codename: "Holo Scout" },
  { src: "./assets/droids/forge-mech.svg", codename: "Forge Mech" },
  { src: "./assets/droids/pulse-repair.svg", codename: "Pulse Repair" },
  { src: "./assets/droids/orbit-sentinel.svg", codename: "Orbit Sentinel" },
  { src: "./assets/droids/nebula-navigator.svg", codename: "Nebula Navigator" },
];

const APP_FEATURES = [
  {
    id: "search-radar",
    title: "Search Radar",
    copy: "Instantly scan the live archive by name, lore, or category tags.",
  },
  {
    id: "category-warp",
    title: "Category Warp",
    copy: "Jump between characters, droids, and vehicles with one click.",
  },
  {
    id: "favorite-vault",
    title: "Favorite Vault",
    copy: "Save the best cards in local storage and filter down to your shortlist.",
  },
  {
    id: "hyperspace-surprise",
    title: "Hyperspace Surprise",
    copy: "Highlight a random record from the active signal set.",
  },
  {
    id: "droid-override",
    title: "Droid Override",
    copy: "Hover the first five droid cards to swap in original custom illustrations.",
  },
];

const state = {
  catalog: null,
  activeCategory: "all",
  search: "",
  sort: "featured",
  favoritesOnly: false,
  favorites: new Set(readStoredArray(FAVORITES_KEY)),
  theme: localStorage.getItem(THEME_KEY) || "aurora",
  spotlightId: null,
  highlightedId: null,
  error: null,
};

const refs = {
  featureGrid: document.querySelector("#featureGrid"),
  searchInput: document.querySelector("#searchInput"),
  sortSelect: document.querySelector("#sortSelect"),
  favoritesOnly: document.querySelector("#favoritesOnly"),
  categoryTabs: document.querySelector("#categoryTabs"),
  statusLine: document.querySelector("#statusLine"),
  statsBar: document.querySelector("#statsBar"),
  feed: document.querySelector("#feed"),
  randomBtn: document.querySelector("#randomBtn"),
  themeBtn: document.querySelector("#themeBtn"),
  spotlightPanel: document.querySelector("#spotlightPanel"),
};

document.body.dataset.theme = state.theme;
syncThemeButton();
refs.favoritesOnly.checked = state.favoritesOnly;

bindEvents();
bindImageFallbacks();
renderFeatureGrid([]);
renderLoading();
loadCatalog();

function bindEvents() {
  refs.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    ensureSpotlightIsVisible();
    render();
  });

  refs.sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value;
    render();
  });

  refs.favoritesOnly.addEventListener("change", (event) => {
    state.favoritesOnly = event.target.checked;
    ensureSpotlightIsVisible();
    render();
  });

  refs.randomBtn.addEventListener("click", () => {
    const visibleItems = getVisibleItems();
    if (!visibleItems.length) {
      return;
    }

    const randomItem = visibleItems[Math.floor(Math.random() * visibleItems.length)];
    state.spotlightId = randomItem.id;
    state.highlightedId = randomItem.id;
    render();

    window.setTimeout(() => {
      const card = document.querySelector(`[data-card-id="${cssEscape(randomItem.id)}"]`);
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 30);

    window.setTimeout(() => {
      if (state.highlightedId === randomItem.id) {
        state.highlightedId = null;
        render();
      }
    }, 1400);
  });

  refs.themeBtn.addEventListener("click", () => {
    state.theme = state.theme === "aurora" ? "solar" : "aurora";
    document.body.dataset.theme = state.theme;
    localStorage.setItem(THEME_KEY, state.theme);
    syncThemeButton();
  });

  refs.categoryTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) {
      return;
    }

    state.activeCategory = button.dataset.category;
    ensureSpotlightIsVisible();
    render();
  });

  refs.feed.addEventListener("click", (event) => {
    const retryButton = event.target.closest("[data-action='retry']");
    if (retryButton) {
      loadCatalog();
      return;
    }

    const favoriteButton = event.target.closest("[data-action='favorite']");
    if (favoriteButton) {
      toggleFavorite(favoriteButton.dataset.id);
      return;
    }

    const spotlightButton = event.target.closest("[data-action='spotlight']");
    if (spotlightButton) {
      state.spotlightId = spotlightButton.dataset.id;
      renderSpotlight();
    }
  });
}

function bindImageFallbacks() {
  document.addEventListener(
    "error",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLImageElement)) {
        return;
      }

      const fallbackSrc = target.dataset.fallbackSrc;
      if (!fallbackSrc || target.src === fallbackSrc) {
        return;
      }

      target.src = fallbackSrc;
    },
    true,
  );
}

async function loadCatalog() {
  state.error = null;
  renderLoading();

  const loaders = IS_FILE_MODE
    ? [loadFromDirectApi, loadFromSnapshot]
    : [loadFromServerProxy, loadFromDirectApi, loadFromSnapshot];

  let lastError = null;

  for (const loader of loaders) {
    try {
      const result = await loader();
      initializeCatalog(result.catalog, {
        sourceMode: result.sourceMode,
        notice: result.notice,
      });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  state.error = lastError instanceof Error ? lastError.message : "Unable to load data.";
  renderError();
}

async function loadFromServerProxy() {
  const response = await fetch("./api/catalog", { cache: "no-store" });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message || "Unknown server proxy error");
  }

  return {
    catalog: payload,
    sourceMode: payload.stale ? "snapshot" : "live",
    notice: payload.notice || "",
  };
}

async function loadFromDirectApi() {
  const categories = await Promise.all(CATEGORY_CONFIG.map(fetchDirectCategory));

  return {
    sourceMode: "live-direct",
    notice: IS_FILE_MODE
      ? "Opened from a local file and connected directly to the live API."
      : "Connected directly to the live API.",
    catalog: {
      fetchedAt: new Date().toISOString(),
      stale: false,
      apiBase: API_BASE,
      features: APP_FEATURES,
      categories: categories.map(({ items, ...meta }) => meta),
      items: categories.flatMap((category) => category.items),
    },
  };
}

function loadFromSnapshot() {
  if (!SNAPSHOT_CATALOG) {
    throw new Error("No bundled snapshot available.");
  }

  return {
    sourceMode: "snapshot",
    notice: "The live API could not be reached, so the app switched to the bundled snapshot.",
    catalog: SNAPSHOT_CATALOG,
  };
}

async function fetchDirectCategory(category) {
  const url = new URL(`${API_BASE}/${category.key}`);
  url.searchParams.set("page", "1");
  url.searchParams.set("limit", String(category.limit));

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Direct API request failed for ${category.key} with status ${response.status}`);
  }

  const payload = await response.json();
  const items = Array.isArray(payload.data)
    ? payload.data.map((item, index) => normalizeLiveItem(item, category, index))
    : [];

  return {
    key: category.key,
    label: category.label,
    blurb: category.blurb,
    count: items.length,
    items,
  };
}

function normalizeLiveItem(rawItem, category, index) {
  const description = String(rawItem.description || "").trim();
  const customArt = category.key === "droids" ? CUSTOM_DROID_ART[index] || null : null;

  return {
    id: `${category.key}-${rawItem._id || index}`,
    name: String(rawItem.name || "Unknown record").trim(),
    description: description || "No databank description is available for this record yet.",
    summary: createSummary(description),
    image: String(rawItem.image || "").trim(),
    category: category.key,
    categoryLabel: category.label,
    hoverImage: customArt ? customArt.src : null,
    hoverLabel: customArt ? customArt.codename : null,
    hasCustomSwap: Boolean(customArt),
  };
}

function initializeCatalog(catalog, options = {}) {
  state.catalog = hydrateCatalog(catalog, options);
  state.spotlightId = state.catalog.items[0]?.id || null;
  renderFeatureGrid(state.catalog.features);
  render();
}

function hydrateCatalog(catalog, { sourceMode = "live", notice } = {}) {
  const items = Array.isArray(catalog.items)
    ? catalog.items.map((item) => {
        const summary = item.summary || createSummary(item.description || "");
        const hoverImage = normalizeAssetPath(item.hoverImage || "");
        const fallbackImage = buildLocalPosterPath(item.category);
        const remoteImage = String(item.image || "").trim();

        return {
          ...item,
          summary,
          hoverImage,
          remoteImage,
          fallbackImage,
          hasCustomSwap: Boolean(item.hasCustomSwap || hoverImage),
          image: remoteImage || fallbackImage,
        };
      })
    : [];

  return {
    ...catalog,
    stale: Boolean(catalog.stale || sourceMode === "snapshot"),
    notice: notice || catalog.notice || "",
    sourceMode,
    items,
  };
}

function buildLocalPosterPath(category) {
  return `./assets/posters/${category || "archive"}.svg`;
}

function normalizeAssetPath(value) {
  if (!value) {
    return "";
  }

  return value.startsWith("/assets/") ? `.${value}` : value;
}

function createSummary(text, limit = 175) {
  const normalized = String(text || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "No databank description is available for this record yet.";
  }

  if (normalized.length <= limit) {
    return normalized;
  }

  const trimmed = normalized.slice(0, limit);
  const lastSpace = trimmed.lastIndexOf(" ");
  return `${trimmed.slice(0, Math.max(lastSpace, 110)).trim()}...`;
}

function render() {
  if (!state.catalog) {
    renderLoading();
    return;
  }

  renderTabs();
  renderStats();
  renderStatusLine();
  renderSpotlight();
  renderFeed();
}

function renderFeatureGrid(features) {
  const items = Array.isArray(features) ? features : [];
  refs.featureGrid.innerHTML = items
    .map(
      (feature, index) => `
        <article class="system">
          <span class="system__index">${String(index + 1).padStart(2, "0")}</span>
          <h3>${escapeHtml(feature.title)}</h3>
          <p>${escapeHtml(feature.copy)}</p>
        </article>
      `,
    )
    .join("");
}

function renderTabs() {
  const counts = getCountsByCategory();
  const tabs = [
    { key: "all", label: "All signals", count: counts.all },
    ...state.catalog.categories.map((category) => ({
      key: category.key,
      label: category.label,
      count: counts[category.key] || 0,
    })),
  ];

  refs.categoryTabs.innerHTML = tabs
    .map(
      (tab) => `
        <button class="tab ${tab.key === state.activeCategory ? "is-active" : ""}" type="button" data-category="${escapeHtml(tab.key)}">
          ${escapeHtml(tab.label)} (${tab.count})
        </button>
      `,
    )
    .join("");
}

function renderStats() {
  const total = state.catalog.items.length;
  const customCount = state.catalog.items.filter((item) => item.hasCustomSwap).length;
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(state.catalog.fetchedAt));

  const freshnessLabel =
    state.catalog.sourceMode === "snapshot"
      ? "snapshot fallback"
      : `updated ${time}`;

  refs.statsBar.innerHTML = [
    `${total} visible records`,
    `${state.catalog.categories.length} categories`,
    `${customCount} custom droid swaps`,
    freshnessLabel,
  ]
    .map((label) => `<span class="stat-pill">${escapeHtml(label)}</span>`)
    .join("");
}

function renderStatusLine() {
  const visibleItems = getVisibleItems();
  const savedCount = state.favorites.size;
  const activeLabel =
    state.activeCategory === "all"
      ? "all categories"
      : state.catalog.categories.find((category) => category.key === state.activeCategory)?.label || state.activeCategory;

  const parts = [
    `Showing ${visibleItems.length} cards from ${activeLabel}.`,
    `${savedCount} saved favorites.`,
  ];

  if (state.catalog.notice) {
    parts.push(state.catalog.notice);
  }

  refs.statusLine.textContent = parts.join(" ");
}

function renderSpotlight() {
  if (!state.catalog) {
    return;
  }

  ensureSpotlightIsVisible();
  const item = state.catalog.items.find((entry) => entry.id === state.spotlightId) || state.catalog.items[0];

  if (!item) {
    refs.spotlightPanel.innerHTML = `
      <div class="spotlight__loading">
        <p class="eyebrow">Spotlight</p>
        <h2>No signal selected</h2>
        <p>Pick a card below to open its detailed dossier.</p>
      </div>
    `;
    return;
  }

  refs.spotlightPanel.innerHTML = `
    <div class="spotlight__card">
      <div class="spotlight__media">
        <img
          src="${escapeAttribute(item.image || item.fallbackImage || item.hoverImage || "")}"
          data-fallback-src="${escapeAttribute(item.fallbackImage || item.hoverImage || "")}"
          alt="${escapeAttribute(item.name)}"
          loading="lazy"
        />
      </div>
      <div class="spotlight__title">
        <div>
          <p class="eyebrow">Spotlight dossier</p>
          <h2>${escapeHtml(item.name)}</h2>
        </div>
        <span class="meta-pill">${escapeHtml(item.categoryLabel)}</span>
      </div>
      <p class="spotlight__copy">${escapeHtml(item.description)}</p>
      <ul class="spotlight__details">
        <li>
          <strong>Category</strong>
          ${escapeHtml(item.categoryLabel)}
        </li>
        <li>
          <strong>Favorite status</strong>
          ${state.favorites.has(item.id) ? "Saved in vault" : "Not saved yet"}
        </li>
        <li>
          <strong>Source</strong>
          ${escapeHtml(getSourceLabel())}
        </li>
        <li>
          <strong>Droid override</strong>
          ${item.hasCustomSwap ? `Hover unlocks ${escapeHtml(item.hoverLabel)}` : "Not available on this card"}
        </li>
      </ul>
    </div>
  `;
}

function renderFeed() {
  const sections = getVisibleSections();

  if (!sections.length) {
    refs.feed.innerHTML = `
      <section class="panel empty-state">
        <h3>No matching signals</h3>
        <p>Try a different search term, disable Favorites only, or switch back to another category.</p>
      </section>
    `;
    return;
  }

  refs.feed.innerHTML = sections
    .map(
      (section) => `
        <section class="panel category-panel">
          <div class="category-panel__head">
            <div>
              <p class="eyebrow">${escapeHtml(section.label)}</p>
              <h2>${escapeHtml(section.label)} Deck</h2>
              <p>${escapeHtml(section.blurb)}</p>
            </div>
            <span class="category-panel__count">${section.items.length} visible cards</span>
          </div>
          ${
            section.items.length
              ? `<div class="card-grid">${section.items.map(renderCard).join("")}</div>`
              : `
                <div class="empty-state">
                  <h3>No cards in this lane</h3>
                  <p>This category is loaded, but the active filters do not leave any visible cards here.</p>
                </div>
              `
          }
        </section>
      `,
    )
    .join("");
}

function renderCard(item) {
  const favorite = state.favorites.has(item.id);
  const chips = [`<span class="meta-pill">${escapeHtml(getCardSourceLabel())}</span>`];

  if (item.hasCustomSwap) {
    chips.unshift(`<span class="meta-pill">Custom droid art</span>`);
  }

  return `
    <article class="card ${item.hasCustomSwap ? "card--custom" : ""} ${state.highlightedId === item.id ? "card--highlight" : ""}" data-card-id="${escapeAttribute(item.id)}">
      <div class="card__media">
        <img
          class="card__image card__image--base"
          src="${escapeAttribute(item.image || item.fallbackImage || item.hoverImage || "")}"
          data-fallback-src="${escapeAttribute(item.fallbackImage || item.hoverImage || "")}"
          alt="${escapeAttribute(item.name)}"
          loading="lazy"
        />
        ${
          item.hasCustomSwap
            ? `<img class="card__image card__image--custom" src="${escapeAttribute(item.hoverImage)}" alt="${escapeAttribute(item.hoverLabel)} custom illustration" loading="lazy" />`
            : ""
        }
        ${item.hasCustomSwap ? `<span class="swap-badge">Hover for ${escapeHtml(item.hoverLabel)}</span>` : ""}
      </div>
      <div class="card__body">
        <div class="card__topline">
          <span class="meta-pill">${escapeHtml(item.categoryLabel)}</span>
          <button class="favorite-btn ${favorite ? "is-active" : ""}" type="button" data-action="favorite" data-id="${escapeAttribute(item.id)}">
            ${favorite ? "Saved" : "Save"}
          </button>
        </div>
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.summary)}</p>
        <div class="card__meta">${chips.join("")}</div>
        <div class="card__actions">
          <button class="card__action" type="button" data-action="spotlight" data-id="${escapeAttribute(item.id)}">Open dossier</button>
        </div>
      </div>
    </article>
  `;
}

function getSourceLabel() {
  if (state.catalog.sourceMode === "snapshot") {
    return "Bundled snapshot";
  }

  if (state.catalog.sourceMode === "live-direct") {
    return "Direct Star Wars API";
  }

  return "Star Wars API via local proxy";
}

function getCardSourceLabel() {
  if (state.catalog.sourceMode === "snapshot") {
    return "Snapshot";
  }

  if (state.catalog.sourceMode === "live-direct") {
    return "Direct API";
  }

  return "Live API";
}

function renderLoading() {
  refs.statusLine.textContent = IS_FILE_MODE
    ? "Trying the live Star Wars API from local file mode..."
    : "Syncing live Star Wars signals...";

  refs.feed.innerHTML = `
    <section class="panel category-panel">
      <div class="category-panel__head">
        <div>
          <p class="eyebrow">Loading</p>
          <h2>${IS_FILE_MODE ? "Connecting directly to the Databank" : "Connecting to the Databank"}</h2>
          <p>${IS_FILE_MODE ? "This page was opened from disk, so it first tries the public API directly and only falls back to the bundled snapshot if needed." : "The API can take a moment to wake up. The interface stays ready while the feed is loading."}</p>
        </div>
      </div>
      <div class="skeleton-grid">
        ${Array.from({ length: 6 }, () => '<div class="skeleton"></div>').join("")}
      </div>
    </section>
  `;
}

function renderError() {
  refs.statusLine.textContent = "Unable to sync the archive.";
  refs.feed.innerHTML = `
    <section class="panel error-state">
      <h3>Databank connection failed</h3>
      <p>${escapeHtml(state.error || "Unknown error")}</p>
      <button class="btn btn--primary" type="button" data-action="retry">Retry sync</button>
    </section>
  `;
}

function getVisibleSections() {
  if (!state.catalog) {
    return [];
  }

  const categories =
    state.activeCategory === "all"
      ? state.catalog.categories
      : state.catalog.categories.filter((category) => category.key === state.activeCategory);

  return categories.map((category) => ({
    ...category,
    items: sortItems(
      state.catalog.items.filter((item) => item.category === category.key).filter(matchesCurrentFilters),
    ),
  }));
}

function getVisibleItems() {
  if (!state.catalog) {
    return [];
  }

  return sortItems(state.catalog.items.filter(matchesCurrentFilters));
}

function matchesCurrentFilters(item) {
  const searchMatch =
    !state.search ||
    `${item.name} ${item.description} ${item.categoryLabel}`.toLowerCase().includes(state.search);
  const categoryMatch = state.activeCategory === "all" || item.category === state.activeCategory;
  const favoriteMatch = !state.favoritesOnly || state.favorites.has(item.id);
  return searchMatch && categoryMatch && favoriteMatch;
}

function sortItems(items) {
  const next = [...items];

  switch (state.sort) {
    case "name":
      return next.sort((left, right) => left.name.localeCompare(right.name));
    case "lore":
      return next.sort((left, right) => right.description.length - left.description.length);
    case "custom":
      return next.sort(
        (left, right) =>
          Number(right.hasCustomSwap) - Number(left.hasCustomSwap) || left.name.localeCompare(right.name),
      );
    case "featured":
    default: {
      const order = Object.fromEntries(state.catalog.categories.map((category, index) => [category.key, index]));
      return next.sort((left, right) => order[left.category] - order[right.category] || left.name.localeCompare(right.name));
    }
  }
}

function getCountsByCategory() {
  if (!state.catalog) {
    return { all: 0 };
  }

  const counts = { all: 0 };

  for (const category of state.catalog.categories) {
    const count = state.catalog.items
      .filter((item) => item.category === category.key)
      .filter((item) => {
        const searchMatch =
          !state.search ||
          `${item.name} ${item.description} ${item.categoryLabel}`.toLowerCase().includes(state.search);
        const favoriteMatch = !state.favoritesOnly || state.favorites.has(item.id);
        return searchMatch && favoriteMatch;
      }).length;

    counts[category.key] = count;
    counts.all += count;
  }

  return counts;
}

function ensureSpotlightIsVisible() {
  const visibleItems = getVisibleItems();
  if (!visibleItems.length) {
    state.spotlightId = null;
    return;
  }

  const stillVisible = visibleItems.some((item) => item.id === state.spotlightId);
  if (!stillVisible) {
    state.spotlightId = visibleItems[0].id;
  }
}

function toggleFavorite(id) {
  if (!id) {
    return;
  }

  if (state.favorites.has(id)) {
    state.favorites.delete(id);
  } else {
    state.favorites.add(id);
  }

  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...state.favorites]));
  ensureSpotlightIsVisible();
  render();
}

function syncThemeButton() {
  refs.themeBtn.textContent = state.theme === "aurora" ? "Switch to Solar Theme" : "Switch to Aurora Theme";
}

function readStoredArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(value);
  }

  return String(value).replace(/"/g, '\\"');
}
