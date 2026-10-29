// 발표자 효과(fx) — 고르는 기준(정책 presenterFx)과 오려내기 파일 확인. render.mjs 검사와 fx.mjs(오려내기)가 같이 쓴다
//   랜덤 배치는 없다: 그 장면의 말이 효과의 말과 맞고(쓰는 단어가 그 장면에서 실제로 나오고), 발표자가 화면에 있고,
//   길이·실물 개수가 하한을 채울 때만. 같은 효과는 영상당 한 번. 그래프 숫자는 데이터 파일에서만.
import fs from 'node:fs';
import path from 'node:path';

/** 효과 이름 (src/fx/index.tsx FX_EFFECTS · 정책 presenterFx.effects · presenter-fx.md 와 같아야 한다 — 시험이 확인) */
export const FX = ['freeze', 'text-behind', 'shoulder', 'grade-wipe', 'tier', 'glass-chart'];

export const fxFiles = (dir, id) => ({
  cutout: path.join(dir, 'fx', `${id}.cutout.webm`),
  track: path.join(dir, 'fx', `${id}.track.json`),
});

/** 오려내기가 지금 장면(렌더 시간 in/out)과 영상(src)에 맞는지. 안 맞으면 이유 문자열 */
export const fxStale = (dir, sc, src) => {
  const f = fxFiles(dir, sc.id);
  if (!fs.existsSync(f.cutout) || !fs.existsSync(f.track)) return '오려내기가 없습니다';
  let s;
  try {
    s = JSON.parse(fs.readFileSync(f.track, 'utf8')).summary;
  } catch {
    return 'track.json 을 못 읽습니다';
  }
  if (s.src !== path.basename(src)) return `다른 영상(${s.src})에서 오려냈습니다`;
  if (Math.abs(s.from - sc.in) > 0.02 || Math.abs(s.to - sc.out) > 0.02)
    return `장면 시간이 바뀌었습니다 (오려낸 ${s.from.toFixed(2)}–${s.to.toFixed(2)}s, 지금 ${sc.in.toFixed(2)}–${sc.out.toFixed(2)}s)`;
  if (fs.statSync(src).mtimeMs > fs.statSync(f.track).mtimeMs) return '영상이 오려낸 뒤에 다시 만들어졌습니다';
  return null;
};

const bare = (s) => String(s).normalize('NFC').replace(/[\s.,!?…·~"'“”‘’()]+/g, '');
/** 장면 안 단어 (장면 기준 초) */
export const sceneWords = (words, sc) =>
  words.filter((w) => w.start >= sc.in - 0.01 && w.start < sc.out).map((w) => ({text: w.text, start: +(w.start - sc.in).toFixed(3), end: +(w.end - sc.in).toFixed(3)}));
/** 단어 하나가 그 장면에서 나오는가 (조사·문장부호가 붙어도). src/fx/fx.tsx onset 과 같은 규칙 */
export const saysWord = (words, w) => words.some((x) => bare(x.text).startsWith(bare(w)));
/** 여러 단어 이름(“김 하나”)이 이어서 나오는가 */
export const saysPhrase = (words, text) => words.map((x) => bare(x.text)).join('').includes(bare(text));

/** 효과에 필요한 실물 개수 (정책 effects.<이름>.minItems 와 비교) */
const items = (sc, data) => {
  const p = sc.props ?? {};
  if (sc.template === 'shoulder') return [p.left, p.right].filter((c) => c?.title).length;
  if (sc.template === 'tier') return (p.rows ?? []).reduce((n, r) => n + (r.items ?? []).length, 0);
  if (sc.template === 'glass-chart') return data?.bars?.length ? 1 : 0;
  return 0;
};

/**
 * fx 장면 검사. scenes = 렌더 시간, words = 렌더 시간 단어 전체.
 * ctx = {dir, src(영상 파일), layout, live(public 경로 앞부분)}  (오브젝트 이름은 render 가 장면 전체에서 확인)
 * → {problems, warn}. 통과한 장면에는 render 가 쓸 값(fx, props.words, props.chart, props.after)을 채운다.
 */
export const fxCheck = (scenes, words, pol = {}, ctx) => {
  const P = {oncePerVideo: true, faceMissMax: 0.3, effects: {}, ...pol};
  const problems = [];
  const warn = [];
  const used = {};
  for (const sc of scenes) {
    const w = `장면 ${sc.id}`;
    const isFx = FX.includes(sc.template);
    if (sc.mode !== 'fx') {
      if (isFx) problems.push(`${w}: ${sc.template} 는 발표자 효과입니다 → mode "fx"`);
      continue;
    }
    if (!isFx) {
      problems.push(`${w}: mode fx 의 template 은 효과 이름입니다 (${FX.join(', ')})`);
      continue;
    }
    if (ctx.layout === 'side') {
      problems.push(`${w}: 발표자 효과는 세로 영상에서만 됩니다`);
      continue;
    }
    if (!ctx.src) {
      problems.push(`${w}: 발표자 효과는 발표자 영상이 있어야 합니다`);
      continue;
    }
    const spec = {minSec: 0, minItems: 0, ...P.effects[sc.template]};
    (used[sc.template] ??= []).push(sc.id);
    const dur = sc.out - sc.in;
    if (dur < spec.minSec - 0.005) problems.push(`정책(fx) ${w}: ${dur.toFixed(2)}초 — ${sc.template} 는 ${spec.minSec}초 이상 (이웃 문장과 합치거나 덜 긴 효과로, 아니면 얼굴로)`);
    const sw = sceneWords(words, sc);
    const p = sc.props ?? {};
    const need = (word, what) => {
      if (!word) problems.push(`${w}: ${what} 가 비었습니다`);
      else if (!saysWord(sw, word)) problems.push(`정책(fx) ${w}: "${word}"(${what}) 를 이 장면에서 말하지 않습니다 — 효과는 그 말을 할 때만 (${sw.map((x) => x.text).join(' ') || '말 없음'})`);
    };
    // 효과마다: 그 말이 실제로 나오는가 (박자도 그 단어에서)
    if (sc.template === 'freeze') {
      if (!p.name || !saysPhrase(sw, p.name)) problems.push(`정책(fx) ${w}: 이름표 "${p.name ?? ''}" 를 이 장면에서 말하지 않습니다 — freeze 는 사람을 소개할 때만`);
      (p.search ?? []).forEach((x) => need(x, 'search'));
      if ((p.hold ?? 1.3) + 0.7 > dur) problems.push(`${w}: ${dur.toFixed(2)}초 장면에 멈춤 ${p.hold ?? 1.3}초가 들어갈 자리가 없습니다 (앞 0.2 + 뒤 0.5초)`);
    }
    if (sc.template === 'text-behind') {
      if (!p.text || !saysWord(sw, p.atWord ?? p.text)) problems.push(`정책(fx) ${w}: "${p.atWord ?? p.text ?? ''}" 를 이 장면에서 말하지 않습니다 — 머리 뒤 글자는 그 이름을 부를 때만`);
      if (p.text && /\s/.test(p.text.trim())) problems.push(`${w}: text-behind 는 한 단어만 ("${p.text}")`);
    }
    if (sc.template === 'shoulder') {
      need(p.left?.atWord, 'left.atWord');
      need(p.right?.atWord, 'right.atWord');
      if (p.sendWord) need(p.sendWord, 'sendWord');
    }
    if (sc.template === 'grade-wipe' || sc.template === 'tier') need(p.atWord, 'atWord');
    if (sc.template === 'grade-wipe' && p.after) {
      const f = path.join(ctx.dir, p.after);
      if (!fs.existsSync(f)) problems.push(`${w}: 보정본 ${f} 없음`);
      else sc.props = {...sc.props, after: `${ctx.live}/${p.after}`};
    }
    if (sc.template === 'tier')
      for (const it of (p.rows ?? []).flatMap((r) => r.items ?? [])) {
        if (it.src && !fs.existsSync(path.join(ctx.dir, it.src))) problems.push(`${w}: 그림 ${path.join(ctx.dir, it.src)} 없음`);
        if (it.src) it.src = `${ctx.live}/${it.src}`;
        if (!saysPhrase(words, it.name)) warn.push(`${w}: 순위 항목 "${it.name}" 은 영상에서 말하지 않았습니다 — 말하지 않은 이름·로고는 화면에 만들지 않는 게 원칙`);
      }
    let data = null;
    if (sc.template === 'glass-chart') {
      if (p.total != null || p.bars || p.chart) problems.push(`정책(fx) ${w}: 그래프 숫자를 plan 에 직접 적었습니다 — data: "broll/<파일>.json" (출처가 있는 데이터 파일)로`);
      const f = p.data && path.join(ctx.dir, p.data);
      if (!f || !fs.existsSync(f)) problems.push(`${w}: data 파일 ${f ?? '(비어 있음)'} 없음`);
      else {
        try {
          data = JSON.parse(fs.readFileSync(f, 'utf8'));
        } catch (e) {
          problems.push(`${w}: ${f} 를 못 읽습니다 (${e.message})`);
        }
        if (data) {
          if (!data.source) problems.push(`정책(fx) ${w}: ${p.data} 에 source(숫자를 어디서 쟀는지)가 없습니다`);
          if (typeof data.total !== 'number' || !Array.isArray(data.bars) || !data.bars.every((b) => b.label && typeof b.value === 'number'))
            problems.push(`${w}: ${p.data} 는 {title, unit, total, bars: [{label, value}], source} 모양이어야 합니다`);
          else {
            sc.props = {...sc.props, chart: data};
            const tot = String(data.total);
            if (!sw.some((x) => x.text.replace(/[^0-9.]/g, '').startsWith(tot.split('.')[0])))
              warn.push(`${w}: 합계 ${tot}${data.unit ?? ''} 를 이 장면에서 말하지 않습니다 — 숫자는 말할 때 보여 주는 게 원칙`);
          }
        }
      }
    }
    if (items(sc, data) < spec.minItems) problems.push(`정책(fx) ${w}: ${sc.template} 는 실물 ${spec.minItems}개가 필요합니다 (지금 ${items(sc, data)}개)`);
    // 오려내기
    const stale = fxStale(ctx.dir, sc, ctx.src);
    if (stale) problems.push(`${w}: ${stale} → npm run fx -- ${path.basename(ctx.dir)}`);
    else {
      const track = JSON.parse(fs.readFileSync(fxFiles(ctx.dir, sc.id).track, 'utf8'));
      const miss = track.summary.face_miss_rate ?? 0;
      if (miss > P.faceMissMax) problems.push(`정책(fx) ${w}: 얼굴을 못 찾은 프레임이 ${Math.round(miss * 100)}% — 발표자가 화면에 있을 때만 (${Math.round(P.faceMissMax * 100)}% 까지)`);
      sc.fx = {cutout: `${ctx.live}/fx/${sc.id}.cutout.webm`, track};
    }
    if (sc.template === 'shoulder' && p.scale == null && P.shoulderScale) sc.props = {...sc.props, scale: P.shoulderScale};
    sc.props = {...sc.props, words: sw};
  }
  if (P.oncePerVideo)
    for (const [k, ids] of Object.entries(used)) if (ids.length > 1) problems.push(`정책(fx): ${k} 가 장면 ${ids.join(', ')} 에 두 번 — 같은 효과는 영상당 한 번`);
  return {problems, warn};
};
