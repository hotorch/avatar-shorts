import React, {useEffect, useState} from 'react';
import {AbsoluteFill, continueRender, delayRender} from 'remotion';
import {loadFonts} from './kit/fonts';
import {fitSize} from './kit/measure';
import {FONT, makeTheme, typeVars} from './kit/theme';
import type {FontFile, Plan, Typography} from './plan';

/**
 * 폰트 조합 비교 시트 (npm run fonts -- sheet). 같은 문장을 조합마다 나란히 놓는다.
 * 칸 하나 = 1080×1920 화면을 360×640 으로 줄인 것 → 폰에서 보이는 크기로 작은 글자가 살아남는지 본다.
 * 위는 밝은 바탕, 아래는 어두운 바탕: 어두운 영상에서만 잘 읽히는 조합을 가려낸다.
 */
export type SheetPair = {
  id: string;
  label: string;
  names: string[];
  stacks?: Typography['stacks'];
  load: FontFile[];
  emphWeight?: number;
  bodyWeight: number;
  caption: string;
};
export type SheetProps = {pairs: SheetPair[]; text: {hook: string; caption: string; title: string}; theme: Plan['theme']};

export const SHEET = {tile: 360, tileH: 640, gap: 28, pad: 36, note: 92};
export const sheetSize = (n: number) => {
  const cols = Math.min(3, Math.max(1, n));
  const rows = Math.max(1, Math.ceil(n / 3));
  return {
    width: SHEET.pad * 2 + cols * SHEET.tile + (cols - 1) * SHEET.gap,
    height: SHEET.pad * 2 + rows * (SHEET.tileH + SHEET.note) + (rows - 1) * SHEET.gap,
  };
};

const Frame: React.FC<{pair: SheetPair; text: SheetProps['text']; accent: string}> = ({pair, text, accent}) => {
  const hook = fitSize(text.hook, 124, 960, 60);
  const caption = fitSize(text.caption, 62, 900, 52);
  const title = fitSize(text.title, 104, 920, 60);
  return (
    <div style={{width: 1080, height: 1920, transform: `scale(${SHEET.tile / 1080})`, transformOrigin: 'left top', ...typeVars(pair.stacks)}}>
      <div style={{height: 960, boxSizing: 'border-box', padding: '110px 70px 0', background: '#F6F3EC', color: '#17171C'}}>
        <div style={{fontFamily: FONT.sans, fontWeight: 600, fontSize: 40, color: '#6B6B73'}}>작은 카드 라벨 Label 09</div>
        <div style={{fontFamily: FONT.head, fontWeight: 800, fontSize: title, lineHeight: 1.2, letterSpacing: '-0.03em', marginTop: 36, whiteSpace: 'nowrap'}}>{text.title}</div>
        <div style={{fontFamily: FONT.head, fontWeight: 900, fontSize: 230, lineHeight: 1.1, letterSpacing: '-0.04em', color: accent, marginTop: 40}}>90%</div>
        <div style={{fontFamily: FONT.sans, fontWeight: 600, fontSize: 52, lineHeight: 1.45, marginTop: 40}}>
          목록은 1초 안에 읽혀야 해요
          <br />
          두 번째 줄도 같은 글꼴로
        </div>
      </div>
      <div style={{height: 960, boxSizing: 'border-box', padding: '0 60px', background: '#101216', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 90}}>
        <div style={{fontFamily: FONT.emph, fontWeight: pair.emphWeight, fontSize: hook, lineHeight: 1.15, color: '#FFFFFF', whiteSpace: 'nowrap', letterSpacing: '-0.01em'}}>{text.hook}</div>
        <div style={{background: '#FBF9F3', color: '#17171C', padding: `${caption * 0.22}px ${caption * 0.42}px`, borderRadius: 8, fontFamily: `"${pair.caption}", "Pretendard", sans-serif`, fontWeight: pair.bodyWeight, fontSize: caption, lineHeight: 1.25, letterSpacing: '-0.02em', whiteSpace: 'nowrap'}}>
          {text.caption}
        </div>
      </div>
    </div>
  );
};

export const TypePairs: React.FC<SheetProps> = ({pairs, text, theme}) => {
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    loadFonts(pairs.flatMap((p) => p.load)).then(() => continueRender(handle));
  }, [handle, pairs]);
  const t = makeTheme(theme.palette, theme.accent, theme.triad, theme.surface, theme.accentFromTriad, theme.background);
  return (
    <AbsoluteFill style={{background: '#E9E6DF', padding: SHEET.pad, boxSizing: 'border-box', fontFamily: '"Pretendard", sans-serif'}}>
      <div style={{display: 'grid', gridTemplateColumns: `repeat(${Math.min(3, Math.max(1, pairs.length))}, ${SHEET.tile}px)`, gap: SHEET.gap}}>
        {pairs.map((p) => (
          <div key={p.id}>
            <div style={{height: SHEET.note, color: '#17171C'}}>
              <div style={{fontWeight: 800, fontSize: 26}}>
                {p.label} <span style={{fontWeight: 500, fontSize: 20, color: '#6B6B73'}}>{p.id}</span>
              </div>
              <div style={{fontWeight: 500, fontSize: 18, color: '#55555C', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden'}}>{p.names.join(' · ')}</div>
            </div>
            <div style={{width: SHEET.tile, height: SHEET.tileH, overflow: 'hidden', borderRadius: 14}}>
              <Frame pair={p} text={text} accent={t.accent} />
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
