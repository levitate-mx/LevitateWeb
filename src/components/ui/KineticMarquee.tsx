type KineticMarqueeProps = {
  items: string[];
};

export function KineticMarquee({ items }: KineticMarqueeProps) {
  const repeatedItems = [...items, ...items, ...items];

  return (
    <div className="kinetic-marquee" aria-hidden="true">
      <div className="kinetic-marquee__track">
        {repeatedItems.map((item, index) => (
          <span key={`${item}-${index}`}>{item}</span>
        ))}
      </div>
    </div>
  );
}
