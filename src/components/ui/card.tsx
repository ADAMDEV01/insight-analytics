import type { HTMLAttributes } from "react";
import { clsx } from "clsx";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <section className={clsx("surface rounded-2xl", className)} {...props} />;
}
export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("flex items-start justify-between gap-4 px-5 pt-5", className)} {...props} />;
}
export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={clsx("text-sm font-semibold tracking-tight", className)} {...props} />;
}
export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("px-5 pb-5", className)} {...props} />;
}
