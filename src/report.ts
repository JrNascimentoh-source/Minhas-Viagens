import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { MONTHS, PERIOD_LABEL, brl, formatBR } from './dates';
import { MonthStats } from './trips';
import { Trip } from './types';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function buildReportHtml(year: number, month0: number, stats: MonthStats, trips: Trip[]): string {
  const registered = trips.filter((t) => t.status === 'registered').sort((a, b) => a.trip_date.localeCompare(b.trip_date));
  const rows = registered.map((t) => `<tr>
    <td>${formatBR(t.trip_date)}</td><td>${PERIOD_LABEL[t.period]}</td><td>${esc(t.description || '-')}</td>
    <td class="r">${brl(Number(t.amount))}</td><td>${t.paid ? 'Pago' : 'A receber'}</td></tr>`).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
  body{font-family:-apple-system,Roboto,Helvetica,Arial,sans-serif;color:#1B1A19;padding:32px}
  h1{font-size:22px;margin:0 0 4px}.sub{color:#66625D;margin-bottom:24px}.kpis{display:flex;gap:12px;margin-bottom:24px}
  .kpi{flex:1;border:1px solid #E7E3DE;border-radius:12px;padding:14px}.kpi b{display:block;font-size:22px;margin-top:4px}
  .accent{color:#D9480F}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:8px 6px;border-bottom:1px solid #E7E3DE}
  th{color:#66625D;font-weight:600}.r{text-align:right}.foot{margin-top:24px;color:#66625D;font-size:12px}
  </style></head><body><h1>Relatório mensal de viagens</h1><div class="sub">${MONTHS[month0]} de ${year}</div>
  <div class="kpis"><div class="kpi">Dias trabalhados<b>${stats.workedDays}</b></div><div class="kpi">Dias não trabalhados<b>${stats.notWorkedDays}</b></div>
  <div class="kpi">Total recebido<b class="accent">${brl(stats.totalReceived)}</b></div></div>
  ${registered.length ? `<table><thead><tr><th>Data</th><th>Período</th><th>Descrição</th><th class="r">Valor</th><th>Pagamento</th></tr></thead><tbody>${rows}</tbody></table>` : '<p>Nenhuma viagem registrada neste mês.</p>'}
  <div class="foot">Total recebido considera apenas viagens concluídas e pagas.${stats.totalPending > 0 ? ` A receber: ${brl(stats.totalPending)}.` : ''}</div></body></html>`;
}
export async function generateReportPdf(year: number, month0: number, stats: MonthStats, trips: Trip[]) {
  const html = buildReportHtml(year, month0, stats, trips);
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `Relatório ${MONTHS[month0]} ${year}` });
  return uri;
}
