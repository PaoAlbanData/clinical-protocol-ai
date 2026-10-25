// Iconos SVG en línea (sin dependencias externas).
type P = { className?: string };
const base = "h-4 w-4 shrink-0";
const svg = (d: string) =>
  function Icon({ className = base }: P) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={d} />
      </svg>
    );
  };

export const IconMic = svg("M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM19 11a7 7 0 0 1-14 0M12 18v3");
export const IconSend = svg("M5 12h14M13 6l6 6-6 6");
export const IconSpeaker = svg("M11 5 6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13");
export const IconStop = svg("M7 7h10v10H7z");
export const IconCopy = svg("M9 9h10v10H9zM5 15V5h10");
export const IconCheck = svg("M5 12l5 5L20 7");
export const IconFile = svg("M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6");
export const IconExternal = svg("M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5");
export const IconAlert = svg("M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z");
export const IconShield = svg("M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6z");
export const IconChip = svg("M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3M6 6h12v12H6zM10 10h4v4h-4z");
export const IconBooks = svg("M4 19V5a2 2 0 0 1 2-2h4v18H6a2 2 0 0 1-2-2zM10 3h4v18h-4M14 4l4-1 3 17-4 1z");
export const IconX = svg("M6 6l12 12M18 6 6 18");
export const IconSearch = svg("M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4");
