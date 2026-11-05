import type { ComponentProps } from "react";

function avifSrc(src: string) {
  return src.replace(/\.(webp|jpe?g)$/i, ".avif");
}

/** Use an explicit fallback when supplied, otherwise prefer the existing AVIF variant. */
export function Photo({
  src,
  fallbackSrc,
  alt = "",
  decoding = "async",
  ...props
}: ComponentProps<"img"> & { fallbackSrc?: string }) {
  if (!src) {
    return <img alt={alt} {...props} decoding={decoding} />;
  }
  if (fallbackSrc) {
    return (
      <picture className="contents">
        <source srcSet={src} type="image/webp" />
        <img src={fallbackSrc} alt={alt} {...props} decoding={decoding} />
      </picture>
    );
  }
  const avif = avifSrc(src);
  if (avif === src) {
    return <img src={src} alt={alt} {...props} decoding={decoding} />;
  }
  return (
    <picture className="contents">
      <source srcSet={avif} type="image/avif" />
      <img src={src} alt={alt} {...props} decoding={decoding} />
    </picture>
  );
}
