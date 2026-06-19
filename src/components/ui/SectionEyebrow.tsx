type SectionEyebrowProps = {
  children: string;
};

export function SectionEyebrow({ children }: SectionEyebrowProps) {
  return <p className="section-eyebrow">{children}</p>;
}
