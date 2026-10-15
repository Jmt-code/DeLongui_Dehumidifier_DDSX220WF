// Minimal stroke icon set (24x24 grid)
const PATHS = {
  power: <><path d="M12 3v9" /><path d="M6.3 6.3a8 8 0 1 0 11.4 0" /></>,
  drop: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  thermometer: <><path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z" /><path d="M12 9v7" /></>,
  fan: <><circle cx="12" cy="12" r="2" /><path d="M12 10c0-4 1-7 4-7s3 4-2 7" /><path d="M14 12c4 0 7 1 7 4s-4 3-7-2" /><path d="M12 14c0 4-1 7-4 7s-3-4 2-7" /><path d="M10 12c-4 0-7-1-7-4s4-3 7 2" /></>,
  shirt: <path d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0z" />,
  wind: <><path d="M3 8h11a3 3 0 1 0-3-3" /><path d="M3 12h16a3 3 0 1 1-3 3" /><path d="M3 16h7" /></>,
  filter: <path d="M3 4h18l-7 9v6l-4 2v-8z" />,
  leaf: <><path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15" /><path d="M5 19 13 11" /></>,
  swing: <><path d="M4 12a8 8 0 0 1 16 0" /><path d="m17 9 3 3 3-3" /><path d="m1 9 3 3 3-3" /></>,
  bucket: <><path d="M4 7h16l-2 13H6z" /><path d="M4 7c0-2 3.5-3 8-3s8 1 8 3" /></>,
  alert: <><path d="M12 3 2 20h20z" /><path d="M12 10v4" /><path d="M12 17h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></>,
  logout: <><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4" /><path d="M6 12h10" /></>,
  close: <><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>,
  minus: <path d="M5 12h14" />,
  plus: <><path d="M5 12h14" /><path d="M12 5v14" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>
}

function Icon({ name, size = 20, className = '' }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}

export default Icon
