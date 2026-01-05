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

  // 오브젝트
  let objects = []; // {type, zone, day, part, claimed}

  // 결과
  let finished = false;

  function log(s, dim=false){ UI?.Log?.add?.(s, dim); }

  function reset(){
    if (timer) clearInterval(timer);
    timer = null;
    running = false;

    day = 1;
    turn = 0;

    pool = [];
    teams = [];
    weather = null;

    objects = [];
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
  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

  // 턴-시간 환산(근사)
  const TURN_SECONDS = 5; // 1턴 = 5초

  // ---------- 결과 모달(없으면 자동 생성 + 항상 닫기 바인딩) ----------
  function ensureResultsModal(){
    let modal = document.querySelector("#resultModal");

    if (!modal){
      modal = document.createElement("div");
      modal.id = "resultModal";
      modal.className = "modal";
      modal.innerHTML = `
        <div class="modal-card" style="max-width:860px;">
          <div class="modal-head">
            <div class="modal-title">결과</div>
            <button id="resultModalX" class="btn mini danger" type="button">X</button>
          </div>
          <div class="modal-body">
            <div id="resultBody"></div>
            <div class="row gap mt12">
              <button id="resultModalClose" class="btn mini danger" type="button">닫기</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    const close = () => UI?.setModal?.(modal, false);

    // ✅ 매번 확실하게 바인딩(이전 버전에서 이벤트가 누락됐어도 복구됨)
    const xBtn = modal.querySelector("#resultModalX");
    const cBtn = modal.querySelector("#resultModalClose");
    if (xBtn) xBtn.onclick = close;
    if (cBtn) cBtn.onclick = close;

    // ✅ 배경 클릭 시 닫기
    modal.onclick = (e) => {
      if (e.target === modal) close();
    };

    return modal;
  }

  // ---------- 날씨 ----------
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
          hpMax: 950,
          hp: 950,
          atk: 70 + Math.floor(Math.random()*18),
          def: 14 + Math.floor(Math.random()*6),
          weaponTier: 1,

          zone: pick(window.ZONES),

          credits: 0,
          creditsEarned: 0,
          creditsSpent: 0,

          dealt: 0,
          taken: 0,
          kills: 0,
          deaths: 0,

          // 금구 폭사 타이머
          banTimer: 0,   // 초
          banMax: 25,    // 초 (킬/오브젝트 시 35까지)
          banGrace: 0,   // 부활 후 10초 유예

          // 전멸 선언 판단용
          lastHitByTeam: null,
          lastKilledByTeam: null,
        });
      }

      out.push({
        teamNo: ti+1,
        members,
        eliminatedAt: null,
        wipedBy: null,
        wipeAnnounced: false,
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

  // 팀 내부 중복 금지(같은 팀만)
  function enforceNoDupWithinTeam(lobbyState){
    let removed = 0;
    for (let ti=0; ti<SIM_RULES.maxTeams; ti++){
      const seen = new Set();
      for (let si=0; si<SIM_RULES.teamSize; si++){
        const slot = lobbyState.teams[ti][si];
        const id = getId(slot);
        if (!id) continue;
        if (seen.has(id)){
          lobbyState.teams[ti][si] = null;
          removed++;
        } else {
          seen.add(id);
        }
      }
    }
    return removed;
  }

  // ---------- 팀/멤버 찾기 ----------
  function getTeamNoOf(member){
    for (const t of teams){
      if (t.members.includes(member)) return t.teamNo;
    }
    return "?";
  }
  function getTeam(teamNo){
    return teams.find(t => t.teamNo === teamNo) || null;
  }
  function teamWiped(t){
    return t.members.every(m => !m.alive);
  }
  function aliveTeams(){
    return teams.filter(t => !teamWiped(t));
  }
  function aliveMembersInTeam(t){
    return t.members.filter(m=>m.alive);
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
    window.MapUI?.setOccupancy?.(occ);
  }

  // ---------- 이동(안전지대 우선) ----------
  function getSafeZonesFallback(){
    const safeSet = window.MapUI?.getSafeSet?.();
    if (safeSet && safeSet.size) return Array.from(safeSet);

    const banned = window.MapUI?.getBannedZone?.();
    const warned = window.MapUI?.getWarnedZone?.();
    const cand = (window.ZONES || []).filter(z => z !== banned && z !== warned);
    return cand.length ? cand : (window.ZONES || []);
  }

  function moveToSafeZone(){
    const safe = getSafeZonesFallback();
    return safe.length ? pick(safe) : pick(window.ZONES);
  }

  function doMove(m){
    m.zone = moveToSafeZone();
  }

  // ---------- 금지구역 폭사 타이머 ----------
  function enforceBanExplodeTimer(){
    const bannedSet = window.MapUI?.getBannedSet?.();
    if (!bannedSet || bannedSet.size === 0) return false;

    let any = false;

    for (const t of teams){
      for (const m of t.members){
        if (!m.alive) continue;

        if (m.banGrace && m.banGrace > 0){
          m.banGrace = Math.max(0, m.banGrace - TURN_SECONDS);
        }

        if (bannedSet.has(m.zone)){
          any = true;

          if (m.banGrace > 0){
            log(`⏱ ${m.name} 폭사 유예 ${m.banGrace}s`, true);
            continue;
          }

          m.banTimer = (m.banTimer || 0) + TURN_SECONDS;

          const maxT = m.banMax || 25;
          if (m.banTimer >= maxT){
            applyDamage(m, 999999, null, "금지구역(폭사)");
            continue;
          }

          if (Math.random() < 0.55){
            const from = m.zone;
            m.zone = moveToSafeZone();
            log(`⛔ ${m.name} 금구 탈출: ${from} → ${m.zone} (타이머 ${m.banTimer}/${maxT})`, true);
          } else {
            log(`⛔ ${m.name} 금구 체류 (타이머 ${m.banTimer}/${maxT})`, true);
          }
        } else {
          m.banTimer = Math.max(0, (m.banTimer || 0) - TURN_SECONDS);
          m.banMax = 25;
        }
      }
    }

    return any;
  }

  // ---------- 부활 ----------
  function reviveIfPossibleStartOfDay(){
    const cost = SIM_RULES.reviveCost;

    for (const t of teams){
      if (teamWiped(t)) continue;
      const dead = t.members.filter(m => !m.alive);
      if (dead.length === 0) continue;

      if (day <= SIM_RULES.autoReviveDays){
        for (const m of dead){
          m.alive = true;
          m.hp = Math.floor(m.hpMax * 0.55);
          m.banTimer = 0;
          m.banMax = 25;
          m.banGrace = 10;
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
        target.banTimer = 0;
        target.banMax = 25;
        target.banGrace = 10;

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
      const atkTeam = getTeamNoOf(attacker);
      target.lastHitByTeam = atkTeam;
    }

    if (target.hp <= 0){
      target.alive = false;
      target.deaths += 1;
      target.hp = 0;

      if (attacker){
        attacker.kills += 1;
        gainCredits(attacker, 80);

        const atkTeam = getTeamNoOf(attacker);
        target.lastKilledByTeam = atkTeam;

        // 킬이면 금구 35초까지
        attacker.banMax = 35;

        log(`☠ ${target.name} (Team ${getTeamNoOf(target)}) ← ${attacker.name} (Team ${atkTeam}) [${reason}]`);
      } else {
        log(`☠ ${target.name} (Team ${getTeamNoOf(target)}) [${reason}]`);
      }
    }
  }

  // ---------- 행동 ----------
  function doFarm(m){
    const base = 15 + Math.floor(Math.random()*25);
    gainCredits(m, base);

    if (!m.mats) m.mats = {};
    const mats = window.MATERIALS || ["재료A","재료B","재료C"];
    const got = pick(mats);
    m.mats[got] = (m.mats[got]||0) + 1;

    return true;
  }

  function canCraftUpgrade(m){
    const a = m.mats?.["재료A"]||0;
    const b = m.mats?.["재료B"]||0;
    const c = m.mats?.["재료C"]||0;
    return a>=1 && b>=1 && c>=1 && m.weaponTier < 3;
  }

  function doCraft(m){
    if (!canCraftUpgrade(m)) return false;
    m.mats["재료A"]--; m.mats["재료B"]--; m.mats["재료C"]--;
    m.weaponTier++;
    m.atk += 16;
    m.def += 5;
    log(`🛠 제작: ${m.name} 무기티어 ${m.weaponTier}`, true);

    // 제작도 활동 보정으로 35초
    m.banMax = 35;

    return true;
  }

  // ---------- 교전 ----------
  function runZoneFights(){
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

    let didFight = false;

    for (const [z, set] of zoneTeams.entries()){
      const arr = Array.from(set);
      if (arr.length < 2) continue;

      if (Math.random() < 0.25) continue;

      const aNo = pick(arr);
      let bNo = pick(arr);
      while (bNo === aNo) bNo = pick(arr);

      const A = teams[aNo-1];
      const B = teams[bNo-1];
      const aAlive = A.members.filter(m => m.alive && m.zone === z);
      const bAlive = B.members.filter(m => m.alive && m.zone === z);
      if (aAlive.length === 0 || bAlive.length === 0) continue;

      didFight = true;
      log(`⚔ 교전: ${z} (Team ${aNo} vs Team ${bNo})`);

      for (let round=0; round<2; round++){
        for (const attacker of aAlive){
          const targets = bAlive.filter(x=>x.alive);
          if (!targets.length) break;
          const target = pick(targets);

          const base = attacker.atk * rand(0.95, 1.25) - target.def * rand(0.5, 0.85);
          const dmg = Math.floor(Math.max(18, base));
          applyDamage(target, dmg, attacker, "전투");
        }

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

    return didFight;
  }

  // ---------- 벼락 ----------
  function runLightningIfAny(){
    const fx = weatherEffects();
    if (!fx.lightning) return false;

    const p = Math.min(0.12 + day*0.04, 0.40);
    if (Math.random() > p) return false;

    const alive = [];
    for (const t of teams){
      for (const m of t.members) if (m.alive) alive.push(m);
    }
    if (!alive.length) return false;

    const target = pick(alive);
    const dmg = Math.floor(target.hp * 0.15);
    applyDamage(target, dmg, null, "벼락");
    log(`⚡ 벼락: ${target.name} 현재체력 15% 피해`, true);
    return true;
  }

  // ---------- 오브젝트 ----------
  function isNight(){
    return turn > Math.floor(SIM_RULES.turnsPerDay / 2);
  }

  function spawnObjectsIfNeeded(){
    const part = isNight() ? "night" : "day";

    if (objects.some(o => o.day === day && o.part === part && o.type === "(tick)")) return false;

    const Z = window.ZONES || [];
    const pickZone = (except=[]) => {
      const cand = Z.filter(z => !except.includes(z));
      return cand.length ? pick(cand) : pick(Z);
    };

    let spawned = false;

    if ((day === 2 || day === 3) && part === "day"){
      const treeZones = ["절","숲","호텔","묘지"].filter(z => Z.includes(z));
      if (treeZones.length){
        objects.push({ type:"생명의 나무", zone: pick(treeZones), day, part, claimed:false });
        spawned = true;
      }
      const meteorZone = pickZone(treeZones);
      objects.push({ type:"운석", zone: meteorZone, day, part, claimed:false });
      spawned = true;

      log(`🌳/☄ 오브젝트 등장: 생명의 나무/운석`, true);
    }

    if (day === 2 && part === "night"){
      const used = new Set();
      for (let i=0;i<4;i++){
        let z = pickZone();
        let tries=0;
        while (used.has(z) && tries<20){ z = pickZone(); tries++; }
        used.add(z);
        objects.push({ type:"차원의 틈(균열)", zone:z, day, part, claimed:false });
      }
      objects.push({ type:"알파", zone: pickZone(), day, part, claimed:false });
      objects.push({ type:"알파", zone: pickZone(), day, part, claimed:false });
      spawned = true;

      log(`🌀 균열 4곳 생성 + 🐺 알파 2기 등장(2일차 밤)`, true);
    }

    if (day === 3 && part === "night"){
      objects.push({ type:"오메가", zone: pickZone(), day, part, claimed:false });
      spawned = true;
      log(`🤖 오메가 등장(3일차 밤)`, true);
    }

    if ((day === 2 && part === "night") || (day === 3) || (day === 4 && part === "day")){
      for (let i=0;i<3;i++){
        objects.push({ type:"영웅 보급", zone: pickZone(), day, part, claimed:false });
      }
      spawned = true;
      log(`📦 영웅 보급 3개 투하`, true);
    }

    if (day === 4 && part === "night"){
      objects.push({ type:"초월 보급", zone: pickZone(), day, part, claimed:false });
      objects.push({ type:"초월 보급", zone: pickZone(), day, part, claimed:false });
      objects.push({ type:"위클라인", zone: pickZone(), day, part, claimed:false });
      spawned = true;

      log(`🟣 초월 보급 2개 + 👑 위클라인 등장(4일차 밤)`, true);
    }

    objects.push({ type:"(tick)", zone:"", day, part, claimed:true });
    return spawned;
  }

  function rewardObject(team, obj){
    const addMat = (m, mat, n=1) => {
      if (!m.mats) m.mats = {};
      m.mats[mat] = (m.mats[mat]||0) + n;
    };

    const alive = team.members.filter(m=>m.alive);
    if (!alive.length) return;

    alive.forEach(m => { m.banMax = 35; });

    if (obj.type === "생명의 나무"){
      alive.forEach(m => { addMat(m, "생명의 나무", 1); gainCredits(m, 40); });
      log(`🌳 Team ${team.teamNo} 생명의 나무 획득(+크레딧)`);
    } else if (obj.type === "운석"){
      alive.forEach(m => { addMat(m, "운석", 1); gainCredits(m, 40); });
      log(`☄ Team ${team.teamNo} 운석 획득(+크레딧)`);
    } else if (obj.type === "차원의 틈(균열)"){
      alive.forEach(m => {
        addMat(m, "균열 보상", 1);
        gainCredits(m, 70);
        m.weaponTier = Math.min(3, m.weaponTier+1);
        m.atk += 10;
      });
      log(`🌀 Team ${team.teamNo} 균열 승리(무기티어+1)`);
    } else if (obj.type === "알파"){
      alive.forEach(m => { addMat(m, "미스릴", 1); gainCredits(m, 60); });
      log(`🐺 Team ${team.teamNo} 알파 처치(미스릴)`);
    } else if (obj.type === "오메가"){
      alive.forEach(m => {
        addMat(m, "포스코어", 1);
        gainCredits(m, 90);
        m.weaponTier = Math.min(3, m.weaponTier+1);
        m.atk += 14;
      });
      log(`🤖 Team ${team.teamNo} 오메가 처치(포스코어)`);
    } else if (obj.type === "영웅 보급"){
      alive.forEach(m => {
        addMat(m, "영웅 재료", 1);
        gainCredits(m, 50);
        m.hp = clamp(m.hp + 180, 0, m.hpMax);
      });
      log(`📦 Team ${team.teamNo} 영웅 보급 확보(회복)`);
    } else if (obj.type === "초월 보급"){
      alive.forEach(m => {
        addMat(m, "초월 장비", 1);
        gainCredits(m, 80);
        m.def += 8;
        m.hpMax += 80;
        m.hp = clamp(m.hp + 120, 0, m.hpMax);
      });
      log(`🟣 Team ${team.teamNo} 초월 보급 확보(내구 상승)`);
    } else if (obj.type === "위클라인"){
      alive.forEach(m => {
        addMat(m, "VF 혈액 샘플", 1);
        addMat(m, "아글라이아의 선물-희귀", 1);
        gainCredits(m, 120);
        m.atk += 18;
      });
      log(`👑 Team ${team.teamNo} 위클라인 처치(대형 보상)`);
    }
  }

  function resolveObjectsThisTurn(){
    const part = isNight() ? "night" : "day";
    const active = objects.filter(o => !o.claimed && o.day === day && o.part === part && o.type !== "(tick)");
    if (!active.length) return false;

    let did = false;

    for (const obj of active){
      const presentTeams = [];
      for (const t of teams){
        if (teamWiped(t)) continue;
        const aliveHere = t.members.filter(m => m.alive && m.zone === obj.zone);
        if (aliveHere.length) presentTeams.push(t);
      }

      if (presentTeams.length === 0) continue;

      if (presentTeams.length === 1){
        obj.claimed = true;
        rewardObject(presentTeams[0], obj);
        did = true;
        continue;
      }

      log(`🎯 오브젝트 교전: ${obj.type} @ ${obj.zone}`, true);

      const score = presentTeams.map(t => {
        const aliveHere = t.members.filter(m=>m.alive && m.zone === obj.zone);
        const hpSum = aliveHere.reduce((a,m)=>a+m.hp,0);
        return { t, hpSum };
      });

      const total = score.reduce((a,x)=>a+x.hpSum,0) || 1;
      let r = Math.random() * total;
      let winner = score[0].t;
      for (const s of score){
        r -= s.hpSum;
        if (r <= 0){ winner = s.t; break; }
      }

      for (const s of score){
        if (s.t === winner) continue;
        const victims = s.t.members.filter(m=>m.alive && m.zone === obj.zone);
        if (!victims.length) continue;

        const killN = Math.min(victims.length, 1 + (Math.random()<0.35 ? 1 : 0));
        for (let i=0;i<killN;i++){
          const v = pick(victims.filter(x=>x.alive));
          if (!v) break;
          applyDamage(v, 999999, null, `${obj.type} 교전`);
        }
      }

      obj.claimed = true;
      rewardObject(winner, obj);
      did = true;
    }

    return did;
  }

  // ---------- 전멸 선언 ----------
  function announceWipeIfAny(){
    for (const t of teams){
      if (t.wipeAnnounced) continue;
      if (!teamWiped(t)) continue;

      t.wipeAnnounced = true;

      const killers = [];
      for (const m of t.members){
        if (m.lastKilledByTeam) killers.push(m.lastKilledByTeam);
        else if (m.lastHitByTeam) killers.push(m.lastHitByTeam);
      }
      const k = killers.length ? mode(killers) : null;
      t.wipedBy = k;

      log(`🏳 Team ${t.teamNo} 전멸`);

      if (!k) continue;

      const killerTeam = getTeam(k);
      if (!killerTeam) continue;

      const aliveAfter = aliveTeams();
      const isFinalKill = aliveAfter.length === 1 && aliveAfter[0].teamNo === k;

      const killerAliveCount = aliveMembersInTeam(killerTeam).length;

      if (isFinalKill){
        log(`♟ CHECKMATE — Team ${k} 승리 확정!`);
        continue;
      }

      if (killerAliveCount === 1){
        log(`🔥 CLUTCH — Team ${k} (솔로 생존) 전멸 성공!`);
      } else {
        log(`⚡ TERMINATE — Team ${k} 전멸 성공!`);
      }
    }
  }

  function mode(arr){
    const m = new Map();
    let best = null, bestN = 0;
    for (const x of arr){
      m.set(x, (m.get(x)||0)+1);
      if (m.get(x) > bestN){ bestN = m.get(x); best = x; }
    }
    return best;
  }

  // ---------- 결과/종료 ----------
  function markEliminations(){
    const time = (day-1)*SIM_RULES.turnsPerDay + turn;
    for (const t of teams){
      if (t.eliminatedAt !== null) continue;
      if (teamWiped(t)){
        t.eliminatedAt = time;
      }
    }
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
    const modal = ensureResultsModal();
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

      openResults();
    }
  }

  // “아무일도 없음” 방지
  function forceAtLeastOneEvent(){
    if (resolveObjectsThisTurn()) return true;
    if (runZoneFights()) return true;
    if (runLightningIfAny()) return true;
    if (enforceBanExplodeTimer()) return true;

    const alive = [];
    for (const t of teams) for (const m of t.members) if (m.alive) alive.push(m);
    if (alive.length){
      const m = pick(alive);
      doFarm(m);
      log(`📌 사건 보정: ${m.name} 파밍(강제)`, true);
      return true;
    }
    return false;
  }

  // 팀 호버 툴팁
  function bindTeamHoverTooltips(){
    const heads = document.querySelectorAll(".team-head");
    heads.forEach((head, idx) => {
      const teamNo = idx + 1;
      const team = teams.find(t => t.teamNo === teamNo);
      if (!team) return;

      const aliveMembers = team.members.filter(m=>m.alive);
      const txt = aliveMembers.length
        ? aliveMembers.map(m => `${m.name} ${m.hp}/${m.hpMax}`).join(" · ")
        : "생존자 없음";

      head.title = `Team ${teamNo}\n${txt}`;
    });
  }

  // 엔드게임 훅 (map.js가 지원하면)
  function startEndgameIfNeeded(){
    if (day !== 6) return;
    if (!window.MapUI?.startEndgame) return;

    const Z = window.ZONES || [];
    if (Z.length < 2) return;

    let a = pick(Z), b = pick(Z);
    let tries=0;
    while (b === a && tries<20){ b = pick(Z); tries++; }

    window.MapUI.startEndgame([a,b]);
    log(`🧱 6일차 엔드게임 진입: 임시 안전지대 ${a} / ${b}`);
  }

  function setFinalSafeIfNeeded(){
    if (day !== 7) return;
    if (!window.MapUI?.setFinalSafe) return;

    const Z = window.ZONES || [];
    if (!Z.length) return;

    const z = pick(Z);
    window.MapUI.setFinalSafe(z);
    log(`🌐 7일차 최종 안전지대: ${z}`);
  }

  // ---------- 한 턴 ----------
  function oneStep(){
    if (finished) return;

    turn++;
    log(`[D${day} T${turn}] 진행 (날씨: ${weather.main}/${weather.sub})`, true);

    let didSomething = false;

    if (spawnObjectsIfNeeded()) didSomething = true;
    if (resolveObjectsThisTurn()) didSomething = true;

    if (runLightningIfAny()) didSomething = true;

    if (enforceBanExplodeTimer()) didSomething = true;

    for (const t of teams){
      if (teamWiped(t)) continue;

      for (const m of t.members){
        if (!m.alive) continue;

        const warned = window.MapUI?.getWarnedZone?.();
        const inWarn = warned && m.zone === warned;

        const r = Math.random();
        if (inWarn && r < 0.60) { doMove(m); didSomething = true; }
        else if (r < 0.30) { doMove(m); didSomething = true; }
        else if (r < 0.78) { if (doFarm(m)) didSomething = true; }
        else {
          const ok = doCraft(m);
          if (!ok) { if (doFarm(m)) didSomething = true; }
          else didSomething = true;
        }

        if (Math.random() < 0.12) { gainCredits(m, 5); didSomething = true; }
      }
    }

    if (runZoneFights()) didSomething = true;

    if (!didSomething) forceAtLeastOneEvent();

    markEliminations();
    announceWipeIfAny();

    pushOccupancy();

    if (turn >= SIM_RULES.turnsPerDay){
      day++;
      turn = 0;

      if (day <= SIM_RULES.maxDays){
        log(`=== ${day}일차 시작 ===`);

        startEndgameIfNeeded();
        setFinalSafeIfNeeded();

        window.MapUI?.advanceBanStage?.(true);

        reviveIfPossibleStartOfDay();
      }
    }

    bindTeamHoverTooltips();
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

  // ---------- 외부 API ----------
  Sim.startFromLobby = (lobbyState, characterPool) => {
    reset();
    UI?.Log?.clear?.();

    pool = deepClone(characterPool || []);

    const lobbyCopy = deepClone(lobbyState);
    const removed = enforceNoDupWithinTeam(lobbyCopy);
    if (removed > 0){
      log(`❌ 같은 팀 내부 중복 선택이 감지되어 ${removed}개 슬롯이 비워졌습니다. 로비에서 다시 채워주세요.`);
      return;
    }

    if (!validateStart(lobbyCopy)){
      log("❌ 실험체가 부족합니다");
      return;
    }

    weather = chooseWeather();

    window.MapUI?.reset?.();
    window.MapUI?.advanceBanStage?.(true);

    teams = buildTeams(lobbyCopy);

    const fx = weatherEffects();
    log("=== 시뮬레이션 시작 ===");
    log(`날씨: ${weather.main} / ${weather.sub}`);
    log(`부활: 1~${SIM_RULES.autoReviveDays}일 자동 / 이후 1인 ${SIM_RULES.reviveCost}C (비공유)`);
    log(`금구: 폭사 타이머 25s (킬/오브젝트 시 35s), 부활 유예 10s`);
    log(`효과(내부): heal×${fx.healMult}, stamina×${fx.staminaRegen}`);
    log("—");

    pushOccupancy();
    bindTeamHoverTooltips();
  };

  Sim.bindUI = () => {
    UI?.Log?.init?.(UI.q("#logBox"));

    UI.q("#btnNextTurn")?.addEventListener("click", manualNextTurn);
    UI.q("#btnAutoStart")?.addEventListener("click", autoStart);
    UI.q("#btnAutoStop")?.addEventListener("click", autoStop);
    UI.q("#btnClearLog")?.addEventListener("click", ()=>UI?.Log?.clear?.());

    UI.q("#btnOpenResults")?.addEventListener("click", openResults);

    ensureResultsModal();
  };

  Sim.autoStop = autoStop;

  window.Sim = Sim;
})();