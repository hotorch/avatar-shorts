import React from 'react';
import {Composition, type CalculateMetadataFunction} from 'remotion';
import demo from '../examples/demo/vertical.json';
import demoSide from '../examples/demo/side.json';
import type {Plan} from './plan';
import {Short} from './Short';

// plan.json 하나로 크기·길이가 정해진다: vertical=1080×1920, side=1920×1080
const meta: CalculateMetadataFunction<Plan> = ({props}) => {
  const p = props;
  const fps = p.fps ?? 30;
  const vertical = p.layout !== 'side';
  return {
    fps,
    width: vertical ? 1080 : 1920,
    height: vertical ? 1920 : 1080,
    durationInFrames: Math.max(1, Math.round(p.duration * fps)),
  };
};

export const Root: React.FC = () => (
  <>
    <Composition id="Short" component={Short} width={1080} height={1920} fps={30} durationInFrames={300} defaultProps={demo as Plan} calculateMetadata={meta} />
    <Composition id="DemoSide" component={Short} width={1920} height={1080} fps={30} durationInFrames={300} defaultProps={demoSide as Plan} calculateMetadata={meta} />
  </>
);
