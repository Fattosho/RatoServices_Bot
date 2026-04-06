import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from '../dist/db/pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);

function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

function formatPct(value) {
  return `${value.toFixed(2).replace('.', ',')}%`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function cleanName(name) {
  return name
    .replace(/\s+/g, ' ')
    .trim();
}

const query = `
  select
    catalog_platform,
    external_service_id,
    name,
    supplier_price::numeric as supplier_price,
    final_price::numeric as final_price
  from services
  where active = true
  order by catalog_platform asc, external_service_id::int asc
`;

const result = await pool.query(query);
await pool.end();

const rows = result.rows.map((row) => {
  const cost = Number(row.supplier_price);
  const sale = Number(row.final_price);
  const profit = sale - cost;
  const retorno = cost > 0 ? (profit / cost) * 100 : 0;

  return {
    platform: row.catalog_platform,
    id: row.external_service_id,
    name: cleanName(row.name),
    cost,
    sale,
    profit,
    retorno
  };
});

const totalServices = rows.length;
const avgCost = rows.reduce((sum, row) => sum + row.cost, 0) / Math.max(totalServices, 1);
const avgSale = rows.reduce((sum, row) => sum + row.sale, 0) / Math.max(totalServices, 1);
const avgProfit = rows.reduce((sum, row) => sum + row.profit, 0) / Math.max(totalServices, 1);
const avgRetorno = rows.reduce((sum, row) => sum + row.retorno, 0) / Math.max(totalServices, 1);

const topProfit = [...rows]
  .sort((left, right) => right.profit - left.profit)
  .slice(0, 5);

const grouped = rows.reduce((acc, row) => {
  acc[row.platform] ??= [];
  acc[row.platform].push(row);
  return acc;
}, {});

const generatedAt = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'full',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo'
}).format(new Date());

const topCards = topProfit.map((row, index) => `
  <div class="top-card">
    <div class="rank">#${index + 1}</div>
    <div class="top-platform">${escapeHtml(row.platform)} · ID ${escapeHtml(row.id)}</div>
    <div class="top-name">${escapeHtml(row.name)}</div>
    <div class="top-profit">${formatMoney(row.profit)} / 1K</div>
    <div class="top-meta">Venda ${formatMoney(row.sale)} · Custo ${formatMoney(row.cost)} · Retorno ${formatPct(row.retorno)}</div>
  </div>
`).join('');

const sections = Object.entries(grouped).map(([platform, items]) => {
  const rowsHtml = items.map((row) => `
    <tr>
      <td class="col-id">${escapeHtml(row.id)}</td>
      <td class="col-name">${escapeHtml(row.name)}</td>
      <td>${formatMoney(row.cost)}</td>
      <td>${formatMoney(row.sale)}</td>
      <td>${formatMoney(row.profit)}</td>
      <td>${formatPct(row.retorno)}</td>
    </tr>
  `).join('');

  return `
    <section class="platform-section">
      <div class="section-head">
        <h2>${escapeHtml(platform)}</h2>
        <span>${items.length} serviços ativos</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Serviço</th>
            <th>Custo / 1K</th>
            <th>Venda / 1K</th>
            <th>Lucro / 1K</th>
            <th>Retorno s/ custo</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </section>
  `;
}).join('');

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Relatório de Margens - RatoAcess</title>
  <style>
    :root {
      --bg: #0b1220;
      --panel: #10192d;
      --panel-2: #13213a;
      --line: rgba(255,255,255,0.08);
      --text: #eef4ff;
      --muted: #9fb0cf;
      --accent: #39d98a;
      --accent-2: #4db5ff;
      --warn: #ffd166;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Arial, sans-serif;
      background:
        radial-gradient(circle at top left, rgba(77,181,255,0.16), transparent 28%),
        radial-gradient(circle at top right, rgba(57,217,138,0.14), transparent 26%),
        var(--bg);
      color: var(--text);
    }
    .page {
      padding: 40px 44px 56px;
    }
    .hero {
      background: linear-gradient(135deg, rgba(77,181,255,0.18), rgba(57,217,138,0.14));
      border: 1px solid var(--line);
      border-radius: 24px;
      padding: 28px 30px;
      margin-bottom: 28px;
    }
    .eyebrow {
      color: var(--warn);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    h1 {
      margin: 0 0 10px;
      font-size: 34px;
      line-height: 1.06;
    }
    .subtitle {
      margin: 0;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.6;
      max-width: 780px;
    }
    .meta {
      margin-top: 16px;
      color: var(--muted);
      font-size: 12px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      margin-bottom: 28px;
    }
    .stat {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 18px 18px 16px;
    }
    .stat-label {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }
    .stat-value {
      font-size: 26px;
      font-weight: 700;
      line-height: 1.05;
    }
    .top-area {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 18px;
      margin: 0 0 12px;
    }
    .top-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
    }
    .top-card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 16px 18px;
    }
    .rank {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      color: var(--bg);
      background: var(--accent);
      border-radius: 999px;
      padding: 6px 10px;
      margin-bottom: 12px;
    }
    .top-platform {
      color: var(--accent-2);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      margin-bottom: 6px;
    }
    .top-name {
      font-size: 16px;
      font-weight: 700;
      line-height: 1.35;
      margin-bottom: 8px;
    }
    .top-profit {
      font-size: 22px;
      font-weight: 800;
      color: var(--accent);
      margin-bottom: 8px;
    }
    .top-meta {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
    }
    .platform-section {
      margin-top: 24px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 22px;
      overflow: hidden;
    }
    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: var(--panel-2);
      border-bottom: 1px solid var(--line);
    }
    .section-head h2 {
      margin: 0;
      font-size: 20px;
    }
    .section-head span {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    th, td {
      padding: 12px 14px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }
    th {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      background: rgba(255,255,255,0.02);
    }
    tbody tr:nth-child(even) td {
      background: rgba(255,255,255,0.015);
    }
    .col-id {
      white-space: nowrap;
      font-weight: 700;
      color: var(--accent-2);
    }
    .col-name {
      width: 38%;
      font-weight: 600;
      line-height: 1.45;
    }
    .footer-note {
      margin-top: 20px;
      color: var(--muted);
      font-size: 11px;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="page">
    <section class="hero">
      <div class="eyebrow">Relatório Comercial</div>
      <h1>Margens dos serviços ativos da loja</h1>
      <p class="subtitle">
        Levantamento de custo, venda, lucro bruto por 1K e retorno sobre custo dos serviços atualmente ativos no painel.
        Base ideal para apresentar precificação, margem e potencial de lucro ao cliente.
      </p>
      <div class="meta">Gerado em ${escapeHtml(generatedAt)} · Marca de referência: RatoAcess</div>
    </section>

    <section class="stats">
      <div class="stat">
        <div class="stat-label">Serviços ativos</div>
        <div class="stat-value">${totalServices}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Custo médio / 1K</div>
        <div class="stat-value">${formatMoney(avgCost)}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Venda média / 1K</div>
        <div class="stat-value">${formatMoney(avgSale)}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Retorno médio s/ custo</div>
        <div class="stat-value">${formatPct(avgRetorno)}</div>
      </div>
    </section>

    <section class="top-area">
      <h2 class="section-title">Top 5 maiores lucros por 1K</h2>
      <div class="top-grid">
        ${topCards}
      </div>
    </section>

    ${sections}

    <div class="footer-note">
      Observação: o relatório usa os preços ativos do banco no momento da geração. O campo "Retorno sobre custo" representa
      quanto o lucro bruto retorna em relação ao custo do serviço. Exemplo: custo de R$ 10 e lucro de R$ 15 = retorno de 150%.
    </div>
  </div>
</body>
</html>`;

const outputPath = join(projectRoot, 'margin-report-ratoacess.html');
await writeFile(outputPath, html, 'utf8');
console.log(outputPath);
