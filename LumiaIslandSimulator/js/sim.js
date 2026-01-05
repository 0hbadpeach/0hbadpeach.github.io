// js/sim.js
(() => {
  const Sim = {};

  let timer = null;
  let running = false;

  // 진행
  let day = 1;
  let turn = 0;

  // 시뮬 상태
  let pool = [];
  let teams = [];
  let weather = null;

  // 결과
  let finished = false;

  function log(s, dim=false){ UI.Log.add(s, dim); }

  function reset(){
    if (timer) clearInterval(timer);
    timer = null;
    running = false;

    day = 1;
    turn = 0;

    pool = [];
    teams = [];
    weather = null;

    finished = false;
  }

  // ---------- 유틸 ----------
  function getId(slot){
    if (!slot) return null;
    if (typeof slot === "string") return slot;
    if (typeof slot === "object") return slot.id || null;
    return null;
  }
  function deepClone(x){ return JSON.parse(JSON.stringify(x)); }
  function findChar(id){ return pool.find(c => c.id === id) || null; }
  function rand(min, max){ return min + Math.random()*(max-min); }
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

  function chooseWeather(){
    const main = pick(window.WEATHER_MAIN);
    let subs = window.WEATHER_SUB.slice();
    if (main === "모래바람") subs = subs.filter(x => x !== "안개");
    const sub = pick(subs);
    return { main, sub };
  }

  function weatherEffects(){
    const fx = {
      healMult: 1.0,
      staminaRegen: 1.0,
      healReductionInFight: 0.0,
      moveSpeedMult: 1.0,
      lightning: false,
      fogNoPing: false
    };

    if (!weather) return fx;

    if (weather.main === "쾌청") fx.healMult = 1.2;
    if (weather.main === "비") fx.staminaRegen = 2.0;
    if (weather.main === "모래바람") fx.healReductionInFight = 0.2;

    if (weather.sub === "강풍") fx.moveSpeedMult = 1.1;
    if (weather.sub === "벼락") fx.lightning = true;
    if (weather.sub === "안개") fx.fogNoPing = true;

    return fx;
  }

  // ---------- 팀/멤버 ----------
  function buildTeams(lobbyState){
    const out = [];
    for (let ti=0; ti<SIM_RULES.maxTeams; ti++){
      const slots = lobbyState.teams[ti];
      const members = [];
      for (let si=0; si<SIM_RULES.teamSize; si++){
        const id = getId(slots[si]);
        const c = findChar(id);
        if (!c) continue;

        members.push({
          id: c.id,
          name: c.name,
          codename: c.codename,
          roles: c.roles || [],
          weaponChoices: c.weaponChoices || [],

          alive: true,
          hpMax: 950,   // ✅ 살짝 낮춤(죽음 잘 나오게)
          hp: 950,
          atk: 70 + Math.floor(Math.random()*18),  // ✅ 공격력 올림
          def: 14 + Math.floor(Math.random()*6),   // ✅ 방어 살짝 낮춤
          weaponTier: 1,

          zone: pick(window.ZONES),

          credits: 0,
          creditsEarned: 0,
          creditsSpent: 0,

          dealt: 0,
          taken: 0,
          kills: 0,
          deaths: 0,
        });
      }

      out.push({
        teamNo: ti+1,
        members,
        eliminatedAt: null,
      });
    }
    return out;
  }

  function validateStart(lobbyState){
    let filled = 0;
    for (const t of lobbyState.teams){
      if (!Array.isArray(t) || t.length !== SIM_RULES.teamSize) return false;
      for (const s of t){
        const id = getId(s);
        if (!id) return false;
        filled++;
      }
    }
    return filled > 0;
  }

  // ---------- 지도 점유 ----------
  function pushOccupancy(){
    const occ = {};
    for (const t of teams){
      const aliveMembers = t.members.filter(m => m.alive);
      for (const m of aliveMembers){
        const z = m.zone;
        occ[z] = occ[z] || [];
        let row = occ[z].find(x => x.team === t.teamNo);
        if (!row){ row = { team:t.teamNo, names:[] }; occ[z].push(row); }
        row.names.push(m.name);
      }
    }
    MapUI.setOccupancy(occ);
  }

  // ---------- 금지구역 ----------
  function moveToSafeZone(){
    const banned = MapUI.getBannedZone();
    const warned = MapUI.getWarnedZone();
    const cand = window.ZONES.filter(z => z !== banned && z !== warned);
    return cand.length ? pick(cand) : pick(window.ZONES);
  }

  function enforceBanDamageAndEscape(){
    const banned = MapUI.getBannedZone();
    if (!banned) return;

    for (const t of teams){
      for (const m of t.members){
        if (!m.alive) continue;
        if (m.zone === banned){
          const dmg = 180 + Math.floor(Math.random()*90); // ✅ 금구 피해도 조금 ↑
          applyDamage(m, dmg, null, "금지구역");
          if (m.alive) {
            m.zone = moveToSafeZone();
            log(`⛔ ${m.name} (Team ${t.teamNo}) 금지구역 피해 후 탈출`, true);
          }
        }
      }
    }
  }

  // ---------- 부활 ----------
  function teamWiped(t){
    return t.members.every(m => !m.alive);
  }

  function reviveIfPossibleStartOfDay(){
    const cost = SIM_RULES.reviveCost;

    for (const t of teams){
      if (teamWiped(t)) continue; // 전멸 팀은 영원히 부활 불가
      const dead = t.members.filter(m => !m.alive);
      if (dead.length === 0) continue;

      if (day <= SIM_RULES.autoReviveDays){
        for (const m of dead){
          m.alive = true;
          m.hp = Math.floor(m.hpMax * 0.55);
          log(`✨ 자동부활: ${m.name} (Team ${t.teamNo})`);
        }
        continue;
      }

      for (const target of dead){
        const aliveMembers = t.members.filter(x => x.alive);
        const totalAvail = target.credits + aliveMembers.reduce((a,x)=>a+x.credits,0);
        if (totalAvail < cost){
          log(`💸 부활 실패(크레딧 부족): ${target.name} (Team ${t.teamNo})`, true);
          continue;
        }

        let need = cost;

        const useSelf = Math.min(target.credits, need);
        target.credits -= useSelf;
        target.creditsSpent += useSelf;
        need -= useSelf;

        aliveMembers.sort((a,b)=>b.credits-a.credits);
        for (const payer of aliveMembers){
          if (need <= 0) break;
          const u = Math.min(payer.credits, need);
          payer.credits -= u;
          payer.creditsSpent += u;
          need -= u;
        }

        target.alive = true;
        target.hp = Math.floor(target.hpMax * 0.55);
        log(`💉 크레딧 부활: ${target.name} (Team ${t.teamNo}) -${cost}`);
      }
    }
  }

  // ---------- 전투/피해 ----------
  function gainCredits(m, amount){
    m.credits += amount;
    m.creditsEarned += amount;
  }

  function applyDamage(target, dmg, attacker, reason){
    if (!target.alive) return;

    const real = Math.max(1, dmg);
    target.hp -= real;
    target.taken += real;

    if (attacker){
      attacker.dealt += real;
    }

    if (target.hp <= 0){
      target.alive = false;
      target.deaths += 1;
      target.hp = 0;

      if (attacker){
        attacker.kills += 1;
        gainCredits(attacker, 80); // ✅ 킬 크레딧 ↑
        // ✅ “누가 죽였는지” 더 눈에 띄게
        log(`☠ ${target.name} (Team ${getTeamNoOf(target)}) ← ${attacker.name} (Team ${getTeamNoOf(attacker)}) [${reason}]`);
      } else {
        log(`☠ ${target.name} (Team ${getTeamNoOf(target)}) [${reason}]`);
      }
    }
  }

  function getTeamNoOf(member){
    for (const t of teams){
      if (t.members.includes(member)) return t.teamNo;
    }
    return "?";
  }

  // ---------- 행동 ----------
  function doMove(m){
    m.zone = moveToSafeZone();
  }
  function doFarm(m){
    const base = 15 + Math.floor(Math.random()*25);
    gainCredits(m, base);
    if (!m.mats) m.mats = { "재료A":0, "재료B":0, "재료C":0 };
    const got = pick(window.MATERIALS);
    m.mats[got] = (m.mats[got]||0) + 1;
  }
  function canCraftUpgrade(m){
    if (!m.mats) return false;
    const a = m.mats["재료A"]||0;
    const b = m.mats["재료B"]||0;
    const c = m.mats["재료C"]||0;
    return a>=1 && b>=1 && c>=1 && m.weaponTier < 3;
  }
  function doCraft(m){
    if (!canCraftUpgrade(m)) return false;
    m.mats["재료A"]--; m.mats["재료B"]--; m.mats["재료C"]--;
    m.weaponTier++;
    m.atk += 16;
    m.def += 5;
    return true;
  }

  // ---------- 교전 ----------
  function runZoneFights(){
    // 지역별 팀 존재 집계
    const zoneTeams = new Map();
    for (const t of teams){
      if (teamWiped(t)) continue;
      for (const m of t.members){
        if (!m.alive) continue;
        const z = m.zone;
        if (!zoneTeams.has(z)) zoneTeams.set(z, new Set());
        zoneTeams.get(z).add(t.teamNo);
      }
    }

    for (const [z, set] of zoneTeams.entries()){
      const arr = Array.from(set);
      if (arr.length < 2) continue;

      // ✅ 전투 발생 확률 크게 ↑ (데모 느낌 제거)
      if (Math.random() < 0.25) continue;

      const aNo = pick(arr);
      let bNo = pick(arr);
      while (bNo === aNo) bNo = pick(arr);

      const A = teams[aNo-1];
      const B = teams[bNo-1];
      const aAlive = A.members.filter(m => m.alive && m.zone === z);
      const bAlive = B.members.filter(m => m.alive && m.zone === z);
      if (aAlive.length === 0 || bAlive.length === 0) continue;

      log(`⚔ 교전: ${z} (Team ${aNo} vs Team ${bNo})`);

      // ✅ 한번만 치고 끝이 아니라 “짧은 교전 라운드 2회”
      for (let round=0; round<2; round++){
        // A -> B
        for (const attacker of aAlive){
          const targets = bAlive.filter(x=>x.alive);
          if (!targets.length) break;
          const target = pick(targets);

          const base = attacker.atk * rand(0.95, 1.25) - target.def * rand(0.5, 0.85);
          const dmg = Math.floor(Math.max(18, base)); // ✅ 최소딜 ↑
          applyDamage(target, dmg, attacker, "전투");
        }

        // B -> A
        for (const attacker of bAlive){
          const targets = aAlive.filter(x=>x.alive);
          if (!targets.length) break;
          const target = pick(targets);

          const base = attacker.atk * rand(0.95, 1.25) - target.def * rand(0.5, 0.85);
          const dmg = Math.floor(Math.max(18, base));
          applyDamage(target, dmg, attacker, "전투");
        }
      }
    }
  }

  // ---------- 벼락 ----------
  function runLightningIfAny(){
    const fx = weatherEffects();
    if (!fx.lightning) return;

    const p = Math.min(0.12 + day*0.04, 0.40);
    if (Math.random() > p) return;

    const alive = [];
    for (const t of teams){
      for (const m of t.members) if (m.alive) alive.push(m);
    }
    if (!alive.length) return;

    const target = pick(alive);
    const dmg = Math.floor(target.hp * 0.15);
    applyDamage(target, dmg, null, "벼락");
    log(`⚡ 벼락: ${target.name} 현재체력 15% 피해`, true);
  }

  // ---------- 결과/종료 ----------
  function markEliminations(){
    const time = (day-1)*SIM_RULES.turnsPerDay + turn;
    for (const t of teams){
      if (t.eliminatedAt !== null) continue;
      if (teamWiped(t)){
        t.eliminatedAt = time;
        log(`🏳 Team ${t.teamNo} 전멸`);
      }
    }
  }

  function aliveTeams(){
    return teams.filter(t => !teamWiped(t));
  }

  function buildResults(){
    const sortedTeams = teams.slice().sort((a,b) => {
      const aw = teamWiped(a) ? 0 : 1;
      const bw = teamWiped(b) ? 0 : 1;
      if (aw !== bw) return bw-aw;
      const at = a.eliminatedAt ?? 1e9;
      const bt = b.eliminatedAt ?? 1e9;
      return bt - at;
    });

    const body = UI.q("#resultBody");
    if (!body) return;

    let html = "";
    html += `<div class="hint">표기: 총크레딧 = (남은 크레딧 + 사용한 크레딧). 크레딧은 공유되지 않습니다.</div>`;
    html += `<div class="mt8"></div>`;
    html += `<table style="width:100%;border-collapse:collapse;font-size:12px;">`;
    html += `<thead><tr>
      <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(255,255,255,.12)">등수</th>
      <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(255,255,255,.12)">팀</th>
      <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(255,255,255,.12)">멤버</th>
    </tr></thead><tbody>`;

    sortedTeams.forEach((t, idx) => {
      const rank = idx+1;
      const members = t.members.map(m => {
        const totalCredits = (m.credits || 0) + (m.creditsSpent || 0);
        const aliveTxt = m.alive ? "생존" : "사망";
        return `${aliveTxt} · ${m.name} · 총C:${totalCredits} (남:${m.credits}, 사용:${m.creditsSpent}) · 준뎀:${m.dealt} · 받은뎀:${m.taken} · K:${m.kills} D:${m.deaths}`;
      }).join("<br/>");
      html += `<tr>
        <td style="padding:8px;border-bottom:1px solid rgba(255,255,255,.08)">${rank}</td>
        <td style="padding:8px;border-bottom:1px solid rgba(255,255,255,.08)">Team ${t.teamNo}</td>
        <td style="padding:8px;border-bottom:1px solid rgba(255,255,255,.08)">${members}</td>
      </tr>`;
    });

    html += `</tbody></table>`;
    body.innerHTML = html;
  }

  function openResults(){
    const modal = UI.q("#resultModal");
    if (!modal){
      alert("결과창 DOM이 없습니다. index.html에 #resultModal/#resultBody가 있는지 확인하세요.");
      return;
    }
    buildResults();
    UI.setModal(modal, true);
  }

  function finishIfNeeded(){
    if (finished) return;

    const alive = aliveTeams();
    if (alive.length <= 1 || day > SIM_RULES.maxDays){
      finished = true;
      running = false;
      if (timer) clearInterval(timer);
      timer = null;

      if (alive.length === 1){
        log(`🏆 우승: Team ${alive[0].teamNo}`);
      } else {
        log(`⏱ ${SIM_RULES.maxDays}일차 종료`);
      }

      // ✅ 종료되면 결과 자동 오픈
      openResults();
    }
  }

  // ---------- 한 턴 ----------
  function oneStep(){
    if (finished) return;

    turn++;
    log(`[D${day} T${turn}] 진행 (날씨: ${weather.main}/${weather.sub})`, true);

    runLightningIfAny();
    enforceBanDamageAndEscape();

    // 각 멤버 행동
    for (const t of teams){
      if (teamWiped(t)) continue;

      for (const m of t.members){
        if (!m.alive) continue;

        const warned = MapUI.getWarnedZone();
        const inWarn = warned && m.zone === warned;

        const r = Math.random();
        if (inWarn && r < 0.60) doMove(m);
        else if (r < 0.30) doMove(m);
        else if (r < 0.78) doFarm(m);
        else {
          const ok = doCraft(m);
          if (!ok) doFarm(m);
          else log(`🛠 제작: ${m.name} 무기티어 ${m.weaponTier}`, true);
        }

        if (Math.random() < 0.12) gainCredits(m, 5);
      }
    }

    // 전투
    runZoneFights();

    // 탈락
    markEliminations();

    // 지도 점유
    pushOccupancy();

    // 일차 넘어감
    if (turn >= SIM_RULES.turnsPerDay){
      day++;
      turn = 0;

      if (day <= SIM_RULES.maxDays){
        log(`=== ${day}일차 시작 ===`);

        MapUI.advanceBanStage(true);
        reviveIfPossibleStartOfDay();
      }
    }

    finishIfNeeded();
  }

  // ---------- UI ----------
  function manualNextTurn(){
    if (!teams.length){
      log("⚠ 먼저 로비에서 ‘시뮬레이션 시작’을 눌러주세요.");
      return;
    }
    oneStep();
  }

  function autoStart(){
    if (!teams.length){
      log("⚠ 먼저 로비에서 ‘시뮬레이션 시작’을 눌러주세요.");
      return;
    }
    if (running) return;
    running = true;
    timer = setInterval(oneStep, 230);
  }

  function autoStop(){
    running = false;
    if (timer) clearInterval(timer);
    timer = null;
  }

  function closeResults(){
    UI.setModal(UI.q("#resultModal"), false);
  }

  // ---------- 외부 API ----------
  Sim.startFromLobby = (lobbyState, characterPool) => {
    reset();
    UI.Log.clear();

    pool = deepClone(characterPool || []);
    if (!validateStart(lobbyState)){
      log("❌ 실험체가 부족합니다");
      return;
    }

    weather = chooseWeather();

    MapUI.reset();
    MapUI.advanceBanStage(true);

    teams = buildTeams(lobbyState);

    const fx = weatherEffects();
    log("=== 시뮬레이션 시작 ===");
    log(`날씨: ${weather.main} / ${weather.sub}`);
    log(`부활: 1~${SIM_RULES.autoReviveDays}일 자동 / 3일차부터 1인 ${SIM_RULES.reviveCost}C (비공유)`);
    log(`효과(내부): heal×${fx.healMult}, stamina×${fx.staminaRegen}`);
    log("—");

    pushOccupancy();
  };

  Sim.bindUI = () => {
    UI.Log.init(UI.q("#logBox"));

    UI.q("#btnNextTurn")?.addEventListener("click", manualNextTurn);
    UI.q("#btnAutoStart")?.addEventListener("click", autoStart);
    UI.q("#btnAutoStop")?.addEventListener("click", autoStop);
    UI.q("#btnClearLog")?.addEventListener("click", ()=>UI.Log.clear());

    UI.q("#btnOpenResults")?.addEventListener("click", openResults);
    UI.q("#resultModalX")?.addEventListener("click", closeResults);
    UI.q("#resultModalClose")?.addEventListener("click", closeResults);
  };

  Sim.autoStop = autoStop;

  window.Sim = Sim;
})();
