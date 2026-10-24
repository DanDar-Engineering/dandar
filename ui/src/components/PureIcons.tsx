// Pure-Ed Rounded Bold Icons (Flaticon style)
import React from "react";

interface IconProps {
  size?: number;
  className?: string;
  animated?: boolean;
}

// Home Icon - Rounded, Bold
export const PureHomeIcon = ({ size = 24, className = "", animated = false }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} ${animated ? "animate-bounce-subtle" : ""}`}
  >
    <path
      d="M3 10L12 3L21 10V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V10Z"
      fill="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="0"
    />
    <path
      d="M9 22V17C9 15.8954 9.89543 15 11 15H13C14.1046 15 15 15.8954 15 17V22"
      fill="white"
      opacity="0.8"
    />
  </svg>
);

// Scan Icon - Rounded, Bold
export const PureScanIcon = ({ size = 24, className = "", animated = false }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} ${animated ? "animate-pulse-glow" : ""}`}
  >
    <rect x="3" y="3" width="18" height="18" rx="3" fill="currentColor" />
    <path d="M6 9H18M6 12H18M6 15H14" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" strokeLinecap="round" />
  </svg>
);

// Study/Cards Icon - Rounded, Bold
export const PureStudyIcon = ({ size = 24, className = "", animated = false }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} ${animated ? "animate-flip" : ""}`}
  >
    <path
      d="M4 5C4 3.89543 4.89543 3 6 3H18C19.1046 3 20 3.89543 20 5V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19V5Z"
      fill="currentColor"
    />
    <path d="M8 8H16M8 12H16M8 16H12" stroke="white" strokeWidth="1.5" strokeOpacity="0.8" strokeLinecap="round" />
  </svg>
);

// Settings Icon - Rounded, Bold
export const PureSettingsIcon = ({ size = 24, className = "", animated = false }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} ${animated ? "animate-spin-slow" : ""}`}
  >
    <circle cx="12" cy="12" r="3" fill="white" opacity="0.8" />
    <path
      d="M12 2C12 2 14.5 2.5 16 4C17.5 5.5 18 8 18 8M12 22C12 22 14.5 21.5 16 20C17.5 18.5 18 16 18 16"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="currentColor"
    />
    <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" />
  </svg>
);

// Chat Icon - Rounded, Bold
export const PureChatIcon = ({ size = 24, className = "", animated = false }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} ${animated ? "animate-bounce-up" : ""}`}
  >
    <path
      d="M3 11C3 7.13401 6.13401 4 10 4H20C21.6569 4 23 5.34315 23 7V16C23 17.6569 21.6569 19 20 19H6L3 22V11Z"
      fill="currentColor"
    />
    <circle cx="7" cy="12" r="1" fill="white" opacity="0.8" />
    <circle cx="12" cy="12" r="1" fill="white" opacity="0.8" />
    <circle cx="17" cy="12" r="1" fill="white" opacity="0.8" />
  </svg>
);

// Loading Spinner - Animated by default
export const PureLoadingIcon = ({ size = 24, className = "" }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} animate-spin`}
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.2" />
    <path
      d="M12 2C6.47715 2 2 6.47715 2 12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

// Lens Icon (PureLogo style)
export const PureLensIcon = ({ size = 24, className = "", animated = false }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} ${animated ? "animate-pulse-glow" : ""}`}
  >
    <defs>
      <linearGradient id="pureLensGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: "currentColor", stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: "currentColor", stopOpacity: 0.8 }} />
      </linearGradient>
    </defs>
    <ellipse cx="20" cy="20" rx="12" ry="16" fill="url(#pureLensGradient)" />
    <ellipse cx="16" cy="14" rx="5" ry="7" fill="white" opacity="0.4" />
  </svg>
);
