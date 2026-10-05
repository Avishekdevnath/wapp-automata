/**
 * Market Trends & Analytics Controller
 * - Visualizes multi-day and yearly price fluctuations with Chart.js
 * - Filterable by Country and Time Horizon (7d, 30d, 90d, 1y)
 */

let trendsChartInstance = null;
let currentTrendsCountry = '';
let currentTrendsDays = 30;

async function loadMarketTrends() {
  const ctx = document.getElementById('trends-chart-canvas');
  if (!ctx) return;

  const params = new URLSearchParams();
  params.set('days', currentTrendsDays);
  if (currentTrendsCountry) params.set('country', currentTrendsCountry);

  try {
    const res = await fetch(`/api/trends?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const trends = data.trends || [];

    // Populate country selector dropdown if not already populated
    populateTrendsCountryFilter(trends);

    // Group trends by day
    const dayMap = {};
    for (const t of trends) {
      if (!dayMap[t.day]) {
        dayMap[t.day] = { min: t.min_rate, avg: t.avg_rate, max: t.max_rate, count: t.offer_count };
      } else {
        if (t.min_rate !== null && (dayMap[t.day].min === null || t.min_rate < dayMap[t.day].min)) dayMap[t.day].min = t.min_rate;
        if (t.max_rate !== null && (dayMap[t.day].max === null || t.max_rate > dayMap[t.day].max)) dayMap[t.day].max = t.max_rate;
        dayMap[t.day].count += t.offer_count;
      }
    }

    const labels = Object.keys(dayMap).sort();
    const minData = labels.map(d => dayMap[d].min);
    const avgData = labels.map(d => dayMap[d].avg);
    const maxData = labels.map(d => dayMap[d].max);

    // Update KPI numbers
    const validAvgs = avgData.filter(v => v !== null && v > 0);
    const validMins = minData.filter(v => v !== null && v > 0);
    const avgRate = validAvgs.length > 0 ? (validAvgs.reduce((a, b) => a + b, 0) / validAvgs.length).toFixed(4) : '--';
    const lowestRate = validMins.length > 0 ? Math.min(...validMins).toFixed(4) : '--';

    const kpiAvg = document.getElementById('trends-kpi-avg');
    const kpiLowest = document.getElementById('trends-kpi-lowest');
    const kpiCount = document.getElementById('trends-kpi-count');

    if (kpiAvg) kpiAvg.innerText = avgRate !== '--' ? `$${avgRate}` : 'Awaiting Data';
    if (kpiLowest) kpiLowest.innerText = lowestRate !== '--' ? `$${lowestRate}` : 'Awaiting Data';
    if (kpiCount) kpiCount.innerText = `${trends.length} Data Points`;

    if (trendsChartInstance) {
      trendsChartInstance.destroy();
    }

    if (typeof Chart === 'undefined') {
      console.warn('Chart.js is not loaded yet');
      return;
    }

    const isDark = document.documentElement.classList.contains('dark');
    const chartLabelColor = isDark ? '#94a3b8' : '#1e293b';
    const chartTickColor = isDark ? '#64748b' : '#334155';
    const chartGridColor = isDark ? 'rgba(51, 65, 85, 0.3)' : 'rgba(203, 213, 225, 0.6)';
    const chartTooltipBg = isDark ? '#0f172a' : '#1e293b';

    // Chart.js render
    trendsChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.length > 0 ? labels : ['Today'],
        datasets: [
          {
            label: 'Lowest Rate ($/min)',
            data: minData.length > 0 ? minData : [0],
            borderColor: isDark ? '#10b981' : '#059669',
            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(5, 150, 105, 0.12)',
            fill: true,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Market Average ($/min)',
            data: avgData.length > 0 ? avgData : [0],
            borderColor: isDark ? '#3b82f6' : '#2563eb',
            backgroundColor: 'transparent',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 3
          },
          {
            label: 'Highest Rate ($/min)',
            data: maxData.length > 0 ? maxData : [0],
            borderColor: isDark ? '#f59e0b' : '#d97706',
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            pointRadius: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: chartLabelColor,
              font: { size: 11, family: 'Inter', weight: '600' },
              boxWidth: 12,
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: chartTooltipBg,
            borderColor: '#334155',
            borderWidth: 1,
            titleColor: '#fff',
            bodyColor: '#cbd5e1',
            padding: 10
          }
        },
        scales: {
          x: {
            grid: { color: chartGridColor },
            ticks: { color: chartTickColor, font: { size: 10, weight: '500' } }
          },
          y: {
            grid: { color: chartGridColor },
            ticks: {
              color: chartTickColor,
              font: { size: 10, weight: '500' },
              callback: function(v) { return '$' + Number(v).toFixed(4); }
            }
          }
        }
      }
    });
  } catch (err) {
    console.error('Error loading market trends:', err);
  }
}

function populateTrendsCountryFilter(trends) {
  const select = document.getElementById('trends-country-select');
  if (!select || select.children.length > 1) return;

  const countries = [...new Set(trends.map(t => t.country).filter(Boolean))].sort();
  for (const c of countries) {
    const opt = document.createElement('option');
    opt.value = c;
    opt.innerText = c;
    select.appendChild(opt);
  }
}

function handleTrendsPeriodChange(days) {
  currentTrendsDays = days;
  // Update button active styling
  document.querySelectorAll('.btn-trends-period').forEach(btn => {
    btn.classList.remove('bg-emerald-600', 'text-white');
    btn.classList.add('text-slate-400', 'hover:text-white');
  });
  const activeBtn = document.getElementById(`btn-period-${days}`);
  if (activeBtn) {
    activeBtn.classList.add('bg-emerald-600', 'text-white');
    activeBtn.classList.remove('text-slate-400');
  }
  loadMarketTrends();
}

function handleTrendsCountryChange(e) {
  currentTrendsCountry = e.target.value;
  loadMarketTrends();
}

window.loadMarketTrends = loadMarketTrends;
window.handleTrendsPeriodChange = handleTrendsPeriodChange;
window.handleTrendsCountryChange = handleTrendsCountryChange;
