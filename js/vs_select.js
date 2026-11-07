/**
 * Character Selection Screen, BGM Manager, Bilingual (EN/JA) UI & Match Preparation
 * Path: js/vs_select.js
 */

(function (window) {
  'use strict';

  window.selectionBGM = window.selectionBGM || null;
  window.battleBGM = window.battleBGM || null;
  window.currentVolume = 0.3;
  window.gameLang = window.gameLang || 'en';

  const SELECTION_BGM_TRACKS = [
    'assets/sounds/matchup.mp3',
    'assets/sounds/matchup1.mp3',
    'assets/sounds/matchup2.mp3'
  ];

  const BATTLE_BGM_TRACKS = [
    'assets/sounds/matchup.mp3',
    'assets/sounds/matchup1.mp3',
    'assets/sounds/matchup2.mp3'
  ];

  // Candidate paths for the Credits QR code image (tries in order)
  const CREDITS_QR_PATHS = [
    'assets/images/bmc_qr.png',
    'assets/images/bmc_qr.jpg',
    'assets/images/qr.png',
    'assets/images/qr.jpg',
    'bmc_qr.png',
    'qr.png'
  ];

  /** Permanently disables and removes any portrait-rotation blocker overlay (fixes PLiCy/browser iframe lock). */
  function disablePortraitOrientationOverlay() {
    const selectors = [
      '#portrait-orientation-overlay',
      '.portrait-orientation-overlay',
      '#orientation-overlay',
      '.orientation-overlay',
      '#rotate-device-overlay',
      '.rotate-device-overlay'
    ];
    document.querySelectorAll(selectors.join(', ')).forEach(el => {
      el.hidden = true;
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('z-index', '-1', 'important');
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
  }

  /*
   * Bilingual UI Dictionary (English & Japanese)
   */
  const I18N = {
    en: {
      rotateTitle: 'PLEASE ROTATE DEVICE',
      rotateSub: 'Use portrait orientation.',
      step1Header: 'STEP 1: SELECT PLAYER 1 RIDER',
      step2Header: 'STEP 2: SELECT PLAYER 2 RIDER',
      step3Header: 'READY FOR BATTLE!',
      trackerStep1: '01 P1 SELECT',
      trackerStep2: '02 P2 SELECT',
      trackerStep3: '03 VS READY',
      player1Heading: 'PLAYER 1',
      player2Heading: 'PLAYER 2',
      humanLabel: 'HUMAN',
      cpuLabel: 'CPU',
      naLabel: 'N/A',
      difficultyLabel: 'DIFFICULTY:',
      movelistBtn: '📋 MOVELIST',
      dockStep1: 'QUICK SELECT — CLICK TO ASSIGN PLAYER 1',
      dockStep2: 'QUICK SELECT — CLICK TO ASSIGN PLAYER 2',
      dockStep3: 'MATCHUP LOCKED — READY FOR BATTLE',
      backBtn: 'BACK',
      confirmP1Btn: 'CONFIRM P1',
      confirmP2Btn: 'CONFIRM P2',
      startGameBtn: 'START GAME',
      errorCpuBanner: 'AT LEAST ONE PLAYER MUST BE CPU.',
      howtoLink: '? HOW TO PLAY',
      creditsLink: '★ CREDITS',
      howtoCloseBtn: 'GOT IT',
      creditsCloseBtn: 'OK',
      movelistCloseBtn: 'CLOSE',
      diffLabels: {
        easy: 'TREE-HOPPER',
        balanced: 'CRICKET',
        defensive: 'BEETLE',
        master: 'BULLET ANT',
        soul: 'BULLET ANT',
        rider: 'RIDER'
      },
      riderNames: {
        ichigo: 'Kamen Rider Ichigo',
        nigo: 'Kamen Rider Nigo',
        v3: 'Kamen Rider V3',
        riderman: 'Riderman',
        x: 'Kamen Rider X',
        amazon: 'Kamen Rider Amazon'
      },
      riderShortNames: {
        ichigo: 'Ichigo',
        nigo: 'Nigo',
        v3: 'V3',
        riderman: 'Riderman',
        x: 'X',
        amazon: 'Amazon'
      },
      movelistSheetSub: (lp) => `MAX LP: ${lp} • COMMAND & COMBAT DATA SHEET`,
      catBasicTitle: 'Basic Attack (D-Stance)',
      catBasicSub: 'Physical Strikes',
      catSpecialTitle: 'Special Attack (S-Stance)',
      catSpecialSub: 'Signature Finishers',
      catUtilityTitle: 'Utilities (W-Stance)',
      catUtilitySub: 'Buffs & Tech',
      catDefenseTitle: 'Defense (A-Stance)',
      catDefenseSub: 'Guard & Counter',
      colName: 'Name',
      colCmd: 'Command',
      colChi: 'CHI',
      colDmg: 'Damage',
      colEffect: 'Effect',
      colRemarks: 'Remarks',
      creditsContent: [
        'Thank you for playing!! I sincerely wish you a joyful game experience and able to beat all Riders in rider mode!!',
        '',
        '========================================',
        'GAME CREDITS',
        '========================================',
        '',
        'Dedicated to the heroes who taught us the meaning of Henshin!!',
        '',
        '[ Kamen Fight ]',
        'A Game By Terence Cheng',
        '',
        '----------------------------------------',
        'CREATED & DEVELOPED BY',
        '----------------------------------------',
        'Lead Developer: Terence Cheng',
        'Game Designer: Terence Cheng',
        'Programming: Terence Cheng',
        '',
        '----------------------------------------',
        'ART & ANIMATION',
        '----------------------------------------',
        'Lead Artist: Terence Cheng',
        'UI / UX Design: Terence Cheng',
        'Asset Packs: Terence Cheng',
        '',
        '----------------------------------------',
        'AUDIO & MUSIC',
        '----------------------------------------',
        'Composer: Terence Cheng',
        '',
        '----------------------------------------',
        'SPECIAL THANKS',
        '----------------------------------------',
        '    Friends of Terence Cheng',
        '    All of my game testers',
        '',
        '========================================',
        'Thank you for playing!',
        '© 2026',
        '========================================'
      ].join('\n'),
      howtoHtml: `
        <div class="kf-howto-content">
          <h2 class="kf-howto-main-title">HOW TO PLAY</h2>

          <div class="kf-howto-section">
            <h3>1. Select Your Rider &amp; Match Setup</h3>
            <p>Pick your Kamen Rider on the character selection screen. Choose whether to battle a friend or face off against CPU opponents ranging from <strong>TREE-HOPPER</strong> (Easy) up to the 36-matrix neural <strong>RIDER</strong> tier.</p>
          </div>

          <div class="kf-howto-section">
            <h3>2. Learn the Combat Controls</h3>
            <p>Every action requires combining a <strong>Direction Key</strong> (to choose move type and build charge) with an <strong>Action Key</strong> (to execute the move).</p>

            <div class="kf-howto-table-wrap">
              <table class="kf-howto-table">
                <thead>
                  <tr>
                    <th>Direction Key</th>
                    <th>Stance Type</th>
                    <th>Action Buttons (I, J, K, L) Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="kf-key-cell">W Key</td>
                    <td class="kf-stance-cell">Utility &amp; Buffs</td>
                    <td>High Jumps, Speed Enhancements, Attack Focus, and Stun Recovery</td>
                  </tr>
                  <tr>
                    <td class="kf-key-cell">D Key</td>
                    <td class="kf-stance-cell">Physical Attacks</td>
                    <td>Quick Punches, Kicks, and Combos that generate extra CHI</td>
                  </tr>
                  <tr>
                    <td class="kf-key-cell">S Key</td>
                    <td class="kf-stance-cell">Special Moves</td>
                    <td>Heavy Finisher Attacks (e.g., Rider Kick, Rider Punch, etc.)</td>
                  </tr>
                  <tr>
                    <td class="kf-key-cell">A Key</td>
                    <td class="kf-stance-cell">Defensive Guard</td>
                    <td>Shields and Blocks to reduce incoming damage and absorb bonus CHI</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="kf-howto-section">
            <h3>3. General Strategy</h3>
            <ul class="kf-howto-list">
              <li><strong>Hold a Direction Key:</strong> Hold W, A, S, or D to charge your power up to 100%.</li>
              <li><strong>Lock in Your Move:</strong> Press I, J, K, or L before the decision timer expires to confirm your action.</li>
              <li><strong>Build CHI with Basic Strikes:</strong> Use D-Stance physical attacks to hit your opponent and quickly fill your CHI meter.</li>
              <li><strong>Guard Incoming Threats:</strong> Use A-Stance blocks to reduce damage when you suspect your opponent is preparing a large attack.</li>
              <li><strong>Unleash Finishers:</strong> Once your CHI meter is high, use S-Stance to deal big damage to KO your opponent.</li>
            </ul>
          </div>
        </div>
      `
    },

    ja: {
      rotateTitle: '画面を回転させてください',
      rotateSub: '縦向き（ポートレート）にしてプレイしてください。',
      step1Header: 'STEP 1: プレイヤー1のライダーを選択',
      step2Header: 'STEP 2: プレイヤー2のライダーを選択',
      step3Header: 'バトル準備完了！',
      trackerStep1: '01 P1選択',
      trackerStep2: '02 P2選択',
      trackerStep3: '03 準備完了',
      player1Heading: 'プレイヤー 1',
      player2Heading: 'プレイヤー 2',
      humanLabel: 'プレイヤー',
      cpuLabel: 'CPU',
      naLabel: 'なし',
      difficultyLabel: '難易度:',
      movelistBtn: '📋 技表',
      dockStep1: 'クイック選択 ― クリックしてプレイヤー1を決定',
      dockStep2: 'クイック選択 ― クリックしてプレイヤー2を決定',
      dockStep3: '対戦カード決定 ― バトル開始可能',
      backBtn: '戻る',
      confirmP1Btn: 'P1 決定',
      confirmP2Btn: 'P2 決定',
      startGameBtn: 'バトル開始',
      errorCpuBanner: '少なくとも1人はCPUにする必要があります。',
      howtoLink: '? 遊び方',
      creditsLink: '★ クレジット',
      howtoCloseBtn: '了解',
      creditsCloseBtn: '閉じる',
      movelistCloseBtn: '閉じる',
      diffLabels: {
        easy: 'ツノゼミ',
        balanced: 'コオロギ',
        defensive: 'カブトムシ',
        master: 'パラポネラ',
        soul: 'パラポネラ',
        rider: 'ライダー'
      },
      riderNames: {
        ichigo: '仮面ライダー1号',
        nigo: '仮面ライダー2号',
        v3: '仮面ライダーV3',
        riderman: 'ライダーマン',
        x: '仮面ライダーX',
        amazon: '仮面ライダーアマゾン'
      },
      riderShortNames: {
        ichigo: '1号',
        nigo: '2号',
        v3: 'V3',
        riderman: 'ライダーマン',
        x: 'X',
        amazon: 'アマゾン'
      },
      movelistSheetSub: (lp) => `最大LP: ${lp} • コマンド＆技データ一覧`,
      catBasicTitle: '通常攻撃 (Dスタンス)',
      catBasicSub: '打撃・コンボ',
      catSpecialTitle: '必殺技 (Sスタンス)',
      catSpecialSub: 'フィニッシャー',
      catUtilityTitle: '補助・強化 (Wスタンス)',
      catUtilitySub: 'バフ＆特殊行動',
      catDefenseTitle: '防御 (Aスタンス)',
      catDefenseSub: 'ガード',
      colName: '技名',
      colCmd: 'コマンド',
      colChi: '氣コスト',
      colDmg: 'ダメージ',
      colEffect: '効果',
      colRemarks: '備考',
      creditsContent: [
        'プレイしていただきありがとうございます！！',
        '「ライダー」難易度の全制覇を目指して、熱い戦いをお楽しみください！！',
        '',
        '========================================',
        'ゲームクレジット',
        '========================================',
        '',
        '「変身」の意味を教えてくれた全てのヒーローたちに捧ぐ！！',
        '',
        '[ Kamen Fight ]',
        '制作：Terence Cheng',
        '',
        '----------------------------------------',
        '企画・開発・プログラミング',
        '----------------------------------------',
        'リード開発者: Terence Cheng',
        'ゲームデザイン: Terence Cheng',
        'プログラミング: Terence Cheng',
        '',
        '----------------------------------------',
        'アート＆アニメーション',
        '----------------------------------------',
        'リードアーティスト: Terence Cheng',
        'UI / UX デザイン: Terence Cheng',
        'アセット制作: Terence Cheng',
        '',
        '----------------------------------------',
        'オーディオ＆ミュージック',
        '----------------------------------------',
        '作曲・音響: Terence Cheng',
        '',
        '----------------------------------------',
        'スペシャルサンクス',
        '----------------------------------------',
        '    Terence Cheng の友人一同',
        '    すべてのテストプレイヤーの皆様',
        '',
        '========================================',
        'Thank you for playing!',
        '© 2026',
        '========================================'
      ].join('\n'),
      howtoHtml: `
        <div class="kf-howto-content">
          <h2 class="kf-howto-main-title">遊び方（HOW TO PLAY）</h2>

          <div class="kf-howto-section">
            <h3>1. ライダーと対戦モードの選択</h3>
            <p>キャラクター選択画面で仮面ライダーを選択します。対人戦またはCPU戦（入門向けの<strong>「ツノゼミ」</strong>から、36マトリクスAI搭載の最高峰<strong>「ライダー」</strong>まで選択可能）を設定してバトルに挑みましょう。</p>
          </div>

          <div class="kf-howto-section">
            <h3>2. 基本操作とスタンス</h3>
            <p>すべての行動は<strong>方向キー（スタンス選択＆パワーチャージ）</strong>と<strong>アクションキー（技の発動）</strong>を組み合わせて入力します。</p>

            <div class="kf-howto-table-wrap">
              <table class="kf-howto-table">
                <thead>
                  <tr>
                    <th>方向キー</th>
                    <th>スタンス種別</th>
                    <th>アクションボタン (I, J, K, L) の効果</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="kf-key-cell">W キー</td>
                    <td class="kf-stance-cell">補助・バフ</td>
                    <td>大ジャンプ、チャージ加速、攻撃集中、気絶値の回復など</td>
                  </tr>
                  <tr>
                    <td class="kf-key-cell">D キー</td>
                    <td class="kf-stance-cell">通常攻撃</td>
                    <td>素早いパンチ・キック・コンボ攻撃（ヒット時に「氣」を獲得）</td>
                  </tr>
                  <tr>
                    <td class="kf-key-cell">S キー</td>
                    <td class="kf-stance-cell">必殺技</td>
                    <td>ライダーキックやライダーパンチなどの強力なフィニッシャー</td>
                  </tr>
                  <tr>
                    <td class="kf-key-cell">A キー</td>
                    <td class="kf-stance-cell">防御ガード</td>
                    <td>相手の攻撃を防いでダメージを軽減し、ボーナスの「氣」を吸収</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="kf-howto-section">
            <h3>3. バトルの戦略ガイド</h3>
            <ul class="kf-howto-list">
              <li><strong>方向キーを長押し：</strong> W・A・S・Dのいずれかを押し続けてパワーを最大100%までチャージします。</li>
              <li><strong>技の確定（ロックイン）：</strong> 制限時間が切れる前に I・J・K・L を押して行動を確定させます。</li>
              <li><strong>通常攻撃で「氣」を溜める：</strong> Dスタンスの打撃を当てて、素早く氣ゲージを溜めましょう。</li>
              <li><strong>危険な大技をガード：</strong> 相手が大技を狙っていると感じたら、Aスタンスで確実に防御しましょう。</li>
              <li><strong>必殺技でトドメ：</strong> 氣ゲージが十分に溜まったら、Sスタンスの必殺技を叩き込んでKOを狙いましょう！</li>
            </ul>
          </div>
        </div>
      `
    }
  };

  /*
   * Complete Tabulated Movelist Database for all 6 Riders (EN & JA)
   */
  const RIDER_MOVELISTS = {
    en: {
      ichigo: {
        name: 'Kamen Rider Ichigo',
        basic: [
          { name: 'Standard Punch', cmd: 'D+J', chi: 0, dmg: 52, remarks: 'Gain 2 CHI if hit' },
          { name: 'Standard Kick', cmd: 'D+K', chi: 0, dmg: 52, remarks: 'Gain 2 CHI if hit' },
          { name: 'Punch Combo', cmd: 'D+L', chi: 1, dmg: 90, remarks: 'Gain 3 CHI if hit' },
          { name: 'Kick Combo', cmd: 'D+I', chi: 1, dmg: 87, remarks: 'Gain 3 CHI if hit' }
        ],
        special: [
          { name: 'Rider Power Chop', cmd: 'S+J', chi: 3, dmg: 400, remarks: '' },
          { name: 'Rider Head Crusher', cmd: 'S+K', chi: 4, dmg: 480, remarks: '' },
          { name: 'Rider Kick', cmd: 'S+L', chi: 6, dmg: 860, remarks: '' },
          { name: 'Kirimomi Kick', cmd: 'S+I', chi: 9, dmg: 1100, remarks: '' }
        ],
        utilities: [
          { name: 'Rider High Jump', cmd: 'W+I', chi: 0, effect: 'Buff attack and evasion', remarks: 'Last 3 rounds' },
          { name: 'Typhoon Charge', cmd: 'W+J', chi: 1, effect: 'Buff charge speed', remarks: 'Last 3 rounds' },
          { name: 'Typhoon Focus', cmd: 'W+K', chi: 1, effect: 'Buff special attack', remarks: 'Last 3 rounds' },
          { name: 'Typhoon Bless', cmd: 'W+L', chi: 1, effect: 'Decrease faint', remarks: '' }
        ],
        defense: [
          { name: 'Windmill Guard', cmd: 'A+I', chi: 4, effect: 'Defense against all attacks', remarks: '' },
          { name: 'Standard Guard', cmd: 'A+J, A+K, A+L', chi: 0, effect: 'Defense against J, K & L attacks respectively', remarks: '' }
        ]
      },
      nigo: {
        name: 'Kamen Rider Nigo',
        basic: [
          { name: 'Standard Punch', cmd: 'D+J', chi: 0, dmg: 75, remarks: 'Gain 2 CHI if hit' },
          { name: 'Standing Kick', cmd: 'D+K', chi: 0, dmg: 80, remarks: 'Gain 2 CHI if hit' },
          { name: 'Punches', cmd: 'D+L', chi: 1, dmg: 140, remarks: 'Gain 3 CHI if hit' },
          { name: 'Mixed Combo', cmd: 'D+I', chi: 1, dmg: 130, remarks: 'Gain 3 CHI if hit' }
        ],
        special: [
          { name: 'Rider Punch', cmd: 'S+J', chi: 3, dmg: 370, remarks: '' },
          { name: 'Rider Flying Knee', cmd: 'S+K', chi: 5, dmg: 480, remarks: '' },
          { name: 'Rider Power Kick', cmd: 'S+L', chi: 7, dmg: 860, remarks: '' },
          { name: 'Typhoon Power Break', cmd: 'S+I', chi: 10, dmg: 1065, remarks: '' }
        ],
        utilities: [
          { name: 'Rider Power Jump', cmd: 'W+I', chi: 0, effect: 'Buff attack and accuracy', remarks: 'Last 3 rounds' },
          { name: 'Typhoon Red Shutter', cmd: 'W+J', chi: 0, effect: 'Buff charge speed and armor', remarks: 'Last 2 rounds' },
          { name: 'Power Focus', cmd: 'W+K', chi: 1, effect: 'Buff basic attack', remarks: 'Last 2 rounds' },
          { name: 'Battle Cry', cmd: 'W+L', chi: 2, effect: 'Decrease faint', remarks: '' }
        ],
        defense: [
          { name: 'Windmill Guard', cmd: 'A+I', chi: 4, effect: 'Defense against all attacks', remarks: '' },
          { name: 'Standard Guard', cmd: 'A+J, A+K, A+L', chi: 0, effect: 'Defense against J, K & L attacks respectively', remarks: '' }
        ]
      },
      v3: {
        name: 'Kamen Rider V3',
        basic: [
          { name: 'Chop', cmd: 'D+J', chi: 0, dmg: 60, remarks: 'Gain 2 CHI if hit' },
          { name: 'High Kick', cmd: 'D+K', chi: 0, dmg: 63, remarks: 'Gain 2 CHI if hit' },
          { name: 'Chop Combo', cmd: 'D+L', chi: 1, dmg: 116, remarks: 'Gain 3 CHI if hit' },
          { name: 'Mixed Hits', cmd: 'D+I', chi: 1, dmg: 106, remarks: 'Gain 3 CHI if hit' }
        ],
        special: [
          { name: 'V3 Kick', cmd: 'S+J', chi: 4, dmg: 430, remarks: '' },
          { name: 'V3 Return Kick', cmd: 'S+K', chi: 5, dmg: 560, remarks: '' },
          { name: 'V3 Screw Kick', cmd: 'S+L', chi: 8, dmg: 940, remarks: '' },
          { name: 'V3 Triple Kick', cmd: 'S+I', chi: 11, dmg: 1160, remarks: '' }
        ],
        utilities: [
          { name: 'Leap', cmd: 'W+I', chi: 0, effect: 'Buff basic attack and evasion', remarks: 'Last 3 rounds' },
          { name: 'Accelerator', cmd: 'W+J', chi: 0, effect: 'Buff charging speed', remarks: 'Last 3 rounds' },
          { name: 'Red Lamp Focus', cmd: 'W+K', chi: 1, effect: 'Buff attack', remarks: 'Last 3 rounds' },
          { name: 'Double Typhoon Blow', cmd: 'W+L', chi: 2, effect: 'Deal damage and build faint', remarks: 'Long reach' }
        ],
        defense: [
          { name: 'Standard Guard', cmd: 'A+I, A+J, A+K, A+L', chi: 0, effect: 'Defense against I, J, K & L attacks respectively', remarks: '' }
        ]
      },
      riderman: {
        name: 'Riderman',
        basic: [
          { name: 'Standard Punch', cmd: 'D+J', chi: 0, dmg: 55, remarks: 'Gain 2 CHI if hit' },
          { name: 'Standard Kick', cmd: 'D+K', chi: 0, dmg: 58, remarks: 'Gain 2 CHI if hit' },
          { name: 'Cassette Combo', cmd: 'D+L', chi: 1, dmg: 125, remarks: 'Gain 3 CHI if hit' },
          { name: 'Rope Arm Hook', cmd: 'D+I', chi: 1, dmg: 130, remarks: 'Gain 3 CHI if hit, Long reach' }
        ],
        special: [
          { name: 'Riderman Kick', cmd: 'S+J', chi: 4, dmg: 420, remarks: '' },
          { name: 'Drill Arm Break', cmd: 'S+K', chi: 6, dmg: 608, remarks: 'Long reach' },
          { name: 'Power Arm Strike', cmd: 'S+L', chi: 7, dmg: 688, remarks: 'Long reach' },
          { name: 'Hook Finisher', cmd: 'S+I', chi: 10, dmg: 999, remarks: 'Long reach' }
        ],
        utilities: [
          { name: 'High Leap', cmd: 'W+I', chi: 1, effect: 'Buff evasion', remarks: 'Last 3 rounds' },
          { name: 'Target Lock', cmd: 'W+J', chi: 1, effect: 'Buff accuracy', remarks: 'Last 3 rounds' },
          { name: 'Battle Cry', cmd: 'W+K', chi: 0, effect: 'Decrease faint', remarks: '' },
          { name: 'Rope Arm Tie-Up', cmd: 'W+L', chi: 2, effect: 'Slows opponent charge speed for 3 rounds', remarks: 'Deals damage' }
        ],
        defense: [
          { name: 'Standard Guard', cmd: 'A+I, A+J, A+K, A+L', chi: 0, effect: 'Defense against I, J, K & L attacks respectively', remarks: '' }
        ]
      },
      x: {
        name: 'Kamen Rider X',
        basic: [
          { name: 'Standard Punch', cmd: 'D+J', chi: 0, dmg: 60, remarks: 'Gain 2 CHI if hit' },
          { name: 'Standard Kick', cmd: 'D+K', chi: 0, dmg: 70, remarks: 'Gain 2 CHI if hit' },
          { name: 'Ridol Rod Strike', cmd: 'D+L', chi: 1, dmg: 122, remarks: 'Gain 3 CHI if hit' },
          { name: 'Ridol Whip Lash', cmd: 'D+I', chi: 1, dmg: 100, remarks: 'Gain 3 CHI if hit' }
        ],
        special: [
          { name: 'Rider Kick', cmd: 'S+J', chi: 4, dmg: 440, remarks: '' },
          { name: 'X-Kick', cmd: 'S+K', chi: 6, dmg: 700, remarks: '' },
          { name: 'Ridol Crown Split', cmd: 'S+L', chi: 7, dmg: 740, remarks: 'Long reach, build faint' },
          { name: 'Vacuum Hell Wheel', cmd: 'S+I', chi: 10, dmg: 1111, remarks: '' }
        ],
        utilities: [
          { name: 'Jump', cmd: 'W+I', chi: 0, effect: 'Buff basic attack and evasion', remarks: 'Last 3 rounds' },
          { name: 'Mercury Overdrive', cmd: 'W+J', chi: 0, effect: 'Buff attack', remarks: 'Last 2 rounds' },
          { name: 'Mercury Fortification', cmd: 'W+K', chi: 1, effect: 'Buff armor', remarks: 'Last 3 rounds' },
          { name: 'Kaizorg Vitality', cmd: 'W+L', chi: 2, effect: 'Recover LP and decrease faint', remarks: '' }
        ],
        defense: [
          { name: 'Standard Guard', cmd: 'A+I, A+J, A+K, A+L', chi: 0, effect: 'Defense against I, J, K & L attacks respectively', remarks: '' }
        ]
      },
      amazon: {
        name: 'Kamen Rider Amazon',
        basic: [
          { name: 'Mystic Kick', cmd: 'D+J', chi: 0, dmg: 77, remarks: 'Gain 2 CHI if hit' },
          { name: 'Claw Attack', cmd: 'D+K', chi: 1, dmg: 130, remarks: 'Gain 3 CHI if hit' },
          { name: 'Claw Combo', cmd: 'D+L', chi: 1, dmg: 142, remarks: 'Gain 3 CHI if hit' },
          { name: 'Standard Kick', cmd: 'D+I', chi: 0, dmg: 74, remarks: 'Gain 2 CHI if hit' }
        ],
        special: [
          { name: 'Amazon Kick', cmd: 'S+J', chi: 4, dmg: 420, remarks: '' },
          { name: 'Jaguar Shock', cmd: 'S+K', chi: 5, dmg: 450, remarks: 'Inflict Bleed for 3 rounds' },
          { name: 'Wild Tackle', cmd: 'S+L', chi: 7, dmg: 880, remarks: '' },
          { name: 'Daisetsudan', cmd: 'S+I', chi: 9, dmg: 1020, remarks: '' }
        ],
        utilities: [
          { name: 'Wild Leap', cmd: 'W+I', chi: 2, effect: 'Buff attack and evasion', remarks: 'Last 4 rounds' },
          { name: 'Inca Blessing', cmd: 'W+J', chi: 2, effect: 'Regenerate LP', remarks: 'Last 3 rounds, stops if took damage' },
          { name: 'Gigi Focus', cmd: 'W+K', chi: 0, effect: 'Buff evasion', remarks: 'Last 3 rounds' },
          { name: 'Wild Instinct', cmd: 'W+L', chi: 1, effect: 'Decrease faint', remarks: '' }
        ],
        defense: [
          { name: 'Standard Guard', cmd: 'A+I, A+J, A+K, A+L', chi: 0, effect: 'Defense against I, J, K & L attacks respectively', remarks: '' }
        ]
      }
    },

    ja: {
      ichigo: {
        name: '仮面ライダー1号',
        basic: [
          { name: '通常パンチ', cmd: 'D+J', chi: 0, dmg: 52, remarks: 'ヒット時、氣+2' },
          { name: '通常キック', cmd: 'D+K', chi: 0, dmg: 52, remarks: 'ヒット時、氣+2' },
          { name: '連続パンチ', cmd: 'D+L', chi: 1, dmg: 90, remarks: 'ヒット時、氣+3' },
          { name: '連続キック', cmd: 'D+I', chi: 1, dmg: 87, remarks: 'ヒット時、氣+3' }
        ],
        special: [
          { name: 'ライダーチョップ', cmd: 'S+J', chi: 3, dmg: 400, remarks: '' },
          { name: 'ライダー頭突き', cmd: 'S+K', chi: 4, dmg: 480, remarks: '' },
          { name: 'ライダーキック', cmd: 'S+L', chi: 6, dmg: 860, remarks: '' },
          { name: 'ライダーきりもみキック', cmd: 'S+I', chi: 9, dmg: 1100, remarks: '' }
        ],
        utilities: [
          { name: 'ライダー大ジャンプ', cmd: 'W+I', chi: 0, effect: '攻撃力・回避率アップ', remarks: '3ラウンド持続' },
          { name: 'タイフーンチャージ', cmd: 'W+J', chi: 1, effect: 'チャージ速度アップ', remarks: '3ラウンド持続' },
          { name: 'タイフーン集中', cmd: 'W+K', chi: 1, effect: '必殺技の威力アップ', remarks: '3ラウンド持続' },
          { name: 'タイフーンの加護', cmd: 'W+L', chi: 1, effect: '気絶値を減少', remarks: '' }
        ],
        defense: [
          { name: '風車ガード', cmd: 'A+I', chi: 4, effect: 'すべての攻撃を防御', remarks: '' },
          { name: '通常ガード', cmd: 'A+J, A+K, A+L', chi: 0, effect: 'J・K・L攻撃をそれぞれ防御', remarks: '' }
        ]
      },
      nigo: {
        name: '仮面ライダー2号',
        basic: [
          { name: '通常パンチ', cmd: 'D+J', chi: 0, dmg: 75, remarks: 'ヒット時、氣+2' },
          { name: '立ちキック', cmd: 'D+K', chi: 0, dmg: 80, remarks: 'ヒット時、氣+2' },
          { name: '連続パンチ', cmd: 'D+L', chi: 1, dmg: 140, remarks: 'ヒット時、氣+3' },
          { name: 'コンビネーション攻撃', cmd: 'D+I', chi: 1, dmg: 130, remarks: 'ヒット時、氣+3' }
        ],
        special: [
          { name: 'ライダーパンチ', cmd: 'S+J', chi: 3, dmg: 370, remarks: '' },
          { name: 'ライダー飛び膝蹴り', cmd: 'S+K', chi: 5, dmg: 480, remarks: '' },
          { name: 'ライダーパワーキック', cmd: 'S+L', chi: 7, dmg: 860, remarks: '' },
          { name: 'タイフーン・パワーブレイク', cmd: 'S+I', chi: 10, dmg: 1065, remarks: '' }
        ],
        utilities: [
          { name: 'ライダーパワージャンプ', cmd: 'W+I', chi: 0, effect: '攻撃力・命中率アップ', remarks: '3ラウンド持続' },
          { name: 'タイフーン・レッドシャッター', cmd: 'W+J', chi: 0, effect: 'チャージ速度・防御力アップ', remarks: '2ラウンド持続' },
          { name: 'パワー集中', cmd: 'W+K', chi: 1, effect: '通常攻撃の威力アップ', remarks: '2ラウンド持続' },
          { name: '気合の咆哮', cmd: 'W+L', chi: 2, effect: '気絶値を減少', remarks: '' }
        ],
        defense: [
          { name: '風車ガード', cmd: 'A+I', chi: 4, effect: 'すべての攻撃を防御', remarks: '' },
          { name: '通常ガード', cmd: 'A+J, A+K, A+L', chi: 0, effect: 'J・K・L攻撃をそれぞれ防御', remarks: '' }
        ]
      },
      v3: {
        name: '仮面ライダーV3',
        basic: [
          { name: 'V3チョップ', cmd: 'D+J', chi: 0, dmg: 60, remarks: 'ヒット時、氣+2' },
          { name: 'ハイキック', cmd: 'D+K', chi: 0, dmg: 63, remarks: 'ヒット時、氣+2' },
          { name: '連続チョップ', cmd: 'D+L', chi: 1, dmg: 116, remarks: 'ヒット時、氣+3' },
          { name: '連続コンビネーション', cmd: 'D+I', chi: 1, dmg: 106, remarks: 'ヒット時、氣+3' }
        ],
        special: [
          { name: 'V3キック', cmd: 'S+J', chi: 4, dmg: 430, remarks: '' },
          { name: 'V3反転キック', cmd: 'S+K', chi: 5, dmg: 560, remarks: '' },
          { name: 'V3きりもみキック', cmd: 'S+L', chi: 8, dmg: 940, remarks: '' },
          { name: 'V3トリプルキック', cmd: 'S+I', chi: 11, dmg: 1160, remarks: '' }
        ],
        utilities: [
          { name: 'V3大ジャンプ', cmd: 'W+I', chi: 0, effect: '通常攻撃・回避率アップ', remarks: '3ラウンド持続' },
          { name: 'アクセラレーター', cmd: 'W+J', chi: 0, effect: 'チャージ速度アップ', remarks: '3ラウンド持続' },
          { name: 'レッドランプ集中', cmd: 'W+K', chi: 1, effect: '攻撃力アップ', remarks: '3ラウンド持続' },
          { name: 'ダブルタイフーン・ブロー', cmd: 'W+L', chi: 2, effect: 'ダメージを与え気絶値を蓄積', remarks: '遠距離リーチ' }
        ],
        defense: [
          { name: '通常ガード', cmd: 'A+I, A+J, A+K, A+L', chi: 0, effect: 'I・J・K・L攻撃をそれぞれ防御', remarks: '' }
        ]
      },
      riderman: {
        name: 'ライダーマン',
        basic: [
          { name: '通常パンチ', cmd: 'D+J', chi: 0, dmg: 55, remarks: 'ヒット時、氣+2' },
          { name: '通常キック', cmd: 'D+K', chi: 0, dmg: 58, remarks: 'ヒット時、氣+2' },
          { name: 'カセットアーム連撃', cmd: 'D+L', chi: 1, dmg: 125, remarks: 'ヒット時、氣+3' },
          { name: 'ロープアーム・フック', cmd: 'D+I', chi: 1, dmg: 130, remarks: 'ヒット時、氣+3・遠距離リーチ' }
        ],
        special: [
          { name: 'ライダーマンキック', cmd: 'S+J', chi: 4, dmg: 420, remarks: '' },
          { name: 'ドリルアーム・ブレイク', cmd: 'S+K', chi: 6, dmg: 608, remarks: '遠距離リーチ' },
          { name: 'パワーアーム・ストライク', cmd: 'S+L', chi: 7, dmg: 688, remarks: '遠距離リーチ' },
          { name: 'スイングアーム・フィニッシャー', cmd: 'S+I', chi: 10, dmg: 999, remarks: '遠距離リーチ' }
        ],
        utilities: [
          { name: 'ハイジャンプ', cmd: 'W+I', chi: 1, effect: '回避率アップ', remarks: '3ラウンド持続' },
          { name: 'ターゲットロック', cmd: 'W+J', chi: 1, effect: '命中率アップ', remarks: '3ラウンド持続' },
          { name: '闘志の咆哮', cmd: 'W+K', chi: 0, effect: '気絶値を減少', remarks: '' },
          { name: 'ロープアーム拘束', cmd: 'W+L', chi: 2, effect: '3ラウンドの間、相手のチャージ速度を低下', remarks: 'ダメージを与える' }
        ],
        defense: [
          { name: '通常ガード', cmd: 'A+I, A+J, A+K, A+L', chi: 0, effect: 'I・J・K・L攻撃をそれぞれ防御', remarks: '' }
        ]
      },
      x: {
        name: '仮面ライダーX',
        basic: [
          { name: '通常パンチ', cmd: 'D+J', chi: 0, dmg: 60, remarks: 'ヒット時、氣+2' },
          { name: '通常キック', cmd: 'D+K', chi: 0, dmg: 70, remarks: 'ヒット時、氣+2' },
          { name: 'ライドルスティック連撃', cmd: 'D+L', chi: 1, dmg: 122, remarks: 'ヒット時、氣+3' },
          { name: 'ライドルホイップ斬り', cmd: 'D+I', chi: 1, dmg: 100, remarks: 'ヒット時、氣+3' }
        ],
        special: [
          { name: 'ライダーキック', cmd: 'S+J', chi: 4, dmg: 440, remarks: '' },
          { name: 'Xキック', cmd: 'S+K', chi: 6, dmg: 700, remarks: '' },
          { name: 'ライドル脳天割り', cmd: 'S+L', chi: 7, dmg: 740, remarks: '遠距離リーチ・気絶値蓄積' },
          { name: '真空地獄車', cmd: 'S+I', chi: 10, dmg: 1111, remarks: '' }
        ],
        utilities: [
          { name: 'Xジャンプ', cmd: 'W+I', chi: 0, effect: '通常攻撃・回避率アップ', remarks: '3ラウンド持続' },
          { name: 'マーキュリー・オーバードライブ', cmd: 'W+J', chi: 0, effect: '攻撃力アップ', remarks: '2ラウンド持続' },
          { name: 'マーキュリー装甲強化', cmd: 'W+K', chi: 1, effect: '防御力アップ', remarks: '3ラウンド持続' },
          { name: 'カイゾーグ活性', cmd: 'W+L', chi: 2, effect: 'LPを回復し気絶値を減少', remarks: '' }
        ],
        defense: [
          { name: '通常ガード', cmd: 'A+I, A+J, A+K, A+L', chi: 0, effect: 'I・J・K・L攻撃をそれぞれ防御', remarks: '' }
        ]
      },
      amazon: {
        name: '仮面ライダーアマゾン',
        basic: [
          { name: 'ミスティックキック', cmd: 'D+J', chi: 0, dmg: 77, remarks: 'ヒット時、氣+2' },
          { name: 'コンドルクローひっかき', cmd: 'D+K', chi: 1, dmg: 130, remarks: 'ヒット時、氣+3' },
          { name: 'ワイルドクロー連撃', cmd: 'D+L', chi: 1, dmg: 142, remarks: 'ヒット時、氣+3' },
          { name: '通常キック', cmd: 'D+I', chi: 0, dmg: 74, remarks: 'ヒット時、氣+2' }
        ],
        special: [
          { name: 'アマゾンキック', cmd: 'S+J', chi: 4, dmg: 420, remarks: '' },
          { name: 'ジャガーショック', cmd: 'S+K', chi: 5, dmg: 450, remarks: '3ラウンドの間、出血状態を付与' },
          { name: 'ワイルドタックル', cmd: 'S+L', chi: 7, dmg: 880, remarks: '' },
          { name: '大切断', cmd: 'S+I', chi: 9, dmg: 1020, remarks: '' }
        ],
        utilities: [
          { name: '野生の大跳躍', cmd: 'W+I', chi: 2, effect: '攻撃力・回避率アップ', remarks: '4ラウンド持続' },
          { name: 'インカの秘術', cmd: 'W+J', chi: 2, effect: 'LPを継続回復', remarks: '3ラウンド持続（被ダメージで解除）' },
          { name: 'ギギの腕輪・集中', cmd: 'W+K', chi: 0, effect: '回避率アップ', remarks: '3ラウンド持続' },
          { name: '野生の本能', cmd: 'W+L', chi: 1, effect: '気絶値を減少', remarks: '' }
        ],
        defense: [
          { name: '通常ガード', cmd: 'A+I, A+J, A+K, A+L', chi: 0, effect: 'I・J・K・L攻撃をそれぞれ防御', remarks: '' }
        ]
      }
    }
  };

  /** Returns active language dictionary ('en' or 'ja'). */
  function t() {
    return I18N[window.gameLang === 'ja' ? 'ja' : 'en'];
  }

  /** Returns localized full name for a Rider object. */
  function getLocalizedRiderName(rider) {
    if (!rider) return '';
    const dict = t();
    const id = String(rider.id || '').toLowerCase();
    return dict.riderNames[id] || rider.name || id;
  }

  /** Returns localized short name for a Rider object. */
  function getLocalizedRiderShortName(rider) {
    if (!rider) return '';
    const dict = t();
    const id = String(rider.id || '').toLowerCase();
    if (dict.riderShortNames[id]) {
      return dict.riderShortNames[id];
    }
    return String(rider.name || rider.id).replace(/^Kamen Rider\s+/i, '');
  }

  /** Sets the active game language ('en' or 'ja') and refreshes all VS Select UI & Modals. */
  window.setGameLanguage = function (lang) {
    window.gameLang = lang === 'ja' ? 'ja' : 'en';
    document.documentElement.lang = window.gameLang;

    disablePortraitOrientationOverlay();

    const dict = t();

    // Refresh How To Play & Credits modal contents if already created
    const howtoModal = document.getElementById('kf-howto-modal');
    if (howtoModal) {
      const body = howtoModal.querySelector('.kf-credits-modal-body');
      if (body) body.innerHTML = dict.howtoHtml;
      const okBtn = document.getElementById('kf-howto-ok-btn');
      if (okBtn) okBtn.textContent = dict.howtoCloseBtn;
    }

    const creditsModal = document.getElementById('kf-credits-modal');
    if (creditsModal) {
      const pre = creditsModal.querySelector('.kf-credits-pre');
      if (pre) pre.textContent = dict.creditsContent;
      const okBtn = document.getElementById('kf-credits-ok-btn');
      if (okBtn) okBtn.textContent = dict.creditsCloseBtn;
    }

    const movelistCloseBtn = document.getElementById('kf-movelist-close-btn');
    if (movelistCloseBtn) {
      movelistCloseBtn.textContent = dict.movelistCloseBtn;
    }

    window.updateSelectionUI();

    // Ensure transition from loading screen to vs-select-screen happens smoothly
    const loadingScreen = document.getElementById('loading-screen');
    const selectScreen = document.getElementById('vs-select-screen');
    if (loadingScreen && !loadingScreen.hidden && selectScreen) {
      setTimeout(() => {
        if (!loadingScreen.hidden) {
          loadingScreen.hidden = true;
          selectScreen.hidden = false;
          window.playSelectionBGM();
          window.updateSelectionUI();
        }
      }, 30);
    }
  };

  /** Protects the 2-button language selector inside #start-prompt from being overwritten by game.js. */
  function protectStartPromptButtons() {
    const startPrompt = document.getElementById('start-prompt');
    if (!startPrompt || startPrompt.dataset.kfLangProtected) return;
    startPrompt.dataset.kfLangProtected = '1';

    const BUTTONS_MARKUP = `
      <div class="start-lang-caption">SELECT LANGUAGE / 言語を選択</div>
      <div class="start-lang-btn-row">
        <button id="start-btn-en"
                type="button"
                class="start-lang-btn lang-en"
                onclick="if(window.setGameLanguage) window.setGameLanguage('en');">
          ENGLISH
        </button>
        <button id="start-btn-ja"
                type="button"
                class="start-lang-btn lang-ja"
                onclick="if(window.setGameLanguage) window.setGameLanguage('ja');">
          日本語
        </button>
      </div>
    `;

    if (!startPrompt.querySelector('.start-lang-btn')) {
      startPrompt.innerHTML = BUTTONS_MARKUP;
    }

    const observer = new MutationObserver(() => {
      if (!startPrompt.querySelector('.start-lang-btn')) {
        startPrompt.innerHTML = BUTTONS_MARKUP;
      }
    });
    observer.observe(startPrompt, { childList: true, characterData: true, subtree: true });
  }

  /*
   * All 6 Riders (6x6 = 36 Matrix) enabled for RIDER difficulty.
   */
  const RIDER_READY_IDS = new Set([
    'ichigo',
    'nigo',
    'v3',
    'riderman',
    'x',
    'amazon'
  ]);

  function riderLevelAvailable(rider) {
    return RIDER_READY_IDS.has(rider?.id);
  }

  function difficultyOptions(rider) {
    const options = [
      'easy',
      'balanced',
      'defensive',
      'master'
    ];

    if (riderLevelAvailable(rider)) {
      options.push('rider');
    }

    return options;
  }

  function normalizeSelectedDifficulty(value, rider) {
    let difficulty = String(value || 'balanced').toLowerCase();

    if (difficulty === 'mcts') {
      difficulty = 'rider';
    } else if (difficulty === 'soul') {
      difficulty = 'master';
    }

    if (!Object.prototype.hasOwnProperty.call(
      I18N.en.diffLabels,
      difficulty
    )) {
      difficulty = 'balanced';
    }

    if (
      difficulty === 'rider' &&
      !riderLevelAvailable(rider)
    ) {
      return 'master';
    }

    return difficulty;
  }

  /*
   * Modern Cyber-Tokusatsu UI Theme & Component Styles
   */
  function installRiderBadgeStyles() {
    if (document.getElementById('kf-rider-badge-styles')) {
      return;
    }

    // Load modern geometric display fonts + Noto Sans JP for Japanese UI
    if (!document.getElementById('kf-modern-fonts')) {
      const fontLink = document.createElement('link');
      fontLink.id = 'kf-modern-fonts';
      fontLink.rel = 'stylesheet';
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Chakra+Petch:ital,wght@0,500;0,600;0,700;1,700&family=Noto+Sans+JP:wght@500;700;900&family=Orbitron:wght@600;700;800;900&display=swap';
      (document.head || document.documentElement).appendChild(fontLink);
    }

    const style = document.createElement('style');
    style.id = 'kf-rider-badge-styles';

    style.textContent = `
      :root {
        --kf-font-display: 'Orbitron', 'Chakra Petch', 'Noto Sans JP', 'Segoe UI', system-ui, sans-serif;
        --kf-font-ui: 'Chakra Petch', 'Noto Sans JP', 'Segoe UI', Roboto, system-ui, sans-serif;
        --kf-p1-accent: #00f0ff;
        --kf-p1-glow: rgba(0, 240, 255, 0.38);
        --kf-p2-accent: #ff2a6d;
        --kf-p2-glow: rgba(255, 42, 109, 0.38);
        --kf-gold: #ffd166;
        --kf-bg-deep: #070a12;
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

      /* --- Screen Atmosphere & Cyber Grid --- */
      #vs-select-screen {
        font-family: var(--kf-font-ui) !important;
        background:
          radial-gradient(circle at 22% 38%, rgba(0, 240, 255, 0.13) 0%, transparent 45%),
          radial-gradient(circle at 78% 38%, rgba(255, 42, 109, 0.13) 0%, transparent 45%),
          radial-gradient(circle at 50% 10%, rgba(255, 209, 102, 0.08) 0%, transparent 40%),
          linear-gradient(180deg, #060911 0%, #0b101d 60%, #070a12 100%) !important;
        position: relative;
        overflow: hidden;
      }

      #vs-select-screen::before {
        content: '';
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(rgba(0, 240, 255, 0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 240, 255, 0.04) 1px, transparent 1px);
        background-size: 44px 44px;
        mask-image: radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0.85) 20%, transparent 80%);
        -webkit-mask-image: radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0.85) 20%, transparent 80%);
        pointer-events: none;
        z-index: 0;
      }

      /* Keep normal layout blocks above the grid without overriding fixed/absolute floating buttons or modals */
      #vs-select-screen > :not(#kf-howto-link):not(#kf-credits-link):not(.kf-howto-link):not(.kf-credits-link):not(.kf-credits-modal-backdrop) {
        z-index: 1;
      }

      /* --- Header & Step Tracker --- */
      #select-step-title,
      #vs-header-text {
        font-family: var(--kf-font-display) !important;
        font-size: clamp(1.05rem, 2.1vw, 1.55rem) !important;
        font-weight: 900 !important;
        letter-spacing: 0.12em !important;
        text-transform: uppercase;
        color: #ffffff !important;
        text-shadow: 0 0 18px rgba(0, 240, 255, 0.45), 0 2px 6px rgba(0, 0, 0, 0.9) !important;
        margin-bottom: 2px !important;
      }

      .kf-step-tracker {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin: 2px auto 8px;
        z-index: 5;
      }

      .kf-step-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        border-radius: 999px;
        font-family: var(--kf-font-display);
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        color: rgba(255, 255, 255, 0.4);
        background: rgba(15, 22, 36, 0.75);
        border: 1px solid rgba(255, 255, 255, 0.1);
        transition: all 0.25s ease;
      }

      .kf-step-pill.is-active {
        color: #060911;
        background: linear-gradient(90deg, #00f0ff, #5cfbff);
        border-color: #ffffff;
        box-shadow: 0 0 14px rgba(0, 240, 255, 0.55);
        transform: scale(1.04);
      }

      .kf-step-pill.is-active.step-p2 {
        color: #ffffff;
        background: linear-gradient(90deg, #ff2a6d, #ff6b8b);
        box-shadow: 0 0 14px rgba(255, 42, 109, 0.55);
      }

      .kf-step-pill.is-active.step-ready {
        color: #060911;
        background: linear-gradient(90deg, #ffd166, #ffae00);
        box-shadow: 0 0 16px rgba(255, 209, 102, 0.65);
      }

      .kf-step-pill.is-done {
        color: #78ff9c;
        border-color: rgba(120, 255, 156, 0.4);
        background: rgba(16, 40, 32, 0.65);
      }

      .kf-step-connector {
        width: 18px;
        height: 2px;
        background: rgba(255, 255, 255, 0.14);
        border-radius: 2px;
      }

      /* --- Player Cards (#p1-card & #p2-card) --- */
      #p1-card,
      #p2-card {
        background: linear-gradient(165deg, rgba(20, 28, 46, 0.88) 0%, rgba(9, 13, 24, 0.94) 100%) !important;
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border-radius: 14px !important;
        padding: 12px 15px !important;
        transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
                    border-color 0.28s ease,
                    box-shadow 0.28s ease,
                    opacity 0.28s ease !important;
        position: relative;
        overflow: hidden;
      }

      #p1-card::before,
      #p2-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        opacity: 0.85;
        pointer-events: none;
      }

      #p1-card::before {
        background: linear-gradient(90deg, transparent, var(--kf-p1-accent), transparent);
      }

      #p2-card::before {
        background: linear-gradient(90deg, transparent, var(--kf-p2-accent), transparent);
      }

      #p1-card.active-slot {
        border: 2px solid var(--kf-p1-accent) !important;
        box-shadow: 0 10px 32px rgba(0, 0, 0, 0.65),
                    0 0 24px var(--kf-p1-glow),
                    inset 0 0 18px rgba(0, 240, 255, 0.08) !important;
        transform: translateY(-2px);
        opacity: 1 !important;
        filter: none !important;
      }

      #p2-card.active-slot {
        border: 2px solid var(--kf-p2-accent) !important;
        box-shadow: 0 10px 32px rgba(0, 0, 0, 0.65),
                    0 0 24px var(--kf-p2-glow),
                    inset 0 0 18px rgba(255, 42, 109, 0.08) !important;
        transform: translateY(-2px);
        opacity: 1 !important;
        filter: none !important;
      }

      #p1-card.locked-slot,
      #p2-card.locked-slot {
        border: 1px solid rgba(255, 255, 255, 0.12) !important;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5) !important;
        opacity: 0.52 !important;
        transform: scale(0.985);
      }

      /* --- Portrait Image Styling --- */
      #p1-img,
      #p2-img {
        border-radius: 10px !important;
        border: 1px solid rgba(255, 255, 255, 0.14) !important;
        background: radial-gradient(circle at 50% 35%, #1f2942 0%, #090d16 100%) !important;
        box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.8), 0 4px 14px rgba(0, 0, 0, 0.5) !important;
        transition: transform 0.35s ease, filter 0.35s ease !important;
      }

      #p1-card.active-slot #p1-img {
        border-color: rgba(0, 240, 255, 0.45) !important;
      }

      #p2-card.active-slot #p2-img {
        border-color: rgba(255, 42, 109, 0.45) !important;
      }

      /* --- Rider Name & Live Stat Strip --- */
      #p1-name-display,
      #p2-name-display {
        font-family: var(--kf-font-display) !important;
        font-size: clamp(0.92rem, 1.45vw, 1.15rem) !important;
        font-weight: 800 !important;
        letter-spacing: 0.05em !important;
        color: #ffffff !important;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.85);
        margin-top: 6px !important;
        margin-bottom: 2px !important;
      }

      #p1-card.active-slot #p1-name-display {
        color: #7df9ff !important;
      }

      #p2-card.active-slot #p2-name-display {
        color: #ff8da8 !important;
      }

      .kf-stat-strip {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin: 3px 0 6px;
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.06em;
      }

      .kf-stat-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.07);
        border: 1px solid rgba(255, 255, 255, 0.14);
        color: #cbd5e1;
      }

      .kf-stat-chip strong {
        color: #ffd166;
        font-family: var(--kf-font-display);
      }

      /* Interactive Movelist Button */
      .kf-movelist-btn {
        cursor: pointer;
        font-family: var(--kf-font-display);
        font-size: 0.66rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        padding: 3px 10px;
        background: linear-gradient(135deg, rgba(187, 100, 255, 0.24) 0%, rgba(0, 240, 255, 0.2) 100%);
        border: 1px solid rgba(224, 166, 255, 0.65);
        color: #f3d5ff;
        box-shadow: 0 0 10px rgba(187, 100, 255, 0.28);
        transition: all 0.16s ease;
        pointer-events: auto !important;
      }

      .kf-movelist-btn:hover,
      .kf-movelist-btn:focus-visible {
        background: linear-gradient(135deg, #00f0ff 0%, #bb64ff 100%);
        border-color: #ffffff;
        color: #060911;
        box-shadow: 0 0 16px rgba(0, 240, 255, 0.65);
        transform: translateY(-1px) scale(1.04);
        outline: none;
      }

      .kf-movelist-btn:active {
        transform: translateY(0) scale(0.99);
      }

      /* --- Cycle Arrow Buttons & Control Type Selector --- */
      #p1-left-btn,
      #p1-right-btn,
      #p2-left-btn,
      #p2-right-btn {
        border-radius: 8px !important;
        background: rgba(255, 255, 255, 0.07) !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
        color: #ffffff !important;
        font-family: var(--kf-font-display) !important;
        font-weight: 800 !important;
        transition: all 0.15s ease !important;
      }

      #p1-left-btn:hover:not(:disabled),
      #p1-right-btn:hover:not(:disabled) {
        background: rgba(0, 240, 255, 0.22) !important;
        border-color: var(--kf-p1-accent) !important;
        box-shadow: 0 0 12px var(--kf-p1-glow) !important;
        transform: translateY(-1px);
      }

      #p2-left-btn:hover:not(:disabled),
      #p2-right-btn:hover:not(:disabled) {
        background: rgba(255, 42, 109, 0.22) !important;
        border-color: var(--kf-p2-accent) !important;
        box-shadow: 0 0 12px var(--kf-p2-glow) !important;
        transform: translateY(-1px);
      }

      #p1-type-display,
      #p2-type-display {
        border-radius: 8px !important;
        font-family: var(--kf-font-display) !important;
        font-weight: 700 !important;
        letter-spacing: 0.08em !important;
        background: rgba(13, 20, 34, 0.85) !important;
        border: 1px solid rgba(255, 255, 255, 0.18) !important;
        transition: all 0.15s ease !important;
      }

      #p1-card.active-slot #p1-type-display:hover {
        border-color: var(--kf-p1-accent) !important;
        background: rgba(0, 240, 255, 0.14) !important;
      }

      #p2-card.active-slot #p2-type-display:hover {
        border-color: var(--kf-p2-accent) !important;
        background: rgba(255, 42, 109, 0.14) !important;
      }

      /* --- Difficulty Badges --- */
      #p1-diff-display,
      #p2-diff-display {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px !important;
        padding: 3px 10px !important;
        font-family: var(--kf-font-display) !important;
        font-size: 0.75rem !important;
        font-weight: 700 !important;
        letter-spacing: 0.06em !important;
        text-transform: uppercase;
        cursor: pointer;
        pointer-events: auto !important;
        user-select: none;
        transition: all 0.18s ease !important;
      }

      #p1-diff-display.easy,
      #p2-diff-display.easy {
        color: #78ff9c !important;
        border-color: rgba(120, 255, 156, 0.55) !important;
        background: rgba(20, 60, 40, 0.5) !important;
      }

      #p1-diff-display.balanced,
      #p2-diff-display.balanced {
        color: #6ee7ff !important;
        border-color: rgba(110, 231, 255, 0.55) !important;
        background: rgba(16, 48, 68, 0.5) !important;
      }

      #p1-diff-display.defensive,
      #p2-diff-display.defensive {
        color: #ff9e64 !important;
        border-color: rgba(255, 158, 100, 0.65) !important;
        background: rgba(70, 32, 18, 0.55) !important;
      }

      #p1-diff-display.master,
      #p2-diff-display.master,
      #p1-diff-display.soul,
      #p2-diff-display.soul {
        color: #ff6b8b !important;
        border-color: rgba(255, 107, 139, 0.65) !important;
        background: rgba(70, 18, 38, 0.55) !important;
        box-shadow: 0 0 10px rgba(255, 107, 139, 0.25);
      }

      #p1-diff-display.rider,
      #p2-diff-display.rider {
        border-color: #e0a6ff !important;
        background: rgba(42, 18, 68, 0.72) !important;
        box-shadow: 0 0 14px rgba(187, 100, 255, 0.45) !important;
      }

      .kf-rider-rainbow {
        display: inline-block;
        color: #ffe17d;
        font-weight: 900;
        letter-spacing: 0.08em;
      }

      @supports ((background-clip: text) or (-webkit-background-clip: text)) {
        .kf-rider-rainbow {
          background-image: linear-gradient(
            90deg,
            #ff6b8b 0%,
            #ffac60 17%,
            #fff176 33%,
            #78ff9c 50%,
            #6ee7ff 67%,
            #a7a0ff 83%,
            #f58bff 100%
          );
          background-size: 200% auto;
          animation: kfRainbowShift 3.5s linear infinite;
          background-clip: text;
          -webkit-background-clip: text;
          color: transparent;
          -webkit-text-fill-color: transparent;
        }
      }

      @keyframes kfRainbowShift {
        0% { background-position: 0% center; }
        100% { background-position: 200% center; }
      }

      @media (forced-colors: active) {
        .kf-rider-rainbow {
          background: none;
          color: ButtonText;
          -webkit-text-fill-color: ButtonText;
        }
      }

      /* --- Bottom Quick-Select Roster Dock --- */
      .kf-roster-dock {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin: 8px auto 6px;
        padding: 8px 16px;
        max-width: min(760px, 94vw);
        background: rgba(11, 16, 28, 0.82);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 14px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
        z-index: 10;
      }

      .kf-roster-dock-title {
        font-family: var(--kf-font-display);
        font-size: 0.64rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.55);
        margin-bottom: 6px;
      }

      .kf-roster-grid {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 10px;
      }

      .kf-roster-tile {
        position: relative;
        width: clamp(58px, 7.6vw, 76px);
        padding: 4px;
        border-radius: 10px;
        background: rgba(20, 28, 46, 0.9);
        border: 1.5px solid rgba(255, 255, 255, 0.14);
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        transition: all 0.18s cubic-bezier(0.22, 1, 0.36, 1);
        user-select: none;
      }

      .kf-roster-tile:hover {
        transform: translateY(-3px);
        border-color: rgba(255, 255, 255, 0.5);
        background: rgba(32, 44, 70, 0.95);
      }

      .kf-roster-tile.is-p1 {
        border-color: var(--kf-p1-accent);
        box-shadow: 0 0 14px var(--kf-p1-glow);
      }

      .kf-roster-tile.is-p2 {
        border-color: var(--kf-p2-accent);
        box-shadow: 0 0 14px var(--kf-p2-glow);
      }

      .kf-roster-tile.is-p1.is-p2 {
        border-color: var(--kf-gold);
        box-shadow: 0 0 16px rgba(255, 209, 102, 0.5);
      }

      .kf-roster-tile-img {
        width: 100%;
        aspect-ratio: 1 / 1;
        object-fit: cover;
        border-radius: 6px;
        background: #090d16;
        display: block;
      }

      .kf-roster-tile-name {
        margin-top: 4px;
        font-family: var(--kf-font-display);
        font-size: 0.58rem;
        font-weight: 700;
        letter-spacing: 0.03em;
        color: #e2e8f0;
        text-transform: uppercase;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }

      .kf-roster-badges {
        position: absolute;
        top: 3px;
        left: 3px;
        right: 3px;
        display: flex;
        justify-content: space-between;
        pointer-events: none;
      }

      .kf-roster-tag {
        padding: 1px 5px;
        border-radius: 4px;
        font-family: var(--kf-font-display);
        font-size: 0.55rem;
        font-weight: 900;
        letter-spacing: 0.04em;
        line-height: 1.2;
      }

      .kf-roster-tag.p1 {
        background: var(--kf-p1-accent);
        color: #050811;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.65);
      }

      .kf-roster-tag.p2 {
        background: var(--kf-p2-accent);
        color: #ffffff;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.65);
        margin-left: auto;
      }

      /* --- Bottom Action Buttons (BACK / CONFIRM / START) --- */
      #back-btn,
      .btn-back {
        font-family: var(--kf-font-display) !important;
        font-weight: 700 !important;
        letter-spacing: 0.08em !important;
        border-radius: 8px !important;
        background: rgba(20, 27, 42, 0.85) !important;
        border: 1px solid rgba(255, 255, 255, 0.22) !important;
        color: #cbd5e1 !important;
        transition: all 0.18s ease !important;
      }

      #back-btn:hover:not(:disabled),
      .btn-back:hover:not(:disabled) {
        background: rgba(40, 52, 78, 0.95) !important;
        border-color: #ffffff !important;
        color: #ffffff !important;
        transform: translateY(-1px);
      }

      #confirm-btn,
      #confirm-p1-btn,
      #confirm-p2-btn,
      .btn-confirm,
      .confirm-btn {
        font-family: var(--kf-font-display) !important;
        font-weight: 800 !important;
        letter-spacing: 0.1em !important;
        border-radius: 8px !important;
        background: linear-gradient(135deg, rgba(0, 240, 255, 0.22) 0%, rgba(0, 140, 255, 0.35) 100%) !important;
        border: 1.5px solid var(--kf-p1-accent) !important;
        color: #ffffff !important;
        box-shadow: 0 0 18px rgba(0, 240, 255, 0.3) !important;
        transition: all 0.18s ease !important;
      }

      #confirm-btn:hover:not(:disabled),
      .btn-confirm:hover:not(:disabled),
      .confirm-btn:hover:not(:disabled) {
        background: linear-gradient(135deg, #00f0ff 0%, #00a8ff 100%) !important;
        color: #050811 !important;
        box-shadow: 0 0 24px rgba(0, 240, 255, 0.65) !important;
        transform: translateY(-1px);
      }

      #start-game-btn,
      .btn-start {
        font-family: var(--kf-font-display) !important;
        font-weight: 900 !important;
        letter-spacing: 0.12em !important;
        border-radius: 8px !important;
        background: linear-gradient(135deg, #ffd166 0%, #ff9f1c 100%) !important;
        border: 2px solid #fff3c4 !important;
        color: #0b0e17 !important;
        box-shadow: 0 0 24px rgba(255, 209, 102, 0.55) !important;
        transition: all 0.18s ease !important;
      }

      #start-game-btn:hover:not(:disabled),
      .btn-start:hover:not(:disabled) {
        filter: brightness(1.08);
        box-shadow: 0 0 32px rgba(255, 209, 102, 0.85) !important;
        transform: translateY(-2px) scale(1.02);
      }

      /* --- Credits Link (Compact Pill in Bottom Right) --- */
      #kf-credits-link,
      .kf-credits-link {
        position: fixed !important;
        bottom: max(14px, env(safe-area-inset-bottom, 0px)) !important;
        right: max(18px, env(safe-area-inset-right, 0px)) !important;
        left: auto !important;
        top: auto !important;
        width: auto !important;
        max-width: fit-content !important;
        margin: 0 !important;
        z-index: 150 !important;
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        background: rgba(15, 22, 36, 0.9) !important;
        backdrop-filter: blur(8px);
        color: #ffd166 !important;
        border: 1px solid rgba(255, 209, 102, 0.55) !important;
        border-radius: 999px !important;
        padding: 6px 16px !important;
        font-family: var(--kf-font-display) !important;
        font-size: 0.74rem !important;
        font-weight: 800 !important;
        letter-spacing: 0.08em !important;
        text-transform: uppercase;
        text-decoration: none;
        white-space: nowrap;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.65) !important;
        transition: all 0.16s ease;
      }

      #kf-credits-link:hover,
      #kf-credits-link:focus-visible,
      .kf-credits-link:hover,
      .kf-credits-link:focus-visible {
        background: rgba(255, 209, 102, 0.18) !important;
        border-color: #ffffff !important;
        color: #ffffff !important;
        box-shadow: 0 0 16px rgba(255, 209, 102, 0.45) !important;
        transform: translateY(-1px);
        outline: none;
      }

      /* --- Hide Volume Bar --- */
      #volume-control,
      #bgm-volume-control,
      #volume-slider,
      .volume-control,
      .bgm-control,
      input[type="range"] {
        display: none !important;
      }

      /* --- How To Play Link (Top-Left Corner) --- */
      #kf-howto-link,
      .kf-howto-link {
        position: fixed !important;
        top: max(12px, env(safe-area-inset-top, 0px)) !important;
        left: max(12px, env(safe-area-inset-left, 0px)) !important;
        right: auto !important;
        bottom: auto !important;
        width: auto !important;
        max-width: fit-content !important;
        margin: 0 !important;
        z-index: 150 !important;
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        background: rgba(15, 22, 36, 0.9) !important;
        backdrop-filter: blur(8px);
        color: #00f0ff !important;
        border: 1px solid rgba(0, 240, 255, 0.65) !important;
        border-radius: 999px !important;
        padding: 5px 14px !important;
        font-family: var(--kf-font-display) !important;
        font-size: 0.72rem !important;
        font-weight: 800 !important;
        letter-spacing: 0.08em !important;
        text-transform: uppercase;
        text-decoration: none;
        white-space: nowrap;
        cursor: pointer;
        box-shadow: 0 0 12px rgba(0, 240, 255, 0.22), 0 2px 8px rgba(0, 0, 0, 0.6) !important;
        transition: all 0.16s ease;
      }

      #kf-howto-link:hover,
      #kf-howto-link:focus-visible,
      .kf-howto-link:hover,
      .kf-howto-link:focus-visible {
        background: rgba(0, 240, 255, 0.2) !important;
        border-color: #ffffff !important;
        color: #ffffff !important;
        box-shadow: 0 0 16px rgba(0, 240, 255, 0.55) !important;
        transform: translateY(-1px);
        outline: none;
      }

      @media (orientation: portrait), (max-height: 760px) {
        .kf-roster-dock {
          margin: 4px auto 4px;
          padding: 5px 10px;
        }
        .kf-roster-tile {
          width: clamp(48px, 6.8vw, 62px);
          padding: 3px;
        }
        .kf-step-tracker {
          margin: 2px auto 4px;
        }
      }

      /* --- Upper Layer Modal Shared Styles --- */
      #kf-credits-modal,
      #kf-howto-modal,
      #kf-movelist-modal,
      .kf-credits-modal-backdrop {
        position: fixed !important;
        inset: 0 !important;
        z-index: 9999 !important;
        background: rgba(5, 8, 15, 0.84);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        box-sizing: border-box;
      }

      #kf-credits-modal[hidden],
      #kf-howto-modal[hidden],
      #kf-movelist-modal[hidden],
      .kf-credits-modal-backdrop[hidden] {
        display: none !important;
      }

      .kf-credits-modal-card {
        width: min(680px, 94vw);
        max-height: 86vh;
        background: linear-gradient(180deg, rgba(20, 28, 46, 0.96) 0%, rgba(10, 14, 24, 0.98) 100%);
        border: 1.5px solid rgba(255, 209, 102, 0.75);
        border-radius: 16px;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.9), 0 0 24px rgba(255, 209, 102, 0.2);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        color: #f4f6fb;
        position: relative;
      }

      .kf-howto-modal-card {
        border-color: rgba(0, 240, 255, 0.75);
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.9), 0 0 24px rgba(0, 240, 255, 0.2);
      }

      /* --- Movelist Modal Specific Styles --- */
      .kf-movelist-modal-card {
        width: min(920px, 96vw);
        max-height: 88vh;
        border-color: rgba(0, 240, 255, 0.75);
        box-shadow: 0 16px 52px rgba(0, 0, 0, 0.92), 0 0 28px rgba(0, 240, 255, 0.25);
      }

      .kf-movelist-watermark {
        position: absolute;
        right: -24px;
        bottom: 40px;
        width: clamp(220px, 36vw, 340px);
        height: clamp(220px, 36vw, 340px);
        object-fit: cover;
        border-radius: 50%;
        opacity: 0.07;
        filter: saturate(1.2) contrast(1.1);
        pointer-events: none;
        z-index: 0;
      }

      .kf-movelist-top-switcher {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 10px 16px;
        background: rgba(8, 12, 22, 0.9);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        z-index: 2;
      }

      .kf-movelist-tab-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 11px;
        border-radius: 999px;
        font-family: var(--kf-font-display);
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: #cbd5e1;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.14);
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .kf-movelist-tab-btn img {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        object-fit: cover;
      }

      .kf-movelist-tab-btn:hover {
        border-color: rgba(0, 240, 255, 0.6);
        color: #ffffff;
        background: rgba(0, 240, 255, 0.14);
      }

      .kf-movelist-tab-btn.is-active {
        background: linear-gradient(90deg, #00f0ff, #5cfbff);
        color: #050811;
        border-color: #ffffff;
        font-weight: 900;
        box-shadow: 0 0 12px rgba(0, 240, 255, 0.5);
      }

      .kf-movelist-header-banner {
        display: flex;
        align-items: center;
        gap: 14px;
        width: 100%;
        padding-bottom: 12px;
        margin-bottom: 14px;
        border-bottom: 1px solid rgba(0, 240, 255, 0.28);
        z-index: 1;
      }

      .kf-movelist-avatar {
        width: 58px;
        height: 58px;
        border-radius: 12px;
        object-fit: cover;
        border: 2px solid var(--kf-p1-accent);
        box-shadow: 0 0 14px rgba(0, 240, 255, 0.35);
        background: #090d16;
        flex-shrink: 0;
      }

      .kf-movelist-title-group {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 3px;
      }

      .kf-movelist-rider-title {
        margin: 0;
        font-family: var(--kf-font-display);
        font-size: clamp(1.05rem, 2.3vw, 1.38rem);
        font-weight: 900;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #ffffff;
        text-shadow: 0 0 12px rgba(0, 240, 255, 0.4);
      }

      .kf-movelist-subtitle {
        font-family: var(--kf-font-display);
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        color: #ffd166;
        text-transform: uppercase;
      }

      .kf-movelist-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
        width: 100%;
        z-index: 1;
      }

      @media (max-width: 760px) {
        .kf-movelist-grid {
          grid-template-columns: 1fr;
        }
      }

      .kf-movelist-cat-card {
        background: rgba(10, 15, 26, 0.82);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 10px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .kf-movelist-cat-header {
        padding: 7px 12px;
        font-family: var(--kf-font-display);
        font-size: 0.76rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .kf-cat-basic .kf-movelist-cat-header {
        background: linear-gradient(90deg, rgba(0, 240, 255, 0.2), transparent);
        color: #6ee7ff;
        border-left: 3px solid #00f0ff;
      }

      .kf-cat-special .kf-movelist-cat-header {
        background: linear-gradient(90deg, rgba(255, 42, 109, 0.22), transparent);
        color: #ff8da8;
        border-left: 3px solid #ff2a6d;
      }

      .kf-cat-utility .kf-movelist-cat-header {
        background: linear-gradient(90deg, rgba(120, 255, 156, 0.2), transparent);
        color: #78ff9c;
        border-left: 3px solid #78ff9c;
      }

      .kf-cat-defense .kf-movelist-cat-header {
        background: linear-gradient(90deg, rgba(224, 166, 255, 0.22), transparent);
        color: #e0a6ff;
        border-left: 3px solid #bb64ff;
      }

      .kf-movelist-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.76rem;
        text-align: left;
      }

      .kf-movelist-table th,
      .kf-movelist-table td {
        padding: 6px 9px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.07);
        vertical-align: middle;
      }

      .kf-movelist-table th {
        font-family: var(--kf-font-display);
        font-size: 0.64rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.52);
        background: rgba(255, 255, 255, 0.03);
      }

      .kf-movelist-table tr:last-child td {
        border-bottom: none;
      }

      .kf-move-name {
        font-weight: 700;
        color: #f8fafc;
      }

      .kf-cmd-badge {
        display: inline-block;
        padding: 2px 6px;
        border-radius: 5px;
        font-family: var(--kf-font-display);
        font-size: 0.66rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        background: rgba(0, 240, 255, 0.14);
        border: 1px solid rgba(0, 240, 255, 0.4);
        color: #7df9ff;
        white-space: nowrap;
      }

      .kf-chi-val {
        font-family: var(--kf-font-display);
        font-weight: 700;
        color: #ffd166;
        text-align: center;
      }

      .kf-dmg-val {
        font-family: var(--kf-font-display);
        font-weight: 800;
        color: #ff6b8b;
      }

      .kf-effect-val {
        color: #a7f3d0;
        font-weight: 600;
      }

      .kf-remarks-val {
        color: #94a3b8;
        font-size: 0.71rem;
      }

      .kf-credits-modal-body {
        padding: 20px 24px;
        overflow-y: auto;
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        z-index: 1;
      }

      .kf-credits-qr-wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin-bottom: 16px;
      }

      .kf-credits-qr-img {
        width: clamp(140px, 32vw, 185px);
        height: clamp(140px, 32vw, 185px);
        object-fit: contain;
        background: #ffffff;
        padding: 8px;
        border-radius: 12px;
        border: 2px solid #ffd166;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.65);
        display: block;
      }

      .kf-credits-pre {
        width: 100%;
        margin: 0;
        font-family: var(--kf-font-ui);
        font-size: clamp(0.82rem, 1.8vw, 0.96rem);
        line-height: 1.6;
        white-space: pre-wrap;
        word-break: break-word;
        text-align: center;
        color: #f4f6fb;
      }

      /* --- How To Play Content Formatting --- */
      .kf-howto-content {
        width: 100%;
        text-align: left;
        font-family: var(--kf-font-ui);
        font-size: clamp(0.82rem, 1.8vw, 0.95rem);
        line-height: 1.55;
        color: #e2e8f0;
      }

      .kf-howto-main-title {
        font-family: var(--kf-font-display);
        text-align: center;
        color: #ffd166;
        font-size: clamp(1.15rem, 2.8vw, 1.45rem);
        letter-spacing: 0.1em;
        margin: 0 0 16px 0;
        padding-bottom: 10px;
        border-bottom: 1px solid rgba(0, 240, 255, 0.3);
        text-shadow: 0 0 12px rgba(255, 209, 102, 0.4);
      }

      .kf-howto-section {
        margin-bottom: 16px;
      }

      .kf-howto-section h3 {
        font-family: var(--kf-font-display);
        color: #00f0ff;
        font-size: clamp(0.9rem, 2vw, 1.04rem);
        margin: 0 0 6px 0;
        letter-spacing: 0.04em;
      }

      .kf-howto-section p {
        margin: 0 0 8px 0;
        color: #f4f6fb;
      }

      .kf-howto-table-wrap {
        width: 100%;
        overflow-x: auto;
        margin-top: 8px;
      }

      .kf-howto-table {
        width: 100%;
        border-collapse: collapse;
        font-size: clamp(0.76rem, 1.7vw, 0.88rem);
        background: rgba(10, 14, 23, 0.78);
        border: 1px solid rgba(0, 240, 255, 0.35);
        border-radius: 8px;
        overflow: hidden;
      }

      .kf-howto-table th,
      .kf-howto-table td {
        border: 1px solid rgba(0, 240, 255, 0.22);
        padding: 9px 12px;
        text-align: left;
        vertical-align: top;
      }

      .kf-howto-table th {
        font-family: var(--kf-font-display);
        background: rgba(0, 240, 255, 0.14);
        color: #ffd166;
        font-weight: 800;
        letter-spacing: 0.05em;
      }

      .kf-howto-table .kf-key-cell {
        font-family: var(--kf-font-display);
        color: #00f0ff;
        font-weight: 800;
        white-space: nowrap;
      }

      .kf-howto-table .kf-stance-cell {
        color: #ffd166;
        font-weight: 700;
        white-space: nowrap;
      }

      .kf-howto-list {
        margin: 6px 0 0 0;
        padding-left: 18px;
      }

      .kf-howto-list li {
        margin-bottom: 6px;
      }

      .kf-howto-list strong {
        color: #ffd166;
      }

      .kf-credits-modal-footer {
        padding: 12px 20px 16px;
        border-top: 1px solid rgba(255, 255, 255, 0.12);
        display: flex;
        justify-content: center;
        background: rgba(8, 11, 19, 0.92);
        z-index: 2;
      }

      .kf-credits-ok-btn {
        min-width: 140px;
        padding: 9px 28px;
        font-family: var(--kf-font-display);
        font-size: 0.9rem;
        font-weight: 900;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #0b0e17;
        background: linear-gradient(180deg, #ffe793 0%, #f5b935 100%);
        border: 2px solid #fff3c4;
        border-radius: 999px;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(245, 185, 53, 0.4);
        transition: transform 0.12s ease, filter 0.15s ease;
      }

      .kf-credits-ok-btn:hover,
      .kf-credits-ok-btn:focus-visible {
        filter: brightness(1.08);
        transform: translateY(-1px);
        outline: none;
      }

      .kf-credits-ok-btn:active {
        transform: translateY(0);
      }
    `;

    (document.head || document.documentElement).appendChild(style);
  }

  installRiderBadgeStyles();
  disablePortraitOrientationOverlay();

  /** Renders the HTML content for a specific Rider's movelist inside #kf-movelist-modal in the active language. */
  function renderMovelistModalContent(riderId) {
    const dict = t();
    const langKey = window.gameLang === 'ja' ? 'ja' : 'en';
    const riders = window.AVAILABLE_RIDERS || [];
    const normalizedId = String(riderId || 'ichigo').toLowerCase();

    const moveSetLang = RIDER_MOVELISTS[langKey] || RIDER_MOVELISTS.en;
    const moveData = moveSetLang[normalizedId] || moveSetLang.ichigo;

    const riderObj = riders.find(r => r.id === normalizedId) || riders[0] || {
      id: normalizedId,
      name: moveData.name,
      icon: `assets/images/icons/${normalizedId}.png`,
      maxLp: 3000
    };

    const switcherEl = document.getElementById('kf-movelist-switcher');
    if (switcherEl) {
      switcherEl.innerHTML = riders.map(r => {
        const shortName = getLocalizedRiderShortName(r);
        const activeClass = r.id === normalizedId ? ' is-active' : '';
        return `
          <button type="button" class="kf-movelist-tab-btn${activeClass}" data-rider-id="${r.id}">
            <img src="${r.icon}" alt="${shortName}">
            <span>${shortName}</span>
          </button>
        `;
      }).join('');

      switcherEl.querySelectorAll('.kf-movelist-tab-btn').forEach(btn => {
        btn.addEventListener('click', function () {
          renderMovelistModalContent(this.getAttribute('data-rider-id'));
        });
      });
    }

    const watermarkEl = document.getElementById('kf-movelist-watermark');
    if (watermarkEl) {
      watermarkEl.src = riderObj.icon;
      watermarkEl.alt = '';
    }

    const closeBtn = document.getElementById('kf-movelist-close-btn');
    if (closeBtn) {
      closeBtn.textContent = dict.movelistCloseBtn;
    }

    const bodyEl = document.getElementById('kf-movelist-body');
    if (!bodyEl) return;

    const renderAttackRows = (rows) => rows.map(row => `
      <tr>
        <td class="kf-move-name">${row.name}</td>
        <td><span class="kf-cmd-badge">${row.cmd}</span></td>
        <td class="kf-chi-val">${row.chi}</td>
        <td class="kf-dmg-val">${row.dmg}</td>
        <td class="kf-remarks-val">${row.remarks || '—'}</td>
      </tr>
    `).join('');

    const renderEffectRows = (rows) => rows.map(row => `
      <tr>
        <td class="kf-move-name">${row.name}</td>
        <td><span class="kf-cmd-badge">${row.cmd}</span></td>
        <td class="kf-chi-val">${row.chi}</td>
        <td class="kf-effect-val">${row.effect}</td>
        <td class="kf-remarks-val">${row.remarks || '—'}</td>
      </tr>
    `).join('');

    bodyEl.innerHTML = `
      <div class="kf-movelist-header-banner">
        <img class="kf-movelist-avatar" src="${riderObj.icon}" alt="${moveData.name}">
        <div class="kf-movelist-title-group">
          <h2 class="kf-movelist-rider-title">${moveData.name}</h2>
          <span class="kf-movelist-subtitle">${dict.movelistSheetSub(riderObj.maxLp || 3000)}</span>
        </div>
      </div>

      <div class="kf-movelist-grid">
        <!-- Basic Attack -->
        <div class="kf-movelist-cat-card kf-cat-basic">
          <div class="kf-movelist-cat-header">
            <span>${dict.catBasicTitle}</span>
            <span>${dict.catBasicSub}</span>
          </div>
          <table class="kf-movelist-table">
            <thead>
              <tr>
                <th>${dict.colName}</th>
                <th>${dict.colCmd}</th>
                <th>${dict.colChi}</th>
                <th>${dict.colDmg}</th>
                <th>${dict.colRemarks}</th>
              </tr>
            </thead>
            <tbody>
              ${renderAttackRows(moveData.basic)}
            </tbody>
          </table>
        </div>

        <!-- Special Attack -->
        <div class="kf-movelist-cat-card kf-cat-special">
          <div class="kf-movelist-cat-header">
            <span>${dict.catSpecialTitle}</span>
            <span>${dict.catSpecialSub}</span>
          </div>
          <table class="kf-movelist-table">
            <thead>
              <tr>
                <th>${dict.colName}</th>
                <th>${dict.colCmd}</th>
                <th>${dict.colChi}</th>
                <th>${dict.colDmg}</th>
                <th>${dict.colRemarks}</th>
              </tr>
            </thead>
            <tbody>
              ${renderAttackRows(moveData.special)}
            </tbody>
          </table>
        </div>

        <!-- Utilities -->
        <div class="kf-movelist-cat-card kf-cat-utility">
          <div class="kf-movelist-cat-header">
            <span>${dict.catUtilityTitle}</span>
            <span>${dict.catUtilitySub}</span>
          </div>
          <table class="kf-movelist-table">
            <thead>
              <tr>
                <th>${dict.colName}</th>
                <th>${dict.colCmd}</th>
                <th>${dict.colChi}</th>
                <th>${dict.colEffect}</th>
                <th>${dict.colRemarks}</th>
              </tr>
            </thead>
            <tbody>
              ${renderEffectRows(moveData.utilities)}
            </tbody>
          </table>
        </div>

        <!-- Defense -->
        <div class="kf-movelist-cat-card kf-cat-defense">
          <div class="kf-movelist-cat-header">
            <span>${dict.catDefenseTitle}</span>
            <span>${dict.catDefenseSub}</span>
          </div>
          <table class="kf-movelist-table">
            <thead>
              <tr>
                <th>${dict.colName}</th>
                <th>${dict.colCmd}</th>
                <th>${dict.colChi}</th>
                <th>${dict.colEffect}</th>
                <th>${dict.colRemarks}</th>
              </tr>
            </thead>
            <tbody>
              ${renderEffectRows(moveData.defense)}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /** Ensures the Movelist modal container exists inside #vs-select-screen. */
  function ensureMovelistUI() {
    const selectScreen = document.getElementById('vs-select-screen');
    if (!selectScreen) return;

    const dict = t();
    let modal = document.getElementById('kf-movelist-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'kf-movelist-modal';
      modal.className = 'kf-credits-modal-backdrop';
      modal.hidden = true;
      modal.style.display = 'none';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-label', 'Rider Movelist');

      const card = document.createElement('div');
      card.className = 'kf-credits-modal-card kf-movelist-modal-card';

      const watermark = document.createElement('img');
      watermark.id = 'kf-movelist-watermark';
      watermark.className = 'kf-movelist-watermark';
      watermark.alt = '';

      const switcher = document.createElement('div');
      switcher.id = 'kf-movelist-switcher';
      switcher.className = 'kf-movelist-top-switcher';

      const body = document.createElement('div');
      body.id = 'kf-movelist-body';
      body.className = 'kf-credits-modal-body';

      const footer = document.createElement('div');
      footer.className = 'kf-credits-modal-footer';

      const closeBtn = document.createElement('button');
      closeBtn.id = 'kf-movelist-close-btn';
      closeBtn.type = 'button';
      closeBtn.className = 'kf-credits-ok-btn';
      closeBtn.textContent = dict.movelistCloseBtn;
      closeBtn.addEventListener('click', window.closeMovelistModal);

      footer.appendChild(closeBtn);
      card.appendChild(watermark);
      card.appendChild(switcher);
      card.appendChild(body);
      card.appendChild(footer);
      modal.appendChild(card);

      modal.addEventListener('click', function (event) {
        if (event.target === modal) {
          window.closeMovelistModal(event);
        }
      });

      selectScreen.appendChild(modal);
    } else {
      const closeBtn = document.getElementById('kf-movelist-close-btn');
      if (closeBtn) closeBtn.textContent = dict.movelistCloseBtn;
    }
  }

  /** Opens the Movelist modal for the specified Rider ID. */
  window.openMovelistModal = function (riderId, e) {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();

    if (typeof window.closeCreditsModal === 'function') {
      window.closeCreditsModal();
    }
    if (typeof window.closeHowToPlayModal === 'function') {
      window.closeHowToPlayModal();
    }

    ensureMovelistUI();
    renderMovelistModalContent(riderId || 'ichigo');

    const modal = document.getElementById('kf-movelist-modal');
    if (!modal) return;

    modal.hidden = false;
    modal.style.display = 'flex';

    const body = document.getElementById('kf-movelist-body');
    if (body) body.scrollTop = 0;

    const closeBtn = document.getElementById('kf-movelist-close-btn');
    if (closeBtn) closeBtn.focus();
  };

  /** Closes the Movelist modal. */
  window.closeMovelistModal = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();

    const modal = document.getElementById('kf-movelist-modal');
    if (!modal) return;

    modal.hidden = true;
    modal.style.display = 'none';
  };

  /** Opens the upper-layer Credits modal on the VS Selection screen. */
  window.openCreditsModal = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();

    if (typeof window.closeHowToPlayModal === 'function') {
      window.closeHowToPlayModal();
    }
    if (typeof window.closeMovelistModal === 'function') {
      window.closeMovelistModal();
    }

    ensureCreditsUI();

    const modal = document.getElementById('kf-credits-modal');
    if (!modal) return;

    const dict = t();
    const pre = modal.querySelector('.kf-credits-pre');
    if (pre) pre.textContent = dict.creditsContent;
    const okBtn = document.getElementById('kf-credits-ok-btn');
    if (okBtn) okBtn.textContent = dict.creditsCloseBtn;

    modal.hidden = false;
    modal.style.display = 'flex';

    const body = modal.querySelector('.kf-credits-modal-body');
    if (body) body.scrollTop = 0;

    if (okBtn) okBtn.focus();
  };

  /** Closes the Credits modal and returns focus to the VS Selection screen. */
  window.closeCreditsModal = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();

    const modal = document.getElementById('kf-credits-modal');
    if (!modal) return;

    modal.hidden = true;
    modal.style.display = 'none';
  };

  /** Opens the upper-layer How To Play modal on the VS Selection screen. */
  window.openHowToPlayModal = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();

    if (typeof window.closeCreditsModal === 'function') {
      window.closeCreditsModal();
    }
    if (typeof window.closeMovelistModal === 'function') {
      window.closeMovelistModal();
    }

    ensureHowToPlayUI();

    const modal = document.getElementById('kf-howto-modal');
    if (!modal) return;

    const dict = t();
    const body = modal.querySelector('.kf-credits-modal-body');
    if (body) {
      body.innerHTML = dict.howtoHtml;
      body.scrollTop = 0;
    }

    const okBtn = document.getElementById('kf-howto-ok-btn');
    if (okBtn) {
      okBtn.textContent = dict.howtoCloseBtn;
    }

    modal.hidden = false;
    modal.style.display = 'flex';

    if (okBtn) okBtn.focus();
  };

  /** Closes the How To Play modal and returns focus to the VS Selection screen. */
  window.closeHowToPlayModal = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();

    const modal = document.getElementById('kf-howto-modal');
    if (!modal) return;

    modal.hidden = true;
    modal.style.display = 'none';
  };

  /** Ensures the Credits link and upper-layer modal exist inside #vs-select-screen. */
  function ensureCreditsUI() {
    const selectScreen = document.getElementById('vs-select-screen');
    if (!selectScreen) return;

    const dict = t();

    let linkBtn =
      document.getElementById('kf-credits-link') ||
      document.getElementById('credits-btn');

    if (!linkBtn) {
      linkBtn = document.createElement('button');
      linkBtn.id = 'kf-credits-link';
      linkBtn.type = 'button';
      linkBtn.className = 'kf-credits-link';
      selectScreen.appendChild(linkBtn);
    }

    linkBtn.textContent = dict.creditsLink;

    if (!linkBtn.dataset.kfCreditsBound) {
      linkBtn.addEventListener('click', window.openCreditsModal);
      linkBtn.dataset.kfCreditsBound = '1';
    }

    let modal = document.getElementById('kf-credits-modal');

    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'kf-credits-modal';
      modal.className = 'kf-credits-modal-backdrop';
      modal.hidden = true;
      modal.style.display = 'none';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-label', 'Game Credits');

      const card = document.createElement('div');
      card.className = 'kf-credits-modal-card';

      const body = document.createElement('div');
      body.className = 'kf-credits-modal-body';

      const qrWrap = document.createElement('div');
      qrWrap.className = 'kf-credits-qr-wrap';

      const qrImg = document.createElement('img');
      qrImg.id = 'kf-credits-qr-img';
      qrImg.className = 'kf-credits-qr-img';
      qrImg.alt = 'Support QR Code';
      qrImg.dataset.pathIndex = '0';
      qrImg.src = CREDITS_QR_PATHS[0];

      qrImg.addEventListener('error', function () {
        const nextIdx = (parseInt(qrImg.dataset.pathIndex, 10) || 0) + 1;
        if (nextIdx < CREDITS_QR_PATHS.length) {
          qrImg.dataset.pathIndex = String(nextIdx);
          qrImg.src = CREDITS_QR_PATHS[nextIdx];
        } else {
          qrWrap.style.display = 'none';
        }
      });

      qrWrap.appendChild(qrImg);
      body.appendChild(qrWrap);

      const pre = document.createElement('pre');
      pre.className = 'kf-credits-pre';
      pre.textContent = dict.creditsContent;

      body.appendChild(pre);

      const footer = document.createElement('div');
      footer.className = 'kf-credits-modal-footer';

      const okBtn = document.createElement('button');
      okBtn.id = 'kf-credits-ok-btn';
      okBtn.type = 'button';
      okBtn.className = 'kf-credits-ok-btn';
      okBtn.textContent = dict.creditsCloseBtn;
      okBtn.addEventListener('click', window.closeCreditsModal);

      footer.appendChild(okBtn);
      card.appendChild(body);
      card.appendChild(footer);
      modal.appendChild(card);

      modal.addEventListener('click', function (event) {
        if (event.target === modal) {
          window.closeCreditsModal(event);
        }
      });

      selectScreen.appendChild(modal);
    }
  }

  /** Ensures the How To Play link and upper-layer modal exist inside #vs-select-screen. */
  function ensureHowToPlayUI() {
    const selectScreen = document.getElementById('vs-select-screen');
    if (!selectScreen) return;

    const dict = t();

    // Remove the volume bar and its label container from the DOM
    document.querySelectorAll('input[type="range"], #volume-control, #bgm-volume-control, .volume-control, .bgm-control').forEach(el => {
      if (el.tagName === 'INPUT' && el.parentElement && el.parentElement !== document.body && el.parentElement !== selectScreen && el.parentElement.children.length <= 3) {
        el.parentElement.remove();
      } else {
        el.remove();
      }
    });

    let linkBtn =
      document.getElementById('kf-howto-link') ||
      document.getElementById('how-to-play-btn');

    if (!linkBtn) {
      linkBtn = document.createElement('button');
      linkBtn.id = 'kf-howto-link';
      linkBtn.type = 'button';
      linkBtn.className = 'kf-howto-link';
      selectScreen.appendChild(linkBtn);
    }

    linkBtn.textContent = dict.howtoLink;

    if (!linkBtn.dataset.kfHowtoBound) {
      linkBtn.addEventListener('click', window.openHowToPlayModal);
      linkBtn.dataset.kfHowtoBound = '1';
    }

    let modal = document.getElementById('kf-howto-modal');

    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'kf-howto-modal';
      modal.className = 'kf-credits-modal-backdrop';
      modal.hidden = true;
      modal.style.display = 'none';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-label', 'How To Play');

      const card = document.createElement('div');
      card.className = 'kf-credits-modal-card kf-howto-modal-card';

      const body = document.createElement('div');
      body.className = 'kf-credits-modal-body';
      body.innerHTML = dict.howtoHtml;

      const footer = document.createElement('div');
      footer.className = 'kf-credits-modal-footer';

      const okBtn = document.createElement('button');
      okBtn.id = 'kf-howto-ok-btn';
      okBtn.type = 'button';
      okBtn.className = 'kf-credits-ok-btn';
      okBtn.textContent = dict.howtoCloseBtn;
      okBtn.addEventListener('click', window.closeHowToPlayModal);

      footer.appendChild(okBtn);
      card.appendChild(body);
      card.appendChild(footer);
      modal.appendChild(card);

      modal.addEventListener('click', function (event) {
        if (event.target === modal) {
          window.closeHowToPlayModal(event);
        }
      });

      selectScreen.appendChild(modal);
    }
  }

  /** Injects and updates the 3-step progress tracker pill bar under the header. */
  function updateStepTrackerUI(currentStep) {
    const headerText = document.getElementById('select-step-title') || document.getElementById('vs-header-text');
    if (!headerText || !headerText.parentNode) return;

    const dict = t();

    let tracker = document.getElementById('kf-step-tracker');
    if (!tracker) {
      tracker = document.createElement('div');
      tracker.id = 'kf-step-tracker';
      tracker.className = 'kf-step-tracker';
      headerText.insertAdjacentElement('afterend', tracker);
    }

    tracker.innerHTML = `
      <span class="kf-step-pill step-p1" data-step="1">${dict.trackerStep1}</span>
      <span class="kf-step-connector"></span>
      <span class="kf-step-pill step-p2" data-step="2">${dict.trackerStep2}</span>
      <span class="kf-step-connector"></span>
      <span class="kf-step-pill step-ready" data-step="3">${dict.trackerStep3}</span>
    `;

    const pills = tracker.querySelectorAll('.kf-step-pill');
    pills.forEach(pill => {
      const stepNum = parseInt(pill.getAttribute('data-step'), 10);
      pill.classList.toggle('is-active', stepNum === currentStep);
      pill.classList.toggle('is-done', stepNum < currentStep);
    });
  }

  /** Injects or updates the LP & interactive MOVELIST button strip below each Rider's name. */
  function updateRiderStatStrip(playerKey, rider) {
    const nameEl = document.getElementById(playerKey + '-name-display');
    if (!nameEl || !rider) return;

    const dict = t();

    let strip = document.getElementById(playerKey + '-stat-strip');
    if (!strip) {
      strip = document.createElement('div');
      strip.id = playerKey + '-stat-strip';
      strip.className = 'kf-stat-strip';
      nameEl.insertAdjacentElement('afterend', strip);
    }

    const lp = rider.maxLp || 3000;

    strip.innerHTML = `
      <span class="kf-stat-chip">LP <strong>${lp}</strong></span>
      <button type="button" class="kf-stat-chip kf-movelist-btn" data-rider-id="${rider.id}">${dict.movelistBtn}</button>
    `;

    const movelistBtn = strip.querySelector('.kf-movelist-btn');
    if (movelistBtn) {
      movelistBtn.addEventListener('click', function (e) {
        window.openMovelistModal(rider.id, e);
      });
    }
  }

  /** Renders and updates the bottom Quick-Select Roster Dock. */
  function updateRosterDockUI() {
    const selectScreen = document.getElementById('vs-select-screen');
    const p1Card = document.getElementById('p1-card');
    if (!selectScreen || !p1Card) return;

    const dict = t();
    const riders = window.AVAILABLE_RIDERS;
    const state = window.vsSelectionState;
    const currentStep = parseInt(state.step, 10) || 1;

    let dock = document.getElementById('kf-roster-dock');
    if (!dock) {
      dock = document.createElement('div');
      dock.id = 'kf-roster-dock';
      dock.className = 'kf-roster-dock';

      const cardsContainer = p1Card.parentElement;
      if (cardsContainer && cardsContainer !== selectScreen) {
        cardsContainer.insertAdjacentElement('afterend', dock);
      } else {
        selectScreen.appendChild(dock);
      }
    }

    const promptLabel =
      currentStep === 1
        ? dict.dockStep1
        : currentStep === 2
        ? dict.dockStep2
        : dict.dockStep3;

    dock.innerHTML = `
      <div class="kf-roster-dock-title">${promptLabel}</div>
      <div class="kf-roster-grid" id="kf-roster-grid"></div>
    `;

    const grid = dock.querySelector('#kf-roster-grid');
    riders.forEach((rider, idx) => {
      const isP1 = idx === state.p1Index;
      const isP2 = idx === state.p2Index;

      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'kf-roster-tile' + (isP1 ? ' is-p1' : '') + (isP2 ? ' is-p2' : '');
      tile.title = getLocalizedRiderName(rider);

      const shortName = getLocalizedRiderShortName(rider);

      tile.innerHTML = `
        <div class="kf-roster-badges">
          ${isP1 ? '<span class="kf-roster-tag p1">P1</span>' : ''}
          ${isP2 ? '<span class="kf-roster-tag p2">P2</span>' : ''}
        </div>
        <img class="kf-roster-tile-img" src="${rider.icon}" alt="${shortName}">
        <span class="kf-roster-tile-name">${shortName}</span>
      `;

      tile.addEventListener('click', () => {
        const stepNow = parseInt(window.vsSelectionState.step, 10) || 1;
        if (stepNow === 1) {
          window.vsSelectionState.p1Index = idx;
          window.updateSelectionUI();
        } else if (stepNow === 2) {
          window.vsSelectionState.p2Index = idx;
          window.updateSelectionUI();
        }
      });

      grid.appendChild(tile);
    });
  }

  // Close Credits, How To Play, or Movelist modal on Escape or Enter key
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' && event.key !== 'Enter') return;

    const creditsModal = document.getElementById('kf-credits-modal');
    if (creditsModal && !creditsModal.hidden) {
      window.closeCreditsModal(event);
    }

    const howtoModal = document.getElementById('kf-howto-modal');
    if (howtoModal && !howtoModal.hidden) {
      window.closeHowToPlayModal(event);
    }

    const movelistModal = document.getElementById('kf-movelist-modal');
    if (movelistModal && !movelistModal.hidden) {
      window.closeMovelistModal(event);
    }
  });

  // Default fallback roster definitions (all 6 Riders)
  window.AVAILABLE_RIDERS = window.AVAILABLE_RIDERS || [
    { id: 'ichigo', name: 'Kamen Rider Ichigo', icon: 'assets/images/icons/ichigo.png', maxLp: 3000 },
    { id: 'nigo', name: 'Kamen Rider Nigo', icon: 'assets/images/icons/nigo.png', maxLp: 3300 },
    { id: 'v3', name: 'Kamen Rider V3', icon: 'assets/images/icons/v3.png', maxLp: 3150 },
    { id: 'riderman', name: 'Riderman', icon: 'assets/images/icons/riderman.png', maxLp: 2800 },
    { id: 'x', name: 'Kamen Rider X', icon: 'assets/images/icons/x.png', maxLp: 3100 },
    { id: 'amazon', name: 'Kamen Rider Amazon', icon: 'assets/images/icons/amazon.png', maxLp: 2900 }
  ];

  // Global VS Selection state controller
  window.vsSelectionState = window.vsSelectionState || {
    step: 1,           // Step 1: P1 Select, Step 2: P2 Select, Step 3: Ready
    p1Index: 0,
    p1IsCPU: false,
    p1Difficulty: 'balanced',
    p2Index: 1,
    p2IsCPU: true,
    p2Difficulty: 'balanced'
  };

  /** Applies difficulty badge styling classes to UI element. */
  function setDiffBadgeClasses(el, difficulty, isCPU) {
    if (!el) return;

    const dict = t();

    el.classList.remove(
      'easy',
      'normal',
      'balanced',
      'defensive',
      'hard',
      'master',
      'soul',
      'rider'
    );

    if (!isCPU) return;

    const name = Object.prototype.hasOwnProperty.call(
      dict.diffLabels,
      difficulty
    )
      ? difficulty
      : 'balanced';

    el.classList.add(name);

    if (name === 'rider') {
      const label = document.createElement('span');
      label.className = 'kf-rider-rainbow';
      label.textContent = dict.diffLabels.rider;

      el.replaceChildren(label);
    }
  }

  /** Toggles active/locked highlight styles on selection cards. */
  function setCardSlotClasses(cardEl, isActive) {
    if (!cardEl) return;
    if (isActive) {
      cardEl.classList.add('active-slot');
      cardEl.classList.remove('locked-slot');
    } else {
      cardEl.classList.add('locked-slot');
      cardEl.classList.remove('active-slot');
    }
  }

  /** Advances selection wizard step state forward. */
  window.confirmStep = function(e) {
    if (e && e.preventDefault) e.preventDefault();
    const state = window.vsSelectionState;
    let currentStep = parseInt(state.step, 10) || 1;

    if (currentStep === 1) {
      state.step = 2;
    } else if (currentStep === 2) {
      state.step = 3;
    }
    window.updateSelectionUI();
  };

  /** Reverts selection wizard step state backward. */
  window.goBackStep = function(e) {
    if (e && e.preventDefault) e.preventDefault();
    const state = window.vsSelectionState;
    let currentStep = parseInt(state.step, 10) || 1;

    if (currentStep === 2) {
      state.step = 1;
    } else if (currentStep === 3) {
      state.step = 2;
    }
    window.updateSelectionUI();
  };

  // Step confirmation alias mappings
  window.handleConfirmStep = window.confirmStep;
  window.handleBackStep = window.goBackStep;

  window.confirmP1 = function(e) { window.vsSelectionState.step = 2; window.updateSelectionUI(); };
  window.confirmP2 = function(e) { window.vsSelectionState.step = 3; window.updateSelectionUI(); };
  window.confirmSelection = window.confirmStep;
  window.nextStep = window.confirmStep;
  window.confirmP1Selection = window.confirmP1;
  window.confirmP2Selection = window.confirmP2;

  /** Updates audio background track volume. */
  window.changeBGMVolume = function(val) {
    window.currentVolume = parseFloat(val);
    if (window.selectionBGM) window.selectionBGM.volume = window.currentVolume;
    if (window.battleBGM) window.battleBGM.volume = window.currentVolume;
  };

  /** Plays randomized background music for character selection screen. */
  window.playSelectionBGM = function() {
    if (window.selectionBGM) return;
    try {
      const randomIndex = Math.floor(Math.random() * SELECTION_BGM_TRACKS.length);
      const randomTrack = SELECTION_BGM_TRACKS[randomIndex];

      window.selectionBGM = new Audio(randomTrack);
      window.selectionBGM.loop = true;
      window.selectionBGM.volume = window.currentVolume;
      const playPromise = window.selectionBGM.play();
      if (playPromise !== undefined) playPromise.catch(() => {});
    } catch (e) {
      console.warn("Audio load error:", e);
    }
  };

  /** Stops selection screen background music. */
  window.stopSelectionBGM = function() {
    if (window.selectionBGM) {
      try {
        window.selectionBGM.pause();
        window.selectionBGM.currentTime = 0;
      } catch (e) {}
      window.selectionBGM = null;
    }
  };

  /** Plays randomized background music for live battle screen. */
  window.playBattleBGM = function() {
    if (window.battleBGM) return;
    try {
      const randomIndex = Math.floor(Math.random() * BATTLE_BGM_TRACKS.length);
      const randomTrack = BATTLE_BGM_TRACKS[randomIndex];

      window.battleBGM = new Audio(randomTrack);
      window.battleBGM.loop = true;
      window.battleBGM.volume = window.currentVolume;
      const playPromise = window.battleBGM.play();
      if (playPromise !== undefined) playPromise.catch(() => {});
    } catch (e) {
      console.warn("Audio load error:", e);
    }
  };

  /** Stops battle background music. */
  window.stopBattleBGM = function() {
    if (window.battleBGM) {
      try {
        window.battleBGM.pause();
        window.battleBGM.currentTime = 0;
      } catch (e) {}
      window.battleBGM = null;
    }
  };

  /** Cycles active rider selection index for P1 or P2. */
  window.cycleRider = function(playerKey, direction) {
    const riders = window.AVAILABLE_RIDERS;
    const state = window.vsSelectionState;
    const currentStep = parseInt(state.step, 10) || 1;
    if (!riders || riders.length === 0) return;

    if (playerKey === 'p1' && currentStep === 1) {
      state.p1Index = (state.p1Index + direction + riders.length) % riders.length;
    } else if (playerKey === 'p2' && currentStep === 2) {
      state.p2Index = (state.p2Index + direction + riders.length) % riders.length;
    }
    window.updateSelectionUI();
  };

  /** Toggles player control type between Human and CPU. */
  window.toggleControlType = function(playerKey) {
    if (playerKey !== 'p1' && playerKey !== 'p2') {
      return;
    }

    const state = window.vsSelectionState;
    const currentStep = parseInt(state.step, 10) || 1;
    const requiredStep = playerKey === 'p1' ? 1 : 2;

    if (currentStep !== requiredStep) {
      return;
    }

    state[playerKey + 'IsCPU'] = !state[playerKey + 'IsCPU'];
    window.updateSelectionUI();
  };

  /** Cycles CPU difficulty setting (easy -> balanced -> defensive -> master -> [rider]). */
  window.toggleDifficulty = function(playerKey) {
    if (playerKey !== 'p1' && playerKey !== 'p2') {
      return;
    }

    const state = window.vsSelectionState;
    const riders = window.AVAILABLE_RIDERS || [];

    // Allow cycling difficulty on any step as long as this slot is set to CPU
    if (!state[playerKey + 'IsCPU']) {
      return;
    }

    const rider =
      riders[state[playerKey + 'Index']] ||
      riders[0];

    if (!rider) return;

    const options = difficultyOptions(rider);

    const current = normalizeSelectedDifficulty(
      state[playerKey + 'Difficulty'],
      rider
    );

    const index = options.indexOf(current);

    state[playerKey + 'Difficulty'] =
      options[(index + 1) % options.length];

    window.updateSelectionUI();
  };

  /** Synchronizes selection screen UI elements, controls, and card highlights with selection state & active language. */
  window.updateSelectionUI = function() {
    disablePortraitOrientationOverlay();
    ensureCreditsUI();
    ensureHowToPlayUI();
    ensureMovelistUI();

    const dict = t();
    const riders = window.AVAILABLE_RIDERS;
    const state = window.vsSelectionState;
    if (!riders || riders.length === 0) return;

    const currentStep = parseInt(state.step, 10) || 1;

    if (state.p1Index >= riders.length) state.p1Index = 0;
    if (state.p2Index >= riders.length) state.p2Index = 0;

    const p1 = riders[state.p1Index] || riders[0];
    const p2 = riders[state.p2Index] || riders[0];

    state.p1Difficulty = normalizeSelectedDifficulty(
      state.p1Difficulty,
      p1
    );

    state.p2Difficulty = normalizeSelectedDifficulty(
      state.p2Difficulty,
      p2
    );

    // Card Headings & Difficulty Static Labels
    const p1Card = document.getElementById('p1-card');
    const p2Card = document.getElementById('p2-card');
    if (p1Card) {
      const h2 = p1Card.querySelector('h2');
      if (h2) h2.textContent = dict.player1Heading;
      const diffLbl = p1Card.querySelector('.diff-label');
      if (diffLbl) diffLbl.textContent = dict.difficultyLabel;
    }
    if (p2Card) {
      const h2 = p2Card.querySelector('h2');
      if (h2) h2.textContent = dict.player2Heading;
      const diffLbl = p2Card.querySelector('.diff-label');
      if (diffLbl) diffLbl.textContent = dict.difficultyLabel;
    }

    // Error Banner
    const errorBanner = document.getElementById('vs-error-banner');
    if (errorBanner) {
      errorBanner.textContent = dict.errorCpuBanner;
    }

    // P1 Display updates
    const p1ImgEl = document.getElementById('p1-img');
    if (p1ImgEl) p1ImgEl.src = p1.icon;

    const p1NameEl = document.getElementById('p1-name-display');
    if (p1NameEl) p1NameEl.textContent = getLocalizedRiderName(p1);
    updateRiderStatStrip('p1', p1);

    const p1TypeEl = document.getElementById('p1-type-display');
    if (p1TypeEl) p1TypeEl.textContent = state.p1IsCPU ? dict.cpuLabel : dict.humanLabel;

    const p1DiffDisplay = document.getElementById('p1-diff-display');
    if (p1DiffDisplay) {
      if (!state.p1IsCPU) {
        p1DiffDisplay.textContent = dict.naLabel;
      } else {
        p1DiffDisplay.textContent = dict.diffLabels[state.p1Difficulty] || dict.diffLabels.balanced;
      }
      setDiffBadgeClasses(p1DiffDisplay, state.p1Difficulty, state.p1IsCPU);
    }

    // P2 Display updates
    const p2ImgEl = document.getElementById('p2-img');
    if (p2ImgEl) {
      p2ImgEl.src = p2.icon;
      p2ImgEl.classList.toggle('p2-mirror-palette', p1.id === p2.id);
    }

    const p2NameEl = document.getElementById('p2-name-display');
    if (p2NameEl) p2NameEl.textContent = getLocalizedRiderName(p2);
    updateRiderStatStrip('p2', p2);

    const p2TypeEl = document.getElementById('p2-type-display');
    if (p2TypeEl) p2TypeEl.textContent = state.p2IsCPU ? dict.cpuLabel : dict.humanLabel;

    const p2DiffDisplay = document.getElementById('p2-diff-display');
    if (p2DiffDisplay) {
      if (!state.p2IsCPU) {
        p2DiffDisplay.textContent = dict.naLabel;
      } else {
        p2DiffDisplay.textContent = dict.diffLabels[state.p2Difficulty] || dict.diffLabels.balanced;
      }
      setDiffBadgeClasses(p2DiffDisplay, state.p2Difficulty, state.p2IsCPU);
    }

    const headerText = document.getElementById('select-step-title') || document.getElementById('vs-header-text');

    const confirmBtns = document.querySelectorAll('#confirm-btn, #confirm-p1-btn, #confirm-p2-btn, .btn-confirm, .confirm-btn');
    const startBtn = document.getElementById('start-game-btn') || document.querySelector('.btn-start');
    const backBtn = document.getElementById('back-btn') || document.querySelector('.btn-back');

    if (backBtn) backBtn.textContent = dict.backBtn;
    if (startBtn) startBtn.textContent = dict.startGameBtn;

    const p1LeftBtn = document.getElementById('p1-left-btn');
    const p1RightBtn = document.getElementById('p1-right-btn');
    const p2LeftBtn = document.getElementById('p2-left-btn');
    const p2RightBtn = document.getElementById('p2-right-btn');

    if (currentStep === 1) {
      if (headerText) headerText.textContent = dict.step1Header;
      setCardSlotClasses(p1Card, true);
      setCardSlotClasses(p2Card, false);

      if (p1LeftBtn) p1LeftBtn.disabled = false;
      if (p1RightBtn) p1RightBtn.disabled = false;
      if (p2LeftBtn) p2LeftBtn.disabled = true;
      if (p2RightBtn) p2RightBtn.disabled = true;

      confirmBtns.forEach(btn => {
        btn.hidden = false;
        btn.style.display = '';
        btn.textContent = dict.confirmP1Btn;
        btn.disabled = false;
      });

      if (startBtn) {
        startBtn.hidden = true;
        startBtn.style.display = 'none';
      }
      if (backBtn) backBtn.disabled = true;

    } else if (currentStep === 2) {
      if (headerText) headerText.textContent = dict.step2Header;
      setCardSlotClasses(p1Card, false);
      setCardSlotClasses(p2Card, true);

      if (p1LeftBtn) p1LeftBtn.disabled = true;
      if (p1RightBtn) p1RightBtn.disabled = true;
      if (p2LeftBtn) p2LeftBtn.disabled = false;
      if (p2RightBtn) p2RightBtn.disabled = false;

      confirmBtns.forEach(btn => {
        btn.hidden = false;
        btn.style.display = '';
        btn.textContent = dict.confirmP2Btn;
        btn.disabled = false;
      });

      if (startBtn) {
        startBtn.hidden = true;
        startBtn.style.display = 'none';
      }
      if (backBtn) backBtn.disabled = false;

    } else if (currentStep === 3) {
      if (headerText) headerText.textContent = dict.step3Header;
      setCardSlotClasses(p1Card, true);
      setCardSlotClasses(p2Card, true);

      if (p1LeftBtn) p1LeftBtn.disabled = true;
      if (p1RightBtn) p1RightBtn.disabled = true;
      if (p2LeftBtn) p2LeftBtn.disabled = true;
      if (p2RightBtn) p2RightBtn.disabled = true;

      confirmBtns.forEach(btn => {
        btn.hidden = true;
        btn.style.display = 'none';
      });

      if (startBtn) {
        startBtn.hidden = false;
        startBtn.style.display = '';
        startBtn.disabled = false;
      }
      if (backBtn) backBtn.disabled = false;
    }

    updateStepTrackerUI(currentStep);
    updateRosterDockUI();
  };

  /** Validates selection state and transitions to live battle mode via startBattle(). */
  window.validateAndStartMatch = function() {
    disablePortraitOrientationOverlay();
    window.closeCreditsModal();
    window.closeHowToPlayModal();
    window.closeMovelistModal();

    if (typeof window.unlockMobileVideos === 'function') {
      window.unlockMobileVideos();
    }

    window.stopSelectionBGM();
    window.playBattleBGM();

    const selectScreen = document.getElementById('vs-select-screen');
    const battleScreen = document.getElementById('battle-screen');

    if (selectScreen) selectScreen.hidden = true;
    if (battleScreen) battleScreen.hidden = false;

    const riders = window.AVAILABLE_RIDERS;
    const state = window.vsSelectionState;

    const matchConfig = {
      p1Rider: riders[state.p1Index] || riders[0],
      p1IsCPU: state.p1IsCPU,
      p1Difficulty: state.p1IsCPU ? state.p1Difficulty : 'balanced',
      p2Rider: riders[state.p2Index] || riders[0],
      p2IsCPU: state.p2IsCPU,
      p2Difficulty: state.p2IsCPU ? state.p2Difficulty : 'balanced',
      lang: window.gameLang
    };

    if (typeof window.startBattle === 'function') {
      window.startBattle(matchConfig);
    }
  };

  // Step confirm & difficulty badge click listener
  document.addEventListener('click', (e) => {
    const p1Diff = e.target.closest('#p1-diff-display');
    if (p1Diff && !p1Diff.hasAttribute('onclick')) {
      window.toggleDifficulty('p1');
      return;
    }

    const p2Diff = e.target.closest('#p2-diff-display');
    if (p2Diff && !p2Diff.hasAttribute('onclick')) {
      window.toggleDifficulty('p2');
      return;
    }

    const p1Btn = e.target.closest('#confirm-p1-btn, #btn-confirm-p1');
    if (p1Btn) {
      window.vsSelectionState.step = 2;
      window.updateSelectionUI();
      return;
    }

    const p2Btn = e.target.closest('#confirm-p2-btn, #btn-confirm-p2');
    if (p2Btn) {
      window.vsSelectionState.step = 3;
      window.updateSelectionUI();
      return;
    }
  });

  // DOM initialization and roster fetching
  document.addEventListener('DOMContentLoaded', async () => {
    disablePortraitOrientationOverlay();
    protectStartPromptButtons();

    ensureCreditsUI();
    ensureHowToPlayUI();
    ensureMovelistUI();

    try {
      const res = await fetch('data/riders.json');
      if (res.ok) {
        const allRiders = await res.json();
        const activeRiders = allRiders.filter(r => r.active === true);
        if (activeRiders.length > 0) {
          window.AVAILABLE_RIDERS = activeRiders;
        }
      }
    } catch (err) {
      console.warn("Could not load riders.json, defaulting to fallback roster.");
    }

    window.updateSelectionUI();

    const unlockAudio = () => {
      window.playSelectionBGM();
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio);
  });

  window.addEventListener('resize', disablePortraitOrientationOverlay);
  window.addEventListener('orientationchange', disablePortraitOrientationOverlay);

})(window);
