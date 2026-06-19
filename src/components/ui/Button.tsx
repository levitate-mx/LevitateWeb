import { ArrowRight, Play } from "lucide-react";
import type { AnchorHTMLAttributes, PointerEvent, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  icon?: "arrow" | "play";
};

export function Button({
  children,
  variant = "primary",
  icon = "arrow",
  className = "",
  ...props
}: ButtonProps) {
  const Icon = icon === "play" ? Play : ArrowRight;

  const handlePointerMove = (event: PointerEvent<HTMLAnchorElement>) => {
    props.onPointerMove?.(event);

    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      window.matchMedia("(pointer: coarse)").matches
    ) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 12;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 12;

    event.currentTarget.style.setProperty("--button-shift-x", `${x.toFixed(2)}px`);
    event.currentTarget.style.setProperty("--button-shift-y", `${y.toFixed(2)}px`);
  };

  const handlePointerLeave = (event: PointerEvent<HTMLAnchorElement>) => {
    props.onPointerLeave?.(event);
    event.currentTarget.style.setProperty("--button-shift-x", "0px");
    event.currentTarget.style.setProperty("--button-shift-y", "0px");
  };

  return (
    <a
      className={`button button--${variant} ${className}`}
      {...props}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <span>{children}</span>
      <Icon aria-hidden="true" className="button__icon" size={17} strokeWidth={1.9} />
    </a>
  );
}
