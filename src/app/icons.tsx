// 화면 꾸밈 아이콘 — 이모지 대신 같은 굵기(1.75)·같은 색(currentColor)으로 그린 SVG(결정 35).
// 이모지는 기기마다 모양·색이 달라 통일감이 깨지고 크기에 따라 흐리다(ui-ux-pro-max "SVG icons, no emoji").
// 모두 꾸밈이라 화면 읽기 프로그램에는 숨긴다(aria-hidden) — 뜻은 옆 글자가 전한다.
type IconProps = { className?: string };

function Svg({ className = "size-5", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {children}
    </svg>
  );
}

export const IconSparkle = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
    <path d="M12 7.5 13.6 10.4 16.5 12 13.6 13.6 12 16.5 10.4 13.6 7.5 12 10.4 10.4z" />
  </Svg>
);
export const IconPencil = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
    <path d="m13.5 6.5 4 4" />
  </Svg>
);
export const IconLink = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Svg>
);
export const IconChart = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h16" />
    <path d="M7 16v-4M12 16V8M17 16v-7" />
  </Svg>
);
export const IconUsers = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <path d="M16 4.5a3.5 3.5 0 0 1 0 7M21 20a6 6 0 0 0-3.5-5.5" />
  </Svg>
);
export const IconCalendar = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="5" width="16" height="15" rx="2.5" />
    <path d="M8 3v4M16 3v4M4 10h16" />
  </Svg>
);
export const IconTarget = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="0.5" />
  </Svg>
);
export const IconCheckCircle = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.5 12.2 2.3 2.3 4.7-4.8" />
  </Svg>
);
export const IconList = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
  </Svg>
);
export const IconChat = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 18.5 4 21l3.5-1.5A8.5 8.5 0 1 0 5 18.5z" />
    <path d="M9 10.5h6M9 13.5h4" />
  </Svg>
);
export const IconArrowRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);
export const IconInbox = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 13 6.5 5h11L20 13v5.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z" />
    <path d="M4 13h4.5l1 2h5l1-2H20" />
  </Svg>
);
export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

// 칸 제목 앞 동그란 아이콘 자리 — 파스텔 바탕에 파랑 아이콘(결정 36).
export function IconBadge({ tint = "bg-tint-4", children }: { tint?: string; children: React.ReactNode }) {
  return <span className={`flex size-9 shrink-0 items-center justify-center rounded-full text-brand ${tint}`}>{children}</span>;
}

// 캐릭터 "파일럿" — 파랑 둥근 사각형 안 웃는 말풍선(설문 = 묻고 듣기)과 AI 반짝이(결정 36).
// 웹 아이콘(src/app/icon.svg)·홈 화면 아이콘(apple-icon.tsx)과 같은 그림. mood: 기본 웃음 / 윙크(축하·빈 화면).
export function Mascot({ className = "size-7", mood = "smile" }: IconProps & { mood?: "smile" | "wink" }) {
  return (
    <svg aria-hidden viewBox="0 0 32 32" className={className}>
      <rect width="32" height="32" rx="8" fill="var(--brand)" />
      <path d="M10 7h12a5 5 0 0 1 5 5v4.5a5 5 0 0 1-5 5h-7l-4.5 3.8v-3.9A5 5 0 0 1 5 16.5V12a5 5 0 0 1 5-5z" fill="#fff" />
      <ellipse cx="12.5" cy="13" rx="1.5" ry="1.9" fill="var(--brand)" />
      {mood === "wink" ? (
        <path d="M18 13.4q1.5-1.5 3 0" fill="none" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round" />
      ) : (
        <ellipse cx="19.5" cy="13" rx="1.5" ry="1.9" fill="var(--brand)" />
      )}
      <path d="M13.5 16.4q2.5 2.2 5 0" fill="none" stroke="var(--brand)" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="10.2" cy="16.2" r="1.3" fill="#f9a8d4" />
      <circle cx="21.8" cy="16.2" r="1.3" fill="#f9a8d4" />
      <path d="M26.5 2.8l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z" fill="#fff" />
    </svg>
  );
}

export const LogoMark = Mascot;
