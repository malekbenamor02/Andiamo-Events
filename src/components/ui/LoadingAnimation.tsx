import { cn } from "@/lib/utils";

interface LoadingAnimationProps {
  type?: "spinner" | "dots" | "wave" | "pulse" | "bars";
  size?: "sm" | "md" | "lg" | "xl";
  color?: "primary" | "white" | "muted" | "gradient";
  className?: string;
  text?: string;
  showText?: boolean;
}

const LoadingAnimation = ({ 
  type = "spinner",
  size = "md", 
  color = "primary", 
  className,
  text,
  showText = true 
}: LoadingAnimationProps) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8", 
    lg: "w-12 h-12",
    xl: "w-16 h-16"
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base", 
    xl: "text-lg"
  };

  const colorClasses = {
    primary: "text-primary",
    white: "text-white",
    muted: "text-muted-foreground",
    gradient: "bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"
  };

  const renderSpinner = () => (
    <div className="relative">
      <div className={cn(
        "rounded-full border-2 animate-spin",
        sizeClasses[size],
        color === "primary" ? "border-primary border-t-transparent" :
        color === "white" ? "border-white border-t-transparent" :
        color === "muted" ? "border-muted-foreground border-t-transparent" :
        "border-primary border-t-transparent"
      )} />
      <div className={cn(
        "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2",
        "w-1 h-1 rounded-full animate-pulse",
        color === "primary" ? "bg-primary" : 
        color === "white" ? "bg-white" : "bg-muted-foreground"
      )} />
    </div>
  );

  const renderDots = () => (
    <div className="flex space-x-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            "rounded-full animate-bounce",
            size === "sm" ? "w-1 h-1" : size === "md" ? "w-2 h-2" : "w-3 h-3",
            colorClasses[color]
          )}
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  );

  const renderWave = () => (
    <div className="flex space-x-1">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={cn(
            "animate-pulse",
            size === "sm" ? "w-1 h-2" : size === "md" ? "w-1 h-4" : "w-1 h-6",
            colorClasses[color]
          )}
          style={{ 
            animationDelay: `${i * 0.1}s`,
            animationDuration: '1s'
          }}
        />
      ))}
    </div>
  );

  const renderPulse = () => (
    <div className={cn(
      "rounded-full animate-pulse",
      sizeClasses[size],
      color === "primary" ? "bg-primary" :
      color === "white" ? "bg-white" :
      color === "muted" ? "bg-muted-foreground" :
      "bg-gradient-to-r from-primary to-secondary"
    )} />
  );

  const renderBars = () => (
    <div className="flex space-x-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            "animate-pulse",
            size === "sm" ? "w-1 h-3" : size === "md" ? "w-2 h-4" : "w-3 h-6",
            colorClasses[color]
          )}
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  );

  const renderAnimation = () => {
    switch (type) {
      case "dots":
        return renderDots();
      case "wave":
        return renderWave();
      case "pulse":
        return renderPulse();
      case "bars":
        return renderBars();
      default:
        return renderSpinner();
    }
  };

  return (
    <div className={cn("flex flex-col items-center justify-center", className)}>
      {renderAnimation()}
      
      {showText && (
        <p className={cn(
          "mt-2 text-center animate-pulse",
          textSizeClasses[size],
          colorClasses[color]
        )}>
          {text || "Loading..."}
        </p>
      )}
    </div>
  );
};

export default LoadingAnimation; 