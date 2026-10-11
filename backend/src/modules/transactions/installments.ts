// Divide o total em N parcelas em centavos; o resto da divisao vai para a primeira parcela.
export function splitInstallments(total: string, n: number): string[] {
  const totalCents = Math.round(parseFloat(total) * 100);
  const base = Math.floor(totalCents / n);
  const rest = totalCents - base * n;
  return Array.from({ length: n }, (_, i) => {
    const c = base + (i === 0 ? rest : 0);
    return (c / 100).toFixed(2);
  });
}

// Soma meses mantendo o dia; se o mes nao tem o dia (ex.: 31), usa o ultimo dia do mes.
export function addMonthsClamped(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const day = Math.min(date.getUTCDate(), lastDay);
  return new Date(Date.UTC(
    y, m, day,
    date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()
  ));
}
