import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-all duration-200",
          className
        )}
        style={{
          background: '#252525',
          borderColor: '#2A2A2A',
          color: '#FFFFFF',
          ...(props.style || {})
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = '#E21836';
          e.currentTarget.style.boxShadow = '0 0 0 2px rgba(226, 24, 54, 0.25)';
          if (props.onFocus) props.onFocus(e);
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = '#2A2A2A';
          e.currentTarget.style.boxShadow = '';
          if (props.onBlur) props.onBlur(e);
        }}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
