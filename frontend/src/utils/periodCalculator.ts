import { Category, Transaction } from '../services/api.js';

export interface FinancialPeriod {
  startDate: Date;
  endDate: Date;
  label: string;
  isCurrentCycle: boolean;
  cycleBasis: 'salary' | 'fifth_business_day' | 'calendar_month';
}

export function getFifthBusinessDay(year: number, month: number): Date {
  let businessDaysCount = 0;
  let day = 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  while (day <= daysInMonth) {
    const current = new Date(year, month, day, 0, 0, 0);
    const dayOfWeek = current.getDay();

    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDaysCount++;
      if (businessDaysCount === 5) {
        return current;
      }
    }
    day++;
  }

  return new Date(year, month, 5, 0, 0, 0);
}

export function formatDayMonth(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return d + '/' + m;
}

export function formatDayMonthYear(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return d + '/' + m + '/' + y;
}

/**
 * Verifica se uma transação é de Salário
 */
export function isSalaryTransaction(tx: Transaction, categories: Category[]): boolean {
  if (tx.typeId !== 1) return false; // Deve ser Receita

  // 1. Verifica por categoria "Salário"
  const cat = categories.find(c => c.id === tx.categoryId);
  if (cat && cat.name.toLowerCase().includes('sal')) {
    return true;
  }

  // 2. Verifica palavras-chave na descrição
  const desc = (tx.description || '').toLowerCase();
  const salaryKeywords = ['salario', 'salário', 'pagamento', 'holerite', 'proventos', 'remuneração', 'remuneracao'];
  return salaryKeywords.some(kw => desc.includes(kw));
}

/**
 * Calcula os períodos financeiros considerando o evento do salário
 */
export function calculateFinancialPeriods(
  transactions: Transaction[],
  categories: Category[],
  offsetCycles: number = 0
): FinancialPeriod {
  const now = new Date();

  // Filtra receitas de salário
  const salaryTxs = transactions
    .filter(t => isSalaryTransaction(t, categories))
    .map(t => new Date(t.date))
    .sort((a, b) => b.getTime() - a.getTime()); // Mais recente primeiro

  if (salaryTxs.length > 0) {
    // Agrupa salários por mês/ano para evitar duplicatas
    const uniqueSalaryDates: Date[] = [];
    salaryTxs.forEach(d => {
      const exists = uniqueSalaryDates.some(
        u => u.getFullYear() === d.getFullYear() && u.getMonth() === d.getMonth()
      );
      if (!exists) uniqueSalaryDates.push(d);
    });

    const targetIdx = Math.abs(offsetCycles);
    if (targetIdx < uniqueSalaryDates.length) {
      const currentSalary = uniqueSalaryDates[targetIdx];
      let nextSalary: Date;

      if (targetIdx > 0) {
        nextSalary = new Date(uniqueSalaryDates[targetIdx - 1]);
        nextSalary.setDate(nextSalary.getDate() - 1);
        nextSalary.setHours(23, 59, 59, 999);
      } else {
        // Ciclo atual: vai da data do último salário até a estimativa do próximo (5º dia útil do mês seguinte)
        const nextMonth = currentSalary.getMonth() === 11 ? 0 : currentSalary.getMonth() + 1;
        const nextYear = currentSalary.getMonth() === 11 ? currentSalary.getFullYear() + 1 : currentSalary.getFullYear();
        const estNext = getFifthBusinessDay(nextYear, nextMonth);
        estNext.setDate(estNext.getDate() - 1);
        estNext.setHours(23, 59, 59, 999);
        nextSalary = estNext;
      }

      const start = new Date(currentSalary);
      start.setHours(0, 0, 0, 0);

      return {
        startDate: start,
        endDate: nextSalary,
        label: formatDayMonth(start) + ' a ' + formatDayMonth(nextSalary),
        isCurrentCycle: offsetCycles === 0,
        cycleBasis: 'salary'
      };
    }
  }

  // Fallback: 5º dia útil do mês
  const refDate = new Date(now.getFullYear(), now.getMonth() + offsetCycles, 1);
  const curYear = refDate.getFullYear();
  const curMonth = refDate.getMonth();

  const startDate = getFifthBusinessDay(curYear, curMonth);
  startDate.setHours(0, 0, 0, 0);

  const nextMonth = curMonth === 11 ? 0 : curMonth + 1;
  const nextYear = curMonth === 11 ? curYear + 1 : curYear;
  const nextSalaryEst = getFifthBusinessDay(nextYear, nextMonth);
  const endDate = new Date(nextSalaryEst);
  endDate.setDate(endDate.getDate() - 1);
  endDate.setHours(23, 59, 59, 999);

  return {
    startDate,
    endDate,
    label: formatDayMonth(startDate) + ' a ' + formatDayMonth(endDate),
    isCurrentCycle: offsetCycles === 0,
    cycleBasis: 'fifth_business_day'
  };
}