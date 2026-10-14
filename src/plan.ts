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
  /** 단어별 시작 시각 (text 를 띄어쓰기로 나눈 순서, 렌더 시간). render 가 words.json 에서 채운다 → 노래방식 자막 */
  w?: number[];
};

/** 장면 안 카메라: at 초부터 dur 초 동안 무대의 (x, y)(0~1) 쪽으로 scale 배 다가간다. 대사가 세부를 가리킬 때 */
export type SceneCamera = {at: number; x: number; y: number; scale: number; dur?: number};

export type Sfx = {t: number; cue: string; volume?: number};

export type Scene = {
  id: string;
  in: number;
  out: number;
  /**
   * cutaway = 화면 전체, panel = 위 칸 판(얼굴은 아래),
   * above = 머리 위에 떠 있는 카드, below = 턱 아래 카드 (가로 영상에선 둘 다 panel 처럼)
   */
  mode: 'cutaway' | 'panel' | 'above' | 'below';
  /** src/scenes 의 템플릿 이름, 또는 'custom' */
  template: string;
  /** template === 'custom' 일 때 src/custom/<component>.tsx */
  component?: string;
  props: Record<string, unknown>;
  sfx?: Sfx[];
  /**
   * 컷어웨이가 끝날 때: wipe = 둥근 창이 닫힘(기본), avatar-grow = 가운데 작은 아바타 틀이 계단식으로 커져 화면을 채움.
   * 비워 두면 render 가 취향 broll.exit 로 채운다 (뒤가 얼굴일 때만).
   */
  exit?: 'wipe' | 'avatar-grow';
  /** 장면 안 카메라 이동 (원본 시간 at). 없으면 취향 broll.camera 의 느린 줌인만 */
  camera?: SceneCamera;
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
    /** 바깥 띠 (0~1, scripts/probe.py inset_frame): 아바타 도구가 인물 화면을 줄여 넣어 생긴 단색 테두리. 안쪽 배경색으로 덮는다 */
    inset?: {top: number; left: number; right: number; colors: {top: string; left: string; right: string}} | null;
    /** 배경을 지운 투명 아바타 (scripts/matte.py → avatar.webm, 소리 포함). 있으면 side 는 카드 대신 사람만, vertical 은 회색 배경 대신 Backdrop 위에 사람만. crop = 원본에서 잘라 낸 영역(px) */
    matte?: {src: string; crop: {x: number; y: number; w: number; h: number}};
    /** 머리 상자 중앙값 (0~1, scripts/face.py) */
    head?: {top: number; chin: number; left: number; right: number};
    /** [렌더 시간 초, top, chin, left, right] — render 가 편집 시간으로 옮겨 넣는다 */
    track?: number[][];
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
  /** 아바타 확대 퇴장 레시피 (정책 avatarGrow → render 가 채움). steps.before = durationSec 에 대한 비율 */
  avatarGrow?: {durationSec: number; steps: {before: number; scale: number}[]; settleSec: number};
  /** 자막 크기 배율 (취향 captions.scale) */
  captionScale?: number;
  /** 노래방식 자막: 지금 말하는 단어에 강조 블록 (취향 captions.karaoke) */
  captionKaraoke?: boolean;
  /** 장면마다 처음→끝 느린 줌인 배율 (취향 broll.camera: drift = 0.035, off = 0) */
  cameraDrift?: number;
  captions: Cue[];
  scenes: Scene[];
  sfx?: Sfx[];
  /** 효과음 전체 볼륨 (0~1, 기본 0.5) */
  sfxVolume?: number;
};
