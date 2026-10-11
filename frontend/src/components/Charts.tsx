import React, { useState } from "react";
import { compactBRL, niceScale } from "../utils/reportSeries.js";

// Graficos dos Relatorios em SVG puro (sem biblioteca). Tema escuro do app.
// Marcas finas, grade discreta, toque/passagem mostra os valores na linha de leitura.

const SURFACE = "#0f172a"; // slate-900 (fundo dos cartoes)
const GRID = "#1e293b"; // slate-800
const INCOME = "#10b981"; // emerald-500, mesma cor de receita do app
const EXPENSE = "#f43f5e"; // rose-500, mesma cor de despesa do app
const NOW = "#3b82f6"; // azul: ciclo atual
const PAST = "#64748b"; // slate-500: ciclo anterior

const brl = (v: number) => "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Barra com topo arredondado (4px) e base reta
const barPath = (x: number, y: number, w: number, h: number, r = 4) => {
  if (h <= 0) return "";
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
};

const Swatch: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
    <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
    {label}
  </span>
);

/* ---------- 1. Receitas x despesas por ciclo ---------- */

export interface CycleBarDatum {
  label: string; // mes curto (ex.: "out")
  range: string; // "05/10 a 04/11"
  income: number;
  expense: number;
  current: boolean; // ciclo selecionado
}

export const CycleBars: React.FC<{ data: CycleBarDatum[] }> = ({ data }) => {
  const [sel, setSel] = useState<number | null>(null);
  const W = 340, H = 170, L = 38, R = 6, T = 8, B = 22;
  const plotW = W - L - R, plotH = H - T - B;
  const max = Math.max(1, ...data.flatMap(d => [d.income, d.expense]));
  const { top, step } = niceScale(max);
  const y = (v: number) => T + plotH - (v / top) * plotH;
  const band = plotW / data.length;
  const bw = Math.min(18, band / 2 - 3);
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);

  const focus = sel ?? data.findIndex(d => d.current);
  const f = data[focus];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 shadow-xl">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">Últimos {data.length} ciclos</h3>
      <div className="flex gap-4 mb-2">
        <Swatch color={INCOME} label="Receitas" />
        <Swatch color={EXPENSE} label="Despesas" />
      </div>
      <p className="text-xs text-slate-300 min-h-[2.25rem] leading-snug">
        {f ? (
          <>
            <span className="text-slate-500">{f.range} · </span>
            Receitas <b className="text-slate-100">{brl(f.income)}</b> · Despesas <b className="text-slate-100">{brl(f.expense)}</b>
          </>
        ) : null}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Receitas e despesas dos últimos ciclos">
        {ticks.map(v => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} />
            <text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize={9} fill="#64748b">{compactBRL(v)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = L + band * i + band / 2;
          const dim = sel !== null && sel !== i ? 0.45 : 1;
          return (
            <g key={i} opacity={dim}>
              <path d={barPath(cx - bw - 1, y(d.income), bw, y(0) - y(d.income))} fill={INCOME} />
              <path d={barPath(cx + 1, y(d.expense), bw, y(0) - y(d.expense))} fill={EXPENSE} />
              <text
                x={cx} y={H - 6} textAnchor="middle" fontSize={10}
                fill={d.current ? "#e2e8f0" : "#64748b"} fontWeight={d.current ? 700 : 400}
              >
                {d.label}
              </text>
              <rect
                x={L + band * i} y={T} width={band} height={plotH + B}
                fill="transparent"
                onMouseEnter={() => setSel(i)}
                onMouseLeave={() => setSel(null)}
                onClick={() => setSel(sel === i ? null : i)}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

/* ---------- 2. Rosca por categoria ---------- */

export interface DonutSlice {
  name: string;
  color: string;
  amount: number;
}

export const Donut: React.FC<{ slices: DonutSlice[]; total: number }> = ({ slices, total }) => {
  const [sel, setSel] = useState<number | null>(null);
  const MAX_SLICES = 7;
  let list = slices.filter(s => s.amount > 0);
  if (list.length > MAX_SLICES) {
    const rest = list.slice(MAX_SLICES - 1);
    list = [
      ...list.slice(0, MAX_SLICES - 1),
      { name: "Outras", color: "#64748b", amount: rest.reduce((a, s) => a + s.amount, 0) },
    ];
  }
  const sum = list.reduce((a, s) => a + s.amount, 0);
  if (sum <= 0) return null;

  const R = 56, SW = 20, C = 2 * Math.PI * R, GAP = list.length > 1 ? 2 : 0;
  let acc = 0;
  const arcs = list.map(s => {
    const len = (s.amount / sum) * C;
    const arc = { start: acc, len: Math.max(0.5, len - GAP) };
    acc += len;
    return arc;
  });
  const focus = sel !== null ? list[sel] : null;

  return (
    <div className="flex justify-center mb-4">
      <svg viewBox="0 0 160 160" className="w-44 h-44" role="img" aria-label="Distribuição por categoria">
        <g transform="rotate(-90 80 80)">
          {list.map((s, i) => (
            <circle
              key={i} cx={80} cy={80} r={R} fill="none"
              stroke={s.color || "#3B82F6"} strokeWidth={sel === i ? SW + 4 : SW}
              strokeDasharray={`${arcs[i].len} ${C}`} strokeDashoffset={-arcs[i].start}
              opacity={sel !== null && sel !== i ? 0.4 : 1}
              style={{ cursor: "pointer", transition: "stroke-width 0.15s, opacity 0.15s" }}
              onMouseEnter={() => setSel(i)}
              onMouseLeave={() => setSel(null)}
              onClick={() => setSel(sel === i ? null : i)}
            />
          ))}
        </g>
        <text x={80} y={72} textAnchor="middle" fontSize={9} fill="#94a3b8">
          {focus ? (focus.name.length > 18 ? focus.name.slice(0, 17) + "…" : focus.name) : "Total"}
        </text>
        <text x={80} y={88} textAnchor="middle" fontSize={13} fontWeight={700} fill="#f1f5f9">
          {brl(focus ? focus.amount : total).replace("R$ ", "R$ ")}
        </text>
        <text x={80} y={101} textAnchor="middle" fontSize={9} fill="#64748b">
          {focus ? ((focus.amount / sum) * 100).toFixed(1).replace(".", ",") + "%" : ""}
        </text>
      </svg>
    </div>
  );
};

/* ---------- 3. Ritmo de gastos acumulado ---------- */

export const PaceLine: React.FC<{
  current: number[]; // acumulado por dia (termina hoje se o ciclo esta em andamento)
  previous: number[]; // acumulado do ciclo anterior (completo)
  totalDays: number; // dias do ciclo selecionado (eixo x)
  currentRange: string;
  previousRange: string;
}> = ({ current, previous, totalDays, currentRange, previousRange }) => {
  const [hover, setHover] = useState<number | null>(null);
  const W = 340, H = 170, L = 38, R = 14, T = 10, B = 20;
  const plotW = W - L - R, plotH = H - T - B;
  const days = Math.max(totalDays, previous.length, current.length, 2);
  const hasPrev = previous.some(v => v > 0);
  const max = Math.max(1, ...current, ...(hasPrev ? previous : []));
  const { top, step } = niceScale(max);
  const x = (i: number) => L + (i / (days - 1)) * plotW;
  const y = (v: number) => T + plotH - (v / top) * plotH;
  const path = (arr: number[]) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);

  const lastIdx = current.length - 1;
  const idx = hover !== null ? Math.min(hover, lastIdx) : lastIdx;
  const cur = current[idx] ?? 0;
  const prev = previous.length ? previous[Math.min(idx, previous.length - 1)] : 0;
  const diff = cur - prev;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - L) / plotW) * (days - 1));
    setHover(Math.max(0, Math.min(days - 1, i)));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 shadow-xl">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">Ritmo dos gastos no ciclo</h3>
      <div className="flex gap-4 mb-2">
        <Swatch color={NOW} label={`Este ciclo (${currentRange})`} />
        {hasPrev && <Swatch color={PAST} label={`Anterior (${previousRange})`} />}
      </div>
      <p className="text-xs text-slate-300 min-h-[2.25rem] leading-snug">
        Dia <b className="text-slate-100">{idx + 1}</b>: <b className="text-slate-100">{brl(cur)}</b>
        {hasPrev && (
          <span className="text-slate-400">
            {" "}· {diff === 0 ? "igual ao ciclo anterior" : `${brl(Math.abs(diff))} ${diff > 0 ? "acima" : "abaixo"} do ciclo anterior no mesmo dia`}
          </span>
        )}
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`} className="w-full h-auto touch-pan-y" role="img"
        aria-label="Gasto acumulado por dia do ciclo"
        onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}
      >
        {ticks.map(v => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} />
            <text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize={9} fill="#64748b">{compactBRL(v)}</text>
          </g>
        ))}
        {[0, Math.floor((days - 1) / 2), days - 1].map(i => (
          <text key={i} x={x(i)} y={H - 5} textAnchor={i === 0 ? "start" : i === days - 1 ? "end" : "middle"} fontSize={9} fill="#64748b">
            dia {i + 1}
          </text>
        ))}
        {hasPrev && <path d={path(previous)} fill="none" stroke={PAST} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        <path d={path(current)} fill="none" stroke={NOW} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && <line x1={x(idx)} x2={x(idx)} y1={T} y2={T + plotH} stroke="#475569" strokeWidth={1} />}
        <circle cx={x(idx)} cy={y(cur)} r={5} fill={NOW} stroke={SURFACE} strokeWidth={2} />
        {hover !== null && hasPrev && previous.length > 0 && (
          <circle cx={x(Math.min(idx, previous.length - 1))} cy={y(prev)} r={4} fill={PAST} stroke={SURFACE} strokeWidth={2} />
        )}
      </svg>
    </div>
  );
};
