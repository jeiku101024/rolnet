import Image from "next/image";
import { cn } from "@/lib/utils";

const logos = {
  mark: { light: "/brand/rolnet-mark.svg", dark: "/brand/rolnet-mark-dark.svg", width: 255, height: 166, alt: "ROLNET" },
  horizontal: { light: "/brand/rolnet-logo-horizontal-animated.svg", dark: "/brand/rolnet-logo-horizontal-animated-dark.svg", width: 2793, height: 373, alt: "ROLNET" },
  full: { light: "/brand/rolnet-logo-jefmaejake-animated.svg", dark: "/brand/rolnet-logo-jefmaejake-animated-dark.svg", width: 2016, height: 1139, alt: "ROLNET JEFMAEJAKE" },
} as const;

/**
 * The ROLNET logo in its light and dark artwork. The full and horizontal logos are the animated SVGs (their own
 * reduced-motion rule stops them); the small mark stays still.
 * Both are in the page and the theme class decides
 * which one shows (`brand-light-only` / `brand-dark-only` in globals.css), so the swap needs no
 * script and printing always uses the light artwork.
 */
export function BrandLogo({ variant, className, priority = false }: { variant: keyof typeof logos; className?: string; priority?: boolean }) {
  const logo = logos[variant];
  return (
    <>
      <Image className={cn(className, "brand-light-only")} src={logo.light} alt={logo.alt} width={logo.width} height={logo.height} priority={priority} />
      <Image className={cn(className, "brand-dark-only")} src={logo.dark} alt={logo.alt} width={logo.width} height={logo.height} priority={priority} />
    </>
  );
}
