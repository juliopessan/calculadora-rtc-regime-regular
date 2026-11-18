/**
 * Normaliza o NCM como chega do ERP/Excel: remove pontuação e espaços e
 * recompõe o zero à esquerda que a planilha costuma descartar (7 → 8 dígitos).
 */
export function normalizarNcm(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 8) return null;
  return digits.padStart(8, "0");
}
