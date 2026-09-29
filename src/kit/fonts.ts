import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

// 모든 글꼴은 public/fonts 에 들어 있다 (SIL OFL). 네트워크 없이 렌더된다.
const LATIN = 'U+0000-024F, U+2000-206F, U+20AC, U+2190-21FF';

let loaded: Promise<unknown> | null = null;

export const loadFonts = () => {
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
