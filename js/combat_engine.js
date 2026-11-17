/* js/combat_engine.js
 * Sequential combat playback, including periodic status events.
 *
 * Compatibility: live-ui-2
 * Patch: complete-status-playback-3-hit-reaction-fix-i18n
 *
 * CombatCore.resolve() remains the sole combat authority.
 * This file never calculates damage, recovery or status duration.
 */
(function (g) {
  "use strict";

  const VERSION = "live-ui-2";
  const PATCH = "complete-status-playback-3-hit-reaction-fix-i18n";

  const SLOTS = ["p1", "p2"];
  const C = g.CombatCore;
  const K = g.KF;

  const I18N_COMBAT = Object.freeze({
    en: {
      resolving: "RESOLVING…",
      statusUpdate: "STATUS UPDATE",
      interruptedPopup: "INTERRUPTED",
      interruptedBanner: (actor, move) => `${actor}: ${move} interrupted.`,
      guardReadyPopup: "GUARD READY",
      guardReadyBanner: (actor, move) => `${actor}: ${move} ready`,
      utilityDefault: "UTILITY",
      lpFull: "LP FULL",
      periodicRecovery: (actor, amount) => `${actor}: periodic recovery +${amount} LP`,
      bleedingPopup: (amount) => `BLEEDING\n-${amount} LP`,
      bleedingBanner: (actor, amount) => `${actor}: bleeding -${amount} LP`,
      cancelledLine: (actor, list) => `${actor}: cancelled ${list} — LP damage`,
      buffGained: (actor, status, rounds) => `${actor}: gained ${status} (${rounds}t)`,
      buffRefreshed: (actor, status, rounds) => `${actor}: refreshed ${status} (${rounds}t)`,
      faintRecover: (amount) => `-${amount} FAINT`,
      chiSuffix: (gain) => ` (+${gain} CHI)`,
      miss: "MISS",
      block: (dmg, chi) => (dmg > 0 ? `BLOCK: -${dmg}` : "BLOCK") + chi,
      partialBlock: (dmg, chi) => `PARTIAL BLOCK: -${dmg}${chi}`,
      guardFail: (dmg) => `GUARD FAILED: -${dmg}`,
      glancing: (dmg) => `SCRATCH: -${dmg}`
    },
    ja: {
      resolving: "判定中…",
      statusUpdate: "ステータス更新",
      interruptedPopup: "中断！",
      interruptedBanner: (actor, move) => `${actor}：${move} が中断された！`,
      guardReadyPopup: "ガード態勢",
      guardReadyBanner: (actor, move) => `${actor}：${move} 準備完了`,
      utilityDefault: "補助技",
      lpFull: "LP 最大",
      periodicRecovery: (actor, amount) => `${actor}：継続回復 +${amount} LP`,
      bleedingPopup: (amount) => `出血\n-${amount} LP`,
      bleedingBanner: (actor, amount) => `${actor}：出血ダメージ -${amount} LP`,
      cancelledLine: (actor, list) => `${actor}：LPダメージにより ${list} が解除された`,
      buffGained: (actor, status, rounds) => `${actor}：${status} 付与 (${rounds}T)`,
      buffRefreshed: (actor, status, rounds) => `${actor}：${status} 更新 (${rounds}T)`,
      faintRecover: (amount) => `-${amount} 気絶値`,
      chiSuffix: (gain) => ` (+${gain} 気力)`,
      miss: "MISS",
      block: (dmg, chi) => (dmg > 0 ? `ガード: -${dmg}` : "ガード") + chi,
      partialBlock: (dmg, chi) => `部分ガード: -${dmg}${chi}`,
      guardFail: (dmg) => `ガード崩れ: -${dmg}`,
      glancing: (dmg) => `かすり傷: -${dmg}`
    },
    zh: {
      resolving: "回合結算中…",
      statusUpdate: "狀態更新",
      interruptedPopup: "動作中斷！",
      interruptedBanner: (actor, move) => `${actor}：${move} 被中斷！`,
      guardReadyPopup: "防禦架勢",
      guardReadyBanner: (actor, move) => `${actor}：${move} 就緒`,
      utilityDefault: "輔助技能",
      lpFull: "LP 已滿",
      periodicRecovery: (actor, amount) => `${actor}：持續回復 +${amount} LP`,
      bleedingPopup: (amount) => `流血\n-${amount} LP`,
      bleedingBanner: (actor, amount) => `${actor}：流血傷害 -${amount} LP`,
      cancelledLine: (actor, list) => `${actor}：因受到 LP 傷害，已解除 ${list}`,
      buffGained: (actor, status, rounds) => `${actor}：獲得 ${status} (${rounds}回合)`,
      buffRefreshed: (actor, status, rounds) => `${actor}：刷新 ${status} (${rounds}回合)`,
      faintRecover: (amount) => `-${amount} 暈眩值`,
      chiSuffix: (gain) => ` (+${gain} 氣力)`,
      miss: "落空",
      block: (dmg, chi) => (dmg > 0 ? `防禦: -${dmg}` : "防禦成功") + chi,
      partialBlock: (dmg, chi) => `部分防禦: -${dmg}${chi}`,
      guardFail: (dmg) => `防禦崩潰: -${dmg}`,
      glancing: (dmg) => `擦傷: -${dmg}`
    }
  });

function getLang() {
    const lang = String(
      g.gameLang ||
      g.GAME_LANG ||
      g.currentLang ||
      g.gameState?.matchConfig?.lang ||
      g.gameState?.lang ||
      (typeof g.getGameLanguage === "function" ? g.getGameLanguage() : "") ||
      document.documentElement?.lang ||
      "en"
    ).toLowerCase();

    if (lang.startsWith("zh")) return "zh";
    if (lang.startsWith("ja")) return "ja";
    return "en";
  }

  function L() {
    return I18N_COMBAT[getLang()] || I18N_COMBAT.en;
  }

  function localizeFighterName(fighter) {
    if (!fighter) return "";
    const lang = getLang();
    if (typeof g.UI?.riderName === "function") {
      return g.UI.riderName(fighter);
    }
    if (lang === "zh") {
      return fighter.name_zh || fighter.nameZh || fighter.zhName || fighter.name || "";
    }
    if (lang === "ja") {
      return fighter.name_ja || fighter.nameJa || fighter.jaName || fighter.name || "";
    }
    return fighter.name_en || fighter.name || "";
  }

  function localizeMoveName(move, fallbackKey = "") {
    if (!move) return fallbackKey;
    const lang = getLang();
    if (typeof g.UI?.moveName === "function") {
      const uiName = g.UI.moveName(move);
      if (uiName) return uiName;
    }
    if (lang === "zh") {
      return move.name_zh || move.nameZh || move.zhName || move.name || move.key || fallbackKey;
    }
    if (lang === "ja") {
      return move.name_ja || move.nameJa || move.jaName || move.name || move.key || fallbackKey;
    }
    return move.name_en || move.name || move.key || fallbackKey;
  }

  function ensureMediaBindings() {
    if (g.KFMedia) {
      if (typeof g.playCenterVideo !== "function" && typeof g.KFMedia.playCenterVideo === "function") {
        g.playCenterVideo = g.KFMedia.playCenterVideo;
      }
      if (typeof g.playReactionVideo !== "function" && typeof g.KFMedia.playReactionVideo === "function") {
        g.playReactionVideo = g.KFMedia.playReactionVideo;
      }
      if (typeof g.KFMedia.freezeSides !== "function" && typeof g.freezeSides === "function") {
        g.KFMedia.freezeSides = g.freezeSides;
      }
    }
  }

  function assertReady() {
    ensureMediaBindings();

    const mediaOk =
      Boolean(g.KFMedia) &&
      typeof g.KFMedia.freezeSides === "function" &&
      typeof g.playCenterVideo === "function" &&
      typeof g.playReactionVideo === "function";

    const requirements = [
      [
        typeof C?.resolve === "function",
        "Load combat_core.js before combat_engine.js."
      ],
      [
        K?.VERSION === "shared-core-1",
        "Combat playback requires common.js shared-core-1."
      ],
      [
        typeof g.KF_AI?.remember === "function",
        "The AI history module is missing."
      ],
      [
        typeof g.UI?.showBattleBanner === "function" &&
        typeof g.UI?.showDamagePopup === "function" &&
        typeof g.UI?.showActionBanner === "function",
        "The battle UI module is missing."
      ],
      [
        typeof g.GameView?.paint === "function" &&
        typeof g.GameView?.finish === "function",
        "The game view is missing."
      ],
      [
        mediaOk,
        `Sequential media.js is missing or incompatible. (KFMedia=${Boolean(g.KFMedia)}, version=${g.KFMedia?.VERSION || "none"}, freezeSides=${typeof g.KFMedia?.freezeSides}, playCenterVideo=${typeof g.playCenterVideo}, playReactionVideo=${typeof g.playReactionVideo})`
      ],
      [
        typeof g.MatchManager?.begin === "function",
        "The match manager is missing."
      ]
    ];

    for (const [ready, message] of requirements) {
      if (!ready) throw new Error(message);
    }
  }

  function ownsTurn(gs, token) {
    return (
      g.gameState === gs &&
      gs.roundToken === token &&
      gs.roundPhase === "RESOLUTION"
    );
  }

  function paintSnapshot(gs, snapshot) {
    for (const slot of SLOTS) {
      gs[slot] = C.copyFighter(snapshot[slot]);
    }

    g.GameView.paint();
  }

  function popup(slot, text, type = "scratch", isSpecialMove = false) {
    g.UI.showDamagePopup(
      `${slot}-box`,
      text,
      type,
      isSpecialMove
    );
  }

  function nameForStatus(id) {
    return typeof g.UI.statusName === "function"
      ? g.UI.statusName(id)
      : String(id || "Status");
  }

  function resolveMoveData(gs, slot, event) {
    const key = event?.key;
    const coreMove = gs?.core?.moves?.[slot]?.[key];
    const slotMove = gs?.[slot]?.moves?.[key];
    const eventMove = event?.move;

    const riderId = String(
      gs?.[slot]?.id ||
      gs?.core?.[slot]?.id ||
      (slot === "p1" ? "ichigo" : "nigo")
    ).toLowerCase();

    const rosterMove =
      g.ROSTER?.[riderId]?.moves?.[key] ||
      g.RIDERS?.[riderId]?.moves?.[key] ||
      g.CHARACTERS?.[riderId]?.moves?.[key] ||
      g.MOVES?.[riderId]?.[key] ||
      g.MOVES?.[slot]?.[key] ||
      g.MOVES?.[key] ||
      null;

    const merged = Object.assign(
      {},
      C.IDLE || {},
      rosterMove || {},
      slotMove || {},
      coreMove || {},
      eventMove || {}
    );

    const videoFile =
      merged.video ||
      merged.videoFile ||
      merged.clip ||
      merged.src ||
      rosterMove?.video ||
      slotMove?.video ||
      coreMove?.video ||
      null;

    if (videoFile) {
      merged.video = videoFile;
    }

    if (!merged.key && key) {
      merged.key = key;
    }

    return merged;
  }

  function cancellationLines(gs, cancellations) {
    const grouped = new Map();

    for (const event of cancellations) {
      if (!SLOTS.includes(event.slot)) continue;

      if (!grouped.has(event.slot)) {
        grouped.set(event.slot, new Set());
      }

      const ids = grouped.get(event.slot);

      for (const id of event.statuses || []) {
        ids.add(id);
      }
    }

    const t = L();
    return [...grouped.entries()].map(([slot, ids]) =>
      t.cancelledLine(
        localizeFighterName(gs[slot]),
        [...ids].map(nameForStatus).join(", ")
      )
    );
  }

  function appliedStatusLines(gs, before, after) {
    const lines = [];
    const t = L();

    for (const slot of SLOTS) {
      const previous = new Map(
        (before[slot]?.activeBuffs || [])
          .filter(buff => buff.roundsLeft > 0)
          .map(buff => [buff.id, buff])
      );

      for (const buff of after[slot]?.activeBuffs || []) {
        if (!(buff.roundsLeft > 0)) continue;

        const old = previous.get(buff.id);

        const newlyApplied = !old;
        const refreshed =
          old &&
          buff.appliedRound !== old.appliedRound;

        if (!newlyApplied && !refreshed) continue;

        const actor = localizeFighterName(gs[slot]);
        const status = nameForStatus(buff.id);

        lines.push(
          refreshed
            ? t.buffRefreshed(actor, status, buff.roundsLeft)
            : t.buffGained(actor, status, buff.roundsLeft)
        );
      }
    }

    return lines;
  }

  function setBanner(base, extraLines = []) {
    g.UI.showBattleBanner(
      [base, ...extraLines]
        .filter(Boolean)
        .join("\n")
    );
  }

  function outcomeLabel(event) {
    const t = L();
    const damage = Math.max(
      0,
      Number(event.damage) || 0
    );

    const chiGain = Math.max(
      0,
      Number(event.guardReward) || 0
    );

    const chiSuffix = chiGain > 0
      ? t.chiSuffix(chiGain)
      : "";

    const labels = {
      miss: t.miss,
      block: t.block(damage, chiSuffix),
      partialBlock: t.partialBlock(damage, chiSuffix),
      guardFail: t.guardFail(damage),
      glancing: t.glancing(damage)
    };

    return labels[event.outcome] ||
      `-${damage}${chiSuffix}`;
  }

  function reactionFor(gs, event) {
    if (event.outcome === "miss") return "DODGE";

    if (
      event.outcome === "block" ||
      event.outcome === "partialBlock" ||
      (
        event.guarded &&
        event.outcome !== "guardFail"
      )
    ) {
      return "GUARD";
    }

    return "HIT";
  }

  function videoOptions(context) {
    return {
      signal: context.controller.signal,
      isCurrent: context.current
    };
  }

  async function readableDelay(context, ms = 450) {
    if (!context.current()) return false;

    await K.wait(ms);
    return context.current();
  }

  async function awaitClip(context, startClip) {
    if (!context.current()) return false;

    try {
      const result = await startClip();

      if (!context.current()) {
        context.controller.abort();
        return false;
      }

      if (result?.status !== "ended") {
        console.warn(
          "[CombatPlayback] Clip did not finish normally:",
          result
        );

        await readableDelay(context, 250);
      }
    } catch (error) {
      if (!context.current()) {
        context.controller.abort();
        return false;
      }

      console.warn(
        "[CombatPlayback] Media warning:",
        error
      );

      await readableDelay(context, 250);
    }

    return context.current();
  }

  async function playAction(context, slot, move) {
    if (!move?.video) {
      console.warn(
        "[CombatPlayback] Move has no video configured:",
        slot,
        move
      );
      return context.current();
    }

    const stallTimeout = Math.max(
      1000,
      Number(g.GAME_CONFIG?.VIDEO_TIMEOUT_MS) || 8000
    );

    const displayMoveName = localizeMoveName(move);

    return awaitClip(context, () =>
      g.playCenterVideo(
        slot,
        move.video,
        displayMoveName,
        stallTimeout,
        move,
        videoOptions(context)
      )
    );
  }

  async function playReaction(context, slot, state) {
    return awaitClip(context, () =>
      g.playReactionVideo(
        slot,
        state,
        videoOptions(context)
      )
    );
  }

  async function presentPeriodic(
    context,
    event,
    cancellations
  ) {
    const gs = context.gs;
    const slot = event.slot;
    const t = L();

    paintSnapshot(gs, event);

    const notes = cancellationLines(
      gs,
      cancellations
    );

    const actorName = localizeFighterName(gs[slot]);

    if (event.type === "recovery") {
      const recovery = Math.max(
        0,
        Number(event.recovery) || 0
      );

      popup(
        slot,
        recovery > 0
          ? `+${recovery} LP`
          : t.lpFull,
        "heal"
      );

      setBanner(
        t.periodicRecovery(actorName, recovery),
        notes
      );

      await readableDelay(context);
      return;
    }

    const damage = Math.max(
      0,
      Number(event.damage) || 0
    );

    popup(
      slot,
      t.bleedingPopup(damage),
      "damage"
    );

    setBanner(
      t.bleedingBanner(actorName, damage),
      notes
    );

    if (damage > 0) {
      await playReaction(context, slot, "HIT");
    } else {
      await readableDelay(context);
    }
  }

  async function presentEvent(
    context,
    event,
    cancellations = []
  ) {
    if (!context.current()) return;

    const gs = context.gs;
    const slot = event.slot;
    const t = L();

    if (
      event.type === "bleeding" ||
      event.type === "recovery"
    ) {
      await presentPeriodic(
        context,
        event,
        cancellations
      );

      return;
    }

    const move = resolveMoveData(gs, slot, event);
    const moveTitle = localizeMoveName(move, event.key);
    const actorName = localizeFighterName(gs[slot]);

    if (event.type === "interrupted") {
      paintSnapshot(gs, event);

      popup(slot, t.interruptedPopup);

      setBanner(
        t.interruptedBanner(actorName, moveTitle),
        cancellationLines(gs, cancellations)
      );

      await readableDelay(context);
      return;
    }

    if (
      !["guardReady", "utility", "attack"]
        .includes(event.type)
    ) {
      throw new Error(
        `Unsupported combat event: ${event.type}`
      );
    }

    const displayedBefore = {
      p1: C.copyFighter(gs.p1),
      p2: C.copyFighter(gs.p2)
    };

    setBanner(
      `[${slot.toUpperCase()}] ${actorName}: ${moveTitle}`
    );

    if (!await playAction(context, slot, move)) {
      return;
    }

    if (!context.current()) return;

    paintSnapshot(gs, event);

    const notes = [
      ...cancellationLines(gs, cancellations),
      ...appliedStatusLines(
        gs,
        displayedBefore,
        event
      )
    ];

    if (event.type === "guardReady") {
      popup(slot, t.guardReadyPopup);

      setBanner(
        t.guardReadyBanner(actorName, moveTitle),
        notes
      );

      await readableDelay(context);
      return;
    }

    if (event.type === "utility") {
      const recoveredLp = Math.max(
        0,
        gs[slot].lp - displayedBefore[slot].lp
      );

      const recoveredFaint = Math.max(
        0,
        displayedBefore[slot].faintMeter -
        gs[slot].faintMeter
      );

      const changes = [];

      if (recoveredLp > 0) {
        changes.push(`+${recoveredLp} LP`);
      }

      if (recoveredFaint > 0) {
        changes.push(t.faintRecover(recoveredFaint));
      }

      popup(
        slot,
        changes.length
          ? changes.join("\n")
          : moveTitle || t.utilityDefault,
        recoveredLp > 0 ? "heal" : "scratch"
      );

      setBanner(
        `${actorName}: ${moveTitle}` +
        (
          changes.length
            ? ` — ${changes.join(", ")}`
            : ""
        ),
        notes
      );

      await readableDelay(context);
      return;
    }

    const target = event.target;
    const targetName = localizeFighterName(gs[target]);
    const label = outcomeLabel(event);

    const popupType = event.outcome === "miss"
      ? "miss"
      : Number(event.damage) > 0
        ? "damage"
        : "block";

    const isSpecialMove =
      move.direction === "S" ||
      String(move.type || "").toUpperCase() === "SPECIAL";

    popup(target, label, popupType, isSpecialMove);

    setBanner(
      `${actorName}: ${moveTitle}\n` +
      `${targetName}: ${label}`,
      notes
    );

    await playReaction(
      context,
      target,
      reactionFor(gs, event)
    );
  }

  async function playTurn(gs, token) {
    assertReady();

    if (!ownsTurn(gs, token)) return false;

    if (gs.playbackToken === token) return false;

    if (!gs.actions?.p1 || !gs.actions?.p2) {
      throw new Error(
        "Both actions must be locked before resolution."
      );
    }

    if (typeof gs.combatRng !== "function") {
      throw new Error(
        "The live match is missing its combat RNG."
      );
    }

    gs.playbackToken = token;

    const controller = new AbortController();

    const context = {
      gs,
      token,
      controller,
      current: () => (
        !controller.signal.aborted &&
        ownsTurn(gs, token)
      )
    };

    const ownershipTimer = setInterval(() => {
      if (!ownsTurn(gs, token)) {
        controller.abort();
      }
    }, 100);

    try {
      g.KFMedia.freezeSides();

      const before = C.copyState(gs.core);
      gs.presentationRound = before.round;

      const result = C.resolve(
        before,
        gs.actions.p1,
        gs.actions.p2,
        gs.combatRng,
        true
      );

      const nextHistory = g.KF_AI.remember(
        gs.history || [],
        before,
        result.actions
      );

      const timer = document.getElementById(
        "turn-timer"
      );

      if (timer) {
        timer.textContent = L().resolving;
      }

      let pendingCancellations = [];

      for (const event of result.events) {
        if (!context.current()) return false;

        if (event.type === "statusCancelled") {
          pendingCancellations.push(event);
          continue;
        }

        if (event.type === "end") {
          continue;
        }

        const cancellations = pendingCancellations;
        pendingCancellations = [];

        await presentEvent(
          context,
          event,
          cancellations
        );

        if (!context.current()) return false;
      }

      if (!context.current()) return false;

      if (!gs.liveReplay) {
        gs.liveReplay = {
          seed: gs.seed,
          initial: C.copyState(before),
          turns: [],
          final: null
        };
      }

      gs.liveReplay.turns.push({
        p1: { ...result.actions.p1 },
        p2: { ...result.actions.p2 }
      });

      gs.liveReplay.final =
        C.copyState(result.state);

      gs.core = result.state;
      gs.actions = result.actions;
      gs.history = nextHistory;
      gs.roundCounter = result.state.round;

      delete gs.presentationRound;

      paintSnapshot(gs, result.state);
      g.UI.showActionBanner("");

      if (pendingCancellations.length) {
        setBanner(
          L().statusUpdate,
          cancellationLines(
            gs,
            pendingCancellations
          )
        );

        if (!await readableDelay(context)) {
          return false;
        }
      }

      if (!context.current()) return false;

      if (gs.core.winner) {
        g.GameView.finish(gs.core.winner);
        return true;
      }

      if (!await readableDelay(context)) {
        return false;
      }

      await g.MatchManager.begin();
      return true;
    } catch (error) {
      if (
        controller.signal.aborted ||
        !ownsTurn(gs, token)
      ) {
        return false;
      }

      throw error;
    } finally {
      clearInterval(ownershipTimer);
      controller.abort();
      delete gs.presentationRound;
    }
  }

  g.CombatPlayback = {
    VERSION,
    PATCH,
    assertReady,
    playTurn
  };
})(window);
