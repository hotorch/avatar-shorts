import React from 'react';
import {Img, interpolate, staticFile} from 'remotion';
import {useExit, useFloat, useSpringAt} from './motion';
import {alpha, useTheme} from './theme';

// public/objects/{clay,color}/<name>.webp — 400px 3D 오브젝트 62종 (CC0)
export const OBJECTS = [
  'bulb', 'chart', 'chess', 'clock', 'target', 'rocket', 'key', 'lock', 'money', 'money-bag', 'dollar',
  '3d-coin', 'wallet', 'trophy', 'medal', 'fire', 'flash', 'heart', 'thumb-up', 'thumb-down', 'tick',
  'megaphone', 'mic', 'camera', 'video-camera', 'computer', 'mobile', 'mail', 'chat', 'chat-bubble',
  'chat-text', 'notify-heart', 'puzzle', 'magic-trick', 'setting', 'tool', 'toggle', 'zoom', 'calender',
  'file-text', 'notebook', 'pencil', 'gift', 'star', 'sun', 'moon', 'map-pin', 'link', 'cup', 'flag',
  'lab', 'gym', 'sheild', 'trash-can', 'folder', 'calculator', 'travel', 'bookmark', 'boy', 'girl',
  'picture', 'music',
] as const;
export type ObjectName = (typeof OBJECTS)[number];

export type Material = 'clay' | 'color' | 'tint' | 'halftone';

export const objectSrc = (name: string, material: 'clay' | 'color') =>
  staticFile(`objects/${material}/${name}.webp`);

/**
 * 사실적인 3D 오브젝트 — 주인공 1개.
 * 진입: 아래에서 떠오르며 살짝 회전, 7% 오버슈트 후 정지 → 느린 부유 + 접지 그림자.
 * material: clay(무채색) / color(원색) / tint(강조색 듀오톤) / halftone(흑백 망점 콜라주)
 */
export const Object3D: React.FC<{
  name: string;
  at?: number;
  size?: number;
  x?: number; // 컨테이너 기준 중심 px
  y?: number;
  material?: Material;
  tilt?: number; // 최종 기울기(도)
  float?: number; // 부유 진폭 px
  depth?: number; // 0~1: 클수록 앞 레이어 (그림자 진하고 부유 큼)
  from?: 'below' | 'left' | 'right' | 'above' | 'scale';
  exit?: boolean;
  shadow?: boolean;
}> = ({
  name,
  at,
  size = 420,
  x,
  y,
  material,
  tilt = 0,
  float = 10,
  depth = 0.7,
  from = 'below',
  exit = true,
  shadow = true,
}) => {
  const t = useTheme();
  const mat = material ?? t.object;
  const s = useSpringAt(at, 'pop');
  const out = useExit(0.35);
  const fy = useFloat(float * (0.6 + depth * 0.6), 3.6 + (1 - depth) * 2, name.length * 0.37);
  const rot = useFloat(1.6, 5.2, name.length * 0.11);

  const dist = 180;
  const dx = from === 'left' ? -dist : from === 'right' ? dist : 0;
  const dy = from === 'below' ? dist : from === 'above' ? -dist : 0;
  const enterScale = from === 'scale' ? interpolate(s, [0, 1], [0.4, 1]) : interpolate(s, [0, 1], [0.82, 1]);
  const ox = interpolate(s, [0, 1], [dx, 0]) ;
  const oy = interpolate(s, [0, 1], [dy, 0]) + fy - out * 60;
  const r = interpolate(s, [0, 1], [tilt - 14, tilt]) + rot;
  const opacity = Math.min(1, s * 1.6) * (1 - out);
  const scale = enterScale * (1 - out * 0.25);

  const imgMat = mat === 'color' || mat === 'halftone' ? 'color' : 'clay';
  const filter =
    mat === 'tint'
      ? 'url(#duo-accent)'
      : mat === 'halftone'
        ? 'grayscale(1) contrast(1.35) brightness(1.02)'
        : undefined;

  const pos: React.CSSProperties =
    x !== undefined && y !== undefined
      ? {position: 'absolute', left: x - size / 2, top: y - size / 2}
      : {position: 'relative'};

  return (
    <div style={{...pos, width: size, height: size, opacity}}>
      {shadow ? (
        <div
          style={{
            position: 'absolute',
            left: '18%',
            width: '64%',
            top: '88%',
            height: '9%',
            borderRadius: '50%',
            background: `radial-gradient(closest-side, ${t.shadow}, transparent)`,
            transform: `translateX(${ox}px) scale(${1 - fy / 120}, 1)`,
            opacity: 0.55 + depth * 0.45,
            filter: 'blur(6px)',
          }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${ox}px, ${oy}px) rotate(${r}deg) scale(${scale})`,
          filter: `drop-shadow(0 ${18 + depth * 18}px ${22 + depth * 16}px ${t.shadow})`,
        }}
      >
        <Img
          src={objectSrc(name, imgMat)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            filter,
            ...(mat === 'halftone' ? HALFTONE_MASK(size) : {}),
          }}
        />
      </div>
    </div>
  );
};

/** 망점 마스크: 균일한 점 격자로 이미지를 오려 인쇄물 같은 하프톤 느낌 */
export const HALFTONE_MASK = (size: number): React.CSSProperties => {
  const cell = Math.max(5, Math.round(size / 70));
  const m = `radial-gradient(circle at center, #000 ${cell * 0.36}px, transparent ${cell * 0.42}px)`;
  return {
    WebkitMaskImage: m,
    maskImage: m,
    WebkitMaskSize: `${cell}px ${cell}px`,
    maskSize: `${cell}px ${cell}px`,
  };
};

/**
 * 레이아웃 최상단에 한 번 넣는 SVG 필터 정의.
 * duo-accent: 밝은 곳은 종이색, 어두운 곳은 강조색의 짙은 톤으로 (clay 오브젝트를 브랜드 색으로 물들임)
 */
export const FilterDefs: React.FC = () => {
  const t = useTheme();
  const [ar, ag, ab] = rgb01(t.accent);
  const [pr, pg, pb] = rgb01(t.dark ? '#E9F2F3' : '#FFFDF8');
  const d = 0.45; // 어두운 끝 = 강조색 * d
  return (
    <svg width={0} height={0} style={{position: 'absolute'}}>
      <defs>
        <filter id="duo-accent" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0" />
          <feComponentTransfer>
            <feFuncR type="table" tableValues={tv(ar * d, ar, pr)} />
            <feFuncG type="table" tableValues={tv(ag * d, ag, pg)} />
            <feFuncB type="table" tableValues={tv(ab * d, ab, pb)} />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
};

const tv = (...v: number[]) => v.map((x) => x.toFixed(3)).join(' ');

const rgb01 = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/** 작은 보조 아이콘 (카드 안, 리스트 앞 등) */
export const ObjIcon: React.FC<{name: string; size?: number; material?: Material; style?: React.CSSProperties}> = ({
  name,
  size = 96,
  material,
  style,
}) => {
  const t = useTheme();
  const mat = material ?? t.object;
  return (
    <Img
      src={objectSrc(name, mat === 'color' ? 'color' : 'clay')}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        filter: `${mat === 'tint' ? 'url(#duo-accent) ' : ''}drop-shadow(0 8px 12px ${alpha('#000000', t.dark ? 0.4 : 0.14)})`,
        ...style,
      }}
    />
  );
};
