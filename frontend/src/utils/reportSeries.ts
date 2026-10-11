import { Transaction } from "../services/api.js";

// Calculos dos graficos dos Relatorios (funcoes puras, sem React).
// Entram so lancamentos confirmados (statusId 1); transferencias nunca contam.

export interface CycleTotals {
  income: number;
  expense: number;
}

const inRange = (t: Transaction, start: Date, end: Date) => {
  const d = new Date(t.date);
  return d >= start && d <= end;
};

export function totalsInRange(transactions: Transaction[], start: Date, end: Date): CycleTotals {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (t.statusId !== 1 || !inRange(t, start, end)) continue;
    const v = parseFloat(t.amount || "0") || 0;
    if (t.typeId === 1) income += v;
    else if (t.typeId === 2) expense += v;
  }
  return { income, expense };
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Numero de dias (inclusive) entre duas datas, pelo calendario local
export function daysInclusive(start: Date, end: Date): number {
  const a = startOfDay(start).getTime();
  const b = startOfDay(end).getTime();
  return Math.round((b - a) / 86400000) + 1;
}

// Despesa acumulada por dia do ciclo. points[i] = total gasto ate o dia i (i = 0 e o primeiro dia).
// Se "lastDay" for informado, a serie termina nele (ciclo em andamento: nao desenha o futuro).
export function cumulativeExpenseByDay(
  transactions: Transaction[],
  start: Date,
  end: Date,
  lastDay?: number
): number[] {
  const total = daysInclusive(start, end);
  const len = Math.max(1, Math.min(total, lastDay !== undefined ? lastDay + 1 : total));
  const perDay = new Array<number>(total).fill(0);
  for (const t of transactions) {
    if (t.statusId !== 1 || t.typeId !== 2 || !inRange(t, start, end)) continue;
    const idx = daysInclusive(start, new Date(t.date)) - 1;
    if (idx >= 0 && idx < total) perDay[idx] += parseFloat(t.amount || "0") || 0;
  }
  const out: number[] = [];
  let acc = 0;
  for (let i = 0; i < len; i++) {
    acc += perDay[i];
    out.push(acc);
  }
  return out;
}

// Rotulo curto de valores em reais para eixos: 0 / 500 / 1,5 mil / 12 mil
export function compactBRL(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1000) return `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

// Maior valor "redondo" para o topo do eixo e passos limpos (1, 2, 2.5, 5 x 10^n)
export function niceScale(max: number, ticks = 4): { top: number; step: number } {
  if (max <= 0) return { top: 1, step: 1 / ticks };
  const raw = max / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const m = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  const step = m * mag;
  return { top: Math.ceil(max / step) * step, step };
}
