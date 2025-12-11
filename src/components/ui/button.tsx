import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:brightness-110 shadow-lg hover:shadow-xl",
        destructive:
          "bg-destructive text-destructive-foreground hover:brightness-110 shadow-lg",
        outline:
          "border-2 border-primary text-primary bg-transparent hover:bg-primary hover:text-primary-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:brightness-110 shadow-lg",
        ghost:
          "hover:bg-muted hover:text-foreground",
        link:
          "text-primary underline-offset-4 hover:underline",
        gold:
          "bg-gradient-to-r from-amber-500 to-yellow-400 text-primary-foreground font-bold shadow-lg hover:shadow-xl hover:brightness-110 glow-gold",
        emerald:
          "bg-gradient-to-r from-emerald-600 to-teal-500 text-secondary-foreground font-bold shadow-lg hover:shadow-xl hover:brightness-110 glow-emerald",
        royal:
          "bg-gradient-to-r from-purple-600 to-pink-500 text-accent-foreground font-bold shadow-lg hover:shadow-xl hover:brightness-110 glow-purple",
        casino:
          "bg-gradient-to-r from-red-600 to-orange-500 text-foreground font-bold shadow-lg hover:shadow-xl hover:brightness-110",
        glass:
          "glass text-foreground hover:bg-muted/50",
      },
      size: {
        default: "h-11 px-6 py-2",
        sm: "h-9 rounded-md px-4",
        lg: "h-14 rounded-xl px-10 text-lg",
        xl: "h-16 rounded-xl px-12 text-xl",
        icon: "h-10 w-10",
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
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
