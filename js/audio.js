/* js/audio.js */
(function (g) {
  "use strict";

  let audioCtx = null;
  let cachedVoices = [];

  function loadVoices() {
    if (!("speechSynthesis" in window)) return;
    cachedVoices = window.speechSynthesis.getVoices() || [];
  }

  if ("speechSynthesis" in window) {
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  function getAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function findBestMaleVoice(targetLang = "ja-JP") {
    if (!cachedVoices.length) loadVoices();

    const maleKeywords = ["keita", "ichiro", "daichi", "takumi", "naoki", "george", "david", "mark", "alex", "male"];
    const femaleKeywords = ["kyoko", "haruka", "nanami", "ayumi", "zira", "jenny", "aria", "female"];

    const jaMale = cachedVoices.find(v => 
      v.lang.toLowerCase().startsWith("ja") &&
      maleKeywords.some(kw => v.name.toLowerCase().includes(kw))
    );
    if (jaMale) return { voice: jaMale, lang: "ja-JP" };

    const enMale = cachedVoices.find(v => 
      v.lang.toLowerCase().startsWith("en") &&
      maleKeywords.some(kw => v.name.toLowerCase().includes(kw))
    );
    if (enMale) return { voice: enMale, lang: "en-US" };

    const jaNonFemale = cachedVoices.find(v => 
      v.lang.toLowerCase().startsWith("ja") &&
      !femaleKeywords.some(kw => v.name.toLowerCase().includes(kw))
    );
    if (jaNonFemale) return { voice: jaNonFemale, lang: "ja-JP" };

    return { voice: null, lang: targetLang };
  }

  function maleKeywordsExist(name) {
    const maleKeywords = ["keita", "ichiro", "daichi", "takumi", "naoki", "george", "david", "mark", "alex", "male"];
    return maleKeywords.some(kw => String(name).toLowerCase().includes(kw));
  }

  function shout(text, lang = "ja-JP") {
    if (!("speechSynthesis" in window) || !text) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const { voice, lang: resolvedLang } = findBestMaleVoice(lang);

    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = resolvedLang;
    }

    const isMale = voice && maleKeywordsExist(voice.name);
    utterance.rate = 1.25;
    utterance.pitch = isMale ? 0.95 : 0.85;
    utterance.volume = 1.0;

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Light Hit (D-moves) - Disabled.
   */
  function playLightHitSFX() {
    // Disabled
  }

  /**
   * Heavy Hit / S-Attack Mini-Bomb Impact
   * Deep audible body drop (280Hz -> 55Hz) + saturated distortion + lowpass explosion tail (400ms).
   */
  function playHeavyHitSFX() {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.40;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.9, now);
    masterGain.connect(ctx.destination);

    // Moderate distortion for warmth without clipping
    const waveShaper = ctx.createWaveShaper();
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    const drive = 18;
    for (let i = 0; i < samples; ++i) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + drive) * x * 20 * deg) / (Math.PI + drive * Math.abs(x));
    }
    waveShaper.curve = curve;
    waveShaper.oversample = "2x";
    waveShaper.connect(masterGain);

    // 1. Audible Low-End Blast (280Hz -> 55Hz)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(280, now);
    subOsc.frequency.exponentialRampToValueAtTime(55, now + duration);

    subGain.gain.setValueAtTime(1.0, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    subOsc.connect(subGain);
    subGain.connect(masterGain);
    subOsc.start(now);
    subOsc.stop(now + duration);

    // 2. Mid-range Sawtooth Crunch
    const midOsc = ctx.createOscillator();
    const midGain = ctx.createGain();
    midOsc.type = "sawtooth";
    midOsc.frequency.setValueAtTime(520, now);
    midOsc.frequency.exponentialRampToValueAtTime(70, now + 0.25);

    midGain.gain.setValueAtTime(0.65, now);
    midGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    midOsc.connect(midGain);
    midGain.connect(waveShaper);
    midOsc.start(now);
    midOsc.stop(now + 0.25);

    // 3. Lowpass Filtered Noise Blast (Explosion body)
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(1800, now);
    lowpass.frequency.exponentialRampToValueAtTime(200, now + duration);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.7, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noiseSource.connect(lowpass);
    lowpass.connect(noiseGain);
    noiseGain.connect(waveShaper);

    noiseSource.start(now);
    noiseSource.stop(now + duration);
  }

  function playHitSFX(heavy = false) {
    if (heavy) {
      playHeavyHitSFX();
    }
  }

  g.KFAudio = { shout, playHitSFX, playLightHitSFX, getAudioContext };
})(window);
