/**
 * Utilitários para formatação e manipulação de valores em Moeda (BRL / R$)
 * Estilo caixa eletrônico / app bancário: digita números direto e desloca centavos
 * Ex: digita 1 -> 0,01 -> 12 -> 0,12 -> 1250 -> 12,50 -> 125000 -> 1.250,00
 */

// Formata um número de centavos inteiros para string de exibição BRL ("45,90")
export const formatCentsToBRL = (cents: number): string => {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Converte valor float/string do backend ("45.90" ou "45,90") em centavos inteiros (4590)
export const decimalToCents = (val: string | number | undefined | null): number => {
  if (!val) return 0;
  const num = typeof val === "number" ? val : parseFloat(String(val).replace(",", "."));
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
};

// Converte texto digitado pelo usuário mantendo apenas dígitos numéricos e calcula os centavos
export const parseInputToCents = (rawInput: string): number => {
  const digitsOnly = rawInput.replace(/\D/g, "");
  if (!digitsOnly) return 0;
  return parseInt(digitsOnly, 10);
};

// Formata string decimal ("45.90") diretamente para BRL formatado sem R$ ("45,90")
export const formatDecimalToBRL = (val: string | number | undefined | null): string => {
  const cents = decimalToCents(val);
  return formatCentsToBRL(cents);
};

// Converte centavos (4590) para string float com 2 casas para enviar ao backend ("45.90")
export const centsToDecimalString = (cents: number): string => {
  return (cents / 100).toFixed(2);
};

// Formata quantidade de produto (ex: "1.000" -> "1", "1.500" -> "1.5", "2" -> "2")
export const formatQuantity = (qty: string | number | undefined | null): string => {
  if (qty === undefined || qty === null || qty === "") return "1";
  const num = typeof qty === "number" ? qty : parseFloat(String(qty));
  if (isNaN(num)) return String(qty);
  return Number(num.toFixed(3)).toString();
};