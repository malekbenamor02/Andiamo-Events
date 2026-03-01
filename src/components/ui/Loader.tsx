import { cn } from "@/lib/utils";

interface LoaderProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "loader-sm",
  md: "loader-md",
  lg: "loader-lg",
  xl: "loader-xl",
};

const Loader = ({ size = "lg", className }: LoaderProps) => (
  <div className={cn("loader", sizeClasses[size], className)} aria-hidden />
);

export default Loader;
