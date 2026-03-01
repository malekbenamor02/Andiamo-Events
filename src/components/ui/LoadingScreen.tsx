import { cn } from "@/lib/utils";
import Loader from "./Loader";

interface LoadingScreenProps {
  size?: "sm" | "md" | "lg" | "xl" | "fullscreen";
  text?: string;
  showText?: boolean;
  className?: string;
}

const LoadingScreen = ({
  size = "fullscreen",
  text,
  showText = true,
  className,
}: LoadingScreenProps) => {
  const loaderSize = size === "fullscreen" ? "xl" : size === "xl" ? "xl" : size === "lg" ? "lg" : size === "md" ? "md" : "sm";

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
    xl: "text-lg",
    fullscreen: "text-xl",
  };

  const containerClasses = {
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
    xl: "p-10",
    fullscreen:
      "fixed inset-0 z-50 flex items-center justify-center min-h-screen bg-background/80 backdrop-blur-sm",
  };

  return (
    <div className={cn(containerClasses[size], className)}>
      <div className="flex flex-col items-center justify-center">
        <Loader size={loaderSize} />

        {showText && (
          <div className="mt-6 text-center">
            <p
              className={cn(
                textSizeClasses[size],
                "font-semibold text-muted-foreground animate-pulse"
              )}
            >
              {text ?? "Loading..."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadingScreen;
