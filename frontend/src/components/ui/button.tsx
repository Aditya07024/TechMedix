import * as React from "react";
import { cn } from "@/lib/utils";

const variants = {
  default:
    "bg-primary text-primary-foreground hover:opacity-90",
  outline:
    "border border-input bg-white text-foreground hover:bg-accent hover:text-accent-foreground",
  link: "text-primary hover:underline underline-offset-4",
};

const sizes = {
  sm: "h-9 px-3",
  default: "h-10 px-4 py-2",
  lg: "h-11 px-8",
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      asChild = false,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const classes = cn(
      "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      variants[variant],
      sizes[size],
      className,
    );

    if (asChild && React.isValidElement(props.children)) {
      return React.cloneElement(props.children, {
        className: cn(classes, props.children.props.className),
      });
    }

    return <button ref={ref} type={type} className={classes} {...props} />;
  },
);

Button.displayName = "Button";
