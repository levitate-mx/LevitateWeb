import { useEffect, useRef } from "react";
import { ArrowDown } from "lucide-react";
import { assets } from "../../data/homeContent";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { AnimatedTextReveal } from "../motion/AnimatedTextReveal";
import { Button } from "../ui/Button";

export function HeroSection() {
  const heroRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const node = heroRef.current;
    if (!node || prefersReducedMotion) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const progress = Math.min(window.scrollY / Math.max(window.innerHeight, 1), 1);
      node.style.setProperty("--hero-progress", progress.toFixed(3));
      node.style.setProperty("--hero-parallax", `${Math.round(progress * 80)}px`);
      node.style.setProperty("--hero-media-scale", (1 + progress * 0.04).toFixed(3));
      node.style.setProperty("--hero-content-y", `${Math.round(progress * -32)}px`);
      node.style.setProperty("--hero-content-opacity", `${Math.max(1 - progress * 0.65, 0.35).toFixed(3)}`);
      node.style.setProperty("--hero-shade-extra", `${Math.min(progress * 0.28, 0.28).toFixed(3)}`);
      node.style.setProperty("--scroll-cue-opacity", `${Math.max(1 - progress * 5, 0).toFixed(3)}`);
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
    <section ref={heroRef} id="inicio" className="hero" aria-label="Levitate MX">
      <div className="hero__media-shell" aria-hidden="true">
        <img className="hero__media" src={assets.hero} alt="" fetchPriority="high" />
      </div>
      <div className="hero__shade" aria-hidden="true" />

      <div className="hero__content">
        <p className="hero__eyebrow">COMPETENCIA · COMUNIDAD · ESCENARIO</p>
        <AnimatedTextReveal
          as="h1"
          className="hero__title"
          lines={[
            <>
              Vuela <span className="text-pink animated-text__accent">libre</span>
            </>,
            "a donde tu",
            "mente lo pida.",
          ]}
        />
        <p className="hero__body">
          Competencia de danza, workshops y experiencias escénicas para academias y participantes
          que buscan elevar su camino.
        </p>

        <div className="hero__actions" aria-label="Acciones principales">
          <Button href="#eventos">Ver próximos eventos</Button>
        </div>

        <Button href="#eventos" variant="ghost" icon="play" className="hero__trailer">
          Ver tráiler
        </Button>
      </div>

      <a className="scroll-cue" href="#eventos">
        <span>Desliza para explorar</span>
        <ArrowDown aria-hidden="true" size={17} strokeWidth={1.8} />
      </a>
    </section>
  );
}
