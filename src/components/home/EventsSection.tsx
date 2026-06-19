import { ArrowLeft, ArrowRight, MapPin } from "lucide-react";
import { type PointerEvent, useEffect, useRef, useState } from "react";
import { events } from "../../data/homeContent";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { SectionEyebrow } from "../ui/SectionEyebrow";
import { MotionReveal } from "./MotionReveal";

export function EventsSection() {
  const trackRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [trackProgress, setTrackProgress] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const update = () => {
      const maxScroll = track.scrollWidth - track.clientWidth;
      setTrackProgress(maxScroll > 0 ? track.scrollLeft / maxScroll : 1);
    };

    update();
    track.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      track.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const scrollTrack = (direction: "prev" | "next") => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector<HTMLElement>(".event-card");
    const distance = card ? card.offsetWidth + 18 : 360;
    track.scrollBy({ left: direction === "next" ? distance : -distance, behavior: "smooth" });
  };

  const handleCardPointerMove = (event: PointerEvent<HTMLAnchorElement>) => {
    if (prefersReducedMotion || window.matchMedia("(pointer: coarse)").matches) return;

    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const xPercent = x / rect.width;
    const yPercent = y / rect.height;

    card.style.setProperty("--card-x", `${x}px`);
    card.style.setProperty("--card-y", `${y}px`);
    card.style.setProperty("--tilt-x", `${(0.5 - yPercent) * 5}deg`);
    card.style.setProperty("--tilt-y", `${(xPercent - 0.5) * 5}deg`);
  };

  const resetCardTilt = (event: PointerEvent<HTMLAnchorElement>) => {
    event.currentTarget.style.setProperty("--tilt-x", "0deg");
    event.currentTarget.style.setProperty("--tilt-y", "0deg");
  };

  return (
    <section id="eventos" className="section section--events">
      <div className="section__inner">
        <MotionReveal className="events-heading">
          <div>
            <SectionEyebrow>PRÓXIMOS EVENTOS</SectionEyebrow>
            <h2>No te pierdas lo que viene.</h2>
          </div>
          <div className="events-controls" aria-label="Control de eventos">
            <button type="button" onClick={() => scrollTrack("prev")} aria-label="Evento anterior">
              <ArrowLeft aria-hidden="true" size={19} />
            </button>
            <button type="button" onClick={() => scrollTrack("next")} aria-label="Siguiente evento">
              <ArrowRight aria-hidden="true" size={19} />
            </button>
          </div>
        </MotionReveal>

        <div ref={trackRef} className="event-track" aria-label="Próximos eventos">
          {events.map((event, index) => (
            <MotionReveal key={`${event.date}-${event.venue}`} delay={index * 80}>
              <a
                className="event-card"
                href={`/sedes/${event.slug}`}
                aria-label={`Ver sede ${event.venue}`}
                onPointerMove={handleCardPointerMove}
                onPointerLeave={resetCardTilt}
              >
                <img src={event.image} alt="" loading="lazy" />
                <span className="event-card__curtain" aria-hidden="true" />
                <div className="event-card__shade" aria-hidden="true" />
                <div className="event-card__date">
                  <span>{event.date.split(" ")[0]}</span>
                  <span>{event.date.split(" ")[1]}</span>
                </div>
                <div className="event-card__content">
                  <p>{event.name}</p>
                  <h3>{event.venue}</h3>
                  <span className="event-card__location">
                    <MapPin aria-hidden="true" size={16} strokeWidth={1.8} />
                    {event.location}
                  </span>
                  <span className="event-card__cta">
                    Ver evento
                    <ArrowRight aria-hidden="true" size={16} />
                  </span>
                </div>
                <span className="event-card__link" aria-hidden="true">
                  <ArrowRight aria-hidden="true" size={20} />
                </span>
              </a>
            </MotionReveal>
          ))}
        </div>
        <div className="event-progress" aria-hidden="true">
          <span style={{ transform: `scaleX(${trackProgress})` }} />
        </div>
      </div>
    </section>
  );
}
