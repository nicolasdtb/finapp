// Dias uteis bancarios do Brasil: segunda a sexta, exceto feriados nacionais
// (incluindo Carnaval, Sexta-feira Santa e Corpus Christi, que os bancos tratam como feriado).

function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

const holidayCache = new Map<number, Set<string>>();

function holidays(year: number): Set<string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const set = new Set<string>();
  // Feriados fixos [mes (0-11), dia]
  const fixed: Array<[number, number]> = [
    [0, 1], [3, 21], [4, 1], [8, 7], [9, 12], [10, 2], [10, 15], [10, 20], [11, 25],
  ];
  fixed.forEach(([m, d]) => set.add(dayKey(new Date(year, m, d))));
  // Moveis, a partir da Pascoa: Carnaval (seg e ter), Sexta-feira Santa, Corpus Christi
  const easterDate = easter(year);
  [-48, -47, -2, 60].forEach(n => set.add(dayKey(addDays(easterDate, n))));
  holidayCache.set(year, set);
  return set;
}

export function isBusinessDay(d: Date): boolean {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  return !holidays(d.getFullYear()).has(dayKey(d));
}

// Se a data nao for dia util, devolve o proximo dia util
export function nextBusinessDay(d: Date): Date {
  let x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  while (!isBusinessDay(x)) x = addDays(x, 1);
  return x;
}
