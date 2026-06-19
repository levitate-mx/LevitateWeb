import type { CSSProperties, ElementType, ReactNode } from "react";

type AnimatedTextRevealProps = {
  as?: ElementType;
  className?: string;
  id?: string;
  lines: ReactNode[];
};

export function AnimatedTextReveal({
  as: Component = "h2",
  className = "",
  id,
  lines,
}: AnimatedTextRevealProps) {
  return (
    <Component id={id} className={`animated-text ${className}`}>
      {lines.map((line, index) => (
        <span className="animated-text__mask" key={index}>
          <span
            className="animated-text__line"
            style={{ "--line-index": index, "--line-delay": `${index * 120}ms` } as CSSProperties}
          >
            {line}
          </span>
        </span>
      ))}
    </Component>
  );
}
