// plan.json 의 모양. Claude 가 이 파일을 쓰고, Remotion 은 이것만 읽어서 영상을 만든다.
// 시간은 전부 "렌더할 영상 기준 초(sec)" 로 적는다 — edit.py 로 편집했으면 편집본(words.edit.json) 기준. 프레임 계산은 코드가 한다.

export type Layout = 'vertical' | 'side';
export type PaletteName = 'editorial' | 'darktech' | 'academic';
export type AccentName = 'purple' | 'teal' | 'yellow' | 'blue' | 'red' | 'terracotta';

export type Word = {text: string; start: number; end: number};

export type Emph = {text: string; tone?: 'key' | 'money' | 'problem'};

export type Cue = {
  start: number;
  end: number;
  text: string;
  emph?: Emph[];
  /** big = 훅·결론처럼 박스 없이 크게 (전체의 30~40% 이하) */
  style?: 'base' | 'big';
};

export type Sfx = {t: number; cue: string; volume?: number};

export type Scene = {
  id: string;
  in: number;
  out: number;
  /** cutaway = 화면 전체, panel = 아바타가 보이는 채로 카드 */
  mode: 'cutaway' | 'panel';
  /** src/scenes 의 템플릿 이름, 또는 'custom' */
  template: string;
  /** template === 'custom' 일 때 src/custom/<component>.tsx */
  component?: string;
  props: Record<string, unknown>;
  sfx?: Sfx[];
};

export type Plan = {
  title?: string;
  layout: Layout;
  fps?: number;
  /** 영상 전체 길이(초). 비워두면 video 길이 */
  duration: number;
  video?: {
    /** public 기준 경로 (render 스크립트가 public/_live 로 연결) */
    src: string;
    width: number;
    height: number;
    /** 얼굴 중심 (0~1). side 레이아웃에서 아바타 카드 크롭 기준 */
    faceX?: number;
    faceY?: number;
  } | null;
  theme: {
    palette: PaletteName;
    accent?: AccentName;
    /** 정책의 트라이어드 [진한색, 포인트색, 밝은색] — 있으면 강조색은 포인트색 */
    triad?: [string, string, string];
    triadName?: string;
    triadSource?: 'explicit' | 'video' | 'default';
    /** false 면 트라이어드는 면에만, 글자 강조색은 팔레트 기본 */
    accentFromTriad?: boolean;
    /** gradient = 주인공 면에 트라이어드 그라디언트 패널, flat = 단색 */
    surface?: 'gradient' | 'flat';
  };
  /** 컷마다 줌 (edit.py 의 cuts.json → render 가 채움). t 는 편집본 기준 초 */
  punch?: {t: number; scale: number}[];
  /** 자막 크기 배율 (취향 captions.scale) */
  captionScale?: number;
  captions: Cue[];
  scenes: Scene[];
  sfx?: Sfx[];
  /** 효과음 전체 볼륨 (0~1, 기본 0.5) */
  sfxVolume?: number;
};
