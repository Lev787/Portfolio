const hoverArts = [
  "./assets/hover-cats/cat-1.svg",
  "./assets/hover-cats/cat-2.svg",
  "./assets/hover-cats/cat-3.svg",
  "./assets/hover-cats/cat-4.svg",
  "./assets/hover-cats/cat-5.svg"
];

const CAT_API_BASE = "https://api.thecatapi.com/v1";
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const DEFAULT_API_KEY = "DEMO-API-KEY";

const storageKeys = {
  favorites: "cat-atlas:favorites",
  theme: "cat-atlas:theme",
  layout: "cat-atlas:layout",
  catCache: "cat-atlas:cat-cache"
};

const collator = new Intl.Collator("en", { sensitivity: "base" });
const apiKey = String(window.CAT_ATLAS_CONFIG?.catApiKey || DEFAULT_API_KEY).trim();

const state = {
  cats: [],
  favorites: new Set(readJson(storageKeys.favorites, [])),
  filters: {
    searchText: "",
    origin: "all",
    temperament: "all",
    sort: "name",
    favoritesOnly: false
  },
  theme: readStorage(storageKeys.theme, "sunset"),
  layout: readStorage(storageKeys.layout, "cozy"),
  loading: true,
  error: "",
  highlightedId: "",
  apiMeta: {
    source: "The Cat API",
    updatedAt: "",
    stale: false,
    warning: "",
    fromCache: false
  }
};

const elements = {
  searchInput: document.querySelector("#searchInput"),
  originSelect: document.querySelector("#originSelect"),
  temperamentSelect: document.querySelector("#temperamentSelect"),
  sortSelect: document.querySelector("#sortSelect"),
  favoritesOnly: document.querySelector("#favoritesOnly"),
  themeToggle: document.querySelector("#themeToggle"),
  layoutToggle: document.querySelector("#layoutToggle"),
  surpriseButton: document.querySelector("#surpriseButton"),
  refreshButton: document.querySelector("#refreshButton"),
  resetButton: document.querySelector("#resetButton"),
  stats: document.querySelector("#stats"),
  apiNote: document.querySelector("#apiNote"),
  cardsGrid: document.querySelector("#cardsGrid"),
  modalBackdrop: document.querySelector("#modalBackdrop"),
  modalContent: document.querySelector("#modalContent"),
  modalClose: document.querySelector("#modalClose"),
  toast: document.querySelector("#toast")
};

let toastTimer = 0;

initialize();

function initialize() {
  applyPreferences();
  syncControls();
  bindEvents();

  const cachedPayload = getCachedPayload();
  if (cachedPayload) {
    hydrateFromPayload(cachedPayload, true);
  }

  render();

  if (!cachedPayload) {
    loadCats();
  }
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.filters.searchText = event.target.value;
    render();
  });

  elements.originSelect.addEventListener("change", (event) => {
    state.filters.origin = event.target.value;
    render();
  });

  elements.temperamentSelect.addEventListener("change", (event) => {
    state.filters.temperament = event.target.value;
    render();
  });

  elements.sortSelect.addEventListener("change", (event) => {
    state.filters.sort = event.target.value;
    render();
  });

  elements.favoritesOnly.addEventListener("change", (event) => {
    state.filters.favoritesOnly = event.target.checked;
    render();
  });

  elements.themeToggle.addEventListener("click", () => {
    state.theme = state.theme === "sunset" ? "moonlight" : "sunset";
    writeStorage(storageKeys.theme, state.theme);
    applyPreferences();
  });

  elements.layoutToggle.addEventListener("click", () => {
    state.layout = state.layout === "cozy" ? "compact" : "cozy";
    writeStorage(storageKeys.layout, state.layout);
    applyPreferences();
  });

  elements.surpriseButton.addEventListener("click", () => {
    spotlightRandomCat();
  });

  elements.refreshButton.addEventListener("click", () => {
    loadCats(true);
  });

  elements.resetButton.addEventListener("click", () => {
    state.filters = {
      searchText: "",
      origin: "all",
      temperament: "all",
      sort: "name",
      favoritesOnly: false
    };
    syncControls();
    render();
  });

  elements.cardsGrid.addEventListener("click", async (event) => {
    const actionTarget = event.target.closest("[data-action]");

    if (!actionTarget) {
      return;
    }

    const catId = actionTarget.getAttribute("data-id");
    const action = actionTarget.getAttribute("data-action");
    const cat = getCatById(catId);

    if (action === "retry") {
      loadCats(true);
      return;
    }

    if (!cat) {
      return;
    }

    if (action === "favorite") {
      toggleFavorite(catId);
      return;
    }

    if (action === "details") {
      openDetails(cat);
      return;
    }

    if (action === "copy") {
      const copied = await copyText(buildFactLine(cat));
      showToast(copied ? `Copied a fact about ${cat.name}.` : "Copy is not available in this browser.");
    }
  });

  elements.cardsGrid.addEventListener("mouseover", (event) => {
    const image = event.target.closest("img[data-hover-src]");

    if (!image || image.dataset.artistMode === "on") {
      return;
    }

    image.dataset.artistMode = "on";
    image.src = image.dataset.hoverSrc;
    image.classList.add("artist-mode");

    const hint = image.parentElement?.querySelector(".hover-hint");
    if (hint) {
      hint.textContent = "Artist mode on";
    }
  });

  elements.cardsGrid.addEventListener("mouseout", (event) => {
    const image = event.target.closest("img[data-hover-src]");

    if (!image || image.dataset.artistMode !== "on") {
      return;
    }

    image.dataset.artistMode = "off";
    image.src = image.dataset.originalSrc;
    image.classList.remove("artist-mode");

    const hint = image.parentElement?.querySelector(".hover-hint");
    if (hint) {
      hint.textContent = "Hover for artist mode";
    }
  });

  elements.modalClose.addEventListener("click", closeDetails);

  elements.modalBackdrop.addEventListener("click", (event) => {
    if (event.target === elements.modalBackdrop) {
      closeDetails();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeDetails();
    }
  });
}

async function loadCats(forceRefresh = false) {
  state.error = "";

  if (!forceRefresh && state.cats.length > 0) {
    state.loading = false;
  } else {
    state.loading = state.cats.length === 0;
  }

  render();

  try {
    const payload = await fetchCatsFromApi();
    hydrateFromPayload(payload, false);
    writeStorage(storageKeys.catCache, payload);
    render();
    showToast(forceRefresh ? "Fresh cat data loaded." : "Cat data loaded from The Cat API.");
  } catch (error) {
    state.loading = false;
    state.error =
      error.message ||
      "Unable to reach The Cat API right now. Add your own API key in public/config.js for better reliability.";
    state.apiMeta.warning = state.error;
    render();
  }
}

async function fetchCatsFromApi() {
  const breeds = await fetchJson(`${CAT_API_BASE}/breeds`);
  const breedsWithImages = breeds.filter((breed) => breed.reference_image_id);
  const cats = await mapWithConcurrency(breedsWithImages, 8, async (breed, index) => {
    try {
      const imagePayload = await fetchJson(`${CAT_API_BASE}/images/${breed.reference_image_id}`);
      return normalizeBreed(breed, imagePayload.url || "", index);
    } catch (error) {
      return null;
    }
  });

  const payload = {
    cats: cats
      .filter((cat) => cat?.imageUrl)
      .sort((left, right) => left.name.localeCompare(right.name, "en", { sensitivity: "base" })),
    source: "The Cat API",
    stale: false,
    updatedAt: new Date().toISOString(),
    warning: apiKey === DEFAULT_API_KEY ? "Using the public demo API key. Add your own free key in public/config.js for better reliability." : ""
  };

  return payload;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: buildApiHeaders()
  });

  const text = await response.text();
  const payload = safeParseJson(text);

  if (!response.ok) {
    const details = payload?.message || payload?.error || `The Cat API responded with ${response.status}.`;
    throw new Error(details);
  }

  return payload;
}

function buildApiHeaders() {
  const headers = {};

  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  return headers;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (currentIndex < items.length) {
      const itemIndex = currentIndex;
      currentIndex += 1;
      results[itemIndex] = await mapper(items[itemIndex], itemIndex);
    }
  });

  await Promise.all(workers);
  return results;
}

function hydrateFromPayload(payload, fromCache) {
  state.cats = payload.cats.map((cat) => ({
    ...cat,
    hoverArt: cat.hoverArt || randomItem(hoverArts)
  }));
  state.loading = false;
  state.error = "";
  state.apiMeta = {
    source: payload.source || "The Cat API",
    updatedAt: payload.updatedAt || "",
    stale: Boolean(payload.stale),
    warning: payload.warning || "",
    fromCache
  };
  populateSelectOptions();
}

function getCachedPayload() {
  const cached = readJson(storageKeys.catCache, null);

  if (!cached || !Array.isArray(cached.cats) || !cached.updatedAt) {
    return null;
  }

  const age = Date.now() - new Date(cached.updatedAt).getTime();
  if (!Number.isFinite(age) || age > CACHE_TTL_MS) {
    return null;
  }

  return cached;
}

function parseLifeSpan(rangeText) {
  const values = String(rangeText || "")
    .split("-")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter(Number.isFinite);

  if (values.length === 0) {
    return { min: null, max: null, average: null };
  }

  if (values.length === 1) {
    return { min: values[0], max: values[0], average: values[0] };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  return {
    min,
    max,
    average: Number(((min + max) / 2).toFixed(1))
  };
}

function normalizeBreed(breed, imageUrl, index) {
  const lifeSpan = parseLifeSpan(breed.life_span);
  const temperamentList = String(breed.temperament || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    id: breed.id || `breed-${index}`,
    name: breed.name || "Unknown Breed",
    altNames: breed.alt_names || "",
    origin: breed.origin || "Unknown",
    countryCode: breed.country_code || "",
    description: breed.description || "No description provided.",
    temperament: breed.temperament || "Unknown",
    temperamentList,
    lifeSpan: breed.life_span || "Unknown",
    lifeSpanMin: lifeSpan.min,
    lifeSpanMax: lifeSpan.max,
    lifeSpanAverage: lifeSpan.average,
    weightMetric: breed.weight?.metric || "Unknown",
    intelligence: Number(breed.intelligence || 0),
    affectionLevel: Number(breed.affection_level || 0),
    energyLevel: Number(breed.energy_level || 0),
    adaptability: Number(breed.adaptability || 0),
    childFriendly: Number(breed.child_friendly || 0),
    dogFriendly: Number(breed.dog_friendly || 0),
    hypoallergenic: Boolean(breed.hypoallergenic),
    rare: Boolean(breed.rare),
    indoor: Number(breed.indoor || 0),
    wikipediaUrl: breed.wikipedia_url || "",
    imageUrl,
    hoverArt: randomItem(hoverArts)
  };
}

function populateSelectOptions() {
  const originOptions = [...new Set(state.cats.map((cat) => cat.origin).filter(Boolean))].sort(collator.compare);
  const temperamentOptions = [...new Set(state.cats.flatMap((cat) => cat.temperamentList))].sort(collator.compare);

  updateSelect(elements.originSelect, "All origins", originOptions, state.filters.origin);
  updateSelect(elements.temperamentSelect, "All temperaments", temperamentOptions, state.filters.temperament);
}

function updateSelect(select, allLabel, options, currentValue) {
  const safeValue = options.includes(currentValue) ? currentValue : "all";

  if (select === elements.originSelect) {
    state.filters.origin = safeValue;
  }

  if (select === elements.temperamentSelect) {
    state.filters.temperament = safeValue;
  }

  select.innerHTML = [
    `<option value="all">${escapeHtml(allLabel)}</option>`,
    ...options.map((option) => `<option value="${escapeAttribute(option)}">${escapeHtml(option)}</option>`)
  ].join("");
  select.value = safeValue;
}

function render() {
  applyPreferences();
  syncControls();

  const visibleCats = getVisibleCats();
  renderStats(visibleCats);
  renderStatus(visibleCats);
  renderCards(visibleCats);
}

function renderStatus(visibleCats) {
  if (state.loading && state.cats.length === 0) {
    elements.apiNote.textContent = "Loading cat data from The Cat API...";
    return;
  }

  if (state.error && state.cats.length === 0) {
    elements.apiNote.textContent = state.error;
    return;
  }

  const updatedAt = state.apiMeta.updatedAt
    ? `Last synced ${new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(state.apiMeta.updatedAt))}`
    : "Waiting for the first sync";

  const notes = [
    state.apiMeta.source || "The Cat API",
    updatedAt,
    state.apiMeta.fromCache ? "Loaded from local cache for speed" : "Fetched directly in the browser",
    state.apiMeta.warning,
    visibleCats.length === 0 ? "Try widening your filters to discover more cats." : ""
  ].filter(Boolean);

  elements.apiNote.textContent = notes.join(" • ");
}

function renderStats(visibleCats) {
  const favoriteCount = state.cats.filter((cat) => state.favorites.has(cat.id)).length;
  const originCount = new Set(visibleCats.map((cat) => cat.origin)).size;
  const averageIntelligence = visibleCats.length
    ? (visibleCats.reduce((sum, cat) => sum + Number(cat.intelligence || 0), 0) / visibleCats.length).toFixed(1)
    : "0.0";

  elements.stats.innerHTML = [
    statCard("Loaded breeds", String(state.cats.length)),
    statCard("Visible cards", String(visibleCats.length)),
    statCard("Favorites saved", String(favoriteCount)),
    statCard("Avg. intelligence", `${averageIntelligence} / 5`),
    statCard("Visible origins", String(originCount))
  ].join("");
}

function statCard(label, value) {
  return `
    <div class="stat-card">
      <span class="stat-label">${escapeHtml(label)}</span>
      <span class="stat-value">${escapeHtml(value)}</span>
    </div>
  `;
}

function renderCards(visibleCats) {
  if (state.loading && state.cats.length === 0) {
    elements.cardsGrid.innerHTML = createSkeletons(6);
    return;
  }

  if (state.error && state.cats.length === 0) {
    elements.cardsGrid.innerHTML = `
      <div class="error-state">
        <h3>Cat radar needs a refresh</h3>
        <p>The browser could not reach The Cat API right now. Add your API key in public/config.js and try again.</p>
        <button class="primary-action pill-button accent" type="button" data-action="retry">Try again</button>
      </div>
    `;
    return;
  }

  if (visibleCats.length === 0) {
    elements.cardsGrid.innerHTML = `
      <div class="empty-state">
        <h3>No cats match these filters</h3>
        <p>Reset the filters, switch off favorites-only mode, or press Surprise me for a new direction.</p>
      </div>
    `;
    return;
  }

  elements.cardsGrid.innerHTML = visibleCats.map(renderCard).join("");
}

function renderCard(cat) {
  const isFavorite = state.favorites.has(cat.id);
  const chips = cat.temperamentList.slice(0, 4).map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("");

  return `
    <article class="cat-card ${state.highlightedId === cat.id ? "spotlight" : ""}" data-card-id="${escapeAttribute(cat.id)}">
      <div class="image-shell">
        <img
          class="cat-image"
          src="${escapeAttribute(cat.imageUrl)}"
          alt="Portrait of ${escapeAttribute(cat.name)}"
          loading="lazy"
          data-hover-src="${escapeAttribute(cat.hoverArt)}"
          data-original-src="${escapeAttribute(cat.imageUrl)}"
          data-artist-mode="off"
        >
        <span class="hover-hint">Hover for artist mode</span>
      </div>

      <div class="card-body">
        <div class="card-header">
          <div class="card-title-block">
            <h3>${escapeHtml(cat.name)}</h3>
            <span class="origin-line">${escapeHtml(cat.origin)}${cat.countryCode ? ` • ${escapeHtml(cat.countryCode)}` : ""}</span>
          </div>

          <button
            class="favorite-button ${isFavorite ? "is-active" : ""}"
            type="button"
            data-action="favorite"
            data-id="${escapeAttribute(cat.id)}"
            aria-label="${isFavorite ? "Remove from favorites" : "Add to favorites"}"
          >
            ${isFavorite ? "♥" : "♡"}
          </button>
        </div>

        <p class="description">${escapeHtml(truncate(cat.description, 150))}</p>

        <div class="chip-row">
          ${chips}
        </div>

        <div class="metric-grid">
          ${metricCard("Intelligence", cat.intelligence)}
          ${metricCard("Affection", cat.affectionLevel)}
          ${metricCard("Energy", cat.energyLevel)}
          ${metricCard("Adaptability", cat.adaptability)}
        </div>

        <div class="meta-row">
          ${metaPill("Life span", `${escapeHtml(cat.lifeSpan)} years`)}
          ${metaPill("Weight", `${escapeHtml(cat.weightMetric)} kg`)}
          ${metaPill("Child friendly", `${escapeHtml(String(cat.childFriendly || 0))} / 5`)}
          ${metaPill("Dog friendly", `${escapeHtml(String(cat.dogFriendly || 0))} / 5`)}
        </div>

        <div class="card-actions">
          <button class="secondary-button" type="button" data-action="details" data-id="${escapeAttribute(cat.id)}">
            More details
          </button>
          <button class="ghost-button" type="button" data-action="copy" data-id="${escapeAttribute(cat.id)}">
            Copy fact
          </button>
          ${
            cat.wikipediaUrl
              ? `<a class="modal-link" href="${escapeAttribute(cat.wikipediaUrl)}" target="_blank" rel="noreferrer">Wikipedia</a>`
              : `<span class="modal-link" aria-hidden="true">No wiki</span>`
          }
        </div>
      </div>
    </article>
  `;
}

function metricCard(title, value) {
  const safeValue = Number(value || 0);
  const fillPercent = Math.max(0, Math.min(100, safeValue * 20));

  return `
    <div class="metric-card">
      <span class="metric-title">${escapeHtml(title)}</span>
      <div class="meter-row">
        <div class="meter-track">
          <div class="meter-fill" style="width: ${fillPercent}%"></div>
        </div>
        <span class="meter-value">${escapeHtml(String(safeValue))}/5</span>
      </div>
    </div>
  `;
}

function metaPill(label, value) {
  return `
    <div class="meta-pill">
      <span class="meta-label">${escapeHtml(label)}</span>
      <span class="meta-value">${value}</span>
    </div>
  `;
}

function createSkeletons(count) {
  return Array.from({ length: count }, () => `
    <div class="skeleton-card" aria-hidden="true">
      <div class="skeleton-image skeleton-block"></div>
      <div class="skeleton-body">
        <div class="skeleton-line short skeleton-block"></div>
        <div class="skeleton-line medium skeleton-block"></div>
        <div class="skeleton-line long skeleton-block"></div>
        <div class="skeleton-line long skeleton-block"></div>
      </div>
    </div>
  `).join("");
}

function getVisibleCats() {
  const searchText = state.filters.searchText.trim().toLowerCase();
  const filtered = state.cats.filter((cat) => {
    if (state.filters.favoritesOnly && !state.favorites.has(cat.id)) {
      return false;
    }

    if (state.filters.origin !== "all" && cat.origin !== state.filters.origin) {
      return false;
    }

    if (state.filters.temperament !== "all" && !cat.temperamentList.includes(state.filters.temperament)) {
      return false;
    }

    if (!searchText) {
      return true;
    }

    const searchable = [
      cat.name,
      cat.altNames,
      cat.origin,
      cat.temperament,
      cat.description
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchable.includes(searchText);
  });

  return filtered.sort(compareCats);
}

function compareCats(left, right) {
  switch (state.filters.sort) {
    case "intelligence":
      return compareNumbers(right.intelligence, left.intelligence) || collator.compare(left.name, right.name);
    case "affection":
      return compareNumbers(right.affectionLevel, left.affectionLevel) || collator.compare(left.name, right.name);
    case "energy":
      return compareNumbers(right.energyLevel, left.energyLevel) || collator.compare(left.name, right.name);
    case "life-span":
      return compareNumbers(right.lifeSpanAverage || 0, left.lifeSpanAverage || 0) || collator.compare(left.name, right.name);
    case "name":
    default:
      return collator.compare(left.name, right.name);
  }
}

function compareNumbers(left, right) {
  return Number(left || 0) - Number(right || 0);
}

function toggleFavorite(catId) {
  if (state.favorites.has(catId)) {
    state.favorites.delete(catId);
  } else {
    state.favorites.add(catId);
  }

  writeStorage(storageKeys.favorites, [...state.favorites]);
  render();
}

function getCatById(catId) {
  return state.cats.find((cat) => cat.id === catId);
}

function openDetails(cat) {
  const chips = cat.temperamentList.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("");
  elements.modalContent.innerHTML = `
    <div class="modal-layout">
      <img src="${escapeAttribute(cat.imageUrl)}" alt="Portrait of ${escapeAttribute(cat.name)}">

      <div class="modal-copy">
        <p class="eyebrow">Detailed profile</p>
        <h3 id="modalTitle">${escapeHtml(cat.name)}</h3>
        <p class="origin-line">${escapeHtml(cat.origin)}${cat.countryCode ? ` • ${escapeHtml(cat.countryCode)}` : ""}</p>
        <p class="modal-description">${escapeHtml(cat.description)}</p>

        <div class="chip-row">
          ${chips}
        </div>

        <div class="metric-grid">
          ${metricCard("Intelligence", cat.intelligence)}
          ${metricCard("Affection", cat.affectionLevel)}
          ${metricCard("Energy", cat.energyLevel)}
          ${metricCard("Indoor preference", cat.indoor)}
        </div>

        <div class="meta-row">
          ${metaPill("Life span", `${escapeHtml(cat.lifeSpan)} years`)}
          ${metaPill("Weight", `${escapeHtml(cat.weightMetric)} kg`)}
          ${metaPill("Hypoallergenic", cat.hypoallergenic ? "Yes" : "No")}
          ${metaPill("Rare breed", cat.rare ? "Yes" : "No")}
        </div>

        <div class="modal-actions">
          <button class="secondary-button" type="button" id="modalCopyFact">Copy fact</button>
          ${
            cat.wikipediaUrl
              ? `<a class="modal-link" href="${escapeAttribute(cat.wikipediaUrl)}" target="_blank" rel="noreferrer">Open Wikipedia</a>`
              : ""
          }
        </div>
      </div>
    </div>
  `;

  const copyButton = document.querySelector("#modalCopyFact");
  if (copyButton) {
    copyButton.addEventListener("click", async () => {
      const copied = await copyText(buildFactLine(cat));
      showToast(copied ? `Copied a fact about ${cat.name}.` : "Copy is not available in this browser.");
    });
  }

  elements.modalBackdrop.classList.remove("hidden");
  elements.modalBackdrop.setAttribute("aria-hidden", "false");
}

function closeDetails() {
  elements.modalBackdrop.classList.add("hidden");
  elements.modalBackdrop.setAttribute("aria-hidden", "true");
}

function spotlightRandomCat() {
  const visibleCats = getVisibleCats();

  if (visibleCats.length === 0) {
    showToast("No visible cat is available for a surprise right now.");
    return;
  }

  const luckyCat = randomItem(visibleCats);
  state.highlightedId = luckyCat.id;
  render();

  const card = document.querySelector(`[data-card-id="${CSS.escape(luckyCat.id)}"]`);
  if (card) {
    card.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  showToast(`Surprise pick: ${luckyCat.name}.`);

  window.setTimeout(() => {
    if (state.highlightedId === luckyCat.id) {
      state.highlightedId = "";
      render();
    }
  }, 2600);
}

function applyPreferences() {
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.dataset.layout = state.layout;
  elements.themeToggle.textContent = `Theme: ${state.theme === "sunset" ? "Sunset" : "Moonlight"}`;
  elements.layoutToggle.textContent = `Layout: ${state.layout === "cozy" ? "Cozy" : "Compact"}`;
}

function syncControls() {
  elements.searchInput.value = state.filters.searchText;
  elements.originSelect.value = state.filters.origin;
  elements.temperamentSelect.value = state.filters.temperament;
  elements.sortSelect.value = state.filters.sort;
  elements.favoritesOnly.checked = state.filters.favoritesOnly;
}

function buildFactLine(cat) {
  return `${cat.name} is a cat breed from ${cat.origin}. It typically lives ${cat.lifeSpan} years and is known for being ${cat.temperament.toLowerCase()}.`;
}

function truncate(text, maxLength) {
  if (!text || text.length <= maxLength) {
    return text || "";
  }

  return `${text.slice(0, maxLength - 1).trimEnd()}...`;
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function safeParseJson(text) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("visible");
  }, 2200);
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    void error;
  }

  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("readonly", "true");
  helper.style.position = "absolute";
  helper.style.left = "-9999px";
  document.body.append(helper);
  helper.select();

  let copied = false;

  try {
    copied = document.execCommand("copy");
  } catch (error) {
    copied = false;
  }

  helper.remove();
  return copied;
}

function readStorage(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch (error) {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    const safeValue = typeof value === "string" ? value : JSON.stringify(value);
    localStorage.setItem(key, safeValue);
  } catch (error) {
    void error;
  }
}

function readJson(key, fallback) {
  try {
    const rawValue = localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallback;
  } catch (error) {
    return fallback;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
