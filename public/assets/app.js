(() => {
  'use strict';

  const els = {
    country: document.querySelector('#country'),
    period: document.querySelector('#period'),
    metric: document.querySelector('#metric'),
    activityFilter: document.querySelector('#activity-filter'),
    search: document.querySelector('#search'),
    rows: document.querySelector('#rows'),
    cards: document.querySelector('#cards'),
    empty: document.querySelector('#empty'),
    status: document.querySelector('#status-text'),
    summaryCountry: document.querySelector('#summary-country'),
    summaryPeriod: document.querySelector('#summary-period'),
    summaryCount: document.querySelector('#summary-count'),
    summaryMethod: document.querySelector('#summary-method'),
    summaryUpdated: document.querySelector('#summary-updated'),
    indexHeading: document.querySelector('#index-heading'),
    contributionsHeading: document.querySelector('#contributions-heading'),
    prsHeading: document.querySelector('#prs-heading'),
    reviewsHeading: document.querySelector('#reviews-heading')
  };

  const state = {
    countries: [],
    dataset: null,
    query: '',
    period: 'rolling',
    metric: 'overall',
    activityFilter: 'all'
  };

  const fmt = new Intl.NumberFormat();

  const rollingMetricOptions = [
    ['overall', 'Developer Index'],
    ['contributions', 'Contributions · 365d'],
    ['stars', 'Stars received'],
    ['followers', 'Followers'],
    ['pullRequests', 'Pull requests · 365d'],
    ['reviews', 'Reviews · 365d']
  ];

  const yearMetricOptions = [
    ['contributions', 'Contributions'],
    ['commits', 'Commits'],
    ['pullRequests', 'Pull requests'],
    ['reviews', 'Reviews'],
    ['issues', 'Issues']
  ];

  function clean(value, fallback = '—') {
    const text = value == null ? '' : String(value).trim();
    return text || fallback;
  }

  function selectedActivity(developer) {
    if (state.period === 'rolling') {
      return {
        contributions: Number(developer.metrics?.contributions365d ?? 0),
        commits: Number(developer.metrics?.commits365d ?? 0),
        issues: Number(developer.metrics?.issues365d ?? 0),
        pullRequests: Number(developer.metrics?.pullRequests365d ?? 0),
        reviews: Number(developer.metrics?.reviews365d ?? 0)
      };
    }

    const yearly = developer.metricsByYear?.[state.period] ?? {};
    return {
      contributions: Number(yearly.contributions ?? 0),
      commits: Number(yearly.commits ?? 0),
      issues: Number(yearly.issues ?? 0),
      pullRequests: Number(yearly.pullRequests ?? 0),
      reviews: Number(yearly.reviews ?? 0)
    };
  }

  function isActiveContributor(developer) {
    return selectedActivity(developer).contributions > 0;
  }

  function metricValue(developer) {
    const activity = selectedActivity(developer);

    switch (state.metric) {
      case 'overall': return Number(developer.scores?.overall ?? 0);
      case 'stars': return Number(developer.metrics?.starsReceived ?? 0);
      case 'followers': return Number(developer.metrics?.followers ?? 0);
      case 'commits': return activity.commits;
      case 'issues': return activity.issues;
      case 'pullRequests': return activity.pullRequests;
      case 'reviews': return activity.reviews;
      case 'contributions':
      default:
        return activity.contributions;
    }
  }

  function filteredDevelopers() {
    const source = Array.isArray(state.dataset?.developers) ? [...state.dataset.developers] : [];
    const activityFiltered = state.activityFilter === 'active'
      ? source.filter(isActiveContributor)
      : source;

    activityFiltered.sort((a, b) => metricValue(b) - metricValue(a) || a.rank - b.rank);

    const query = state.query.trim().toLowerCase();
    if (!query) return activityFiltered;

    return activityFiltered.filter((developer) => [
      developer.login,
      developer.name,
      developer.company,
      developer.location?.raw
    ].map((value) => clean(value, '')).join(' ').toLowerCase().includes(query));
  }

  function currentDevelopers() {
    return filteredDevelopers().slice(0, 20);
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

  function periodLabel() {
    if (state.period === 'rolling') return 'Rolling 365 days';

    const year = Number(state.period);
    const window = state.dataset?.calendarWindows?.find((item) => Number(item.year) === year);
    return window?.complete === false ? `${year} YTD` : String(year);
  }

  function renderTable(developers) {
    els.rows.replaceChildren();
    for (const [index, developer] of developers.entries()) {
      const activity = selectedActivity(developer);
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
        numberCell(activity.contributions),
        numberCell(developer.metrics?.starsReceived),
        numberCell(developer.metrics?.followers),
        numberCell(activity.pullRequests),
        numberCell(activity.reviews)
      );
      els.rows.append(row);
    }
  }

  function renderCards(developers) {
    els.cards.replaceChildren();
    for (const [index, developer] of developers.entries()) {
      const activity = selectedActivity(developer);
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
        ['Current Index', Number(developer.scores?.overall ?? 0).toFixed(2)],
        [`Contributions · ${periodLabel()}`, fmt.format(activity.contributions)],
        ['Current Stars', fmt.format(Number(developer.metrics?.starsReceived ?? 0))],
        ['Current Followers', fmt.format(Number(developer.metrics?.followers ?? 0))]
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

  function setPeriodOptions() {
    els.period.replaceChildren();

    const rolling = document.createElement('option');
    rolling.value = 'rolling';
    rolling.textContent = 'Rolling 365 days';
    els.period.append(rolling);

    const years = Array.isArray(state.dataset?.availableYears)
      ? state.dataset.availableYears.map(Number).filter(Number.isFinite)
      : [];

    for (const year of years) {
      const option = document.createElement('option');
      option.value = String(year);
      const window = state.dataset?.calendarWindows?.find((item) => Number(item.year) === year);
      option.textContent = window?.complete === false ? `${year} (YTD)` : String(year);
      els.period.append(option);
    }

    state.period = 'rolling';
    els.period.value = state.period;
    els.period.disabled = years.length === 0;
  }

  function setMetricOptions() {
    const options = state.period === 'rolling' ? rollingMetricOptions : yearMetricOptions;
    const supported = new Set(options.map(([value]) => value));

    if (!supported.has(state.metric)) {
      state.metric = state.period === 'rolling' ? 'overall' : 'contributions';
    }

    els.metric.replaceChildren();
    for (const [value, label] of options) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      els.metric.append(option);
    }
    els.metric.value = state.metric;
  }

  function updateHeadings() {
    const scope = state.period === 'rolling' ? '365d' : periodLabel();
    els.indexHeading.textContent = 'Current Index';
    els.contributionsHeading.textContent = `Contributions · ${scope}`;
    els.prsHeading.textContent = `PRs · ${scope}`;
    els.reviewsHeading.textContent = `Reviews · ${scope}`;
  }

  function render() {
    const developers = currentDevelopers();
    const total = state.dataset?.developers?.length ?? 0;
    const activeTotal = Array.isArray(state.dataset?.developers)
      ? state.dataset.developers.filter(isActiveContributor).length
      : 0;
    const filteredTotal = filteredDevelopers().length;
    const hasData = total > 0;
    const period = periodLabel();

    updateHeadings();
    els.summaryCountry.textContent = clean(state.dataset?.country?.name);
    els.summaryPeriod.textContent = period;
    els.summaryCount.textContent = fmt.format(total);
    els.summaryMethod.textContent = `v${clean(state.dataset?.methodology?.version, '—')}`;
    els.summaryUpdated.textContent = state.dataset?.generatedAt
      ? new Date(state.dataset.generatedAt).toLocaleString()
      : 'Awaiting first refresh';

    if (hasData) {
      const activityText = state.activityFilter === 'active'
        ? `${fmt.format(activeTotal)} active contributors in ${period}`
        : `${fmt.format(total)} indexed developers`;
      els.status.textContent = `${activityText}. Showing ${developers.length} of ${fmt.format(filteredTotal)} matching results.`;
    } else {
      els.status.textContent = 'Dataset is ready; run the refresh workflow to populate live GitHub data.';
    }

    els.empty.hidden = developers.length !== 0;
    els.empty.textContent = hasData
      ? state.activityFilter === 'active'
        ? 'No active contributors match the current country, period and search filters.'
        : 'No developers match the current search and period.'
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
    state.metric = 'overall';
    els.search.value = '';
    setPeriodOptions();
    setMetricOptions();
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
  els.period.addEventListener('change', () => {
    state.period = els.period.value;
    setMetricOptions();
    render();
  });
  els.metric.addEventListener('change', () => { state.metric = els.metric.value; render(); });
  els.activityFilter.addEventListener('change', () => {
    state.activityFilter = els.activityFilter.value;
    render();
  });
  els.search.addEventListener('input', () => { state.query = els.search.value; render(); });

  init();
})();
