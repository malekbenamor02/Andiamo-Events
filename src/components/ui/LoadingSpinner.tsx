import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  color?: "primary" | "white" | "muted";
  className?: string;
  text?: string;
  showText?: boolean;
}

const LoadingSpinner = ({ 
  size = "md", 
  color = "primary", 
  className,
  text,
  showText = true 
}: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8", 
    lg: "w-12 h-12",
    xl: "w-16 h-16"
  };

  const colorClasses = {
    primary: "border-primary border-t-transparent",
    white: "border-white border-t-transparent",
    muted: "border-muted-foreground border-t-transparent"
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base", 
    xl: "text-lg"
  };

  return (
    <div className={cn("flex flex-col items-center justify-center", className)}>
      {/* Custom Animated Spinner */}
      <div className="relative">
        {/* Outer ring */}
        <div className={cn(
          "rounded-full border-2 animate-spin",
          sizeClasses[size],
          colorClasses[color]
        )} />
        
        {/* Inner pulse dot */}
        <div className={cn(
          "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2",
          "w-1 h-1 rounded-full animate-pulse",
          color === "primary" ? "bg-primary" : 
          color === "white" ? "bg-white" : "bg-muted-foreground"
        )} />
      </div>

      {/* Loading text */}
      {showText && (
        <p className={cn(
          "mt-2 text-center animate-pulse",
          textSizeClasses[size],
          color === "primary" ? "text-primary" :
          color === "white" ? "text-white" : "text-muted-foreground"
        )}>
          {text || "Loading..."}
        </p>
      )}
    </div>
  );
};

export default LoadingSpinner; 