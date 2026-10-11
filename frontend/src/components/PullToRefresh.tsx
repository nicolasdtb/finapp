import React, { useEffect, useRef, useState } from "react";

interface PullToRefreshProps {
  onRefresh: () => Promise<unknown> | void;
  /** Desliga o gesto (ex.: com um modal aberto). */
  disabled?: boolean;
  children: React.ReactNode;
}

const TRIGGER = 45; // altura (px) do indicador a partir da qual soltar atualiza
const MAX_PULL = 110;

// Puxar a tela para baixo, estando no topo, recarrega os dados.
export const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, disabled, children }) => {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const startX = useRef(0);
  const active = useRef(false);

  // Evita o "puxar para atualizar" nativo do navegador somar com o nosso.
  useEffect(() => {
    const prev = document.body.style.overscrollBehaviorY;
    document.body.style.overscrollBehaviorY = "contain";
    return () => { document.body.style.overscrollBehaviorY = prev; };
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    if (disabled || refreshing || window.scrollY > 0) { startY.current = null; return; }
    startY.current = e.touches[0].clientY;
    startX.current = e.touches[0].clientX;
    active.current = false;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    const dxAbs = Math.abs(e.touches[0].clientX - startX.current);
    if (!active.current) {
      if (dy < 12 || dxAbs > dy) return; // so puxada vertical para baixo
      if (window.scrollY > 0) { startY.current = null; return; }
      active.current = true;
    }
    setPull(Math.min(MAX_PULL, dy * 0.5));
  };

  const onTouchEnd = async () => {
    const triggered = active.current && pull >= TRIGGER;
    startY.current = null;
    active.current = false;
    if (!triggered) { setPull(0); return; }
    setRefreshing(true);
    setPull(40);
    try { await onRefresh(); } finally {
      setRefreshing(false);
      setPull(0);
    }
  };

  const shown = refreshing ? 40 : pull;

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
      <div
        style={{ height: shown, transition: active.current ? "none" : "height 0.2s ease-out" }}
        className="flex items-end justify-center overflow-hidden text-xs text-slate-400"
      >
        {shown > 8 && (
          <span className="pb-2">
            {refreshing ? "Atualizando…" : pull >= TRIGGER ? "Solte para atualizar" : "Puxe para atualizar"}
          </span>
        )}
      </div>
      {children}
    </div>
  );
};
