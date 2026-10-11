import { Account, CardPayment, Transaction } from "../services/api.js";
import { nextBusinessDay } from "./businessDays.js";

// Faturas de cartao calculadas a partir dos lancamentos.
//
// Regras:
//  - A fatura e identificada pelo mes de vencimento (ref = "AAAA-MM").
//  - Compra feita ate o dia anterior ao fechamento entra na fatura que fecha naquele dia;
//    compra feita no dia do fechamento (ou depois) entra na fatura seguinte.
//  - Se o dia de fechamento for menor que o de vencimento, a fatura fecha no mesmo mes em que vence
//    (ex.: fecha dia 1, vence dia 8); senao fecha no mes anterior (ex.: fecha dia 25, vence dia 5).
//  - O vencimento que cai em fim de semana ou feriado vale o proximo dia util.
//  - A divida atual do cartao (saldo) pode ser maior que a soma das faturas: a diferenca e o
//    "saldo anterior" (divida informada ao cadastrar, ajustes, juros) e fica na fatura mais antiga em aberto.

export type InvoiceStatus = "open" | "closed" | "paid" | "next";

export interface Invoice {
  ref: string;
  start: Date;
  end: Date;
  dueNominal: Date;
  due: Date;
  purchasesCents: number;
  previousCents: number;
  payableCents: number;
  status: InvoiceStatus;
  payment?: CardPayment;
  transactions: Transaction[];
  pending: Transaction[];
}

export interface InvoiceData {
  invoices: Invoice[];
  currentRef: string;
  targetRef: string;
  debtCents: number;
  previousCents: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

export const makeRef = (year: number, month0: number): string => {
  const d = new Date(year, month0, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

const parseRef = (ref: string) => {
  const [y, m] = ref.split("-").map(Number);
  return { y, m0: m - 1 };
};

export const addMonthsToRef = (ref: string, n: number): string => {
  const { y, m0 } = parseRef(ref);
  return makeRef(y, m0 + n);
};

const dayInMonth = (y: number, m0: number, day: number): Date => {
  const last = new Date(y, m0 + 1, 0).getDate();
  return new Date(y, m0, Math.min(day, last));
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function closingDateOf(ref: string, closingDay: number, dueDay: number): Date {
  const { y, m0 } = parseRef(ref);
  const closingMonth0 = closingDay < dueDay ? m0 : m0 - 1;
  return dayInMonth(y, closingMonth0, closingDay);
}

export function dueDateOf(ref: string, dueDay: number): Date {
  const { y, m0 } = parseRef(ref);
  return dayInMonth(y, m0, dueDay);
}

// Fatura (mes de vencimento) em que uma compra feita na data informada entra
export function refOfPurchase(date: Date, closingDay: number, dueDay: number): string {
  const d = startOfDay(date);
  let ref = makeRef(d.getFullYear(), d.getMonth() - 2);
  for (let i = 0; i < 8; i++) {
    if (closingDateOf(ref, closingDay, dueDay).getTime() > d.getTime()) return ref;
    ref = addMonthsToRef(ref, 1);
  }
  return ref;
}

const cents = (v: string | number | undefined | null) => Math.round(parseFloat(String(v ?? "0")) * 100) || 0;

export function buildInvoices(
  card: Account,
  transactions: Transaction[],
  payments: CardPayment[],
  now: Date
): InvoiceData | null {
  const closingDay = card.closingDay;
  const dueDay = card.dueDay;
  if (!closingDay || !dueDay) return null;

  const today = startOfDay(now);
  const currentRef = refOfPurchase(today, closingDay, dueDay);
  const nextRef = addMonthsToRef(currentRef, 1);

  const confirmed = new Map<string, Transaction[]>();
  const pending = new Map<string, Transaction[]>();
  const push = (map: Map<string, Transaction[]>, ref: string, t: Transaction) => {
    const list = map.get(ref);
    if (list) list.push(t);
    else map.set(ref, [t]);
  };

  for (const t of transactions) {
    // Compras (despesa) e estornos (receita) no cartao; transferencias nao entram
    if (t.accountId !== card.id || (t.typeId !== 1 && t.typeId !== 2)) continue;
    const ref = refOfPurchase(new Date(t.date), closingDay, dueDay);
    if (t.statusId === 1) push(confirmed, ref, t);
    else if (t.statusId === 2) push(pending, ref, t);
  }

  const paymentByRef = new Map<string, CardPayment>();
  payments.filter(p => p.accountId === card.id).forEach(p => paymentByRef.set(p.ref, p));

  const refSet = new Set<string>([currentRef, nextRef]);
  confirmed.forEach((_, r) => refSet.add(r));
  pending.forEach((_, r) => refSet.add(r));
  paymentByRef.forEach((_, r) => refSet.add(r));
  const minRef = Array.from(refSet).sort()[0];

  const refs: string[] = [];
  for (let r = minRef; r <= nextRef; r = addMonthsToRef(r, 1)) refs.push(r);

  const invoices: Invoice[] = refs.map(ref => {
    const conf = confirmed.get(ref) ?? [];
    const purchasesCents = conf.reduce(
      (sum, t) => sum + (t.typeId === 2 ? cents(t.amount) : -cents(t.amount)),
      0
    );
    const start = closingDateOf(addMonthsToRef(ref, -1), closingDay, dueDay);
    const end = closingDateOf(ref, closingDay, dueDay);
    const dueNominal = dueDateOf(ref, dueDay);
    const payment = paymentByRef.get(ref);
    let status: InvoiceStatus;
    if (payment) status = "paid";
    else if (end.getTime() <= today.getTime()) status = "closed";
    else if (start.getTime() <= today.getTime()) status = "open";
    else status = "next";
    return {
      ref,
      start,
      end,
      dueNominal,
      due: nextBusinessDay(dueNominal),
      purchasesCents,
      previousCents: 0,
      payableCents: purchasesCents,
      status,
      payment,
      transactions: conf,
      pending: pending.get(ref) ?? [],
    };
  });

  // Saldo anterior = divida atual do cartao - soma das faturas ainda nao pagas
  const debtCents = Math.round(-parseFloat(card.balance || "0") * 100) || 0;
  const unpaidSum = invoices.filter(i => !i.payment).reduce((s, i) => s + i.purchasesCents, 0);
  const previousCents = debtCents - unpaidSum;

  // Vai para a fatura mais antiga em aberto (com compras) ou, se nao houver, a fatura atual
  const target =
    invoices.find(i => !i.payment && (i.purchasesCents !== 0 || i.ref === currentRef))?.ref ?? currentRef;
  invoices.forEach(i => {
    if (i.ref === target) {
      i.previousCents = previousCents;
      i.payableCents = i.purchasesCents + previousCents;
    }
  });

  return { invoices, currentRef, targetRef: target, debtCents, previousCents };
}
