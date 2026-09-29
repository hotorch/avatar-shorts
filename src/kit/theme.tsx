import React, {createContext, useContext} from 'react';
import type {AccentName, PaletteName} from '../plan';

// 팔레트 3종. 중립색 80% + 강조색 20% 원칙.
export type Theme = {
  name: PaletteName;
  dark: boolean;
  bg: string; // 바탕
  paper: string; // 카드·패널 면
  paper2: string; // 한 단계 깊은 면
  grid: string; // 점선 격자
  line: string; // 배경 대각선 2개 (바탕에서 파생, 저대비)
  ink: string; // 본문 글자
  muted: string; // 보조 글자
  accent: string; // 강조색
  accentInk: string; // 강조색 위 글자
  accentSoft: string; // 강조색 옅은 면
  shadow: string; // 그림자 색 (rgba)
  grid_kind: 'dot' | 'cross';
  object: 'clay' | 'color' | 'tint'; // 3D 오브젝트 기본 재질 (tint = 강조색 듀오톤)
  triad: {dark: string; accent: string; light: string}; // 그라디언트 면의 3색 (정책)
  surface: 'gradient' | 'flat';
};

export const ACCENTS: Record<AccentName, string> = {
  purple: '#4B2BBF',
  teal: '#12B5A6',
  yellow: '#F2B705',
  blue: '#2F5BEA',
  red: '#E0402E',
  terracotta: '#C8623A',
};

const BASE: Record<PaletteName, Omit<Theme, 'accentSoft' | 'accentInk' | 'triad' | 'surface'> & {accentInk?: string}> = {
  editorial: {
    name: 'editorial',
    dark: false,
    bg: '#F3F0E8',
    paper: '#FBFAF6',
    paper2: '#E9E5DA',
    grid: 'rgba(40,36,28,0.16)',
    line: 'rgba(120,108,88,0.10)',
    ink: '#141312',
    muted: '#6E6A62',
    accent: ACCENTS.purple,
    shadow: 'rgba(40,32,20,0.18)',
    grid_kind: 'dot',
    object: 'tint',
  },
  darktech: {
    name: 'darktech',
    dark: true,
    bg: '#14171B',
    paper: '#1D2227',
    paper2: '#252B32',
    grid: 'rgba(170,200,210,0.13)',
    line: 'rgba(120,200,210,0.08)',
    ink: '#F2F5F7',
    muted: '#8C98A3',
    accent: ACCENTS.teal,
    accentInk: '#06201D',
    shadow: 'rgba(0,0,0,0.45)',
    grid_kind: 'dot',
    object: 'color',
  },
  academic: {
    name: 'academic',
    dark: false,
    bg: '#F6F0E2',
    paper: '#FCF8EF',
    paper2: '#EDE3CF',
    grid: 'rgba(90,70,40,0.16)',
    line: 'rgba(150,110,70,0.10)',
    ink: '#2B2A28',
    muted: '#766D60',
    accent: ACCENTS.terracotta,
    shadow: 'rgba(70,45,20,0.18)',
    grid_kind: 'cross',
    object: 'tint',
  },
};

const hexToRgb = (hex: string) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const alpha = (hex: string, a: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

const luminance = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// 트라이어드를 안 주면 팔레트에서 만든다 (style/policy.json 의 paletteDefault 와 같은 값)
const TRIAD: Record<PaletteName, [string, string, string]> = {
  darktech: ['#0B2B2F', '#12B5A6', '#DDF3EF'],
  editorial: ['#1E1446', '#8A6CF0', '#ECE6FF'],
  academic: ['#3B2A20', '#E07A4F', '#F4ECDD'],
};

export const makeTheme = (
  palette: PaletteName,
  accent?: AccentName,
  triad?: [string, string, string],
  surface: 'gradient' | 'flat' = 'flat',
  accentFromTriad = !!triad,
): Theme => {
  const b = BASE[palette] ?? BASE.editorial;
  const tri = triad ?? TRIAD[palette] ?? TRIAD.editorial;
  // 정책: 한 영상에 강조색 하나 — 트라이어드를 골랐으면 그 포인트색이 강조색 (style.mjs 가 글자 대비를 보고 accentFromTriad 를 정한다)
  const acc = accentFromTriad && triad ? tri[1] : accent ? ACCENTS[accent] : b.accent;
  return {
    ...b,
    accent: acc,
    triad: {dark: tri[0], accent: tri[1], light: tri[2]},
    surface,
    accentInk: (accentFromTriad ? undefined : b.accentInk) ?? (luminance(acc) > 0.45 ? '#141312' : '#FFFFFF'),
    accentSoft: alpha(acc, b.dark ? 0.18 : 0.12),
  };
};

/** 두 색의 대비 (WCAG, 1~21) */
export const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

const Ctx = createContext<Theme>(makeTheme('editorial'));
export const ThemeProvider = Ctx.Provider;
export const useTheme = () => useContext(Ctx);

// 글꼴 스택 (fonts.ts 에서 로드)
export const FONT = {
  sans: '"Pretendard", "SUIT", system-ui, sans-serif',
  suit: '"SUIT", "Pretendard", sans-serif',
  serif: '"Instrument Serif", "Nanum Myeongjo", serif', // 라틴은 Instrument, 한글은 명조로 떨어짐
  myeongjo: '"Nanum Myeongjo", serif',
  emph: '"Instrument Serif", "Hakgyoansim Allimjang", sans-serif', // 강조 레지스터
  mono: '"IBM Plex Mono", ui-monospace, monospace',
};
