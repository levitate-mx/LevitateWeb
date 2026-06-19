import type { ImgHTMLAttributes } from "react";

type ImageRevealProps = ImgHTMLAttributes<HTMLImageElement> & {
  wrapperClassName?: string;
};

export function ImageReveal({ wrapperClassName = "", className = "", ...props }: ImageRevealProps) {
  return (
    <span className={`image-reveal ${wrapperClassName}`} aria-hidden={props.alt === "" ? "true" : undefined}>
      <img className={className} {...props} />
      <span className="image-reveal__curtain" aria-hidden="true" />
    </span>
  );
}
