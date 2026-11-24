"use client";
import Link from "next/link";
import { clsx } from "clsx";
import { Loader2 } from "lucide-react";
import { forwardRef, useRef, type ComponentProps, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

type Variant = "primary" | "brand" | "ghost" | "outline" | "dark" | "glass" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[background,box-shadow,color,transform,opacity] duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50";
const variants: Record<Variant, string> = {
  primary: "bg-coral text-white shadow-[0_10px_30px_-10px_rgba(255,122,89,0.8)] hover:bg-coral-deep hover:shadow-[0_14px_34px_-10px_rgba(255,122,89,0.9)]",
  brand: "bg-teal text-white shadow-[0_10px_30px_-12px_rgba(15,139,141,0.9)] hover:bg-deep",
  ghost: "text-ink-soft hover:bg-surface-2 hover:text-ink",
  outline: "border border-line bg-surface text-ink hover:border-teal/40 hover:bg-surface-2",
  dark: "bg-abyss text-foam hover:bg-deep",
  glass: "glass-dark text-white hover:bg-white/15",
  danger: "border border-coral/30 bg-coral/10 text-coral-deep hover:bg-coral/20",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-14 px-7 text-base",
};

export function buttonClass(variant: Variant = "brand", size: Size = "md", className?: string) {
  return clsx(base, variants[variant], sizes[size], className);
}

interface Props extends ComponentProps<"button"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "brand", size = "md", loading, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button ref={ref} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

export function LinkButton({
  href, variant = "brand", size = "md", icon, className, children, ...rest
}: { href: string; variant?: Variant; size?: Size; icon?: ReactNode; className?: string; children: ReactNode } & Omit<ComponentProps<typeof Link>, "href">) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

/** Botão "magnético": puxa levemente em direção ao cursor. */
export function Magnetic({ children, strength = 0.35, className }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 15, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 220, damping: 15, mass: 0.4 });
  return (
    <motion.div
      ref={ref}
      className={clsx("inline-block", className)}
      style={{ x: sx, y: sy }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const r = ref.current!.getBoundingClientRect();
        x.set((e.clientX - r.left - r.width / 2) * strength);
        y.set((e.clientY - r.top - r.height / 2) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}
