let catalog = [];
let selectedMake = '', selectedModel = '', selectedType = '';

document.addEventListener('DOMContentLoaded', async () => {
  await loadCatalog();
  updateApiKeyButton();
  loadLastUpdated();
});

async function loadCatalog() {
  try {
    const r = await fetch('data/catalog.json');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    catalog = await r.json();
    populateMakes();
  } catch (e) {
    console.error('Catalog error:', e);
    showToast(t('catalog_error'), 'error');
  }
}

function populateMakes() {
  const sel = document.getElementById('makeSelect');
  sel.innerHTML = '';
  const opt = document.createElement('option');
  opt.value = '';
  opt.textContent = t('select_make');
  sel.appendChild(opt);
  catalog.forEach(make => {
    const o = document.createElement('option');
    o.value = make.slug || make.name;
    o.textContent = make.name;
    sel.appendChild(o);
  });
}

function onMakeChange() {
  const makeVal = document.getElementById('makeSelect').value;
  const modelSel = document.getElementById('modelSelect');
  const typeSel = document.getElementById('typeSelect');
  selectedMake = makeVal;
  selectedModel = '';
  selectedType = '';
  modelSel.innerHTML = '<option value="">' + t('select_model') + '</option>';
  typeSel.innerHTML = '<option value="">' + t('select_type') + '</option>';
  modelSel.disabled = !makeVal;
  typeSel.disabled = true;
  if (makeVal) {
    const make = catalog.find(m => (m.slug || m.name) === makeVal);
    if (make && make.models) {
      make.models.forEach(model => {
        const o = document.createElement('option');
        o.value = model.slug || model.name;
        o.textContent = model.name;
        modelSel.appendChild(o);
      });
    }
  }
  updateButtons();
}

function onModelChange() {
  const makeVal = document.getElementById('makeSelect').value;
  const modelVal = document.getElementById('modelSelect').value;
  const typeSel = document.getElementById('typeSelect');
  selectedModel = modelVal;
  selectedType = '';
  typeSel.innerHTML = '<option value="">' + t('select_type') + '</option>';
  typeSel.disabled = true;
  if (modelVal) {
    const make = catalog.find(m => (m.slug || m.name) === makeVal);
    if (make) {
      const model = make.models && make.models.find(m => (m.slug || m.name) === modelVal);
      if (model && model.types && model.types.length > 0) {
        model.types.forEach(tp => {
          const o = document.createElement('option');
          o.value = tp.slug || tp.name;
          o.textContent = tp.name;
          typeSel.appendChild(o);
        });
        typeSel.disabled = false;
      }
    }
  }
  updateButtons();
}

function onTypeChange() {
  selectedType = document.getElementById('typeSelect').value;
  updateButtons();
}

function updateButtons() {
  const has = !!selectedMake;
  document.getElementById('searchBtn').disabled = !has;
  document.getElementById('adviceBtn').disabled = !has;
}

function getSelection() {
  const make = catalog.find(m => (m.slug || m.name) === selectedMake);
  const makeName = make ? make.name : selectedMake;
  const model = make && make.models && make.models.find(m => (m.slug || m.name) === selectedModel);
  const modelName = model ? model.name : selectedModel;
  const tp = model && model.types && model.types.find(x => (x.slug || x.name) === selectedType);
  const typeName = tp ? tp.name : selectedType;
  return { makeSlug: selectedMake, makeName, modelSlug: selectedModel, modelName, typeSlug: selectedType, typeName };
}

function getFilters() {
  return {
    yearFrom: document.getElementById('yearFrom').value,
    yearTo: document.getElementById('yearTo').value,
    priceMax: document.getElementById('priceMax').value,
    kmMax: document.getElementById('kmMax').value
  };
}

function onSearch() {
  const sel = getSelection();
  const filters = getFilters();
  showListingsSection(sel, filters);
}

async function getAiAdvice() {
  const apiKey = sessionStorage.getItem('claudeApiKey');
  if (!apiKey) { openApiKeyModal(); return; }
  const sel = getSelection();
  const carLabel = [sel.makeName, sel.modelName, sel.typeName].filter(Boolean).join(' ');
  const adviceSection = document.getElementById('adviceSection');
  const adviceLoading = document.getElementById('adviceLoading');
  const adviceContent = document.getElementById('adviceContent');
  const badge = document.getElementById('selectedCarBadge');
  badge.textContent = carLabel;
  adviceSection.style.display = 'block';
  adviceLoading.style.display = 'flex';
  adviceContent.innerHTML = '';
  adviceSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const isHu = currentLang === 'hu';
  const prompt = isHu
    ? buildPromptHu(carLabel)
    : buildPromptEn(carLabel);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2500,
        stream: true,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err.error && err.error.message) || 'HTTP ' + response.status);
    }
    adviceLoading.style.display = 'none';
    adviceContent.innerHTML = '<div id="streamOut"></div>';
    const streamEl = document.getElementById('streamOut');
    let fullText = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const evt = JSON.parse(data);
          if (evt.type === 'content_block_delta' && evt.delta && evt.delta.type === 'text_delta') {
            fullText += evt.delta.text;
            streamEl.innerHTML = renderMarkdown(fullText);
          }
        } catch (_) {}
      }
    }
    streamEl.innerHTML = renderMarkdown(fullText);
  } catch (e) {
    adviceLoading.style.display = 'none';
    adviceContent.innerHTML = '<div class="error-msg">&#9888; ' + t('advice_error') + '<br><small>' + e.message + '</small></div>';
  }
}

function buildPromptHu(carLabel) {
  return 'Reszletes autovassarlasi tanacsadast kerek a kovetkezo jarmurol: ' + carLabel + '\n\n' +
    'Kerem foglalja ossze a kovetkezo szempontokat, jol strukturalt formaban, magyar nyelven:\n\n' +
    '## Megbizhatosag es tipikus hibak\n- Mik a leggyakoribb meghibaosodasok es gyenge pontok?\n- Melyik evjaratok vagy motortipusok kerulendok?\n\n' +
    '## Karbantartasi es alkatreszkoltségek\n- Jellemzo szervizkoltsegek Magyarorszagon (Ft-ban)\n- Legdragabb/leggyakoribb javitasi tetelek\n- Alkatresz-elerhetoseg\n\n' +
    '## Tesztek es szakmai velemenyek\n- Fobb autós tesztek ertekeléséi\n- Megbizhatosagi felmeresek (TUV, ADAC, JD Power)\n\n' +
    '## Mire figyelj vásárláskor?\n- Konkret ellenorzesi pontok\n- Tipikus kozmetikozott hibak\n\n' +
    '## Ar/ertek arany\n- Piaci ertekallando sag\n- Tipikus ar Magyarorszagon jo allapotu, ~150 000 km koruli peldanyra\n\n' +
    '## Fogyasztas es uzemeltetesi koltsegek\n- Valos fogyasztasi ertekek (vegyes ciklus)\n- Eves becsult uzemeltetesi koltseg\n\n' +
    'Legyen tomor, praktikus es adatkozpontu. Ha nem tudod pontosan, inkabb jelezd.';
}

function buildPromptEn(carLabel) {
  return 'Please provide detailed car buying advice for: ' + carLabel + '\n\n' +
    'Summarize the following in English in a well-structured format:\n\n' +
    '## Reliability and Common Issues\n- Most frequent failures and weak points\n- Which model years or engines to avoid?\n\n' +
    '## Maintenance and Parts Costs\n- Typical service costs (EUR)\n- Most expensive/frequent repairs\n- Parts availability\n\n' +
    '## Reviews and Expert Opinions\n- Key automotive test results\n- Reliability surveys (TUV, ADAC, JD Power)\n\n' +
    '## What to Check When Buying\n- Specific inspection points\n- Common hidden issues\n\n' +
    '## Value for Money\n- Market value retention\n- Typical price for good condition ~150,000 km example\n\n' +
    '## Fuel Consumption and Running Costs\n- Real-world fuel consumption\n- Estimated annual running costs\n\n' +
    'Be concise, practical and data-driven. If uncertain, please indicate it.';
}

function renderMarkdown(text) {
  const lines = text.split('\n');
  let html = '';
  let inList = false;
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (inList) { html += '</ul>'; inList = false; }
      html += '<h3>' + inlineFmt(line.slice(3)) + '</h3>';
    } else if (line.startsWith('### ')) {
      if (inList) { html += '</ul>'; inList = false; }
      html += '<h4>' + inlineFmt(line.slice(4)) + '</h4>';
    } else if (line.match(/^[-*] /)) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += '<li>' + inlineFmt(line.slice(2)) + '</li>';
    } else if (line.trim() === '') {
      if (inList) { html += '</ul>'; inList = false; }
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      html += '<p>' + inlineFmt(line) + '</p>';
    }
  }
  if (inList) html += '</ul>';
  return html;
}

function inlineFmt(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

function openApiKeyModal() {
  const modal = document.getElementById('apiKeyModal');
  const input = document.getElementById('apiKeyInput');
  modal.style.display = 'flex';
  const saved = sessionStorage.getItem('claudeApiKey') || '';
  input.value = saved ? '\u2022'.repeat(24) : '';
  setTimeout(() => input.focus(), 100);
}

function closeApiKeyModal() {
  document.getElementById('apiKeyModal').style.display = 'none';
}

function handleModalClick(e) {
  if (e.target === document.getElementById('apiKeyModal')) closeApiKeyModal();
}

function saveApiKey() {
  const input = document.getElementById('apiKeyInput');
  const key = input.value.trim();
  if (key && !key.startsWith('\u2022')) {
    sessionStorage.setItem('claudeApiKey', key);
    updateApiKeyButton();
    closeApiKeyModal();
    showToast(t('api_key_saved'), 'success');
  } else if (key.startsWith('\u2022')) {
    closeApiKeyModal();
  } else {
    input.focus();
  }
}

function updateApiKeyButton() {
  const hasKey = !!sessionStorage.getItem('claudeApiKey');
  const btn = document.getElementById('apiKeyBtn');
  btn.classList.toggle('key-set', hasKey);
}

function showToast(message, type) {
  type = type || 'info';
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('visible'), 10);
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 350);
  }, 3000);
}

async function loadLastUpdated() {
  try {
    const r = await fetch('data/listings.json');
    if (!r.ok) return;
    const data = await r.json();
    if (data.last_updated) {
      const d = new Date(data.last_updated);
      const fmt = d.toLocaleString(currentLang === 'hu' ? 'hu-HU' : 'en-GB');
      document.getElementById('footerUpdate').textContent = t('last_updated') + ' ' + fmt;
    }
  } catch (_) {}
}

function updateFooterDate() {
  loadLastUpdated();
}

document.getElementById('apiKeyInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') saveApiKey();
  if (e.key === 'Escape') closeApiKeyModal();
});
