interface MarkProps {
  size?: number;
}

/** Hodor's mark: a door, held open a crack */
export const Mark: React.FC<MarkProps> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path
      d="M4 18V7.5a6 6 0 0 1 12 0V18"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    <path d="M7.5 18V8.25a2.5 2.5 0 0 1 5 0V18Z" fill="currentColor" />
    <path d="M2.5 18h15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);
