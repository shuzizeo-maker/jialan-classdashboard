/* =========================================================
   教室音量：人聲傾向過濾（純計算，瀏覽器／Node 皆可測）
   - 人聲頻帶能量、突發聲排斥、持續性、頻譜平坦度、簡易週期性
   ========================================================= */
(function (root) {
'use strict';

const STRENGTH = {
  off:    { band: false, transient: 99, flatMax: 1, harmMin: 0, bandMin: 0, sustainMs: 0, voiceMin: 0, aboveFrac: 0 },
  light:  { band: true,  transient: 18, flatMax: .92, harmMin: .08, bandMin: .35, sustainMs: 700,  voiceMin: .25, aboveFrac: .45 },
  std:    { band: true,  transient: 12, flatMax: .78, harmMin: .15, bandMin: .45, sustainMs: 1200, voiceMin: .40, aboveFrac: .55 },
  strong: { band: true,  transient: 9,  flatMax: .65, harmMin: .22, bandMin: .55, sustainMs: 1600, voiceMin: .55, aboveFrac: .65 }
};

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function dbFromRms(rms) { return 20 * Math.log10(rms + 1e-8); }
function levelFromDb(db, floor = -60, ceil = 0) {
  return clamp((db - floor) / (ceil - floor) * 100, 0, 100);
}

/** 簡易基二 FFT（實部／虛部就地運算），n 必須為 2 的次方 */
function fftInPlace(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wlr = Math.cos(ang), wli = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wr = 1, wi = 0;
      for (let j = 0; j < len / 2; j++) {
        const u = i + j, v = u + len / 2;
        const tr = wr * re[v] - wi * im[v];
        const ti = wr * im[v] + wi * re[v];
        re[v] = re[u] - tr; im[v] = im[u] - ti;
        re[u] += tr; im[u] += ti;
        const nwr = wr * wlr - wi * wli;
        wi = wr * wli + wi * wlr; wr = nwr;
      }
    }
  }
}

function rmsOf(buf, n) {
  let s = 0;
  const len = n || buf.length;
  for (let i = 0; i < len; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / len);
}

/** 以 FFT 頻帶能量近似 250–3500 Hz 人聲帶（不做昂貴 IIR） */
function bandRmsFromSpectrum(mags, sr, n, f0, f1) {
  const binHz = sr / n;
  const a = Math.max(1, Math.floor(f0 / binHz));
  const b = Math.min(mags.length - 1, Math.ceil(f1 / binHz));
  let s = 0, c = 0;
  for (let i = a; i <= b; i++) { s += mags[i] * mags[i]; c++; }
  return c ? Math.sqrt(s / c) : 0;
}

function totalRmsFromSpectrum(mags) {
  let s = 0;
  for (let i = 1; i < mags.length; i++) s += mags[i] * mags[i];
  return Math.sqrt(s / Math.max(1, mags.length - 1));
}

/** 頻譜平坦度：接近 1＝噪音／刮擦，較低＝有峰／像人聲 */
function spectralFlatness(mags, a, b) {
  let logSum = 0, sum = 0, c = 0;
  for (let i = a; i <= b; i++) {
    const v = mags[i] + 1e-12;
    logSum += Math.log(v); sum += v; c++;
  }
  if (!c || sum <= 0) return 1;
  return Math.exp(logSum / c) / (sum / c);
}

/** 自相關簡易週期性（85–400 Hz），clarity 高＝較像有音高的人聲 */
function pitchClarity(samples, sr, fMin = 85, fMax = 400) {
  const n = samples.length;
  const minLag = Math.floor(sr / fMax);
  const maxLag = Math.min(n - 2, Math.floor(sr / fMin));
  if (maxLag <= minLag + 2) return 0;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += samples[i];
  mean /= n;
  let best = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let ac = 0, e1 = 0, e2 = 0;
    const lim = n - lag;
    for (let i = 0; i < lim; i++) {
      const a = samples[i] - mean, b = samples[i + lag] - mean;
      ac += a * b; e1 += a * a; e2 += b * b;
    }
    const c = ac / (Math.sqrt(e1 * e2) + 1e-12);
    if (c > best) best = c;
  }
  return clamp(best, 0, 1);
}

function median(arr) {
  if (!arr.length) return 0;
  const a = arr.slice().sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/**
 * 分析單一音框
 * @param {Float32Array} samples 時域樣本（建議 1024–2048）
 * @param {number} sr 取樣率
 * @param {object} ctx 可重用緩衝 { re, im, mags, dbHist }
 * @param {object} cfg STRENGTH 設定
 */
function analyseFrame(samples, sr, ctx, cfg) {
  const n = samples.length;
  if (!ctx.re || ctx.re.length !== n) {
    ctx.re = new Float32Array(n);
    ctx.im = new Float32Array(n);
    ctx.mags = new Float32Array(n / 2);
  }
  const { re, im, mags } = ctx;
  re.set(samples); im.fill(0);
  // Hann 窗降低洩漏
  for (let i = 0; i < n; i++) re[i] *= 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1));
  fftInPlace(re, im);
  for (let i = 0; i < mags.length; i++) mags[i] = Math.hypot(re[i], im[i]) / n;

  const rawRms = rmsOf(samples);
  const rawDb = dbFromRms(rawRms);
  // 頻帶能量占比（用功率比，避免 FFT 絕對縮放影響 dB）
  const binHz = sr / n;
  const aBin = Math.max(1, Math.floor(250 / binHz));
  const bBin = Math.min(mags.length - 1, Math.ceil(3500 / binHz));
  let bandPow = 0, totPow = 0;
  for (let i = 1; i < mags.length; i++) {
    const p = mags[i] * mags[i];
    totPow += p;
    if (i >= aBin && i <= bBin) bandPow += p;
  }
  const bandRatio = totPow > 0 ? bandPow / totPow : 0;
  const bandDb = dbFromRms(rawRms * Math.sqrt(Math.max(bandRatio, 1e-6)));
  const flat = spectralFlatness(mags, aBin, bBin);
  const harm = pitchClarity(samples, sr);

  // 突發候選：比近期中位數高出很多（真正判定還要看是否「像噪音」且很快落下）
  ctx.dbHist = ctx.dbHist || [];
  const med = median(ctx.dbHist);
  const jump = rawDb - (Number.isFinite(med) ? med : rawDb);
  const isTransient = cfg.transient < 90 && jump > cfg.transient && ctx.dbHist.length >= 5;
  ctx.dbHist.push(rawDb);
  if (ctx.dbHist.length > 25) ctx.dbHist.shift(); // ~1s @25fps

  let ignore = '';
  let voiceLike = 1;
  if (cfg.band) {
    // 綜合人聲傾向權重：平坦度低、週期性高、人聲帶能量高
    const flatScore = clamp(1 - (flat - 0.05) / Math.max(0.05, cfg.flatMax - 0.05), 0, 1);
    const harmScore = clamp(harm / Math.max(0.05, cfg.harmMin * 1.8), 0, 1);
    const bandScore = clamp(bandRatio / Math.max(0.05, cfg.bandMin), 0, 1);
    voiceLike = flatScore * 0.30 + harmScore * 0.45 + bandScore * 0.25;
    // 突發聲：能量暴衝 + 不像人聲（避免把「開始講話」誤判成掉筆）
    const transientNoise = isTransient && harm < cfg.harmMin && flat > cfg.flatMax * 0.85;
    if (transientNoise) { voiceLike *= 0.05; ignore = '突發聲'; }
    else if (bandRatio < cfg.bandMin * 0.55) { voiceLike *= 0.2; ignore = '非人聲'; }
    else if (voiceLike < cfg.voiceMin) { ignore = '非人聲'; }
  }

  // 講話音量：時域 RMS（瀏覽器端已先經 250–3500 濾波）再乘人聲權重
  const voiceDb = cfg.band
    ? (rawDb + 20 * Math.log10(Math.max(0.08, voiceLike)))
    : rawDb;
  return {
    rawDb, bandDb, voiceDb, voiceLike, ignore,
    flatness: flat, harmonicity: harm, bandRatio, transient: isTransient, jump
  };
}

/** 建立持續追蹤器（講話音量＋持續性） */
function createTracker(strengthKey) {
  let key = strengthKey in STRENGTH ? strengthKey : 'std';
  let cfg = STRENGTH[key];
  const ctx = {};
  const voiceHist = []; // { t, level, like, above }
  let smoothVoice = 0, smoothRaw = 0, loud = 0;
  let lastIgnore = '', ignoreUntil = 0;
  let baseline = -55; // 安靜校正後的環境 dB
  let calibrating = false, calSamples = [], calEnd = 0;

  function setStrength(k) {
    key = k in STRENGTH ? k : 'off';
    cfg = STRENGTH[key];
  }

  function startCalibrate(now = Date.now()) {
    calibrating = true; calSamples = []; calEnd = now + 5000;
  }

  function process(samples, sr, now = Date.now(), thresholdPct = 60) {
    const frame = analyseFrame(samples, sr, ctx, cfg);
    const rawLvl = levelFromDb(frame.rawDb, baseline - 5, baseline + 40);

    // 突發確認：能量衝高後在 ~300ms 內掉回 → 才當成掉筆／咳嗽；持續高＝可能在講話
    ctx._spike = ctx._spike || null;
    if (cfg.band && frame.transient && frame.harmonicity < cfg.harmMin) {
      if (!ctx._spike) ctx._spike = { t0: now, peak: frame.rawDb, like: frame.voiceLike };
      else { ctx._spike.peak = Math.max(ctx._spike.peak, frame.rawDb); ctx._spike.like = Math.min(ctx._spike.like, frame.voiceLike); }
    }
    let decayTransient = false;
    if (ctx._spike) {
      const age = now - ctx._spike.t0;
      if (age >= 280) {
        if (frame.rawDb < ctx._spike.peak - 8 && ctx._spike.like < cfg.voiceMin) decayTransient = true;
        ctx._spike = null;
      }
    }
    if (decayTransient) {
      frame.ignore = '突發聲';
      frame.voiceLike *= 0.05;
    }

    let vDb = frame.voiceDb;
    if (frame.voiceLike < cfg.voiceMin && cfg.band) vDb = Math.min(vDb, baseline);
    let voiceLvl = levelFromDb(vDb, baseline - 5, baseline + 40);
    const rejected = cfg.band && (frame.ignore || frame.voiceLike < cfg.voiceMin);
    if (rejected) {
      voiceLvl = smoothVoice * 0.85;
      lastIgnore = frame.ignore || '非人聲';
      ignoreUntil = now + 700;
    } else {
      lastIgnore = (now < ignoreUntil) ? lastIgnore : '';
    }

    smoothRaw = smoothRaw * 0.8 + rawLvl * 0.2;
    smoothVoice = smoothVoice * 0.75 + voiceLvl * 0.25;

    if (calibrating) {
      calSamples.push(frame.rawDb);
      if (now >= calEnd) {
        calibrating = false;
        const a = calSamples.slice().sort((x, y) => x - y);
        const lo = Math.floor(a.length * 0.1), hi = Math.ceil(a.length * 0.9);
        const slice = a.slice(lo, hi);
        baseline = slice.reduce((s, x) => s + x, 0) / Math.max(1, slice.length);
      }
    }

    // 持續性：視窗內「像人聲且超過門檻」的比例
    const th = thresholdPct;
    const above = !rejected && smoothVoice > th;
    voiceHist.push({ t: now, above, like: frame.voiceLike });
    const win = Math.max(cfg.sustainMs || 400, 400);
    while (voiceHist.length && now - voiceHist[0].t > win) voiceHist.shift();
    const frac = voiceHist.length ? voiceHist.filter(x => x.above).length / voiceHist.length : 0;
    const sustained = !cfg.band || cfg.sustainMs <= 0
      ? smoothVoice > th
      : (frac >= cfg.aboveFrac && smoothVoice > th);

    if (sustained) loud = Math.min(120, loud + 1);
    else loud = Math.max(0, loud - 2);

    return {
      rawLevel: smoothRaw,
      voiceLevel: smoothVoice,
      loud,
      sustained,
      calibrating,
      baseline,
      ignore: now < ignoreUntil ? lastIgnore : '',
      strength: key,
      flatness: frame.flatness,
      harmonicity: frame.harmonicity,
      voiceLike: frame.voiceLike
    };
  }

  return {
    setStrength, startCalibrate, process,
    getBaseline: () => baseline,
    setBaseline: (v) => { baseline = v; },
    STRENGTH
  };
}

/** 合成測試訊號（Node 單元測試用） */
function synth(sr, seconds, fn) {
  const n = Math.floor(sr * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / sr, i);
  return out;
}
function synthVoice(sr = 16000, sec = 1.5, f0 = 140) {
  // 有諧波＋輕微抖動的人聲近似
  return synth(sr, sec, (t) => {
    const vib = f0 * (1 + 0.015 * Math.sin(2 * Math.PI * 5 * t));
    let s = 0;
    for (let h = 1; h <= 5; h++) s += Math.sin(2 * Math.PI * vib * h * t) / h;
    return 0.35 * s;
  });
}
function synthCough(sr = 16000) {
  // 150ms 寬頻爆發
  let state = 123456789 >>> 0;
  return synth(sr, 0.15, (t) => {
    const env = Math.sin(Math.PI * t / 0.15);
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    const r = (state / 0x100000000) * 2 - 1;
    return env * r * 0.8;
  });
}
function synthImpulse(sr = 16000) {
  const out = new Float32Array(Math.floor(sr * 0.05));
  out[2] = 0.95; out[3] = -0.6; out[4] = 0.2;
  return out;
}
function synthScrape(sr = 16000, sec = 1.5) {
  // 持續寬頻噪音（桌椅刮擦近似）— 用跑動 LCG，避免「樣本=f(i)」造成假週期
  let state = 2463534242 >>> 0;
  let prev = 0;
  return synth(sr, sec, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const r = (state / 0x100000000) * 2 - 1;
    // 輕微染色（摩擦感），仍保持寬頻
    prev = prev * 0.3 + r * 0.7;
    return prev * 0.4;
  });
}

const API = {
  STRENGTH, analyseFrame, createTracker, median, dbFromRms, levelFromDb,
  spectralFlatness, pitchClarity, bandRmsFromSpectrum, rmsOf, fftInPlace,
  synthVoice, synthCough, synthImpulse, synthScrape, synth
};
root.VoiceFilter = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
