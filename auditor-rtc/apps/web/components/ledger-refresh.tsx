"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

type LedgerGlobal = { motion?: { scan?: (root: Document) => void; refresh?: () => void } };

/** Na navegação interna do Next, reexamina a página para revelar blocos [data-reveal] recém-montados. */
export function LedgerRefresh() {
  const pathname = usePathname();
  useEffect(() => {
    const L = (window as unknown as { Ledger?: LedgerGlobal }).Ledger;
    try {
      L?.motion?.scan?.(document);
      L?.motion?.refresh?.();
    } catch {
      document.querySelectorAll("[data-reveal],[data-reveal-group]").forEach((el) => el.classList.add("is-in"));
    }
  }, [pathname]);
  return null;
}
