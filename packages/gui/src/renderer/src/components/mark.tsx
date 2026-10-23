import icon from '../assets/hodor-icon.svg';

interface MarkProps {
  size?: number;
}

/** Hodor's icon (assets/brand/hodor-icon.svg) */
export const Mark: React.FC<MarkProps> = ({ size = 22 }) => (
  <img
    src={icon}
    width={size}
    height={size}
    alt=""
    aria-hidden="true"
    className="mark"
    draggable={false}
  />
);
