import { useEffect, useRef } from "react";
import { assets } from "../../data/homeContent";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { AnimatedTextReveal } from "../motion/AnimatedTextReveal";
import { Button } from "../ui/Button";
import { MotionReveal } from "./MotionReveal";

export function FinalCTA() {
  const sectionRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const node = sectionRef.current;
    if (!node || prefersReducedMotion) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const progress = Math.min(Math.max(1 - rect.top / Math.max(window.innerHeight, 1), 0), 1);
      node.style.setProperty("--cta-parallax", `${Math.round(progress * 34)}px`);
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [prefersReducedMotion]);

  return (
    <section ref={sectionRef} id="convocatoria" className="final-cta" aria-labelledby="final-cta-title">
      <img src={assets.hero} alt="" loading="lazy" aria-hidden="true" />
      <div className="final-cta__shade" aria-hidden="true" />
      <MotionReveal className="final-cta__content">
        <p className="section-eyebrow">CONVOCATORIA</p>
        <AnimatedTextReveal
          as="h2"
          id="final-cta-title"
          className="final-cta__title"
          lines={["Inscríbete a nuestra", "convocatoria."]}
        />
        <p>Forma parte de la próxima generación de artistas. Tu momento es ahora.</p>
        {/* Reemplazar href por la URL final del formulario externo cuando esté disponible. */}
        <Button href="/convocatoria">Ir al formulario</Button>
      </MotionReveal>
    </section>
  );
}
