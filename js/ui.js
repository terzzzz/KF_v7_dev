/* js/ui.js
 * Battle HUD and status presentation (Bilingual EN / JA).
 *
 * Patch: numeric-status-hud-2 + cyber-tokusatsu-jp-hud + glass-shatter-dmg-fx + i18n-ja + orientation-unlock
 */
(function (g) {
  "use strict";

  const I18N_UI = Object.freeze({
    en: {
      statusNames: {
        typhoon_speed: "Typhoon Charge",
        charge_speed: "Charge Speed",
        focus: "Typhoon Focus",
        typhoon_bless: "Typhoon Bless",
        v3_focus: "V3 Focus",
        red_shutter: "Red Shutter",
        power_focus: "Power Focus",
        double_typhoon_speed: "Double Typhoon",
        red_lamp_boost: "Red Lamp",
        accuracy_focus: "Target Lock",
        arm_calibration: "Arm Calibration",
        rope_bind: "Rope Bind",
        rope_tie_up: "Rope Arm Tie-Up",
        mercury_atk: "Mercury Attack",
        mercury_def: "Mercury Defense",
        mercury_overdrive: "Mercury Overdrive",
        mercury_fortification: "Mercury Fortification",
        kaizorg_vitality: "Kaizorg Vitality",
        airborne_evasion: "Airborne Evasion",
        inca_blessing: "Inca Blessing",
        gigi_focus: "Gigi Focus",
        wild_leap: "Wild Leap",
        wild_instinct: "Wild Instinct",
        high_leap: "High Leap",
        battle_cry: "Battle Cry",
        rider_high_jump: "Rider High Jump",
        rider_power_jump: "Rider Power Jump",
        accelerator: "Accelerator",
        leap: "Leap",
        jump: "Jump",
        bleeding: "Bleeding",
        lprecover: "LP Recovery",
        lpRecovery: "LP Recovery",
        airborne_boost: "Airborne Boost"
      },
      diffLabels: {
        easy: "Rugrat",
        balanced: "All-rounder",
        master: "Geek",
        soul: "Monomaniac",
        rider: "Rider"
      },
      riderNames: {
        ichigo: "Kamen Rider Ichigo",
        nigo: "Kamen Rider Nigo",
        v3: "Kamen Rider V3",
        riderman: "Riderman",
        x: "Kamen Rider X",
        amazon: "Kamen Rider Amazon"
      },
      statLabels: {
        attack: "ATK",
        dAttack: "D-ATK",
        sAttack: "S-ATK",
        armor: "damage taken",
        speed: "charge speed",
        hit: "HIT",
        evs: "EVS",
        hitUnit: "pp",
        evsUnit: "pp",
        lpPerTurn: "LP/turn",
        breaksOnDmg: "breaks on LP damage",
        turnShort: "t",
        durationDetail: (t) => `Engine duration remaining: ${t} turns.`,
        periodicDue: "Eligible for this turn's periodic payment.",
        periodicInitial: "No periodic payment on the initial application turn.",
        periodicRule:
          "Regeneration resolves before bleeding. Regeneration cannot revive a fighter at zero LP."
      },
      hud: {
        lp: "LP",
        chi: "CHI",
        faint: "FAINT",
        faintAria: "Faint buildup",
        faintedOverlay: "FAINTED!",
        ko: "KO",
        faintedState: "FAINTED — forced recovery",
        airborneState: (t) => `AIRBORNE · ${t}t`,
        lowChiText: "LOW CHI · damage taken +25% · EVS -25pp",
        lowChiTitle:
          "Below 5 CHI: incoming LP damage is multiplied by 1.25, evasion is reduced by 25 percentage points, and faint buildup is increased.",
        highChiText: "HIGH CHI · ATK +20% · HIT +20pp",
        highChiTitle:
          "Above 14 CHI: the attack resolver can apply +20% damage and +20 percentage points of accuracy. The attack's CHI cost is paid before these checks.",
        p1PadLabel: "PLAYER 1 [W-A-S-D + I-J-K-L]",
        p2PadLabel: "PLAYER 2 [ARROWS + 1-2-3-5]",
        lockedFlag: "LOCKED!",
        readyText: "READY",
        tapToCharge: "TAP DIRECTION TO CHARGE"
      }
    },

    ja: {
      statusNames: {
        typhoon_speed: "タイフーンチャージ",
        charge_speed: "チャージ加速",
        focus: "タイフーン集中",
        typhoon_bless: "タイフーンの加護",
        v3_focus: "V3集中",
        red_shutter: "レッドシャッター",
        power_focus: "パワー集中",
        double_typhoon_speed: "ダブルタイフーン",
        red_lamp_boost: "レッドランプ集中",
        accuracy_focus: "ターゲットロック",
        arm_calibration: "アーム照準調整",
        rope_bind: "ロープアーム拘束",
        rope_tie_up: "ロープアーム拘束",
        mercury_atk: "マーキュリー・オーバードライブ",
        mercury_def: "マーキュリー装甲強化",
        mercury_overdrive: "マーキュリー・オーバードライブ",
        mercury_fortification: "マーキュリー装甲強化",
        kaizorg_vitality: "カイゾーグ活性",
        airborne_evasion: "空中回避",
        inca_blessing: "インカの秘術",
        gigi_focus: "ギギの腕輪・集中",
        wild_leap: "野生の大跳躍",
        wild_instinct: "野生の本能",
        high_leap: "ハイジャンプ",
        battle_cry: "気合の咆哮",
        rider_high_jump: "ライダー大ジャンプ",
        rider_power_jump: "ライダーパワージャンプ",
        accelerator: "アクセラレーター",
        leap: "V3大ジャンプ",
        jump: "Xジャンプ",
        bleeding: "出血",
        lprecover: "LP回復",
        lpRecovery: "LP回復",
        airborne_boost: "空中強化"
      },
      diffLabels: {
        easy: "ちびっこ",
        balanced: "オールラウンダー",
        master: "マニア",
        soul: "特撮の鬼",
        rider: "ライダー"
      },
      riderNames: {
        ichigo: "仮面ライダー1号",
        nigo: "仮面ライダー2号",
        v3: "仮面ライダーV3",
        riderman: "ライダーマン",
        x: "仮面ライダーX",
        amazon: "仮面ライダーアマゾン"
      },
      statLabels: {
        attack: "攻撃力",
        dAttack: "通常攻撃",
        sAttack: "必殺技",
        armor: "被ダメージ",
        speed: "チャージ速度",
        hit: "命中",
        evs: "回避",
        hitUnit: "%",
        evsUnit: "%",
        lpPerTurn: "LP/ターン",
        breaksOnDmg: "被ダメージで解除",
        turnShort: "T",
        durationDetail: (t) => `残り持続ターン: ${t}ターン`,
        periodicDue: "このターンに継続効果が発動します。",
        periodicInitial: "付与された最初のターンは継続効果は発動しません。",
        periodicRule:
          "回復は出血ダメージより先に処理されます。LPが0のライダーは回復では復活しません。"
      },
      hud: {
        lp: "LP",
        chi: "氣",
        faint: "気絶",
        faintAria: "気絶ゲージ",
        faintedOverlay: "気絶中！",
        ko: "KO",
        faintedState: "気絶中 ― 強制回復ターン",
        airborneState: (t) => `空中状態 · ${t}T`,
        lowChiText: "氣不足 · 被ダメージ +25% · 回避 -25%",
        lowChiTitle:
          "氣が5未満：受けるLPダメージが1.25倍になり、回避率が25%低下し、気絶値が溜まりやすくなります。",
        highChiText: "氣充満 · 攻撃力 +20% · 命中 +20%",
        highChiTitle:
          "氣が14超：攻撃時にダメージ+20%・命中率+20%のボーナスが適用されます（技の氣コスト消費後に判定）。",
        p1PadLabel: "プレイヤー 1 [W-A-S-D + I-J-K-L]",
        p2PadLabel: "プレイヤー 2 [矢印キー + 1-2-3-5]",
        lockedFlag: "確定！",
        readyText: "準備完了",
        tapToCharge: "方向キーでチャージ"
      }
    }
  });

  const EN_TO_JA_TERMS = Object.freeze([
    ["Kamen Rider Ichigo", "仮面ライダー1号"],
    ["Kamen Rider Nigo", "仮面ライダー2号"],
    ["Kamen Rider V3", "仮面ライダーV3"],
    ["Kamen Rider X", "仮面ライダーX"],
    ["Kamen Rider Amazon", "仮面ライダーアマゾン"],
    ["Riderman", "ライダーマン"],

    ["Typhoon Power Break", "タイフーン・パワーブレイク"],
    ["Typhoon Red Shutter", "タイフーン・レッドシャッター"],
    ["Double Typhoon Blow", "ダブルタイフーン・ブロー"],
    ["Mercury Fortification", "マーキュリー装甲強化"],
    ["Mercury Overdrive", "マーキュリー・オーバードライブ"],
    ["Rider Head Crusher", "ライダー頭突き"],
    ["Rider Power Chop", "ライダーチョップ"],
    ["Rider High Jump", "ライダー大ジャンプ"],
    ["Rider Flying Knee", "ライダー飛び膝蹴り"],
    ["Rider Power Kick", "ライダーパワーキック"],
    ["Rider Power Jump", "ライダーパワージャンプ"],
    ["Vacuum Hell Wheel", "真空地獄車"],
    ["Ridol Crown Split", "ライドル脳天割り"],
    ["Ridol Rod Strike", "ライドルスティック連撃"],
    ["Ridol Whip Lash", "ライドルホイップ斬り"],
    ["Power Arm Strike", "パワーアーム・ストライク"],
    ["Drill Arm Break", "ドリルアーム・ブレイク"],
    ["Hook Finisher", "スイングアーム・フィニッシャー"],
    ["Rope Arm Tie-Up", "ロープアーム拘束"],
    ["Rope Arm Hook", "ロープアーム・フック"],
    ["Cassette Combo", "カセットアーム連撃"],
    ["Kirimomi Kick", "ライダーきりもみキック"],
    ["V3 Triple Kick", "V3トリプルキック"],
    ["V3 Screw Kick", "V3きりもみキック"],
    ["V3 Return Kick", "V3反転キック"],
    ["Windmill Guard", "風車ガード"],
    ["Standard Guard", "通常ガード"],
    ["Standard Punch", "通常パンチ"],
    ["Standard Kick", "通常キック"],
    ["Standing Kick", "立ちキック"],
    ["Red Lamp Focus", "レッドランプ集中"],
    ["Typhoon Charge", "タイフーンチャージ"],
    ["Typhoon Focus", "タイフーン集中"],
    ["Typhoon Bless", "タイフーンの加護"],
    ["Kaizorg Vitality", "カイゾーグ活性"],
    ["Inca Blessing", "インカの秘術"],
    ["Jaguar Shock", "ジャガーショック"],
    ["Riderman Kick", "ライダーマンキック"],
    ["Wild Instinct", "野生の本能"],
    ["Wild Tackle", "ワイルドタックル"],
    ["Amazon Kick", "アマゾンキック"],
    ["Mystic Kick", "ミスティックキック"],
    ["Claw Attack", "コンドルクローひっかき"],
    ["Claw Combo", "ワイルドクロー連撃"],
    ["Daisetsudan", "大切断"],
    ["Mixed Combo", "コンビネーション攻撃"],
    ["Mixed Hits", "連続コンビネーション"],
    ["Punch Combo", "連続パンチ"],
    ["Kick Combo", "連続キック"],
    ["Chop Combo", "連続チョップ"],
    ["Rider Punch", "ライダーパンチ"],
    ["Rider Kick", "ライダーキック"],
    ["Power Focus", "パワー集中"],
    ["Accelerator", "アクセラレーター"],
    ["Target Lock", "ターゲットロック"],
    ["Gigi Focus", "ギギの腕輪・集中"],
    ["Battle Cry", "気合の咆哮"],
    ["Wild Leap", "野生の大跳躍"],
    ["High Leap", "ハイジャンプ"],
    ["High Kick", "ハイキック"],
    ["V3 Kick", "V3キック"],
    ["X-Kick", "Xキック"],
    ["Punches", "連続パンチ"],
    ["Chop", "V3チョップ"],
    ["Leap", "V3大ジャンプ"],
    ["Jump", "Xジャンプ"]
  ]);

  const renderedTags = new WeakMap();
  const riderHitCounters = new Map();
  let lastTrackedRound = null;

  const byId = id => document.getElementById(id);

  /** Permanently disables and removes any portrait-rotation blocker overlay (fixes PLiCy/browser iframe lock). */
  function disablePortraitOrientationOverlay() {
    const selectors = [
      "#portrait-orientation-overlay",
      ".portrait-orientation-overlay",
      "#orientation-overlay",
      ".orientation-overlay",
      "#rotate-device-overlay",
      ".rotate-device-overlay"
    ];
    document.querySelectorAll(selectors.join(", ")).forEach(el => {
      el.hidden = true;
      el.style.setProperty("display", "none", "important");
      el.style.setProperty("pointer-events", "none", "important");
      el.style.setProperty("visibility", "hidden", "important");
      el.style.setProperty("z-index", "-1", "important");
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
  }

  function getLang() {
    const raw =
      g.gameLang ||
      g.gameState?.matchConfig?.lang ||
      g.gameState?.lang ||
      document.documentElement?.lang ||
      "en";
    return String(raw).toLowerCase().startsWith("ja") ? "ja" : "en";
  }

  function isJa() {
    return getLang() === "ja";
  }

  function dict() {
    return I18N_UI[getLang()] || I18N_UI.en;
  }

  function number(value, fallback = 0) {
    const result = Number(value);
    return Number.isFinite(result) ? result : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function pretty(value) {
    return String(Math.round(number(value) * 100) / 100);
  }

  function signed(value) {
    const rounded = Math.round(number(value) * 100) / 100;
    return (rounded > 0 ? "+" : "") + rounded;
  }

  function currentRound() {
    return number(
      g.gameState?.presentationRound ?? g.gameState?.core?.round,
      1
    );
  }

  function resetRiderHitCounters() {
    riderHitCounters.clear();
  }

  function statusName(id) {
    const d = dict();
    const key = String(id || "").toLowerCase();
    if (d.statusNames[id]) {
      return d.statusNames[id];
    }
    if (d.statusNames[key]) {
      return d.statusNames[key];
    }
    if (I18N_UI.en.statusNames[id]) {
      return I18N_UI.en.statusNames[id];
    }
    if (I18N_UI.en.statusNames[key]) {
      return I18N_UI.en.statusNames[key];
    }
    return String(id || (isJa() ? "状態" : "Status"))
      .replace(/_/g, " ")
      .replace(/\b\w/g, letter => letter.toUpperCase());
  }

  function resolveLocalizedRiderName(player, fallbackSlot) {
    if (!player) return fallbackSlot.toUpperCase();
    const d = dict();
    const id = String(player.id || player.riderId || "").toLowerCase();
    if (id && d.riderNames[id]) {
      return d.riderNames[id];
    }

    const rawName = String(player.name || fallbackSlot.toUpperCase());
    if (!isJa()) return rawName;

    const lower = rawName.toLowerCase();
    for (const [key, jaName] of Object.entries(d.riderNames)) {
      const enName = I18N_UI.en.riderNames[key];
      if (enName && lower === enName.toLowerCase()) {
        return jaName;
      }
    }
    return localizeBattleText(rawName);
  }

  function localizeBattleText(input) {
    const raw = String(input ?? "");
    if (!raw || !isJa()) return raw;

    let out = raw;

    for (const [enTerm, jaTerm] of EN_TO_JA_TERMS) {
      if (out.includes(enTerm)) {
        out = out.split(enTerm).join(jaTerm);
      }
    }

    out = out
      .replace(/\bGET READY!\b/gi, "バトル開始！")
      .replace(/\bREADY FOR BATTLE!\b/gi, "バトル準備完了！")
      .replace(/\bINTERRUPTED!\b/gi, "中断！")
      .replace(/\bINTERRUPTED\b/gi, "中断！")
      .replace(/\bINTERRUPT!\b/gi, "中断！")
      .replace(/\bINTERRUPT\b/gi, "中断！")
      .replace(/\bTAP DIRECTION TO CHARGE\b/gi, "方向キーでチャージ")
      .replace(/\bHOLD DIRECTION TO CHARGE\b/gi, "方向キー長押しでチャージ")
      .replace(/\bPRESS ACTION KEY\b/gi, "アクションキーで決定")
      .replace(/\bLOCKED!\b/gi, "確定！")
      .replace(/\bLOCKED\b/gi, "確定")
      .replace(/\bFAINTED!\b/gi, "気絶中！")
      .replace(/\bGLANCING HIT\b/gi, "かすりヒット")
      .replace(/\bCOUNTER HIT\b/gi, "カウンター")
      .replace(/\bCRITICAL HIT\b/gi, "クリティカル")
      .replace(/\bGUARD BREAK\b/gi, "ガードブレイク")
      .replace(/\bSCRATCH\b/gi, "かすり傷")
      .replace(/\bBLOCKED\b/gi, "ガード")
      .replace(/\bBLOCK\b/gi, "ガード")
      .replace(/\bGUARD\b/gi, "ガード")
      .replace(/\bEVADED\b/gi, "回避")
      .replace(/\bDODGED\b/gi, "回避")
      .replace(/\bMISSED\b/gi, "ミス")
      .replace(/\bMISS\b/gi, "ミス")
      .replace(/\bHEAL\b/gi, "回復")
      .replace(/\bDRAW GAME\b/gi, "引き分け")
      .replace(/\bDOUBLE KO\b/gi, "ダブルKO")
      .replace(/\bTIME OVER\b/gi, "タイムアップ")
      .replace(/\bYOU WIN!\b/gi, "勝利！")
      .replace(/\bYOU LOSE!\b/gi, "敗北…")
      .replace(/\bVICTORY!\b/gi, "勝利！")
      .replace(/\bVICTORY\b/gi, "勝利！")
      .replace(/\bDEFEAT\.\.\./gi, "敗北…")
      .replace(/\bDEFEAT!\b/gi, "敗北…")
      .replace(/\bDEFEAT\b/gi, "敗北…");

    out = out
      .replace(/\bROUND\s+(\d+)\b/gi, "ラウンド $1")
      .replace(/\bTIME:\s*([0-9.]+)s\b/gi, "残り時間: $1秒")
      .replace(/\bPLAYER\s*1\s+WINS!\b/gi, "プレイヤー1の勝利！")
      .replace(/\bPLAYER\s*2\s+WINS!\b/gi, "プレイヤー2の勝利！")
      .replace(/([^\n\r]+?)\s+WINS!\b/gi, "$1 の勝利！")
      .replace(/\bREADY\b/g, "準備完了");

    out = out
      .replace(/\s+uses\s+/gi, " の ")
      .replace(/\s+used\s+/gi, " の ")
      .replace(/\bCHI\b/g, "氣")
      .replace(/\bFAINT\b/g, "気絶");

    return out;
  }

  function syncBattleStaticDOM() {
    disablePortraitOrientationOverlay();

    const d = dict();

    const p1PadLabel = document.querySelector("#p1-controls .pad-label");
    if (p1PadLabel) p1PadLabel.textContent = d.hud.p1PadLabel;

    const p2PadLabel = document.querySelector("#p2-controls .pad-label");
    if (p2PadLabel) p2PadLabel.textContent = d.hud.p2PadLabel;

    ["p1", "p2"].forEach(slot => {
      const stunEl = byId(`${slot}-stun-overlay`);
      if (stunEl) stunEl.textContent = d.hud.faintedOverlay;

      const flagEl = byId(`${slot}-action-flag`);
      if (flagEl && (flagEl.textContent === "LOCKED!" || flagEl.textContent === "確定！")) {
        flagEl.textContent = d.hud.lockedFlag;
      }

      const chargeTextEl = byId(`${slot}-charge-text`);
      if (chargeTextEl && isJa()) {
        const localized = localizeBattleText(chargeTextEl.textContent);
        if (localized !== chargeTextEl.textContent) {
          chargeTextEl.textContent = localized;
        }
      }
    });

    ["charge-status-display", "p2-charge-status-display"].forEach(id => {
      const el = byId(id);
      if (!el) return;
      if (!isJa() && el.textContent === I18N_UI.ja.hud.tapToCharge) {
        el.textContent = I18N_UI.en.hud.tapToCharge;
      } else if (isJa()) {
        const localized = localizeBattleText(el.textContent);
        if (localized !== el.textContent) {
          el.textContent = localized;
        }
      }
    });

    ["turn-display", "turn-timer", "splash-round-text", "splash-names-text"].forEach(id => {
      const el = byId(id);
      if (el && isJa()) {
        const localized = localizeBattleText(el.textContent);
        if (localized !== el.textContent) {
          el.textContent = localized;
        }
      }
    });
  }

  function periodicAmount(buff, field) {
    return Math.max(
      0,
      number(buff?.[field] ?? buff?.effects?.[field])
    );
  }

  function describeStatus(buff, round = currentRound()) {
    const d = dict();
    const s = d.statLabels;
    const effects = buff?.effects || {};
    const remaining = Math.max(0, number(buff?.roundsLeft));
    const parts = [];
    let harmful = false;

    const multiplicative = [
      ["attack", s.attack],
      ["dAttack", s.dAttack],
      ["sAttack", s.sAttack],
      ["armor", s.armor],
      ["speed", s.speed]
    ];

    for (const [field, label] of multiplicative) {
      if (effects[field] === undefined) continue;

      const multiplier = number(effects[field], 1);
      const percent = 100 * (multiplier - 1);

      if (Math.abs(percent) < 0.000001) continue;

      parts.push(`${label} ${signed(percent)}%`);

      if (field === "armor" ? multiplier > 1 : multiplier < 1) {
        harmful = true;
      }
    }

    if (effects.accuracy !== undefined && number(effects.accuracy) !== 0) {
      const value = number(effects.accuracy);
      parts.push(`${s.hit} ${signed(value)}${s.hitUnit}`);
      if (value < 0) harmful = true;
    }

    if (effects.evasion !== undefined && number(effects.evasion) !== 0) {
      const value = 100 * number(effects.evasion);
      parts.push(`${s.evs} ${signed(value)}${s.evsUnit}`);
      if (value < 0) harmful = true;
    }

    const regeneration = periodicAmount(buff, "lpRegen");
    const bleeding = periodicAmount(buff, "lpBleed");

    if (regeneration > 0) parts.push(`+${pretty(regeneration)} ${s.lpPerTurn}`);
    if (bleeding > 0) {
      parts.push(`-${pretty(bleeding)} ${s.lpPerTurn}`);
      harmful = true;
    }

    const fragile = Boolean(
      buff?.cancelOnLpDamage ?? effects.cancelOnLpDamage ?? false
    );
    if (fragile) parts.push(s.breaksOnDmg);

    const periodic = regeneration > 0 || bleeding > 0;
    const firstApplied =
      buff?.periodicAppliedRound ?? buff?.appliedRound ?? round - 1;
    const paymentDue = periodic && remaining > 0 && firstApplied < round;

    const name = statusName(buff?.id);

    const text = [
      name,
      parts.length ? parts.join(", ") : "",
      `${pretty(remaining)}${s.turnShort}`
    ].filter(Boolean).join(" · ");

    const details = [
      name,
      ...parts,
      s.durationDetail(pretty(remaining))
    ];

    if (periodic) {
      details.push(paymentDue ? s.periodicDue : s.periodicInitial);
      details.push(s.periodicRule);
    }

    return {
      id: buff?.id || "",
      name,
      text,
      title: details.join("\n"),
      remaining,
      periodic,
      paymentDue,
      fragile,
      harmful,
      regeneration,
      bleeding
    };
  }

  function renderTags(tray, tags) {
    if (!tray) return;

    const signature = JSON.stringify(tags);
    if (renderedTags.get(tray) === signature) return;

    renderedTags.set(tray, signature);
    const fragment = document.createDocumentFragment();

    for (const tag of tags) {
      const element = document.createElement("span");
      element.className = "buff-tag";
      if (tag.className) element.classList.add(tag.className);
      element.textContent = tag.text;
      element.title = tag.title || tag.text;
      fragment.appendChild(element);
    }

    tray.replaceChildren(fragment);
  }

  function resolveControllerInfo(slot, player) {
    const vs = g.vsSelectionState || {};
    const gs = g.gameState || {};

    let isCPU;
    if (typeof player?.isCPU === "boolean") {
      isCPU = player.isCPU;
    } else if (typeof player?.isCpu === "boolean") {
      isCPU = player.isCpu;
    } else if (typeof player?.cpu === "boolean") {
      isCPU = player.cpu;
    } else if (typeof player?.ai === "boolean") {
      isCPU = player.ai;
    } else if (typeof player?.controller === "string") {
      isCPU = player.controller.toLowerCase() === "cpu";
    } else if (typeof gs?.matchConfig?.[`${slot}IsCPU`] === "boolean") {
      isCPU = gs.matchConfig[`${slot}IsCPU`];
    } else if (typeof gs[`${slot}IsCPU`] === "boolean") {
      isCPU = gs[`${slot}IsCPU`];
    } else if (typeof vs[`${slot}IsCPU`] === "boolean") {
      isCPU = vs[`${slot}IsCPU`];
    } else {
      isCPU = false;
    }

    const rawDiff =
      player?.difficulty ||
      player?.cpuDifficulty ||
      player?.aiDifficulty ||
      gs?.matchConfig?.[`${slot}Difficulty`] ||
      gs[`${slot}Difficulty`] ||
      vs[`${slot}Difficulty`] ||
      "balanced";

    let diffKey = String(rawDiff).toLowerCase();
    if (diffKey === "mcts") diffKey = "rider";

    return { isCPU, diffKey };
  }

  function updatePlayerHUD(slot, player) {
    if (!player) return;

    const cRound = currentRound();
    if (lastTrackedRound !== null && lastTrackedRound !== cRound) {
      resetRiderHitCounters();
    }
    lastTrackedRound = cRound;

    syncBattleStaticDOM();

    const d = dict();
    const h = d.hud;

    const maxLp = Math.max(1, number(player.maxLp, 2300));
    const lp = clamp(number(player.lp), 0, maxLp);

    const maxChi = Math.max(
      1,
      number(player.maxChi, g.COMBAT_RULES?.MAX_CHI || 16)
    );
    const chi = clamp(number(player.chi), 0, maxChi);

    const faintThreshold = Math.max(
      1,
      number(g.COMBAT_RULES?.FAINT_THRESHOLD, 100)
    );
    const faint = clamp(number(player.faintMeter), 0, faintThreshold);

    const lpPercent = (100 * lp) / maxLp;
    const chiPercent = (100 * chi) / maxChi;
    const faintPercent = (100 * faint) / faintThreshold;

    const nameElement = byId(`${slot}-name`);
    const subtextElement = byId(`${slot}-subtext`);
    const lpElement = byId(`${slot}-lp`);
    const chiElement = byId(`${slot}-chi`);
    const chiFill = byId(`${slot}-chi-bar-fill`);

    if (nameElement) {
      nameElement.textContent = resolveLocalizedRiderName(player, slot);
    }

    if (subtextElement) {
      const { isCPU, diffKey } = resolveControllerInfo(slot, player);

      if (isCPU) {
        const label = d.diffLabels[diffKey] || I18N_UI.en.diffLabels[diffKey] || diffKey.toUpperCase();
        subtextElement.textContent = label;
        subtextElement.classList.add("cpu-subtext");
        subtextElement.classList.remove("human-subtext");
        subtextElement.classList.toggle("rider-tier-subtext", diffKey === "rider");
        subtextElement.hidden = false;
      } else {
        subtextElement.textContent = "";
        subtextElement.classList.remove("cpu-subtext", "human-subtext", "rider-tier-subtext");
        subtextElement.hidden = true;
      }
    }

    if (lpElement) {
      lpElement.textContent = `${h.lp} ${pretty(lp)} / ${pretty(maxLp)}`;
      lpElement.classList.toggle("lp-text-danger", lpPercent < 40);
      lpElement.classList.toggle("lp-text-warn", lpPercent >= 40 && lpPercent <= 60);
    }

    document.querySelectorAll(`#${slot}-lp-bar-fill, .${slot}-lp-fill`).forEach(fill => {
      fill.style.width = `${lpPercent}%`;

      if (lpPercent > 60) {
        fill.style.background =
          "linear-gradient(180deg, rgba(255,255,255,0.32) 0%, transparent 45%), " +
          "linear-gradient(90deg, #00994d 0%, #00e676 55%, #69f0ae 100%)";
        fill.style.boxShadow = "0 0 12px rgba(0, 230, 118, 0.55)";
      } else if (lpPercent >= 40) {
        fill.style.background =
          "linear-gradient(180deg, rgba(255,255,255,0.32) 0%, transparent 45%), " +
          "linear-gradient(90deg, #c67c00 0%, #ffbe0b 55%, #ffe169 100%)";
        fill.style.boxShadow = "0 0 12px rgba(255, 190, 11, 0.6)";
      } else {
        fill.style.background =
          "linear-gradient(180deg, rgba(255,255,255,0.32) 0%, transparent 45%), " +
          "linear-gradient(90deg, #8a001d 0%, #ff1e42 55%, #ff6b8b 100%)";
        fill.style.boxShadow = "0 0 14px rgba(255, 30, 66, 0.85)";
      }
    });

    if (chiElement) {
      chiElement.textContent = `${h.chi} ${pretty(chi)} / ${pretty(maxChi)}`;

      chiElement.classList.toggle("chi-text-low", chi < 5);
      chiElement.classList.toggle("chi-text-full", chi > 14);

      chiElement.style.color =
        chi < 5 ? "#ff4d6d" : chi > 14 ? "#ffd166" : "#00f0ff";
    }

    if (chiFill) {
      chiFill.style.width = `${chiPercent}%`;

      chiFill.classList.toggle("chi-bar-low", chi < 5);
      chiFill.classList.toggle("chi-bar-full", chi > 14);

      if (chi < 5) {
        chiFill.style.background =
          "linear-gradient(90deg, #990022 0%, #ff2a55 60%, #ff758f 100%)";
        chiFill.style.boxShadow = "0 0 10px rgba(255, 42, 85, 0.7)";
      } else if (chi > 14) {
        chiFill.style.background =
          "linear-gradient(90deg, #c27800 0%, #ffd166 60%, #fff3b0 100%)";
        chiFill.style.boxShadow = "0 0 12px rgba(255, 209, 102, 0.8)";
      } else {
        chiFill.style.background =
          "linear-gradient(90deg, #006699 0%, #00d2ff 60%, #7df9ff 100%)";
        chiFill.style.boxShadow = "0 0 10px rgba(0, 210, 255, 0.55)";
      }
    }

    const faintText = byId(`${slot}-faint-text`) || byId(`${slot}-faint`);
    if (faintText) {
      faintText.textContent = `${h.faint} ${pretty(faint)} / ${pretty(faintThreshold)}`;
    }

    const hudContainer = document.querySelector(`.${slot}-hud`);
    if (hudContainer) {
      const faintLabel = hudContainer.querySelector(".faint-label");
      if (faintLabel) {
        faintLabel.textContent = `${h.faint} ${Math.round(faintPercent)}%`;
        faintLabel.classList.toggle("faint-danger", faintPercent >= 75);
      }
    }

    document.querySelectorAll(
      `#${slot}-faint-fill, .${slot}-faint-fill, #${slot}-faint-bar-fill`
    ).forEach(element => {
      element.style.width = `${faintPercent}%`;
      element.style.height = "100%";

      element.setAttribute("role", "progressbar");
      element.setAttribute("aria-valuemin", "0");
      element.setAttribute("aria-valuemax", String(faintThreshold));
      element.setAttribute("aria-valuenow", String(faint));
      element.setAttribute("aria-label", h.faintAria);
    });

    const faintOverlay = byId(`${slot}-stun-overlay`);
    if (faintOverlay) {
      faintOverlay.textContent = h.faintedOverlay;
      faintOverlay.hidden = !player.isFainted;
    }

    const stateLabels = [];
    if (lp <= 0) {
      stateLabels.push(h.ko);
    } else if (player.isFainted) {
      stateLabels.push(h.faintedState);
    }

    if (number(player.airborneTicks) > 0) {
      stateLabels.push(h.airborneState(pretty(player.airborneTicks)));
    }

    const statusElement = byId(`${slot}-status`);
    if (statusElement) {
      statusElement.textContent = stateLabels.join(" / ");
      statusElement.hidden = stateLabels.length === 0;
    }

    const tags = [];
    for (const buff of player.activeBuffs || []) {
      if (!(buff.roundsLeft > 0)) continue;

      const description = describeStatus(buff);

      tags.push({
        text: description.text,
        title: description.title,
        className: description.harmful ? "combat-debuff" : "combat-buff"
      });
    }

    if (chi < 5) {
      tags.push({
        text: h.lowChiText,
        title: h.lowChiTitle,
        className: "debuff-low-power"
      });
    } else if (chi > 14) {
      tags.push({
        text: h.highChiText,
        title: h.highChiTitle,
        className: "buff-full-power"
      });
    }

    renderTags(byId(`${slot}-buff-tray`), tags);
  }

  function ensureGlassCrackOverlay(box) {
    let overlay = box.querySelector(".glass-crack-overlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.className = "glass-crack-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <svg viewBox="0 0 300 300" preserveAspectRatio="none">
        <!-- Translucent fractured glass shards -->
        <polygon points="150,150 112,88 172,74" fill="rgba(210,248,255,0.16)"/>
        <polygon points="150,150 224,106 206,168" fill="rgba(210,248,255,0.12)"/>
        <polygon points="150,150 92,190 136,228" fill="rgba(210,248,255,0.14)"/>
        <polygon points="150,150 64,122 112,88" fill="rgba(255,255,255,0.09)"/>
        <polygon points="150,150 202,220 140,208" fill="rgba(255,255,255,0.11)"/>

        <!-- Primary radial fracture lines -->
        <g stroke="rgba(255,255,255,0.96)" stroke-linecap="round" stroke-linejoin="round" fill="none">
          <path d="M150,150 L118,96 L92,42 L65,6" stroke-width="2.7"/>
          <path d="M118,96 L74,78 L16,50" stroke-width="1.9"/>
          <path d="M150,150 L168,82 L195,34 L216,4" stroke-width="2.5"/>
          <path d="M168,82 L224,58 L280,22" stroke-width="1.8"/>
          <path d="M150,150 L216,114 L268,95 L298,78" stroke-width="2.6"/>
          <path d="M216,114 L254,142 L296,158" stroke-width="1.8"/>
          <path d="M150,150 L204,172 L248,218 L294,268" stroke-width="2.5"/>
          <path d="M204,172 L188,232 L205,296" stroke-width="1.9"/>
          <path d="M150,150 L138,212 L114,264 L96,298" stroke-width="2.7"/>
          <path d="M138,212 L82,248 L26,290" stroke-width="1.8"/>
          <path d="M150,150 L88,182 L38,208 L4,228" stroke-width="2.5"/>
          <path d="M88,182 L44,158 L4,144" stroke-width="1.7"/>
          <path d="M150,150 L72,124 L26,98 L2,82" stroke-width="2.6"/>

          <!-- Secondary concentric spiderweb rings -->
          <path d="M132,120 L158,112 L184,132 L176,164 L144,178 L116,166 L112,136 Z" stroke-width="1.6" stroke-opacity="0.9"/>
          <path d="M104,72 L174,64 L228,106 L218,186 L168,228 L102,216 L66,168 L74,108 Z" stroke-width="1.25" stroke-opacity="0.76"/>
          <path d="M62,38 L192,28 L266,88 L256,222 L184,274 L74,258 L28,194 L32,84 Z" stroke-width="0.95" stroke-opacity="0.58"/>
        </g>

        <!-- Impact center starburst -->
        <circle cx="150" cy="150" r="5.5" fill="rgba(255,255,255,0.98)"/>
      </svg>
    `;

    box.appendChild(overlay);
    return overlay;
  }

  function hashRiderId(str) {
    let hash = 2166136261;
    const s = String(str || "rider").toLowerCase();
    for (let i = 0; i < s.length; i++) {
      hash ^= s.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededRandom(seed, step) {
    const x = Math.sin(seed + step * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  function triggerGlassCrack(boxOrId, damageAmount = 0, explicitRiderId = null, isSpecialMove = false) {
    const box = typeof boxOrId === "string" ? byId(boxOrId) : boxOrId;
    if (!box) return;

    const overlay = ensureGlassCrackOverlay(box);
    const svg = overlay.querySelector("svg");

    const boxIdStr = typeof boxOrId === "string" ? boxOrId : (box.id || "");
    const slot = boxIdStr.split("-")[0].toLowerCase();
    const player = g.gameState?.[slot] || g.gameState?.core?.[slot];
    const riderId = String(
      explicitRiderId || player?.id || player?.riderId || slot || "rider"
    ).toLowerCase();

    const currentHit = (riderHitCounters.get(riderId) || 0) + 1;
    riderHitCounters.set(riderId, currentHit);

    const seed = hashRiderId(riderId);

    if (svg) {
      const randAngle = seededRandom(seed, currentHit);
      const randFlip = seededRandom(seed + 100, currentHit);

      const deg = Math.floor(randAngle * 360);
      const flipX = randFlip > 0.5 ? -1 : 1;

      svg.style.transform = `scale(${flipX}, 1) rotate(${deg}deg)`;
    }

    overlay.classList.remove("crack-active", "heavy-crack");
    box.classList.remove("victim-hit-shake", "victim-hit-heavy-shake");

    void overlay.offsetWidth;

    const isHeavy = isSpecialMove || number(damageAmount) >= 300;

    if (isHeavy) {
      overlay.classList.add("heavy-crack");
      box.classList.add("victim-hit-heavy-shake");
    } else {
      box.classList.add("victim-hit-shake");
    }

    overlay.classList.add("crack-active");
  }

  function showDamagePopup(boxId, text, type = "damage", isSpecialMove = false) {
    const box = byId(boxId);
    if (!box) return;

    const rawText = String(text ?? "");

    const dmgMatch = rawText.replace(/,/g, "").match(/(-?\d+(?:\.\d+)?)/);
    const dmgValue = dmgMatch ? Math.abs(number(dmgMatch[1], 0)) : 0;

    const validTypes = new Set(["damage", "heal", "miss", "scratch", "block", "info", "special"]);
    const resolvedType = validTypes.has(type) ? type : "info";

    const isSpecial = isSpecialMove || resolvedType === "special";

    if ((resolvedType === "damage" || resolvedType === "scratch" || resolvedType === "special") && dmgValue > 0) {
      triggerGlassCrack(box, dmgValue, null, isSpecial);
    }

    const popup = document.createElement("div");

    popup.classList.add("damage-popup", resolvedType === "special" ? "damage" : resolvedType);
    if (isSpecial || (dmgValue >= 300 && resolvedType === "damage")) {
      popup.classList.add("heavy-dmg");
    }

    const battleScreen = byId("battle-screen") || document.body;

    const boxRect = box.getBoundingClientRect();
    const screenRect = battleScreen.getBoundingClientRect();

    const activeCount = box.querySelectorAll(".damage-popup").length;
    const topOffsetPercent = activeCount > 0 ? Math.min(0.68, 0.42 + activeCount * 0.12) : 0.42;

    const centerX = (boxRect.left + boxRect.width / 2) - screenRect.left;
    const centerY = (boxRect.top + boxRect.height * topOffsetPercent) - screenRect.top;

    popup.style.position = "absolute";
    popup.style.left = `${centerX}px`;
    popup.style.top = `${centerY}px`;
    popup.style.zIndex = "9999";

    popup.textContent = localizeBattleText(rawText);

    battleScreen.appendChild(popup);

    setTimeout(() => popup.remove(), 1450);
  }

  function showBattleBanner(message) {
    const banner = byId("battle-message");
    if (!banner) return;

    const localized = localizeBattleText(String(message || ""));
    banner.textContent = localized;
    banner.style.whiteSpace = "pre-line";
    banner.hidden = !localized;
  }

  function showActionBanner(message) {
    const banner = byId("center-action-label");
    if (!banner) return;

    const localized = localizeBattleText(String(message || ""));
    banner.textContent = localized;
    banner.hidden = !localized;
  }

  function installBattleTextObserver() {
    if (g.__kfBattleTextObserverInstalled) return;
    g.__kfBattleTextObserverInstalled = true;

    const watchedIds = [
      "turn-display",
      "turn-timer",
      "splash-round-text",
      "splash-names-text",
      "charge-status-display",
      "p2-charge-status-display",
      "p1-charge-text",
      "p2-charge-text",
      "p1-action-flag",
      "p2-action-flag"
    ];

    let isMutating = false;

    const observer = new MutationObserver(mutations => {
      if (isMutating || !isJa()) return;
      isMutating = true;
      try {
        for (const m of mutations) {
          const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
          if (!el) continue;
          const localized = localizeBattleText(el.textContent);
          if (localized !== el.textContent) {
            el.textContent = localized;
          }
        }
      } finally {
        isMutating = false;
      }
    });

    const attach = () => {
      syncBattleStaticDOM();
      watchedIds.forEach(id => {
        const el = byId(id);
        if (el) {
          observer.observe(el, { childList: true, characterData: true, subtree: true });
        }
      });
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", attach);
    } else {
      attach();
    }
  }

  function installStyles() {
    if (byId("kf-status-hud-styles")) return;

    if (!byId("kf-jp-hud-fonts")) {
      const fontLink = document.createElement("link");
      fontLink.id = "kf-jp-hud-fonts";
      fontLink.rel = "stylesheet";
      fontLink.href =
        "https://fonts.googleapis.com/css2?family=Chakra+Petch:ital,wght@0,600;0,700;1,700&family=M+PLUS+1p:wght@700;800;900&family=Noto+Sans+JP:wght@700;900&family=Orbitron:wght@700;800;900&display=swap";
      (document.head || document.documentElement).appendChild(fontLink);
    }

    const style = document.createElement("style");
    style.id = "kf-status-hud-styles";

    style.textContent = `
      :root {
        --kf-hud-font-display: 'Orbitron', 'Chakra Petch', 'M PLUS 1p', 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Meiryo', sans-serif;
        --kf-hud-font-ui: 'Chakra Petch', 'M PLUS 1p', 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Meiryo', sans-serif;
        --kf-p1-cyan: #00f0ff;
        --kf-p2-pink: #ff2a6d;
        --kf-gold: #ffd166;
      }

      /* --- Force-Disable Portrait Orientation Blocker in All Browser/Iframe Contexts --- */
      #portrait-orientation-overlay,
      .portrait-orientation-overlay,
      #orientation-overlay,
      .orientation-overlay,
      #rotate-device-overlay,
      .rotate-device-overlay {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        z-index: -1 !important;
      }

      #battle-screen,
      #match-transition-screen,
      #loading-screen {
        font-family: var(--kf-hud-font-ui) !important;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
      }

      #battle-hud.hud-bar {
        background:
          radial-gradient(circle at 14% 25%, rgba(0, 240, 255, 0.14) 0%, transparent 42%),
          radial-gradient(circle at 86% 25%, rgba(255, 42, 109, 0.14) 0%, transparent 42%),
          linear-gradient(180deg, rgba(11, 16, 29, 0.96) 0%, rgba(6, 9, 17, 0.94) 100%) !important;
        border: 1px solid rgba(0, 240, 255, 0.32) !important;
        border-top: 2px solid rgba(0, 240, 255, 0.65) !important;
        border-radius: 10px !important;
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
        padding: 10px 16px !important;
        position: relative;
        overflow: hidden;
      }

      #p1-name,
      #p2-name {
        font-family: var(--kf-hud-font-display) !important;
        font-size: clamp(0.95rem, 1.65vw, 1.3rem) !important;
        font-weight: 900 !important;
        letter-spacing: 0.06em !important;
        line-height: 1.2 !important;
        margin: 0 0 3px 0 !important;
      }

      #p1-name {
        color: #7df9ff !important;
        text-shadow: 0 0 14px rgba(0, 240, 255, 0.45), 0 2px 4px rgba(0, 0, 0, 0.9) !important;
      }

      #p2-name {
        color: #ff8da8 !important;
        text-shadow: 0 0 14px rgba(255, 42, 109, 0.45), 0 2px 4px rgba(0, 0, 0, 0.9) !important;
      }

      .rider-subtext {
        display: inline-flex;
        align-items: center;
        font-family: var(--kf-hud-font-display) !important;
        font-size: clamp(0.58rem, 1.1vw, 0.7rem) !important;
        font-weight: 800 !important;
        letter-spacing: 0.12em !important;
        margin-top: 0;
        margin-bottom: 5px;
        padding: 1px 8px;
        border-radius: 999px;
        text-transform: uppercase;
        min-height: 1.2em;
      }

      .p2-hud .rider-subtext {
        margin-left: auto;
      }

      .rider-subtext.human-subtext {
        color: #00f0ff;
        background: rgba(0, 240, 255, 0.12);
        border: 1px solid rgba(0, 240, 255, 0.35);
      }

      .rider-subtext.cpu-subtext {
        color: #ffd166;
        background: rgba(255, 209, 102, 0.12);
        border: 1px solid rgba(255, 209, 102, 0.4);
        text-shadow: 0 0 8px rgba(255, 209, 102, 0.45);
      }

      .rider-subtext.rider-tier-subtext {
        color: #f3d5ff;
        background: rgba(187, 100, 255, 0.2);
        border: 1px solid rgba(224, 166, 255, 0.65);
        box-shadow: 0 0 10px rgba(187, 100, 255, 0.4);
      }

      .stat-line {
        margin: 2px 0 !important;
      }

      .stat-value-styled,
      #p1-lp,
      #p2-lp,
      #p1-chi,
      #p2-chi {
        font-family: var(--kf-hud-font-display) !important;
        font-variant-numeric: tabular-nums;
        font-size: clamp(0.76rem, 1.25vw, 0.94rem) !important;
        font-weight: 800 !important;
        letter-spacing: 0.06em !important;
        color: #f8fafc !important;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.95), 0 0 8px rgba(0, 240, 255, 0.25) !important;
        filter: none !important;
      }

      #p1-lp.lp-text-warn,
      #p2-lp.lp-text-warn {
        color: #ffd166 !important;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.95), 0 0 10px rgba(255, 209, 102, 0.45) !important;
      }

      #p1-lp.lp-text-danger,
      #p2-lp.lp-text-danger {
        color: #ff5c77 !important;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.95), 0 0 12px rgba(255, 42, 85, 0.65) !important;
      }

      .lp-bar-wrapper {
        position: relative;
        width: 100%;
        height: 15px !important;
        background: linear-gradient(180deg, #05080f 0%, #101726 100%) !important;
        border: 1px solid rgba(255, 255, 255, 0.24) !important;
        margin: 3px 0 6px 0 !important;
        border-radius: 4px !important;
        overflow: hidden;
        box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.9), 0 1px 0 rgba(255, 255, 255, 0.06) !important;
        transform: skewX(-14deg);
      }

      .p2-hud .lp-bar-wrapper {
        transform: skewX(14deg);
      }

      .lp-bar-wrapper::after {
        content: "";
        position: absolute;
        inset: 0;
        background-image: repeating-linear-gradient(
          90deg,
          transparent 0,
          transparent calc(10% - 1.5px),
          rgba(5, 8, 15, 0.55) calc(10% - 1.5px),
          rgba(5, 8, 15, 0.55) 10%
        );
        pointer-events: none;
        z-index: 2;
      }

      .lp-bar-fill {
        width: 100%;
        height: 100%;
        border-radius: 2px;
        transition: width 0.32s cubic-bezier(0.22, 1, 0.36, 1),
                    background 0.3s ease,
                    box-shadow 0.3s ease !important;
      }

      .p2-hud .lp-bar-fill {
        margin-left: auto;
      }

      .chi-bar-wrapper {
        position: relative;
        width: 100%;
        height: 10px !important;
        background: linear-gradient(180deg, #05080f 0%, #0d1422 100%) !important;
        border: 1px solid rgba(0, 240, 255, 0.35) !important;
        margin: 3px 0 7px 0 !important;
        border-radius: 3px !important;
        overflow: hidden;
        box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.9) !important;
        transform: skewX(-14deg);
      }

      .p2-hud .chi-bar-wrapper {
        transform: skewX(14deg);
      }

      .chi-bar-wrapper::after {
        content: "";
        position: absolute;
        inset: 0;
        background-image: repeating-linear-gradient(
          90deg,
          transparent 0,
          transparent calc(6.25% - 1.5px),
          rgba(5, 8, 15, 0.72) calc(6.25% - 1.5px),
          rgba(5, 8, 15, 0.72) 6.25%
        );
        pointer-events: none;
        z-index: 2;
      }

      .chi-bar-fill {
        width: 50%;
        height: 100%;
        transition: width 0.26s cubic-bezier(0.22, 1, 0.36, 1),
                    background 0.25s ease,
                    box-shadow 0.25s ease !important;
      }

      .p2-hud .chi-bar-fill {
        margin-left: auto;
      }

      .faint-bar-wrapper {
        display: flex !important;
        flex-wrap: wrap !important;
        align-items: center !important;
        gap: 6px 8px !important;
        margin-top: 3px !important;
        width: 100% !important;
        max-width: min(220px, 100%) !important;
      }

      .p2-hud .faint-bar-wrapper {
        margin-left: auto !important;
        flex-direction: row-reverse !important;
      }

      .faint-label {
        font-family: var(--kf-hud-font-display) !important;
        font-variant-numeric: tabular-nums;
        font-size: 0.65rem !important;
        font-weight: 800 !important;
        letter-spacing: 0.08em !important;
        color: #fbbf24 !important;
        white-space: nowrap;
        min-width: 60px;
      }

      .p2-hud .faint-label {
        text-align: right;
      }

      .faint-label.faint-danger {
        color: #ff4d6d !important;
        text-shadow: 0 0 8px rgba(255, 77, 109, 0.7);
      }

      .faint-track {
        flex: 1 1 80px !important;
        width: 100% !important;
        height: 7px !important;
        background: rgba(8, 12, 22, 0.95) !important;
        border: 1px solid rgba(251, 191, 36, 0.45) !important;
        border-radius: 999px !important;
        overflow: hidden !important;
        box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.9) !important;
        position: relative;
      }

      .faint-fill {
        width: 0%;
        height: 100% !important;
        background: linear-gradient(90deg, #f59e0b 0%, #ff2a6d 100%) !important;
        box-shadow: 0 0 8px rgba(255, 42, 109, 0.7) !important;
        border-radius: 999px !important;
        transition: width 0.25s ease !important;
      }

      .p2-hud .faint-fill {
        margin-left: auto;
      }

      .center-hud {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        gap: 4px;
      }

      #turn-display.round-title {
        font-family: var(--kf-hud-font-display) !important;
        font-variant-numeric: tabular-nums;
        font-size: clamp(0.75rem, 1.3vw, 0.95rem) !important;
        font-weight: 800 !important;
        letter-spacing: 0.14em !important;
        color: #ffd166 !important;
        background: rgba(255, 209, 102, 0.1);
        border: 1px solid rgba(255, 209, 102, 0.4);
        border-radius: 999px;
        padding: 3px 14px;
        text-shadow: 0 0 10px rgba(255, 209, 102, 0.4) !important;
      }

      #turn-timer.timer-display {
        font-family: var(--kf-hud-font-display) !important;
        font-variant-numeric: tabular-nums;
        font-size: clamp(0.95rem, 1.75vw, 1.3rem) !important;
        font-weight: 900 !important;
        letter-spacing: 0.08em !important;
        color: #ff4d6d !important;
        text-shadow: 0 0 14px rgba(255, 77, 109, 0.55), 0 2px 4px rgba(0, 0, 0, 0.9) !important;
      }

      #battle-message.battle-banner {
        font-family: var(--kf-hud-font-display) !important;
        font-size: clamp(0.78rem, 1.3vw, 0.95rem) !important;
        font-weight: 800 !important;
        letter-spacing: 0.1em !important;
        color: #ffd166 !important;
        background: linear-gradient(90deg, rgba(10, 15, 28, 0.85) 0%, rgba(24, 34, 58, 0.95) 50%, rgba(10, 15, 28, 0.85) 100%) !important;
        border: 1px solid rgba(255, 209, 102, 0.55) !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.65), 0 0 12px rgba(255, 209, 102, 0.18) !important;
        padding: 5px 14px !important;
      }

      #center-action-label.action-sub-banner {
        font-family: var(--kf-hud-font-display) !important;
        font-weight: 800 !important;
        letter-spacing: 0.08em !important;
        color: #7df9ff !important;
        text-shadow: 0 0 12px rgba(0, 240, 255, 0.55), 0 2px 4px #000 !important;
      }

      .player-box {
        position: relative !important;
        border-radius: 10px !important;
        border: 1px solid rgba(255, 255, 255, 0.14) !important;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.65) !important;
        overflow: hidden;
      }

      .player-charge-container {
        padding: 4px 6px !important;
        background: rgba(6, 9, 17, 0.92) !important;
        border-top: 1px solid rgba(0, 240, 255, 0.25) !important;
      }

      .player-charge-track {
        height: 20px !important;
        background: rgba(13, 20, 34, 0.95) !important;
        border: 1px solid rgba(255, 255, 255, 0.18) !important;
        border-radius: 6px !important;
        overflow: hidden !important;
        position: relative;
        box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.85) !important;
      }

      .player-charge-fill {
        height: 100% !important;
        background: linear-gradient(90deg, #0077aa 0%, #00f0ff 65%, #7df9ff 100%) !important;
        box-shadow: 0 0 12px rgba(0, 240, 255, 0.6) !important;
        transition: width 0.1s linear !important;
      }

      #p2-box .player-charge-fill {
        background: linear-gradient(90deg, #a80038 0%, #ff2a6d 65%, #ff8da8 100%) !important;
        box-shadow: 0 0 12px rgba(255, 42, 109, 0.6) !important;
      }

      .player-charge-text {
        font-family: var(--kf-hud-font-display) !important;
        font-size: 0.68rem !important;
        font-weight: 800 !important;
        letter-spacing: 0.14em !important;
        color: #ffffff !important;
        text-shadow: 0 1px 4px rgba(0, 0, 0, 0.95) !important;
      }

      .buff-tray {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 4px;
        max-width: 100%;
      }

      .p2-hud .buff-tray {
        justify-content: flex-end;
      }

      .buff-tray .buff-tag {
        font-family: var(--kf-hud-font-ui) !important;
        font-size: clamp(0.6rem, 1.05vw, 0.68rem) !important;
        font-weight: 700 !important;
        letter-spacing: 0.03em;
        padding: 2px 7px !important;
        border-radius: 6px !important;
        max-width: 100%;
        box-sizing: border-box;
        white-space: normal;
        word-break: break-word;
        overflow-wrap: anywhere;
        line-height: 1.25;
        pointer-events: auto;
        backdrop-filter: blur(6px);
      }

      .buff-tray .combat-debuff,
      .buff-tray .debuff-low-power {
        border: 1px solid rgba(255, 107, 130, 0.65) !important;
        color: #ffb3c1 !important;
        background: rgba(68, 14, 28, 0.82) !important;
      }

      .buff-tray .combat-buff {
        border: 1px solid rgba(0, 240, 255, 0.55) !important;
        color: #a5f3fc !important;
        background: rgba(8, 45, 68, 0.82) !important;
      }

      .buff-tray .buff-full-power {
        border: 1px solid rgba(255, 209, 102, 0.7) !important;
        color: #ffe8a3 !important;
        background: rgba(68, 48, 10, 0.85) !important;
      }

      /* Base Glass Crack Overlay Container */
      .glass-crack-overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 26;
        opacity: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        mix-blend-mode: screen;
      }

      .glass-crack-overlay svg {
        width: 108%;
        height: 108%;
        transform-origin: center center;
        filter: drop-shadow(0 0 5px rgba(180, 240, 255, 0.85))
                drop-shadow(0 2px 4px rgba(0, 0, 0, 0.9));
        transition: filter 0.2s ease, width 0.2s ease, height 0.2s ease;
      }

      /* Heavy S-Move Glass Overlay SVG styling */
      .glass-crack-overlay.heavy-crack svg {
        width: 135%;
        height: 135%;
        filter: drop-shadow(0 0 14px rgba(255, 30, 60, 1))
                drop-shadow(0 0 28px rgba(255, 180, 0, 0.9))
                drop-shadow(0 4px 10px rgba(0, 0, 0, 0.98));
      }

      /* Minor Hit Animation (Fast, cyan/white flash, subtle scale expansion) */
      .glass-crack-overlay.crack-active:not(.heavy-crack) {
        animation: kfMinorGlassShatter 0.68s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }

      /* Heavy S-Move Animation (Longer, blood-red explosion flash, massive scale shatter) */
      .glass-crack-overlay.crack-active.heavy-crack {
        animation: kfHeavyGlassShatter 1.25s cubic-bezier(0.12, 0.9, 0.2, 1) forwards;
      }

      /* Minor victim box tremor */
      .victim-hit-shake {
        animation: kfVictimShake 0.32s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
      }

      /* Heavy S-Move violent scaling screen shake */
      .victim-hit-heavy-shake {
        animation: kfVictimHeavyShake 0.58s cubic-bezier(0.22, 1, 0.36, 1) both;
      }

      @keyframes kfMinorGlassShatter {
        0% {
          opacity: 0.9;
          background: rgba(200, 245, 255, 0.22);
          transform: scale(0.88);
        }
        15% {
          opacity: 1;
          background: rgba(120, 220, 255, 0.12);
          transform: scale(1.02);
        }
        100% {
          opacity: 0;
          background: transparent;
          transform: scale(1.05);
        }
      }

      @keyframes kfHeavyGlassShatter {
        0% {
          opacity: 1;
          background: rgba(255, 255, 255, 0.68);
          transform: scale(0.75);
        }
        10% {
          opacity: 1;
          background: rgba(255, 20, 50, 0.38);
          transform: scale(1.28);
        }
        25% {
          opacity: 1;
          background: rgba(255, 140, 0, 0.22);
          transform: scale(1.18);
        }
        70% {
          opacity: 0.85;
          background: transparent;
          transform: scale(1.1);
        }
        100% {
          opacity: 0;
          background: transparent;
          transform: scale(1.32);
        }
      }

      @keyframes kfVictimShake {
        0%, 100% { transform: translate(0, 0) rotate(0deg); }
        20% { transform: translate(-5px, -3px) rotate(-0.8deg); }
        40% { transform: translate(5px, 3px) rotate(0.8deg); }
        60% { transform: translate(-4px, 2px) rotate(-0.4deg); }
        80% { transform: translate(3px, -2px) rotate(0.4deg); }
      }

      @keyframes kfVictimHeavyShake {
        0%, 100% { transform: translate(0, 0) scale(1) rotate(0deg); }
        10% { transform: translate(-14px, -10px) scale(1.06) rotate(-2.5deg); }
        25% { transform: translate(14px, 8px) scale(0.96) rotate(2.5deg); }
        40% { transform: translate(-10px, 9px) scale(1.04) rotate(-1.8deg); }
        55% { transform: translate(10px, -7px) scale(0.98) rotate(1.8deg); }
        70% { transform: translate(-6px, 4px) scale(1.02) rotate(-0.9deg); }
        85% { transform: translate(4px, -3px) scale(1.01) rotate(0.5deg); }
      }

      .damage-popup {
        position: absolute !important;
        transform: translate(-50%, -50%);
        z-index: 9999 !important;
        pointer-events: none !important;
        text-align: center !important;
        white-space: nowrap !important;
        font-family: var(--kf-hud-font-display) !important;
        font-size: clamp(2.4rem, 5.8vw, 4.2rem) !important;
        font-weight: 900 !important;
        font-style: italic !important;
        letter-spacing: 0.04em !important;
        line-height: 1.05 !important;
        background: linear-gradient(180deg, #ffffff 0%, #ffe66d 28%, #ff3b1f 68%, #9e0000 100%) !important;
        -webkit-background-clip: text !important;
        background-clip: text !important;
        -webkit-text-fill-color: transparent !important;
        -webkit-text-stroke: 2.5px #1a0000 !important;
        filter: drop-shadow(0 4px 0 #000000)
                drop-shadow(0 0 14px rgba(255, 35, 0, 0.95))
                drop-shadow(0 0 28px rgba(255, 180, 0, 0.65)) !important;
        animation: kfStylishDmgPop 1.35s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards !important;
      }

      .damage-popup.heavy-dmg {
        font-size: clamp(2.9rem, 7vw, 4.9rem) !important;
        background: linear-gradient(180deg, #ffffff 0%, #fff3a1 22%, #ff0044 62%, #6b001b 100%) !important;
        -webkit-background-clip: text !important;
        background-clip: text !important;
        filter: drop-shadow(0 5px 0 #000000)
                drop-shadow(0 0 18px rgba(255, 0, 68, 1))
                drop-shadow(0 0 34px rgba(255, 215, 0, 0.85)) !important;
      }

      .damage-popup.scratch {
        font-size: clamp(1.95rem, 4.6vw, 3.3rem) !important;
        background: linear-gradient(180deg, #ffffff 0%, #ffd166 38%, #ff7b00 85%, #993d00 100%) !important;
        -webkit-background-clip: text !important;
        background-clip: text !important;
        -webkit-text-stroke: 2px #1a0900 !important;
        filter: drop-shadow(0 3px 0 #000000)
                drop-shadow(0 0 12px rgba(255, 140, 0, 0.9)) !important;
      }

      .damage-popup.heal {
        font-size: clamp(1.4rem, 3.6vw, 2.2rem) !important;
        background: linear-gradient(180deg, #ffffff 0%, #a8ffdb 35%, #00e676 78%, #007a3d 100%) !important;
        -webkit-background-clip: text !important;
        background-clip: text !important;
        -webkit-text-stroke: 2px #001f0f !important;
        filter: drop-shadow(0 3px 0 #000000)
                drop-shadow(0 0 14px rgba(0, 230, 118, 0.9)) !important;
      }

      .damage-popup.block {
        font-size: clamp(1.25rem, 2.8vw, 2.6rem) !important;
        background: linear-gradient(180deg, #ffffff 0%, #ffe89e 40%, #f59e0b 85%, #92400e 100%) !important;
        -webkit-background-clip: text !important;
        background-clip: text !important;
        -webkit-text-stroke: 2px #1c0d00 !important;
        filter: drop-shadow(0 3px 0 #000000)
                drop-shadow(0 0 14px rgba(255, 209, 102, 0.85)) !important;
      }

      .damage-popup.miss {
        font-size: clamp(1.25rem, 2.8vw, 2.6rem) !important;
        background: linear-gradient(180deg, #ffffff 0%, #bae6fd 45%, #38bdf8 88%, #0369a1 100%) !important;
        -webkit-background-clip: text !important;
        background-clip: text !important;
        -webkit-text-stroke: 2px #021824 !important;
        filter: drop-shadow(0 3px 0 #000000)
                drop-shadow(0 0 12px rgba(56, 189, 248, 0.85)) !important;
      }

      @keyframes kfStylishDmgPop {
        0% {
          opacity: 0;
          transform: translate(-50%, -18%) scale(0.25) rotate(-8deg);
        }
        16% {
          opacity: 1;
          transform: translate(-50%, -55%) scale(1.28) rotate(3deg);
        }
        32% {
          opacity: 1;
          transform: translate(-50%, -48%) scale(0.96) rotate(-1deg);
        }
        48% {
          opacity: 1;
          transform: translate(-50%, -54%) scale(1.05) rotate(0deg);
        }
        78% {
          opacity: 1;
          transform: translate(-50%, -68%) scale(1);
        }
        100% {
          opacity: 0;
          transform: translate(-50%, -95%) scale(0.88);
        }
      }

      .pad-label,
      .charge-status,
      .action-flag,
      .pad-btn {
        font-family: var(--kf-hud-font-display) !important;
      }
    `;

    (document.head || document.documentElement).appendChild(style);
  }

  installStyles();
  disablePortraitOrientationOverlay();
  installBattleTextObserver();

  g.addEventListener("resize", disablePortraitOrientationOverlay);
  g.addEventListener("orientationchange", disablePortraitOrientationOverlay);

  g.UI = {
    ...(g.UI || {}),
    PATCH: "numeric-status-hud-2-i18n",
    updatePlayerHUD,
    showDamagePopup,
    triggerGlassCrack,
    resetRiderHitCounters,
    showBattleBanner,
    showActionBanner,
    describeStatus,
    statusName,
    localizeBattleText,
    syncBattleStaticDOM
  };

  g.updatePlayerHUD = updatePlayerHUD;
  g.showDamagePopup = showDamagePopup;
  g.triggerGlassCrack = triggerGlassCrack;
  g.resetRiderHitCounters = resetRiderHitCounters;
  g.showBattleBanner = showBattleBanner;
  g.showActionBanner = showActionBanner;
  g.localizeBattleText = localizeBattleText;
})(window);
