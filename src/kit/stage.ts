import {createContext, useContext} from 'react';

/** 장면이 그려지는 무대 크기. 템플릿은 이 크기에 맞춰 스스로 배치를 바꾼다. */
export type Stage = {w: number; h: number; kind: 'full' | 'panel' | 'side'};
export const StageCtx = createContext<Stage>({w: 1080, h: 1920, kind: 'full'});
export const useStage = () => {
  const s = useContext(StageCtx);
  const wide = s.w / s.h > 1.05;
  // 기준 스케일: 세로 전체(1080 폭)를 1 로
  const u = Math.min(s.w / 1080, s.h / (wide ? 880 : 1300));
  return {...s, wide, u};
};
