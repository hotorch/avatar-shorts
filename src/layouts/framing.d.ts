// framing.js 의 타입 (계산은 render.mjs 도 같이 쓰려고 JS 로 둔다)
import type {Plan, Scene} from '../plan';

type Video = Plan['video'];
export type Head = {top: number; chin: number; left: number; right: number};
export type FrameMode = 'panel' | 'above' | 'below' | 'cutaway' | 'face';
export type Fit = {
  mode: FrameMode;
  s: number;
  tx: number;
  ty: number;
  /** panel: 위 판 높이(px) */
  panel: number | null;
  /** above/below: 떠 있는 카드 자리 */
  box: {x: number; y: number; w: number; h: number} | null;
  capY: number;
  top: number;
  chin: number;
  fill: boolean;
  issues: string[];
};
export type Segment = {mode: 'panel' | 'above' | 'below'; in: number; out: number; scenes: Scene[]; fit: Fit};

export const FRAME: {
  W: number;
  H: number;
  SAFE_TOP: number;
  UI_BOTTOM: number;
  CAPTION_Y: number;
  CAP_H: number;
  CAP_GAP: number;
  GAP: number;
  PANEL_MAX: number;
  PANEL_MIN: number;
  FLOAT_X: number;
  ABOVE: {min: number; want: number; max: number};
  BELOW: {min: number; want: number; max: number};
  HEAD_TOP_MIN: number;
  S_MIN: number;
  MERGE_GAP: number;
  RAMP: number;
};
export function headBox(video: Video | undefined, a?: number, b?: number): Head;
export function fitFrame(mode: FrameMode, h: Head, opts?: Partial<typeof FRAME>): Fit;
export function buildFraming(scenes: Scene[], video: Video | undefined, opts?: Partial<typeof FRAME>): Segment[];
export function faceFrame(video: Video | undefined, opts?: Partial<typeof FRAME>): Fit;
export function ramp(a: number, b: number, now: number, dur?: number): number;
export function frameAt(segs: Segment[], base: Fit, now: number): {s: number; tx: number; ty: number; capY: number; k: number; fill: number};
