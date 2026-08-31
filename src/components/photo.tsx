import type { ComponentProps } from "react";

function avifSrc(src: string) {
  return src.replace(/\.(webp|jpe?g)$/i, ".avif");
}

/** Job photo: AVIF for modern browsers, WebP fallback. */
export function Photo({
  src,
  alt = "",
  decoding = "async",
  ...props
}: ComponentProps<"img">) {
  if (!src) {
    return <img alt={alt} {...props} decoding={decoding} />;
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
