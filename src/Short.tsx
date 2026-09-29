import React, {useEffect, useState} from 'react';
import {AbsoluteFill, Audio, continueRender, delayRender, Sequence, staticFile, useVideoConfig} from 'remotion';
import {loadFonts} from './kit/fonts';
import {FilterDefs} from './kit/Object3D';
import {makeTheme, ThemeProvider} from './kit/theme';
import {Side} from './layouts/Side';
import {Vertical} from './layouts/Vertical';
import type {Plan, Sfx} from './plan';

export const Short: React.FC<Plan> = (plan) => {
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    loadFonts().then(() => continueRender(handle));
  }, [handle]);

  const theme = makeTheme(plan.theme.palette, plan.theme.accent, plan.theme.triad, plan.theme.surface, plan.theme.accentFromTriad);
  return (
    <ThemeProvider value={theme}>
      <AbsoluteFill style={{background: theme.bg}}>
        <FilterDefs />
        {plan.layout === 'side' ? <Side plan={plan} /> : <Vertical plan={plan} />}
        <SfxLayer plan={plan} />
      </AbsoluteFill>
    </ThemeProvider>
  );
};

/** 효과음: plan.sfx + 각 장면 sfx. 장면에 sfx 를 안 적으면 시작에 옅은 whoosh 하나. */
const SfxLayer: React.FC<{plan: Plan}> = ({plan}) => {
  const {fps} = useVideoConfig();
  const master = plan.sfxVolume ?? 0.5;
  const all: Sfx[] = [
    ...(plan.sfx ?? []),
    ...plan.scenes.flatMap((s) => s.sfx ?? [{t: s.in, cue: s.mode === 'cutaway' ? 'whoosh' : 'whoosh-soft', volume: 0.6}]),
  ];
  return (
    <>
      {all.map((s, i) => (
        <Sequence key={i} from={Math.max(0, Math.round(s.t * fps))} durationInFrames={Math.round(1.5 * fps)} layout="none">
          <Audio src={staticFile(`sfx/${s.cue}.wav`)} volume={(s.volume ?? 1) * master} />
        </Sequence>
      ))}
    </>
  );
};
