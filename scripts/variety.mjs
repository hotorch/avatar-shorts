// 장면 지문 — 연속으로 비슷한 장면을 막는다 (정책 variety). render.mjs 검사와 storyboard.mjs 표가 같이 쓴다
//   지문 4축: 배치(mode) · 등장 모션(템플릿이 정함) · 주인공 에셋(첫 object·center·media src) · 첫 효과음
export const AXES = {mode: '배치', motion: '모션', hero: '주인공', sfx: '첫 효과음'};

export const fingerprint = (sc, motion = {}) => {
  let hero = null;
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) {
        if (hero) return;
        if (typeof x === 'string' && (k === 'object' || k === 'center' || (k === 'src' && sc.template === 'media'))) hero = x;
        else walk(x);
      }
  };
  walk(sc.props);
  return {
    mode: sc.mode ?? null,
    motion: sc.template === 'custom' ? `custom:${sc.component}` : (motion[sc.template] ?? sc.template ?? null),
    hero,
    sfx: [...(sc.sfx ?? [])].sort((a, b) => a.t - b.t)[0]?.cue ?? null,
  };
};

/** 두 지문에서 같은 축 (비어 있는 축은 같다고 보지 않는다) */
export const sharedAxes = (a, b) => Object.keys(AXES).filter((k) => a[k] != null && a[k] === b[k]);

/** 시간순 장면 → 정책 위반 목록. rule = policy.variety, strict = 취향 broll.variety === 'strict' */
export const varietyProblems = (scenes, rule = {}, strict = false) => {
  const r = {windowSec: 5, maxSharedAxes: 1, sameHeroAdjacent: false, morphSameKindRun: false, motion: {}, ...rule};
  const max = strict ? 0 : r.maxSharedAxes;
  const out = [];
  scenes.forEach((s, i) => {
    if (s.template === 'morph' && !r.morphSameKindRun) {
      const st = s.props?.states ?? [];
      st.forEach((x, j) => j && x.kind === st[j - 1].kind && out.push(`정책(다양성) 장면 ${s.id}: morph 가 ${x.kind} → ${x.kind} 로 모양이 그대로입니다 → 다른 kind 로 바꾸거나 한 상태로 합치세요`));
    }
    const p = scenes[i - 1];
    if (!p || s.in - p.out > r.windowSec) return;
    const a = fingerprint(p, r.motion);
    const b = fingerprint(s, r.motion);
    const same = sharedAxes(a, b);
    if (!r.sameHeroAdjacent && same.includes('hero')) out.push(`정책(다양성) 장면 ${p.id}→${s.id}: 주인공 "${b.hero}" 가 연속입니다 → 다른 오브젝트로`);
    else if (same.length > max)
      out.push(`정책(다양성) 장면 ${p.id}→${s.id}: ${same.map((k) => `${AXES[k]} ${b[k]}`).join(' · ')} 가 같습니다 (${max}개까지) → 배치·템플릿·주인공 중 하나를 바꾸세요`);
  });
  return out;
};
