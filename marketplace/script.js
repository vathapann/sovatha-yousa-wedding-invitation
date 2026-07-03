const UI_TEXT = {
  preview: { en: "Preview", km: "មើលសាកល្បង" },
  buy: { en: "Buy", km: "ទិញ" },
  redirecting: { en: "Redirecting…", km: "កំពុងបញ្ជូន..." },
  checkoutError: {
    en: "Sorry, checkout couldn't start. Please try again or email us.",
    km: "សូមអភ័យទោស ការទូទាត់មិនអាចចាប់ផ្តើមបានទេ។ សូមព្យាយាមម្តងទៀត ឬផ្ញើអ៊ីមែលមកយើង។",
  },
  noResults: {
    en: "No templates match your search.",
    km: "គ្មានគំរូត្រូវនឹងការស្វែងរករបស់អ្នកទេ។",
  },
};

let currentLang = localStorage.getItem("lang") || "en";
let allTemplates = [];
let activeTag = "all";
let searchTerm = "";

function t(key) {
  return UI_TEXT[key][currentLang];
}

function matchesFilter(tpl) {
  const tagOk = activeTag === "all" || (tpl.tags || []).includes(activeTag);
  const term = searchTerm.trim().toLowerCase();
  const textOk =
    !term ||
    tpl.name.toLowerCase().includes(term) ||
    tpl.description.toLowerCase().includes(term);
  return tagOk && textOk;
}

function renderCatalog() {
  const catalog = document.getElementById("catalog");
  const resultCount = document.getElementById("resultCount");
  const visible = allTemplates.filter(matchesFilter);

  resultCount.textContent =
    currentLang === "km"
      ? `${visible.length} នៃ ${allTemplates.length}`
      : `${visible.length} of ${allTemplates.length}`;

  if (visible.length === 0) {
    catalog.innerHTML = `<p class="no-results">${t("noResults")}</p>`;
    return;
  }

  catalog.innerHTML = "";
  for (const tpl of visible) {
    const description = currentLang === "km" ? tpl.descriptionKm || tpl.description : tpl.description;
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <a class="card-preview-link" style="background:linear-gradient(rgba(0,0,0,.18),rgba(0,0,0,.32)), ${tpl.accent}" href="${tpl.previewUrl}" target="_blank" rel="noopener">
        ${tpl.name}
      </a>
      <div class="card-body">
        <h2>${tpl.name}</h2>
        <p>${description}</p>
        <div class="card-footer">
          <span class="price">${tpl.price}</span>
          <div class="card-actions">
            <a class="preview-btn" href="${tpl.previewUrl}" target="_blank" rel="noopener">${t("preview")}</a>
            <button class="buy-btn" data-template-id="${tpl.id}">${t("buy")}</button>
          </div>
        </div>
      </div>
    `;
    catalog.appendChild(card);
  }
}

async function loadCatalog() {
  allTemplates = await fetch("/templates.json").then((res) => res.json());
  renderCatalog();

  document.getElementById("catalog").addEventListener("click", async (event) => {
    const button = event.target.closest(".buy-btn");
    if (!button) return;

    button.disabled = true;
    button.textContent = t("redirecting");

    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: button.dataset.templateId }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      console.error(err);
      alert(t("checkoutError"));
      button.disabled = false;
      button.textContent = t("buy");
    }
  });
}

function setupSearchAndChips() {
  document.getElementById("templateSearch").addEventListener("input", (event) => {
    searchTerm = event.target.value;
    renderCatalog();
  });

  document.getElementById("chipsRow").addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip) return;
    document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    activeTag = chip.dataset.tag;
    renderCatalog();
  });
}

function setupNavHighlight() {
  const navLinks = document.querySelectorAll(".nav-link");
  const sections = ["home", "templates", "features", "offer"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => {
          link.classList.toggle("active", link.dataset.nav === entry.target.id);
        });
      });
    },
    { rootMargin: "-40% 0px -50% 0px" }
  );

  sections.forEach((section) => io.observe(section));
}

function applyStaticTranslations() {
  document.documentElement.lang = currentLang;
  document.body.classList.toggle("km", currentLang === "km");

  document.querySelectorAll("[data-en]").forEach((el) => {
    const value = el.getAttribute(`data-${currentLang}`);
    if (value !== null) el.innerHTML = value;
  });

  document.querySelectorAll("[data-en-placeholder]").forEach((el) => {
    const value = el.getAttribute(`data-${currentLang}-placeholder`);
    if (value !== null) el.placeholder = value;
  });
}

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem("lang", lang);
  applyStaticTranslations();
  if (allTemplates.length) renderCatalog();
}

function setupLangToggle() {
  document.getElementById("langToggle").addEventListener("click", () => {
    setLang(currentLang === "en" ? "km" : "en");
  });
}

applyStaticTranslations();
loadCatalog();
setupSearchAndChips();
setupNavHighlight();
setupLangToggle();
