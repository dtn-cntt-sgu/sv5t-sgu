"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";

export function TiltCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMove(event: MouseEvent<HTMLDivElement>) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const node = ref.current;
    if (!node) return;
    const bounds = node.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    node.style.setProperty("--rotate-x", `${-y * 8}deg`);
    node.style.setProperty("--rotate-y", `${x * 10}deg`);
    node.style.setProperty("--glow-x", `${(x + 0.5) * 100}%`);
    node.style.setProperty("--glow-y", `${(y + 0.5) * 100}%`);
  }

  function reset() {
    const node = ref.current;
    if (!node) return;
    node.style.setProperty("--rotate-x", "0deg");
    node.style.setProperty("--rotate-y", "0deg");
  }

  return (
    <div
      ref={ref}
      className={`tilt-card ${className}`}
      onMouseMove={handleMove}
      onMouseLeave={reset}
    >
      {children}
    </div>
  );
}
