(() => {
  'use strict';

  const els = {
    country: document.querySelector('#country'),
    metric: document.querySelector('#metric'),
    search: document.querySelector('#search'),
    rows: document.querySelector('#rows'),
    cards: document.querySelector('#cards'),
    empty: document.querySelector('#empty'),
    status: document.querySelector('#status-text'),
    summaryCountry: document.querySelector('#summary-country'),
    summaryCount: document.querySelector('#summary-count'),
    summaryMethod: document.querySelector('#summary-method'),
    summaryUpdated: document.querySelector('#summary-updated')
  };

  const state = { countries: [], dataset: null, query: '', metric: 'overall' };
  const fmt = new Intl.NumberFormat();

  const metrics = {
    overall: (developer) => Number(developer.scores?.overall ?? 0),
    contributions365d: (developer) => Number(developer.metrics?.contributions365d ?? 0),
    starsReceived: (developer) => Number(developer.metrics?.starsReceived ?? 0),
    followers: (developer) => Number(developer.metrics?.followers ?? 0),
    pullRequests365d: (developer) => Number(developer.metrics?.pullRequests365d ?? 0),
    reviews365d: (developer) => Number(developer.metrics?.reviews365d ?? 0)
  };

  function clean(value, fallback = '—') {
    const text = value == null ? '' : String(value).trim();
    return text || fallback;
  }

  function currentDevelopers() {
    const source = Array.isArray(state.dataset?.developers) ? [...state.dataset.developers] : [];
    source.sort((a, b) => metrics[state.metric](b) - metrics[state.metric](a) || a.rank - b.rank);

    const query = state.query.trim().toLowerCase();
    if (!query) return source.slice(0, 20);

    return source.filter((developer) => [
      developer.login,
      developer.name,
      developer.company,
      developer.location?.raw
    ].map((value) => clean(value, '')).join(' ').toLowerCase().includes(query)).slice(0, 20);
  }

  function developerIdentity(developer) {
    const wrap = document.createElement('div');
    wrap.className = 'developer';

    const avatar = document.createElement('img');
    avatar.className = 'avatar';
    avatar.src = developer.avatarUrl;
    avatar.alt = '';
    avatar.loading = 'lazy';

    const link = document.createElement('a');
    link.className = 'profile';
    link.href = developer.profileUrl || `https://github.com/${encodeURIComponent(developer.login)}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = clean(developer.name, developer.login);
    const handle = document.createElement('div');
    handle.className = 'handle';
    handle.textContent = `@${developer.login}`;
    link.append(name, handle);
    wrap.append(avatar, link);
    return wrap;
  }

  function numberCell(value) {
    const cell = document.createElement('td');
    cell.className = 'num';
    cell.textContent = fmt.format(Number(value ?? 0));
    return cell;
  }

  function renderTable(developers) {
    els.rows.replaceChildren();
    for (const [index, developer] of developers.entries()) {
      const row = document.createElement('tr');
      const rank = document.createElement('td');
      rank.className = 'rank';
      rank.dataset.rank = String(index + 1);
      rank.textContent = String(index + 1);
      const identity = document.createElement('td');
      identity.append(developerIdentity(developer));
      const score = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = 'score';
      badge.textContent = Number(developer.scores?.overall ?? 0).toFixed(2);
      score.append(badge);
      row.append(
        rank,
        identity,
        score,
        numberCell(developer.metrics?.contributions365d),
        numberCell(developer.metrics?.starsReceived),
        numberCell(developer.metrics?.followers),
        numberCell(developer.metrics?.pullRequests365d),
        numberCell(developer.metrics?.reviews365d)
      );
      els.rows.append(row);
    }
  }

  function renderCards(developers) {
    els.cards.replaceChildren();
    for (const [index, developer] of developers.entries()) {
      const card = document.createElement('article');
      card.className = 'card';
      const head = document.createElement('div');
      head.className = 'card-head';
      const rank = document.createElement('div');
      rank.className = 'card-rank rank';
      rank.dataset.rank = String(index + 1);
      rank.textContent = `#${index + 1}`;
      head.append(rank, developerIdentity(developer));

      const metricsGrid = document.createElement('div');
      metricsGrid.className = 'card-metrics';
      const items = [
        ['Developer Index', Number(developer.scores?.overall ?? 0).toFixed(2)],
        ['Contributions', fmt.format(Number(developer.metrics?.contributions365d ?? 0))],
        ['Stars', fmt.format(Number(developer.metrics?.starsReceived ?? 0))],
        ['Followers', fmt.format(Number(developer.metrics?.followers ?? 0))]
      ];
      for (const [label, value] of items) {
        const item = document.createElement('div');
        item.className = 'metric';
        const labelNode = document.createElement('span');
        labelNode.textContent = label;
        const valueNode = document.createElement('strong');
        valueNode.textContent = value;
        item.append(labelNode, valueNode);
        metricsGrid.append(item);
      }
      card.append(head, metricsGrid);
      els.cards.append(card);
    }
  }

  function render() {
    const developers = currentDevelopers();
    const total = state.dataset?.developers?.length ?? 0;
    const hasData = total > 0;

    els.summaryCountry.textContent = clean(state.dataset?.country?.name);
    els.summaryCount.textContent = fmt.format(total);
    els.summaryMethod.textContent = `v${clean(state.dataset?.methodology?.version, '—')}`;
    els.summaryUpdated.textContent = state.dataset?.generatedAt
      ? new Date(state.dataset.generatedAt).toLocaleString()
      : 'Awaiting first refresh';

    els.status.textContent = hasData
      ? `Loaded ${fmt.format(total)} ranked developers. Showing top ${developers.length}.`
      : 'Foundation dataset is ready; run the refresh workflow to populate live GitHub data.';

    els.empty.hidden = developers.length !== 0;
    els.empty.textContent = hasData
      ? 'No developers match the current search.'
      : 'No live developer records yet. Trigger “Refresh GitHub Developer Index” in GitHub Actions.';

    renderTable(developers);
    renderCards(developers);
  }

  async function loadCountry(datasetPath) {
    els.status.textContent = 'Loading country dataset…';
    const response = await fetch(datasetPath, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Dataset request failed (${response.status}).`);
    state.dataset = await response.json();
    state.query = '';
    els.search.value = '';
    render();
  }

  async function init() {
    try {
      const response = await fetch('data/countries.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Country registry request failed (${response.status}).`);
      state.countries = await response.json();
      els.country.replaceChildren();
      for (const country of state.countries) {
        const option = document.createElement('option');
        option.value = country.dataset;
        option.textContent = country.name;
        els.country.append(option);
      }
      els.country.disabled = state.countries.length < 2;
      if (!state.countries.length) throw new Error('Country registry is empty.');
      await loadCountry(state.countries[0].dataset);
    } catch (error) {
      console.error(error);
      els.status.textContent = error.message || 'Unable to load the leaderboard.';
      els.empty.hidden = false;
      els.empty.textContent = 'Leaderboard data could not be loaded.';
    }
  }

  els.country.addEventListener('change', () => loadCountry(els.country.value));
  els.metric.addEventListener('change', () => { state.metric = els.metric.value; render(); });
  els.search.addEventListener('input', () => { state.query = els.search.value; render(); });

  init();
})();
