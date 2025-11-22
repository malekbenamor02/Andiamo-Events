import { cn } from "@/lib/utils";

interface LoadingScreenProps {
  size?: "sm" | "md" | "lg" | "xl" | "fullscreen";
  text?: string;
  showText?: boolean;
  className?: string;
  variant?: "default" | "minimal" | "energetic";
}

const LoadingScreen = ({
  size = "fullscreen",
  text,
  showText = true,
  className,
  variant = "default",
}: LoadingScreenProps) => {
  const sizeClasses = {
    sm: "w-12 h-12",
    md: "w-16 h-16",
    lg: "w-24 h-24",
    xl: "w-32 h-32",
    fullscreen: "w-40 h-40",
  };

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
    fullscreen: "fixed inset-0 z-50 flex items-center justify-center min-h-screen bg-background/80 backdrop-blur-sm",
  };

  // Default variant - Multi-ring neon spinner with gradient
  const renderDefault = () => (
    <div className={cn("relative", sizeClasses[size])}>
      {/* Outer ring - Purple */}
      <div
        className="absolute inset-0 rounded-full border-4 border-transparent"
        style={{
          borderTopColor: "hsl(285 85% 65%)",
          borderRightColor: "hsl(285 85% 65%)",
          animation: "spin 1s linear infinite",
          boxShadow: "0 0 20px hsl(285 85% 65% / 0.5), inset 0 0 20px hsl(285 85% 65% / 0.3)",
        }}
      />

      {/* Middle ring - Cyan (reverse) */}
      <div
        className="absolute inset-2 rounded-full border-4 border-transparent"
        style={{
          borderBottomColor: "hsl(195 100% 50%)",
          borderLeftColor: "hsl(195 100% 50%)",
          animation: "spin 1.5s linear infinite reverse",
          boxShadow: "0 0 15px hsl(195 100% 50% / 0.5), inset 0 0 15px hsl(195 100% 50% / 0.3)",
        }}
      />

      {/* Inner ring - Pink */}
      <div
        className="absolute inset-4 rounded-full border-4 border-transparent"
        style={{
          borderTopColor: "hsl(330 100% 65%)",
          borderRightColor: "hsl(330 100% 65%)",
          animation: "spin 0.8s linear infinite",
          boxShadow: "0 0 10px hsl(330 100% 65% / 0.5), inset 0 0 10px hsl(330 100% 65% / 0.3)",
        }}
      />

      {/* Center pulsing orb */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: size === "fullscreen" ? "16px" : size === "xl" ? "12px" : size === "lg" ? "10px" : "8px",
          height: size === "fullscreen" ? "16px" : size === "xl" ? "12px" : size === "lg" ? "10px" : "8px",
          background: "linear-gradient(135deg, hsl(285 85% 65%), hsl(195 100% 50%), hsl(330 100% 65%))",
          backgroundSize: "200% 200%",
          animation: "pulse-glow 2s ease-in-out infinite, gradient-shift 3s ease infinite",
          boxShadow: "0 0 20px hsl(285 85% 65% / 0.8), 0 0 40px hsl(195 100% 50% / 0.6)",
        }}
      />

      {/* Orbiting particles */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: size === "fullscreen" ? "6px" : size === "xl" ? "5px" : "4px",
            height: size === "fullscreen" ? "6px" : size === "xl" ? "5px" : "4px",
            background: i === 0 ? "hsl(285 85% 65%)" : i === 1 ? "hsl(195 100% 50%)" : "hsl(330 100% 65%)",
            top: "50%",
            left: "50%",
            transformOrigin: size === "fullscreen" ? "0 60px" : size === "xl" ? "0 48px" : size === "lg" ? "0 36px" : "0 24px",
            transform: `translate(-50%, -50%) rotate(${i * 120}deg) translateY(${
              size === "fullscreen" ? "-60px" : size === "xl" ? "-48px" : size === "lg" ? "-36px" : "-24px"
            })`,
            animation: `spin-particle 2s linear infinite`,
            animationDelay: `${i * 0.3}s`,
            boxShadow: `0 0 10px ${i === 0 ? "hsl(285 85% 65% / 0.8)" : i === 1 ? "hsl(195 100% 50% / 0.8)" : "hsl(330 100% 65% / 0.8)"}`,
          }}
        />
      ))}
    </div>
  );

  // Minimal variant - Simple elegant spinner
  const renderMinimal = () => (
    <div className={cn("relative", sizeClasses[size])}>
      <div
        className="absolute inset-0 rounded-full border-4 border-transparent"
        style={{
          borderTopColor: "hsl(285 85% 65%)",
          animation: "spin 1s linear infinite",
          boxShadow: "0 0 30px hsl(285 85% 65% / 0.6)",
        }}
      />
      <div
        className="absolute inset-2 rounded-full border-4 border-transparent"
        style={{
          borderBottomColor: "hsl(195 100% 50%)",
          animation: "spin 1.2s linear infinite reverse",
          boxShadow: "0 0 20px hsl(195 100% 50% / 0.5)",
        }}
      />
    </div>
  );

  // Energetic variant - Fast pulsing with more effects
  const renderEnergetic = () => (
    <div className={cn("relative", sizeClasses[size])}>
      {/* Multiple overlapping rings */}
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="absolute rounded-full border-2"
          style={{
            inset: `${i * 4}px`,
            borderColor: i % 2 === 0 ? "hsl(285 85% 65%)" : "hsl(195 100% 50%)",
            borderTopColor: "transparent",
            borderBottomColor: i % 2 === 0 ? "transparent" : "hsl(330 100% 65%)",
            animation: `spin ${0.8 + i * 0.2}s linear infinite ${i % 2 === 0 ? "" : "reverse"}`,
            opacity: 0.6 + i * 0.1,
            boxShadow: `0 0 ${15 + i * 5}px ${i % 2 === 0 ? "hsl(285 85% 65% / 0.4)" : "hsl(195 100% 50% / 0.4)"}`,
          }}
        />
      ))}

      {/* Center gradient orb */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: size === "fullscreen" ? "20px" : size === "xl" ? "16px" : "12px",
          height: size === "fullscreen" ? "20px" : size === "xl" ? "16px" : "12px",
          background: "linear-gradient(135deg, hsl(285 85% 65%), hsl(195 100% 50%), hsl(330 100% 65%))",
          backgroundSize: "200% 200%",
          animation: "pulse-glow 1s ease-in-out infinite, gradient-shift 2s ease infinite",
          boxShadow: "0 0 30px hsl(285 85% 65% / 1), 0 0 60px hsl(195 100% 50% / 0.8)",
        }}
      />
    </div>
  );

  const renderAnimation = () => {
    switch (variant) {
      case "minimal":
        return renderMinimal();
      case "energetic":
        return renderEnergetic();
      default:
        return renderDefault();
    }
  };

  return (
    <div className={cn(containerClasses[size], className)}>
      <div className="flex flex-col items-center justify-center">
        {renderAnimation()}

        {showText && (
          <div className="mt-6 text-center">
            <p
              className={cn(
                textSizeClasses[size],
                "font-semibold text-transparent bg-clip-text",
                "bg-gradient-to-r from-primary via-secondary to-accent",
                "animate-pulse"
              )}
              style={{
                backgroundSize: "200% 200%",
                animation: "gradient-shift 3s ease infinite, pulse-glow 2s ease-in-out infinite",
                textShadow: "0 0 20px hsl(285 85% 65% / 0.5)",
              }}
            >
              {text || "Loading..."}
            </p>
          </div>
        )}
      </div>

      {/* Add keyframes styles */}
      <style>{`
        @keyframes spin-particle {
          from {
            transform: translate(-50%, -50%) rotate(0deg) translateY(${
              size === "fullscreen" ? "-60px" : size === "xl" ? "-48px" : size === "lg" ? "-36px" : "-24px"
            }) rotate(0deg);
          }
          to {
            transform: translate(-50%, -50%) rotate(360deg) translateY(${
              size === "fullscreen" ? "-60px" : size === "xl" ? "-48px" : size === "lg" ? "-36px" : "-24px"
            }) rotate(-360deg);
          }
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;

