/** アプリ内で使うアイコン（このアプリ用に作った簡単な線画） */

export type IconName =
  | 'home'
  | 'undo'
  | 'redo'
  | 'close'
  | 'check'
  | 'plus'
  | 'camera'
  | 'image'
  | 'trash'
  | 'front'
  | 'text'
  | 'frame'
  | 'filter'
  | 'sparkle'
  | 'calendar'
  | 'sticker'
  | 'move'
  | 'download'
  | 'share'
  | 'back'
  | 'rotate'
  | 'flip'
  | 'reset'
  | 'edit'
  | 'video';

const PATHS: Record<IconName, string> = {
  home: 'M4 11 12 4l8 7M6 9.5V20h4.5v-5h3v5H18V9.5',
  undo: 'M9 5 4 10l5 5M4 10h10a5 5 0 0 1 0 10h-3',
  redo: 'm15 5 5 5-5 5M20 10H10a5 5 0 0 0 0 10h3',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'm5 12.5 4.5 4.5L19 7',
  plus: 'M12 5v14M5 12h14',
  camera: 'M4 8h3.5L9 5.5h6L16.5 8H20v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 2.5-2.5L20 17M15.5 9.5h.01',
  trash: 'M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13M10.5 11v5.5M13.5 11v5.5',
  front: 'M8 8h11v11H8zM5 15V5h10',
  text: 'M5 6V4.5h14V6M12 4.5V20M9 20h6',
  frame: 'M5 3.5h14v17H5zM7.5 6h9v9.5h-9z',
  filter: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16M12 4v16M12 4a8 8 0 0 1 0 16',
  sparkle: 'M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7M18.5 15.5c.3 1.6.9 2.2 2.5 2.5-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.3 2.2-.9 2.5-2.5',
  calendar: 'M4.5 6h15v14h-15zM4.5 10h15M8.5 3.5V7M15.5 3.5V7M8 14h2M12 14h2M8 17h2',
  sticker: 'M12 20.5c-4.7 0-8.5-3.8-8.5-8.5S7.3 3.5 12 3.5s8.5 3.8 8.5 8.5M20.5 12c0 4.7-3.8 8.5-8.5 8.5 0-4.7 3.8-8.5 8.5-8.5M9 10h.01M14.5 10h.01',
  move: 'M12 3v18M3 12h18M12 3 9.5 5.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5',
  download: 'M12 4v11M7 10.5l5 5 5-5M5 19.5h14',
  share: 'M12 15V4M8 7.5 12 3.5l4 4M7 10.5H5.5V20h13v-9.5H17',
  back: 'M15 5 8 12l7 7',
  rotate: 'M5 12a7 7 0 1 0 2.1-5M5 4v4h4',
  flip: 'M12 3v18M9 7 4 17h5zM15 7l5 10h-5z',
  reset: 'M4.5 12a7.5 7.5 0 1 0 2.4-5.5M4.5 4.5v4h4',
  edit: 'M5 19l1-4L15.5 5.5l3 3L9 18zM13.5 7.5l3 3',
  video: 'M4 6.5h11v11H4zM15 10.5l5-3v9l-5-3',
};

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
