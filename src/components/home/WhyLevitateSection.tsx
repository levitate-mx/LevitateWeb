import { type CSSProperties, useEffect, useRef } from "react";
import { galleryImages, whyPillars } from "../../data/homeContent";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { AnimatedTextReveal } from "../motion/AnimatedTextReveal";
import { SectionEyebrow } from "../ui/SectionEyebrow";
import { MotionReveal } from "./MotionReveal";

export function WhyLevitateSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const node = sectionRef.current;
    if (!node || prefersReducedMotion) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const viewport = window.innerHeight || 1;
      const progress = 1 - Math.min(Math.max((rect.bottom - viewport) / (rect.height + viewport), 0), 1);
      const drift = 24 - progress * 48;
      node.style.setProperty("--gallery-drift", `${drift.toFixed(2)}px`);
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
    <section ref={sectionRef} id="por-que-levitate" className="section section--why">
      <div className="section__inner why-layout">
        <MotionReveal className="why-copy">
          <SectionEyebrow>POR QUÉ LEVITATE</SectionEyebrow>
          <AnimatedTextReveal
            as="h2"
            lines={[
              "Aquí el talento",
              <>
                encuentra <span className="text-pink animated-text__accent">alas.</span>
              </>,
            ]}
          />
          <div className="why-pillars">
            {whyPillars.map((pillar, index) => (
              <div className="why-pillar" key={pillar.title}>
                <span aria-hidden="true">0{index + 1}</span>
                <div>
                  <h3>{pillar.title}</h3>
                  <p>{pillar.description}</p>
                </div>
              </div>
            ))}
          </div>
        </MotionReveal>

        <MotionReveal className="gallery-wrap" delay={100}>
          <div className="gallery-track">
            {galleryImages.map((item, index) => (
              <figure className={`gallery-card ${item.className}`} key={item.alt}>
                <img src={item.image} alt={item.alt} loading="lazy" />
                <span className="gallery-card__curtain" aria-hidden="true" />
                <figcaption style={{ "--gallery-index": index } as CSSProperties}>
                  {item.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </MotionReveal>
      </div>
    </section>
  );
}
