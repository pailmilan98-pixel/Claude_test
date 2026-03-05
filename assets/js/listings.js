let allListings = [];
let currentSelection = null;
let currentFilters = {};

async function showListingsSection(selection, filters) {
  currentSelection = selection;
  currentFilters = filters;
  const section = document.getElementById('listingsSection');
  section.style.display = 'block';
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (allListings.length === 0) {
    try {
      const r = await fetch('data/listings.json');
      if (r.ok) {
        const data = await r.json();
        allListings = data.listings || [];
      }
    } catch (_) {}
  }
  setupSourceTabs();
  renderListings('all');
  renderSearchLinks();
}

function setupSourceTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = function() {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      renderListings(this.dataset.source);
    };
  });
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const allBtn = document.querySelector('.tab-btn[data-source="all"]');
  if (allBtn) allBtn.classList.add('active');
}

function renderListings(source) {
  const grid = document.getElementById('listingsGrid');
  const meta = document.getElementById('listingsMeta');
  const sel = currentSelection;
  const filt = currentFilters;
  if (!sel) return;
  let filtered = allListings.filter(l => {
    if (sel.makeName) {
      const mn = (l.make || '').toLowerCase();
      if (!mn.includes(sel.makeName.toLowerCase())) return false;
    }
    if (sel.modelName) {
      const mod = (l.model || '').toLowerCase();
      if (!mod.includes(sel.modelName.toLowerCase())) return false;
    }
    if (filt.yearFrom && l.year && l.year < parseInt(filt.yearFrom)) return false;
    if (filt.yearTo && l.year && l.year > parseInt(filt.yearTo)) return false;
    if (filt.priceMax && l.price_huf && l.price_huf > parseInt(filt.priceMax)) return false;
    if (filt.kmMax && l.km && l.km > parseInt(filt.kmMax)) return false;
    if (source && source !== 'all' && l.source !== source) return false;
    return true;
  });
  const countLabel = currentLang === 'hu' ? t('results_count_hu') : t('results_count_en');
  meta.textContent = filtered.length + ' ' + countLabel;
  if (filtered.length === 0) {
    grid.innerHTML = '<div class="no-listings">' + t('no_results') + '</div>';
    return;
  }
  grid.innerHTML = filtered.map(renderCard).join('');
}

function renderCard(l) {
  const sourceName = { hasznaltauto: 'hasznaltauto.hu', mobile: 'mobile.de', autoscout: 'autoscout24' }[l.source] || l.source;
  const price = formatPrice(l.price, l.currency);
  const km = l.km ? l.km.toLocaleString() + ' km' : '\u2013';
  const year = l.year || '\u2013';
  const title = esc(l.title || [l.make, l.model, l.type].filter(Boolean).join(' '));
  const imgHtml = l.image
    ? '<img src="' + esc(l.image) + '" alt="' + title + '" loading="lazy" onerror="this.style.display=\'none\'">'
    : '&#128664;';
  return '<div class="listing-card">'
    + '<div class="listing-image">' + imgHtml + '</div>'
    + '<div class="listing-body">'
    + '<span class="listing-source-badge src-' + (l.source || '') + '">' + esc(sourceName) + '</span>'
    + '<div class="listing-title">' + title + '</div>'
    + '<div class="listing-price">' + price + '</div>'
    + '<div class="listing-details">'
    + '<span>&#128197; ' + year + '</span>'
    + '<span>&#128739; ' + km + '</span>'
    + '</div>'
    + '<a href="' + esc(l.link || '#') + '" target="_blank" rel="noopener" class="listing-link">'
    + t('view_listing') + '</a>'
    + '</div></div>';
}

function renderSearchLinks() {
  const container = document.getElementById('searchLinks');
  const sel = currentSelection;
  const filt = currentFilters;
  if (!sel) return;
  const hu = buildHasznaltautoUrl(sel, filt);
  const mob = buildMobileDeUrl(sel, filt);
  const asc = buildAutoscout24Url(sel, filt);
  container.innerHTML = '<div class="search-links-title">' + t('search_on') + '</div>'
    + '<div class="search-links-grid">'
    + '<a href="' + hu + '" target="_blank" rel="noopener" class="search-link-btn hasznaltauto">&#128269; hasznaltauto.hu</a>'
    + '<a href="' + mob + '" target="_blank" rel="noopener" class="search-link-btn mobile">&#128269; mobile.de</a>'
    + '<a href="' + asc + '" target="_blank" rel="noopener" class="search-link-btn autoscout">&#128269; autoscout24</a>'
    + '</div>';
}

function buildHasznaltautoUrl(sel, filt) {
  let url = 'https://www.hasznaltauto.hu/szemelyauto';
  if (sel.makeSlug) url += '/' + sel.makeSlug;
  if (sel.modelSlug) url += '/' + sel.modelSlug;
  const p = new URLSearchParams();
  if (filt.yearFrom) p.set('minfrom', filt.yearFrom);
  if (filt.yearTo) p.set('minto', filt.yearTo);
  if (filt.priceMax) p.set('pricemax', filt.priceMax);
  if (filt.kmMax) p.set('kmmax', filt.kmMax);
  const qs = p.toString();
  return qs ? url + '?' + qs : url;
}

function buildMobileDeUrl(sel, filt) {
  const p = new URLSearchParams();
  p.set('isSearchRequest', 'true');
  if (sel.makeName) p.set('makeModelVariant1.make', sel.makeName);
  if (sel.modelName) p.set('makeModelVariant1.model', sel.modelName);
  if (filt.yearFrom) p.set('minFirstRegistrationDate', filt.yearFrom + '-01-01');
  if (filt.yearTo) p.set('maxFirstRegistrationDate', filt.yearTo + '-12-31');
  if (filt.kmMax) p.set('maxMileage', filt.kmMax);
  return 'https://suchen.mobile.de/fahrzeuge/search.html?' + p.toString();
}

function buildAutoscout24Url(sel, filt) {
  let path = 'https://www.autoscout24.com/lst';
  if (sel.makeSlug) path += '/' + sel.makeSlug;
  if (sel.modelSlug) path += '/' + sel.modelSlug;
  const p = new URLSearchParams();
  if (filt.yearFrom) p.set('fregfrom', filt.yearFrom);
  if (filt.yearTo) p.set('fregto', filt.yearTo);
  if (filt.priceMax) {
    const eur = Math.round(parseInt(filt.priceMax) / 400);
    p.set('priceto', eur);
  }
  if (filt.kmMax) p.set('kmto', filt.kmMax);
  const qs = p.toString();
  return qs ? path + '?' + qs : path;
}

function formatPrice(price, currency) {
  if (!price) return '\u2013';
  const num = Number(price);
  if (currency === 'EUR' || currency === '\u20ac') return num.toLocaleString('de-DE') + ' \u20ac';
  return num.toLocaleString('hu-HU') + ' Ft';
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
