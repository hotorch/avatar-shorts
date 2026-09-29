import React from 'react';
import {CUSTOM} from '../custom';
import {Chapter, Hero, Keyword, Palette, Stat} from './basic';
import {Media, Morph} from './morph';
import {Chart, Compare, List, Quote, Steps} from './structured';

// plan.json 의 scene.template 이름 → 컴포넌트
export const TEMPLATES: Record<string, React.FC<any>> = {
  hero: Hero, // 주인공 3D 오브젝트 + 핵심어
  keyword: Keyword, // 큰 타이포 + 밑줄/동그라미
  stat: Stat, // 실제로 말한 숫자
  compare: Compare, // A vs B
  steps: Steps, // 계단식 과정
  list: List, // 체크리스트
  chart: Chart, // 막대 / 추세선
  quote: Quote, // 종이 콜라주 인용 카드
  chapter: Chapter, // 소제목
  morph: Morph, // 한 도형이 pill→card→chat→toggle 로 변신 (+커서)
  media: Media, // 직접 만든 이미지·영상 (Flow 등)
  palette: Palette, // 트라이어드 팔레트 카드 (그라디언트 패널 + 색 탭 3장)
};

export const resolveScene = (template: string, component?: string): React.FC<any> | null => {
  if (template === 'custom') return (component && CUSTOM[component]) || null;
  return TEMPLATES[template] ?? null;
};
