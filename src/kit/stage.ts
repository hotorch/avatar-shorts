import {createContext, useContext} from 'react';

/** 장면이 그려지는 무대 크기. 템플릿은 이 크기에 맞춰 스스로 배치를 바꾼다. float = 머리 위/아래에 떠 있는 납작한 카드 */
export type Stage = {
  w: number;
  h: number;
  kind: 'full' | 'panel' | 'side' | 'float';
  /** 내용이 작을 때 붙일 쪽: end = 아래(머리 위 카드), start = 위(턱 아래 카드). 기본 가운데 */
  anchor?: 'start' | 'center' | 'end';
};
export const StageCtx = createContext<Stage>({w: 1080, h: 1920, kind: 'full'});
export const useStage = () => {
  const s = useContext(StageCtx);
  const wide = s.w / s.h > 1.05;
  // 기준 스케일: 세로 전체(1080 폭)를 1 로
  const u = s.kind === 'float' ? Math.min(1, s.w / 1000, s.h / 460) : Math.min(s.w / 1080, s.h / (wide ? 880 : 1300));
  return {...s, wide, u};
};
