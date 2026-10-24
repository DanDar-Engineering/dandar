export const PureLogo = ({ size = "md" }: { size?: "sm" | "md" | "lg" }) => {
  const sizeMap = {
    sm: { container: "w-8 h-8", text: "text-xs" },
    md: { container: "w-10 h-10", text: "text-sm" },
    lg: { container: "w-12 h-12", text: "text-base" },
  };

  const { container, text } = sizeMap[size];

  return (
    <div className="pure-logo">
      <svg
        viewBox="0 0 40 40"
        className={container}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="pureGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: "#4949FF", stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: "#6B6BFF", stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        {/* Oval/Lens shape similar to Pure-Ed logo */}
        <ellipse cx="20" cy="20" rx="12" ry="16" fill="url(#pureGradient)" />
        {/* Inner highlight for depth */}
        <ellipse cx="16" cy="14" rx="5" ry="7" fill="white" opacity="0.4" />
      </svg>
      <span className={`font-semibold text-pure-text-primary ${text}`}>Pure</span>
    </div>
  );
};

export const PureLogoIcon = ({
  size = "md",
  animated = false
}: {
  size?: "sm" | "md" | "lg"
  animated?: boolean
}) => {
  const sizeMap = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  };

  return (
    <svg
      viewBox="0 0 40 40"
      className={`${sizeMap[size]} ${animated ? "animate-spin" : ""}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="pureGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#4949FF", stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: "#6B6BFF", stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      <ellipse cx="20" cy="20" rx="12" ry="16" fill="url(#pureGradient2)" />
      <ellipse cx="16" cy="14" rx="5" ry="7" fill="white" opacity="0.4" />
    </svg>
  );
};
