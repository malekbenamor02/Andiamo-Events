import * as React from "react"

import { cn } from "@/lib/utils"

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
          className
        )}
        style={{
          background: '#000000',
          borderColor: '#424242',
          color: '#FFFFFF',
          ...(props.style || {})
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = '#E21836';
          e.currentTarget.style.boxShadow = '0 0 0 2px rgba(226, 24, 54, 0.25)';
          if (props.onFocus) props.onFocus(e);
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = '#424242';
          e.currentTarget.style.boxShadow = '';
          if (props.onBlur) props.onBlur(e);
        }}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
