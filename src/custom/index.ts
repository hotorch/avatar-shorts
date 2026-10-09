import type React from 'react';
import {LightBloom} from './LightBloom';
import {OrbitIdea} from './OrbitIdea';
import {StackCarousel} from './StackCarousel';
import {TypeSpecimen} from './TypeSpecimen';

// 템플릿으로 표현이 안 되는 장면은 여기 컴포넌트로 직접 만든다.
// plan.json: { "template": "custom", "component": "OrbitIdea", "props": {...} }
// 새 파일을 만들면 아래 목록에 한 줄 추가하면 된다.
export const CUSTOM: Record<string, React.FC<any>> = {
  OrbitIdea,
  LightBloom,
  TypeSpecimen,
  StackCarousel,
};
