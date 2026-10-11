import React, { useRef, useState } from "react";

interface SwipeRowProps {
  children: React.ReactNode;
  /** Deslizar para a direita (ex.: confirmar). Sem isso, nao desliza para a direita. */
  onSwipeRight?: () => void;
  /** Deslizar para a esquerda (ex.: excluir). Sem isso, nao desliza para a esquerda. */
  onSwipeLeft?: () => void;
  rightLabel?: string;
  leftLabel?: string;
}

const THRESHOLD = 90; // px para disparar a acao
const MAX = 140; // px maximos de arrasto
const LOCK = 10; // px antes de decidir se o gesto e horizontal ou vertical

// Linha que desliza para os lados mostrando uma acao colorida atras.
// So reage a gesto claramente horizontal, para nao atrapalhar a rolagem da tela.
export const SwipeRow: React.FC<SwipeRowProps> = ({
  children, onSwipeRight, onSwipeLeft, rightLabel = "Confirmar", leftLabel = "Excluir"
}) => {
  const [dx, setDx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const mode = useRef<"idle" | "h" | "v">("idle");
  const moved = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
    mode.current = "idle";
    moved.current = false;
    setAnimating(false);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!start.current || mode.current === "v") return;
    const t = e.touches[0];
    const ddx = t.clientX - start.current.x;
    const ddy = t.clientY - start.current.y;

    if (mode.current === "idle") {
      if (Math.abs(ddx) < LOCK && Math.abs(ddy) < LOCK) return;
      mode.current = Math.abs(ddx) > Math.abs(ddy) * 1.5 ? "h" : "v";
      if (mode.current === "v") return;
    }

    moved.current = true;
    let next = ddx;
    if (next > 0 && !onSwipeRight) next = 0;
    if (next < 0 && !onSwipeLeft) next = 0;
    next = Math.max(-MAX, Math.min(MAX, next));
    setDx(next);
  };

  const onTouchEnd = () => {
    const final = dx;
    start.current = null;
    setAnimating(true);
    setDx(0);
    if (mode.current === "h") {
      if (final >= THRESHOLD && onSwipeRight) onSwipeRight();
      else if (final <= -THRESHOLD && onSwipeLeft) onSwipeLeft();
    }
    mode.current = "idle";
  };

  // Depois de arrastar, o "click" que o navegador dispara nao deve abrir a edicao.
  const onClickCapture = (e: React.MouseEvent) => {
    if (moved.current) {
      e.stopPropagation();
      e.preventDefault();
      moved.current = false;
    }
  };

  const ready = Math.abs(dx) >= THRESHOLD;

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {dx > 0 && (
        <div className={`absolute inset-0 flex items-center justify-start pl-5 text-sm font-bold transition-colors ${ready ? "bg-emerald-600 text-white" : "bg-emerald-600/40 text-emerald-100"}`}>
          ✓ {rightLabel}
        </div>
      )}
      {dx < 0 && (
        <div className={`absolute inset-0 flex items-center justify-end pr-5 text-sm font-bold transition-colors ${ready ? "bg-rose-600 text-white" : "bg-rose-600/40 text-rose-100"}`}>
          {leftLabel} 🗑
        </div>
      )}
      <div
        style={{
          transform: `translateX(${dx}px)`,
          transition: animating ? "transform 0.18s ease-out" : "none",
          touchAction: "pan-y",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onClickCapture={onClickCapture}
      >
        {children}
      </div>
    </div>
  );
};
