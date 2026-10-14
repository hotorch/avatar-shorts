// 가로 영상(Side.tsx)에서 아바타 카드를 왼쪽 ↔ 오른쪽으로 옮기는 시각 계산. Remotion 과 검사(render.mjs)·시험이 같이 쓴다.
//   chapter 장면의 props.avatar = 'left' | 'right' 가 다음 chapter 까지 이어진다 (처음은 왼쪽).
//   옮기는 건 그 chapter 장면 안에서 (cutaway 라 카드가 작아져 있는 동안) → 화면이 덜컥이지 않는다.
//   9분 내내 같은 배치면 단조롭다 (기획안: "오른쪽 배치, 왼쪽 자료 지시 → 왼쪽 배치, 비교 설명").

export const SWAP = {DELAY: 0.15, DUR: 0.6};

const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3));

/** 장(章)별 아바타 자리 목록 [{at, side}] (시간 순). side 를 적은 chapter 만 */
export const sideMarks = (scenes) =>
  (scenes ?? [])
    .filter((s) => s.template === 'chapter' && (s.props?.avatar === 'left' || s.props?.avatar === 'right'))
    .map((s) => ({at: s.in, side: s.props.avatar}))
    .sort((a, b) => a.at - b.at);

/** t 초에 아바타가 얼마나 오른쪽인지 0(왼쪽)~1(오른쪽) */
export const avatarSideAt = (scenes, t) => {
  let v = 0;
  for (const m of sideMarks(scenes)) {
    if (t < m.at) break;
    const to = m.side === 'right' ? 1 : 0;
    v = v + (to - v) * ease((t - m.at - SWAP.DELAY) / SWAP.DUR);
  }
  return v;
};

/** 왼쪽 기준 상자를 m 만큼 좌우 반전 (화면 폭 W) */
export const mirrorX = (x, w, m, W = 1920) => x + (W - x - w - x) * m;
