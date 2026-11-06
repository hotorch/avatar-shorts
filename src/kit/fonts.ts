import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';
import type {FontFile} from '../plan';

// 모든 글꼴은 public/fonts 에 들어 있다 (라이선스는 public/fonts/README.md). 네트워크 없이 렌더된다.
// 아래 6종은 늘 읽고, 폰트 조합의 글꼴은 그 영상에 필요한 것만 읽는다 (plan.typography.load).
const LATIN = 'U+0000-024F, U+2000-206F, U+20AC, U+2190-21FF';

let loaded: Promise<unknown> | null = null;

const extra = new Map<string, Promise<unknown>>();
/** @remotion/fonts 의 loadFont 에는 size-adjust 가 없어서 직접 올린다 */
const loadExtra = (f: FontFile) => {
  const key = `${f.family}|${f.file}`;
  if (!extra.has(key)) {
    const face = new FontFace(f.family, `url("${staticFile(f.file)}")`, {
      weight: f.weight,
      ...(f.range ? {unicodeRange: f.range} : {}),
      ...(f.size ? {sizeAdjust: `${Math.round(f.size * 100)}%`} : {}),
    } as FontFaceDescriptors);
    extra.set(key, face.load().then(() => (document.fonts as unknown as Set<FontFace>).add(face)));
  }
  return extra.get(key);
};

export const loadFonts = (files: FontFile[] = []) => Promise.all([loadBase(), ...files.map(loadExtra)]);

const loadBase = () => {
  if (loaded) return loaded;
  loaded = Promise.all([
    loadFont({family: 'Pretendard', url: staticFile('fonts/PretendardVariable.woff2'), weight: '100 900'}),
    loadFont({family: 'SUIT', url: staticFile('fonts/SUIT-Variable.woff2'), weight: '100 900'}),
    loadFont({
      family: 'Instrument Serif',
      url: staticFile('fonts/InstrumentSerif-Italic.woff2'),
      style: 'normal',
      unicodeRange: LATIN,
    }),
    loadFont({family: 'Nanum Myeongjo', url: staticFile('fonts/NanumMyeongjo-ExtraBold.woff2'), weight: '800'}),
    loadFont({family: 'Hakgyoansim Allimjang', url: staticFile('fonts/HakgyoansimAllimjang-B.woff2')}),
    loadFont({family: 'IBM Plex Mono', url: staticFile('fonts/IBMPlexMono-Medium.woff2'), weight: '500'}),
  ]);
  return loaded;
};
