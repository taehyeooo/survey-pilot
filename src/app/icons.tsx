import { useId } from "react";

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

// 칸 제목 앞 동그란 아이콘 자리 — 연보라 바탕에 보라 아이콘(결정 36·37).
export function IconBadge({ children }: { children: React.ReactNode }) {
  return <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-brand">{children}</span>;
}

// 캐릭터 "비행쪽지" — 질문을 적은 쪽지를 접어 만든 종이비행기(결정 37, Figma Make 시안 "03 정돈된 도구"에서 고름).
// 웹 아이콘(src/app/icon.svg)과 같은 그림. variant: mark(흰 바탕 위) / tile(보라 사각형 안). expression: default(비행) / celebrate(축하, 18도 더 들고 반달 눈·비행선).
// 16px 이하는 메모 줄·비행선을 빼고 모양과 눈만(작은 크기에서 뭉개지지 않게).
const PILOT_SILHOUETTE = "M3.8 13 28.2 4.1c.8-.2 1.3.6.8 1.2l-8 21.9c-.3.8-1.3.8-1.7.1l-4.8-7-7.2 1.5c-.8.2-1.3-.8-.7-1.4l5.1-5-7.5-.7c-.9-.1-1.1-1.2-.2-1.7Z";
const PILOT_INK = "var(--brand)";

export function PaperPilot({
  size = 32,
  variant = "mark",
  expression = "default",
  className = "",
}: {
  size?: number;
  variant?: "mark" | "tile";
  expression?: "default" | "celebrate";
  className?: string;
}) {
  const clip = useId();
  const compact = size <= 16;
  const paper = variant === "tile" ? "#ffffff" : "#f8f7ff";
  const shade = variant === "tile" ? "#e5e1ff" : "#dedaff";
  // 사각형 안에서는 조금 작게, 눈으로 보는 가운데로(오른쪽 위로 치우쳐 보이는 것을 보정)
  const pose = [variant === "tile" ? "translate(-0.6 0.7) translate(16 16) scale(0.9) translate(-16 -16)" : "", expression === "celebrate" ? "rotate(-18 16 16)" : ""].join(" ");
  return (
    <svg aria-hidden viewBox="0 0 32 32" width={size} height={size} className={`shrink-0 overflow-visible ${className}`}>
      <defs>
        <clipPath id={clip}>
          <path d={PILOT_SILHOUETTE} />
        </clipPath>
      </defs>
      {variant === "tile" && <rect width="32" height="32" rx="9" fill={PILOT_INK} />}
      {expression === "celebrate" && !compact && (
        <path d="M3.5 24.5q4.2 2.3 7.4-.5" fill="none" stroke={variant === "tile" ? "#ffffff" : PILOT_INK} strokeWidth="1.35" strokeLinecap="round" />
      )}
      <g transform={pose}>
        <path d={PILOT_SILHOUETTE} fill={paper} stroke={paper} strokeWidth="1.2" strokeLinejoin="round" />
        <g clipPath={`url(#${clip})`}>
          <path d="m14.4 20.2 14-16-7.5 23Z" fill={shade} />
          <path d="m14.5 20.1 13.4-15.3M15.3 20.8l3.8 4.3" fill="none" stroke={PILOT_INK} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          {!compact && <path d="m7.8 13.1 6.8-2.5M8.8 15.5l5.1-1.9M10 17.6l3.2-1.2" fill="none" stroke={PILOT_INK} strokeWidth="1.05" strokeLinecap="round" />}
          {expression === "celebrate" ? (
            <path d="M18.2 12q1.7 1.8 3.4-.2M21.9 10.5q1.7 1.8 3.4-.2" fill="none" stroke={PILOT_INK} strokeWidth="2.25" strokeLinecap="round" />
          ) : (
            <g fill={PILOT_INK}>
              <ellipse cx="19.4" cy="11.8" rx="1.65" ry="2.15" transform="rotate(-28 19.4 11.8)" />
              <ellipse cx="22.6" cy="10.5" rx="1.65" ry="2.15" transform="rotate(-28 22.6 10.5)" />
            </g>
          )}
        </g>
      </g>
    </svg>
  );
}

// 로고 표식 — 보라 사각형 안 비행쪽지
export function LogoMark({ size = 28 }: { size?: number }) {
  return <PaperPilot size={size} variant="tile" />;
}
