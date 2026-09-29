// 글자 폭 추정 (브라우저 측정 없이 결정적으로). 단위: 글자 크기(em)
// 한글 1.0 / 라틴 대문자·숫자 0.68 / 그 외 라틴 0.56 / 공백 0.32
export const emWidth = (text: string) => {
  let w = 0;
  for (const ch of text) {
    if (/[가-힣ㄱ-ㆎ]/.test(ch)) w += 1.0;
    else if (/[A-Z0-9]/.test(ch)) w += 0.68;
    else if (ch === ' ') w += 0.32;
    else if (/[.,'!?:;·]/.test(ch)) w += 0.3;
    else w += 0.56;
  }
  return w;
};

/** KText 표기(*, _)를 뺀 순수 텍스트 */
export const plain = (text: string) => text.replace(/[*_]/g, '');

/** 가장 긴 줄의 폭(px) 추정 */
export const textWidth = (text: string, size: number, tracking = -0.035) =>
  Math.max(...plain(text).split('\n').map((l) => emWidth(l) * size * (1 + tracking)));

/** 폭 maxW 에 들어가도록 글자 크기를 줄인다 */
export const fitSize = (text: string, size: number, maxW: number, min = size * 0.5) => {
  const w = textWidth(text, size);
  return w <= maxW ? size : Math.max(min, (size * maxW) / w);
};
