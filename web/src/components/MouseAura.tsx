import { useEffect } from "react";

/**
 * Глобальный mouse tracker. Слушает движение мыши на window и пишет CSS-переменные:
 *   --mx, --my   — абсолютные координаты в пикселях (для overlay full-screen эффектов)
 *   --mxp, --myp — координаты внутри ближайшего .card-hover / .magnetic в процентах
 *
 * Ставится один раз в Layout. Без React-state — это бы пересобирало половину дерева.
 * Только мутация CSS-переменных, GPU-friendly.
 */
export function MouseAura() {
  useEffect(() => {
    let raf = 0;
    let lastX = window.innerWidth / 2;
    let lastY = window.innerHeight / 2;

    function update() {
      raf = 0;
      document.documentElement.style.setProperty("--mx", `${lastX}px`);
      document.documentElement.style.setProperty("--my", `${lastY}px`);
    }

    function onMove(e: MouseEvent) {
      lastX = e.clientX;
      lastY = e.clientY;
      if (!raf) raf = requestAnimationFrame(update);
      // локальные координаты для card-hover / magnetic
      const target = (e.target as HTMLElement)?.closest?.(".card-hover, .magnetic") as HTMLElement | null;
      if (target) {
        const rect = target.getBoundingClientRect();
        const xp = ((e.clientX - rect.left) / rect.width) * 100;
        const yp = ((e.clientY - rect.top) / rect.height) * 100;
        target.style.setProperty("--mxp", `${xp}%`);
        target.style.setProperty("--myp", `${yp}%`);
      }
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div className="aurora-bg" aria-hidden />
      <div className="aurora-grid" aria-hidden />
      <div className="aurora-noise" aria-hidden />
    </>
  );
}

/**
 * Custom курсор-кольцо. Тонкий violet-кружок который мягко догоняет мышь.
 * Скрыт на тач-устройствах через media (hover: none).
 */
export function CursorRing() {
  useEffect(() => {
    if (window.matchMedia("(hover: none)").matches) return;
    const ring = document.createElement("div");
    ring.className =
      "fixed top-0 left-0 size-8 rounded-full border border-violet-300/40 pointer-events-none z-[60] mix-blend-difference";
    ring.style.transform = "translate(-100px, -100px)";
    ring.style.transition = "transform 120ms ease-out, width 200ms ease, height 200ms ease, opacity 200ms ease";
    document.body.appendChild(ring);

    let tx = -100, ty = -100, x = -100, y = -100, raf = 0;
    function loop() {
      tx += (x - tx) * 0.18;
      ty += (y - ty) * 0.18;
      ring.style.transform = `translate(${tx - 16}px, ${ty - 16}px)`;
      raf = requestAnimationFrame(loop);
    }
    function onMove(e: MouseEvent) { x = e.clientX; y = e.clientY; }
    function onOver(e: MouseEvent) {
      const t = e.target as HTMLElement;
      const interactive = t.closest("a, button, [role='button'], input, textarea, select, .card-hover");
      if (interactive) ring.style.opacity = "0.0";
      else ring.style.opacity = "0.7";
    }
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseover", onOver, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
      ring.remove();
    };
  }, []);
  return null;
}
