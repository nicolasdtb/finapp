import React from 'react';
import { ChevronLeft, ChevronRight, Calendar, Sparkles } from 'lucide-react';
import { FinancialPeriod } from '../utils/periodCalculator.js';

interface PeriodSelectorProps {
  period: FinancialPeriod;
  onPrevCycle: () => void;
  onNextCycle: () => void;
  onResetCurrent: () => void;
}

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  period,
  onPrevCycle,
  onNextCycle,
  onResetCurrent
}) => {
  return (
    <div className=""bg-slate-900/80 border border-slate-800/80 backdrop-blur-md rounded-2xl p-3 mb-4 flex items-center justify-between shadow-lg"">
      <button
        onClick={onPrevCycle}
        className=""p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors""
        title=""Ciclo anterior""
      >
        <ChevronLeft className=""w-5 h-5"" />
      </button>

      <div className=""flex flex-col items-center cursor-pointer"" onClick={onResetCurrent}>
        <div className=""flex items-center gap-1.5"">
          <Calendar className=""w-4 h-4 text-emerald-400"" />
          <span className=""text-sm font-semibold text-white tracking-wide"">
            {period.label}
          </span>
          {period.isCurrentCycle && (
            <span className=""flex items-center gap-1 text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full ml-1"">
              <Sparkles className=""w-2.5 h-2.5"" /> Atual
            </span>
          )}
        </div>
        <span className=""text-[11px] text-slate-400 mt-0.5"">
          {period.cycleBasis === 'salary' ? 'Período entre Salários' : 'Ciclo Financeiro (5º dia útil)'}
        </span>
      </div>

      <button
        onClick={onNextCycle}
        className=""p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors""
        title=""Próximo ciclo""
      >
        <ChevronRight className=""w-5 h-5"" />
      </button>
    </div>
  );
};
