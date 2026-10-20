import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "touch-target inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-body-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-brand text-ink hover:bg-brand-dark hover:text-surface",
        secondary: "bg-brand-soft text-brand-dark hover:bg-canvas",
        outline: "border border-rule bg-surface text-brand-dark hover:bg-brand-soft",
        ghost: "text-brand-dark hover:bg-brand-soft",
        destructive: "bg-danger text-surface hover:bg-brand-dark",
      },
      size: {
        default: "",
        sm: "px-3",
        lg: "px-6 text-body",
        icon: "w-11 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      type={type}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
