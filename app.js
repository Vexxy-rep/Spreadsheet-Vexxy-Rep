// app.js - Version finale
// - Recherche globale (section "Résultats")
// - Pagination par catégorie (12 items)
// - Tutoriels exclus (no pagination, vidéos embed)
// - Copy link handlers
// - Report button (send simple message to Discord webhook)
// - Theme toggle (light/dark) persisted in localStorage

/* ============= CONFIG ============= */
const ITEMS_PER_PAGE = 12;
// Replace the placeholder with your actual Discord webhook URL
const WEBHOOK_URL = "https://discord.com/api/webhooks/1427636102478430374/co7wpqeFAWV2H9mIE0toUALYavPkqcg02bl54fDZMoYvxWqzux1gDeLn8uwOeK0Kz4EO";

/* ============= DOM refs ============= */
const categoriesList = document.getElementById('categoriesList');
const allSections = Array.from(document.querySelectorAll('.cards-section'));
const pagination = document.getElementById('pagination');
const searchInput = document.getElementById('searchInput');
const clearSearch = document.getElementById('clearSearch');
const tutorialBtn = document.getElementById('tutorialBtn');
const yearSpan = document.getElementById('year');
const themeToggle = document.getElementById('themeToggle');
const mainContainer = document.querySelector('main.container');

if (yearSpan) yearSpan.textContent = new Date().getFullYear();

/* ============= Ensure search-results section exists ============= */
let searchResultsSection = document.getElementById('search-results');
let searchResultsContainer = document.getElementById('search-results-container');

if (!searchResultsSection) {
  searchResultsSection = document.createElement('section');
  searchResultsSection.className = 'cards-section';
  searchResultsSection.id = 'search-results';
  searchResultsSection.style.display = 'none';
  searchResultsSection.innerHTML = `
    <h2 class="section-title">Résultats de recherche</h2>
    <div class="cards-grid-inner" id="search-results-container"></div>
  `;
  if (pagination && pagination.parentNode) {
    mainContainer.insertBefore(searchResultsSection, pagination);
  } else {
    mainContainer.appendChild(searchResultsSection);
  }
  searchResultsContainer = document.getElementById('search-results-container');
} else {
  searchResultsContainer = document.getElementById('search-results-container');
}

/* ============= Build categories ============= */
const CATEGORIES = allSections.map(sec => {
  const id = sec.dataset.category || sec.id || '';
  const heading = (sec.querySelector('.section-title') && sec.querySelector('.section-title').textContent.trim()) || id || 'Catégorie';
  return { id, name: heading, section: sec };
});

/* ============= State ============= */
let currentCategory = CATEGORIES.length ? CATEGORIES[0].id : null;
let currentPage = 1;
let currentQuery = '';

/* ============= Utilities: toast ============= */
let toastTimer = null;
function showToast(msg, isError = false) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.className = isError ? 'toast toast-error' : 'toast';
  t.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ''; t.textContent = ''; }, 2400);
}

/* ============= Copy link handlers ============= */
function attachCopyHandlers(scope = document) {
  const buttons = Array.from(scope.querySelectorAll('.copy-link'));
  buttons.forEach(btn => {
    btn.removeEventListener('click', copyHandler);
    btn.addEventListener('click', copyHandler);
  });
}
function copyHandler(e) {
  const link = e.currentTarget.dataset.link;
  if (!link) return;
  navigator.clipboard.writeText(link).then(() => showToast('Lien copié ✅')).catch(() => showToast('Impossible de copier', true));
  e.stopPropagation();
}

/* ============= Report (Discord webhook) ============= */
function attachReportHandlers(scope = document) {
  const reportButtons = Array.from(scope.querySelectorAll('.report-btn'));
  reportButtons.forEach(btn => {
    // avoid double-binding
    btn.removeEventListener('click', reportHandler);
    btn.addEventListener('click', reportHandler);
  });
}
function reportHandler(e) {
  const btn = e.currentTarget;
  const title = btn.dataset.title || btn.closest('.card')?.querySelector('.card-title')?.textContent || "Titre inconnu";
  const link = btn.dataset.link || btn.closest('.card')?.querySelector('.copy-link')?.dataset.link || "Lien inconnu";

  // Simple payload: plain content message
  const payload = {
    content: `⚠️ **Lien signalé <@&1426981224668463137>**\n**Titre :** ${title}\n**Lien :** ${link}`
  };

  // send
  fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  .then(res => {
    if (res.ok) {
      showToast('Signalement envoyé ✅');
    } else {
      showToast('Erreur lors de l\'envoi ❌', true);
    }
  })
  .catch(() => showToast('Impossible de contacter le webhook ❌', true));
  e.stopPropagation();
}

/* ============= Render category tabs ============= */
function renderCategoryTabs() {
  if (!categoriesList) return;
  categoriesList.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const li = document.createElement('li');
    li.className = 'category-item' + (cat.id === currentCategory ? ' active' : '');
    li.dataset.cat = cat.id;
    li.tabIndex = 0;
    li.innerHTML = `<button class="cat-btn">${cat.name}</button>`;
    li.addEventListener('click', () => selectCategory(cat.id));
    li.addEventListener('keydown', e => { if (e.key === 'Enter') selectCategory(cat.id); });
    categoriesList.appendChild(li);
  });
}

/* ============= Select category ============= */
function selectCategory(catId) {
  clearSearchAndResults();
  currentCategory = catId;
  currentPage = 1;
  renderCategoryTabs();
  renderSection();
  window.scrollTo({ top: mainContainer.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
}

/* ============= Render section ============= */
function renderSection() {
  // hide all, hide results
  allSections.forEach(sec => sec.classList.remove('active'));
  hideSearchResults();

  const activeSection = allSections.find(s => s.dataset.category === currentCategory);
  if (!activeSection) return;
  activeSection.classList.add('active');

  // tutorial: show all tutorial cards, no pagination
  if (activeSection.classList.contains('tutorial-section')) {
    pagination && (pagination.innerHTML = '');
    const tutorials = Array.from(activeSection.querySelectorAll('.card-tutorial'));
    tutorials.forEach(t => t.style.display = '');
    // attach handlers (if any) - tutorials don't have report/copy buttons typically
    attachCopyHandlers(activeSection);
    attachReportHandlers(activeSection);
    return;
  }

  // normal categories: paginate cards
  const cards = Array.from(activeSection.querySelectorAll('.cards-grid-inner > article.card'));
  const filtered = cards.filter(() => true);
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  if (currentPage > totalPages) currentPage = totalPages;

  cards.forEach(c => c.style.display = 'none');
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const visible = filtered.slice(start, start + ITEMS_PER_PAGE);
  visible.forEach(c => c.style.display = '');
  renderPagination(totalPages);

  // attach handlers in active section
  attachCopyHandlers(activeSection);
  attachReportHandlers(activeSection);
}

/* ============= Pagination ============= */
function renderPagination(totalPages) {
  if (!pagination) return;
  pagination.innerHTML = '';
  if (totalPages <= 1) return;

  const prev = document.createElement('button');
  prev.className = 'page-btn';
  prev.textContent = '‹';
  prev.disabled = currentPage <= 1;
  prev.addEventListener('click', () => { currentPage = Math.max(1, currentPage - 1); renderSection(); });
  pagination.appendChild(prev);

  const windowSize = 5;
  let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
  let end = Math.min(totalPages, start + windowSize - 1);
  if (end - start < windowSize - 1) start = Math.max(1, end - windowSize + 1);

  if (start > 1) {
    pagination.appendChild(makePageButton(1));
    if (start > 2) { const e = document.createElement('span'); e.className = 'ellipsis'; e.textContent = '…'; pagination.appendChild(e); }
  }

  for (let p = start; p <= end; p++) pagination.appendChild(makePageButton(p));

  if (end < totalPages) {
    if (end < totalPages - 1) { const e = document.createElement('span'); e.className = 'ellipsis'; e.textContent = '…'; pagination.appendChild(e); }
    pagination.appendChild(makePageButton(totalPages));
  }

  const next = document.createElement('button');
  next.className = 'page-btn';
  next.textContent = '›';
  next.disabled = currentPage >= totalPages;
  next.addEventListener('click', () => { currentPage = Math.min(totalPages, currentPage + 1); renderSection(); });
  pagination.appendChild(next);
}
function makePageButton(p) {
  const btn = document.createElement('button');
  btn.className = 'page-btn' + (p === currentPage ? ' active' : '');
  btn.textContent = String(p);
  btn.addEventListener('click', () => { currentPage = p; renderSection(); });
  return btn;
}

/* ============= Global search (Option 2) ============= */
function searchAllCards(query) {
  const q = (query || '').trim().toLowerCase();
  currentQuery = q;

  if (!q) {
    hideSearchResults();
    renderSection();
    return;
  }

  // gather candidates from all normal sections
  const candidates = [];
  allSections.forEach(section => {
    if (section.classList.contains('tutorial-section')) return;
    const cards = Array.from(section.querySelectorAll('.cards-grid-inner > article.card'));
    cards.forEach(card => {
      const titleEl = card.querySelector('.card-title');
      const descEl = card.querySelector('.card-desc');
      const title = titleEl ? titleEl.textContent.trim().toLowerCase() : '';
      const desc = descEl ? descEl.textContent.trim().toLowerCase() : '';
      if (title.includes(q) || desc.includes(q)) {
        candidates.push({ card, section });
      }
    });
  });

  if (!searchResultsSection || !searchResultsContainer) return;
  searchResultsContainer.innerHTML = '';

  if (candidates.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'no-results';
    msg.innerHTML = `<p>Aucun résultat pour <strong>${escapeHtml(query)}</strong>.</p>`;
    searchResultsContainer.appendChild(msg);
    showOnlySearchResults();
    return;
  }

  candidates.forEach(item => {
    const original = item.card;
    const clone = original.cloneNode(true);

    // create badge with category name
    const badge = document.createElement('div');
    badge.className = 'result-badge';
    const catObj = CATEGORIES.find(c => c.id === item.section.dataset.category);
    const catLabel = (catObj && catObj.name) ? catObj.name : (item.section.dataset.category || 'Catégorie');
    badge.textContent = `Catégorie: ${catLabel}`;
    badge.style.cssText = 'font-size:0.75rem;padding:6px 8px;border-radius:999px;background:rgba(0,0,0,0.45);color:white;margin-bottom:8px;display:inline-block;';

    const body = clone.querySelector('.card-body');
    if (body) body.insertBefore(badge, body.firstChild);
    else clone.insertBefore(badge, clone.firstChild);

    searchResultsContainer.appendChild(clone);
  });

  showOnlySearchResults();
  attachCopyHandlers(searchResultsContainer);
  attachReportHandlers(searchResultsContainer);
}

/* ============= Show/hide results helpers ============= */
function showOnlySearchResults() {
  allSections.forEach(sec => { sec.classList.remove('active'); sec.style.display = 'none'; });
  if (searchResultsSection) {
    searchResultsSection.style.display = '';
    searchResultsSection.classList.add('active');
  }
  pagination && (pagination.innerHTML = '');
}
function hideSearchResults() {
  if (searchResultsSection) {
    searchResultsSection.style.display = 'none';
    searchResultsSection.classList.remove('active');
  }
  allSections.forEach(sec => sec.style.display = '');
}

/* ============= Escape helper ============= */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (m) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); });
}

/* ============= Events ============= */
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const q = e.target.value || '';
    searchAllCards(q);
  });
}

if (clearSearch) {
  clearSearch.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    currentQuery = '';
    hideSearchResults();
    renderSection();
  });
}

if (tutorialBtn) tutorialBtn.addEventListener('click', () => selectCategory('tutorial'));

/* Theme behaviour */
if (themeToggle) {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') document.body.classList.add('light');
  else document.body.classList.remove('light');

  const chk = document.getElementById('themeToggle');
  if (chk) chk.checked = document.body.classList.contains('light');
  if (chk) chk.addEventListener('change', () => {
    if (chk.checked) { document.body.classList.add('light'); localStorage.setItem('theme','light'); }
    else { document.body.classList.remove('light'); localStorage.setItem('theme','dark'); }
  });
}

/* Clear search helper */
function clearSearchAndResults() {
  if (searchInput) searchInput.value = '';
  currentQuery = '';
  hideSearchResults();
}

/* ============= Boot ============= */
renderCategoryTabs();
selectCategory(currentCategory);
attachCopyHandlers();
attachReportHandlers();

// End of file
/* Effet 3D sur les cartes */
document.querySelectorAll('.card').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left; // position souris X
    const y = e.clientY - rect.top;  // position souris Y
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // calcul rotation
    const rotateX = ((y - centerY) / centerY) * 8; // inclinaison verticale
    const rotateY = ((x - centerX) / centerX) * -8; // inclinaison horizontale

    card.style.transform = `
      perspective(800px)
      rotateX(${rotateX}deg)
      rotateY(${rotateY}deg)
      scale(1.05)
    `;
  });

  card.addEventListener('mouseleave', () => {
    card.style.transform = `perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)`;
  });
});
