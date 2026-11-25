import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ButtonHTMLAttributes } from "react";

const buttonStyles = cva("inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background", {
  variants: {
    variant: {
      primary: "bg-accent text-white shadow-[0_8px_24px_rgba(112,96,255,.22)] hover:brightness-110",
      secondary: "surface text-foreground hover:bg-panel-raised",
      ghost: "text-muted hover:bg-panel-raised hover:text-foreground",
      danger: "bg-rose-500/12 text-rose-400 hover:bg-rose-500/20",
    },
    size: { sm: "h-9 px-3", md: "h-10 px-4", lg: "h-12 px-5", icon: "h-10 w-10" },
  },
  defaultVariants: { variant: "primary", size: "md" },
});

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size"> & VariantProps<typeof buttonStyles>;
export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={twMerge(clsx(buttonStyles({ variant, size }), className))} {...props} />;
}
