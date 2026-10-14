import type {Scene} from '../plan';

export declare const SWAP: {DELAY: number; DUR: number};
export declare const sideMarks: (scenes: Scene[] | undefined) => {at: number; side: 'left' | 'right'}[];
export declare const avatarSideAt: (scenes: Scene[] | undefined, t: number) => number;
export declare const mirrorX: (x: number, w: number, m: number, W?: number) => number;
