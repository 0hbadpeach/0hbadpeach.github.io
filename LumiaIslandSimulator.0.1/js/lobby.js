// js/lobby.js
(() => {
  const Lobby = {};

  let originalCharacters = [];
  let lobbyState = null;
  let selectedId = null;

  const $ = UI.q;
  const $$ = UI.qq;

  function deepClone(x){ return JSON.parse(JSON.stringify(x)); }

  // 슬롯 객체/문자열 모두 지원해서 id 뽑기
  function slotId(s){
    if (!s) return null;
    if (typeof s === "string") return s;
    return s.id || null;
  }

  function makeEmptyLobby(){
    return {
      teams: Array.from({length: SIM_RULES.maxTeams}, () =>
        Array.from({length: SIM_RULES.teamSize}, () => null)
      )
    };
  }

  function getCharacterPool(){
    return [...(window.OFFICIAL_CHARACTERS || []), ...(originalCharacters || [])];
  }

  function findChar(id){
    return getCharacterPool().find(c => c.id === id) || null;
  }

  function saveLobby(){
    Store.saveLobby(lobbyState);
  }

  function setSelected(id){
    selectedId = id;
    renderPool();
  }

  function togglePanel(bodyId, btnId){
    const body = document.getElementById(bodyId);
    const btn = document.getElementById(btnId);
    if (!body || !btn) return;
    const hidden = body.style.display === "none";
    body.style.display = hidden ? "" : "none";
    btn.textContent = hidden ? "접기" : "열기";
  }

  // ✅ A 규칙: 같은 팀 내부만 중복 금지
  function hasDupInTeam(teamIndex, characterId, exceptSlotIndex = null){
    const team = lobbyState.teams[teamIndex];
    for (let si=0; si<team.length; si++){
      if (exceptSlotIndex !== null && si === exceptSlotIndex) continue;
      const id = slotId(team[si]);
      if (id && id === characterId) return true;
    }
    return false;
  }

  function placeToSlot(ti, si, charId){
    if (!charId) return;

    if (hasDupInTeam(ti, charId, si)){
      const c = findChar(charId);
      UI.Log.add(`❌ [로비] Team ${ti+1} 내부 중복 금지: ${c?.name || charId}`);
      alert("같은 팀 안에는 동일 실험체를 2명 넣을 수 없습니다.");
      return;
    }

    lobbyState.teams[ti][si] = { id: charId };
    saveLobby();
    renderTeams();
    safeMapPreview();
  }

  function safeMapPreview(){
    try {
      if (window.MapUI && typeof MapUI.setOccupancy === "function"){
        MapUI.setOccupancy(Lobby.buildOccupancyPreview());
      }
    } catch {}
  }

  // --------------------------
  // 풀 렌더
  // --------------------------
  function renderPool(){
    const list = $("#poolList");
    if (!list) return;

    const query = ($("#poolSearch")?.value || "").trim().toLowerCase();
    const pool = getCharacterPool();

    const filtered = query
      ? pool.filter(c => {
          const name = (c.name || "").toLowerCase();
          const code = (c.codename || "").toLowerCase();
          return name.includes(query) || code.includes(query);
        })
      : pool;

    list.innerHTML = "";

    for (const c of filtered){
      const card = UI.el("div", "card" + (selectedId === c.id ? " selected" : ""));
      card.dataset.charId = c.id;
      card.draggable = true;

      const top = UI.el("div","card-top");

      const left = UI.el("div","");
      left.appendChild(UI.el("div","card-name", c.name || "(이름없음)"));
      left.appendChild(UI.el("div","card-code", c.codename || ""));
      top.appendChild(left);

      const right = UI.el("div","pills");
      (c.roles || []).slice(0,3).forEach(r => right.appendChild(UI.el("span","pill", r)));
      const w = (c.weaponChoices || []).join("/");
      if (w) right.appendChild(UI.el("span","pill", w));
      top.appendChild(right);

      card.appendChild(top);

      // 클릭 선택
      card.addEventListener("click", () => setSelected(c.id));

      // 드래그: 풀 -> 슬롯
      card.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", JSON.stringify({ type:"pool", charId:c.id }));
        e.dataTransfer.effectAllowed = "copy";
      });

      list.appendChild(card);
    }

    // 목록 비었을 때
    if (filtered.length === 0){
      list.appendChild(UI.el("div","hint", "검색 결과가 없습니다."));
    }
  }

  // --------------------------
  // 팀 렌더 + 드래그 스왑
  // --------------------------
  function renderTeams(){
    const grid = $("#teamsGrid");
    if (!grid) return;

    grid.innerHTML = "";

    for (let ti=0; ti<SIM_RULES.maxTeams; ti++){
      const teamBox = UI.el("div","team");

      const head = UI.el("div","team-head");
      head.appendChild(UI.el("div","team-title", `Team ${ti+1}`));
      teamBox.appendChild(head);

      const body = UI.el("div","team-body");

      for (let si=0; si<SIM_RULES.teamSize; si++){
        const id = slotId(lobbyState.teams[ti][si]);
        const c = id ? findChar(id) : null;

        const node = UI.el("div","slot" + (id ? " filled" : ""));
        node.dataset.team = String(ti);
        node.dataset.slot = String(si);
        node.draggable = !!id;

        // 클릭 배치 (선택된 실험체)
        node.addEventListener("click", () => {
          if (!selectedId) return;
          placeToSlot(ti, si, selectedId);
        });

        // 표시
        const title = UI.el("div","slot-title");
        title.appendChild(UI.el("div","slot-name", c ? c.name : "빈 슬롯"));
        title.appendChild(UI.el("div","slot-hint", c ? (c.codename || "") : "클릭=배치"));
        node.appendChild(title);

        if (c){
          node.appendChild(UI.el("div","slot-sub",
            `${(c.roles||[]).join(", ")} · ${(c.weaponChoices||[]).join("/")}`
          ));
        }

        // 드래그 시작(슬롯 -> 슬롯)
        node.addEventListener("dragstart", (e) => {
          if (!id) return;
          node.classList.add("dragging");
          e.dataTransfer.setData("text/plain", JSON.stringify({
            type:"slot",
            fromTeam:ti,
            fromSlot:si
          }));
          e.dataTransfer.effectAllowed = "move";
        });

        node.addEventListener("dragend", () => node.classList.remove("dragging"));

        // 드롭 타겟
        node.addEventListener("dragover", (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        });

        node.addEventListener("drop", (e) => {
          e.preventDefault();
          let payload = null;
          try { payload = JSON.parse(e.dataTransfer.getData("text/plain")); } catch {}
          if (!payload) return;

          // 풀 -> 슬롯
          if (payload.type === "pool"){
            placeToSlot(ti, si, payload.charId);
            return;
          }

          // 슬롯 -> 슬롯
          if (payload.type === "slot"){
            const ft = payload.fromTeam;
            const fs = payload.fromSlot;
            if (ft === ti && fs === si) return;

            const a = lobbyState.teams[ft][fs];
            const b = lobbyState.teams[ti][si];
            const aId = slotId(a);
            const bId = slotId(b);

            if (!aId) return;

            // ✅ a가 도착 팀에 들어갈 때 중복 체크
            const exceptTo = (ft === ti) ? fs : null;
            if (hasDupInTeam(ti, aId, exceptTo)){
              alert("도착 팀 안에 같은 실험체가 이미 있습니다.");
              UI.Log.add(`❌ [로비] 이동 차단: Team ${ti+1} 내부 중복(${findChar(aId)?.name || aId})`);
              return;
            }

            // ✅ 스왑이면 b도 출발 팀에서 중복 체크
            if (bId){
              const exceptFrom = (ft === ti) ? si : null;
              if (hasDupInTeam(ft, bId, exceptFrom)){
                alert("스왑 결과 같은 팀 내부 중복이 발생합니다.");
                UI.Log.add(`❌ [로비] 스왑 차단: Team ${ft+1} 내부 중복(${findChar(bId)?.name || bId})`);
                return;
              }
            }

            // swap / move
            lobbyState.teams[ti][si] = a;
            lobbyState.teams[ft][fs] = b;

            saveLobby();
            renderTeams();
            safeMapPreview();
          }
        });

        body.appendChild(node);
      }

      teamBox.appendChild(body);
      grid.appendChild(teamBox);
    }
  }

  // --------------------------
  // 시작 조건 체크 + 시작
  // --------------------------
  function startSim(){
    const total = SIM_RULES.maxTeams * SIM_RULES.teamSize;
    let filled = 0;

    for (const team of lobbyState.teams){
      for (const s of team){
        if (slotId(s)) filled++;
      }
    }

    const allEmpty = filled === 0;
    const anyEmpty = filled < total;

    UI.Log.add(`[디버그] filled=${filled}/${total}, allEmpty=${allEmpty}, anyEmpty=${anyEmpty}`);

    if (allEmpty || anyEmpty){
      alert("실험체가 부족합니다");
      UI.Log.add("❌ 실험체가 부족합니다");
      return;
    }

    UI.Log.add("✅ startSim 통과: Sim.startFromLobby 호출 직전");

    const pool = getCharacterPool();

    if (!window.Sim || typeof Sim.startFromLobby !== "function"){
      UI.Log.add("❌ Sim.startFromLobby 함수가 없습니다 (sim.js 로드/함수명 확인)");
      alert("Sim.startFromLobby가 없습니다. sim.js를 확인하세요.");
      return;
    }

    Sim.startFromLobby(
  deepClone(lobbyState),
  deepClone(getCharacterPool())
);

    UI.Log.add("✅ Sim.startFromLobby 호출 완료");
  }

  // --------------------------
  // 지도 호버용 “미리보기” (로비 단계)
  // --------------------------
  Lobby.buildOccupancyPreview = () => {
    const occ = {};
    const zones = window.ZONES || [];
    if (!zones.length) return occ;

    const pickZone = (ti, si) => zones[(ti*3 + si) % zones.length]; // 고정 분산

    for (let ti=0; ti<SIM_RULES.maxTeams; ti++){
      for (let si=0; si<SIM_RULES.teamSize; si++){
        const id = slotId(lobbyState.teams[ti][si]);
        if (!id) continue;

        const c = findChar(id);
        const z = pickZone(ti, si);

        occ[z] = occ[z] || [];
        let row = occ[z].find(x => x.team === (ti+1));
        if (!row){
          row = { team: ti+1, names: [] };
          occ[z].push(row);
        }
        row.names.push(c?.name || id);
      }
    }
    return occ;
  };

  // --------------------------
  // 오리지널 실험체 모달
  // --------------------------
  function renderRoleChips(){
    const box = $("#ocRoleChips");
    if (!box) return;
    box.innerHTML = "";
    for (const r of window.ROLE_LIST || []){
      const chip = UI.el("button","chip", r);
      chip.type = "button";
      chip.dataset.role = r;
      chip.addEventListener("click", ()=> chip.classList.toggle("on"));
      box.appendChild(chip);
    }
  }

  function renderWeaponSelect(){
    const sel = $("#ocWeapon");
    if (!sel) return;
    sel.innerHTML = "";
    for (const w of window.WEAPON_LIST || []){
      const opt = document.createElement("option");
      opt.value = w;
      opt.textContent = w;
      sel.appendChild(opt);
    }
  }

  function openOCModal(){ UI.setModal($("#ocModal"), true); }
  function closeOCModal(){ UI.setModal($("#ocModal"), false); }

  function cryptoRandomId(){
    if (window.crypto?.getRandomValues){
      const buf = new Uint32Array(2);
      crypto.getRandomValues(buf);
      return (buf[0].toString(16) + buf[1].toString(16));
    }
    return String(Date.now()) + String(Math.random()).slice(2);
  }

  function addOC(){
    const codename = ($("#ocCodename")?.value || "").trim();
    const name = ($("#ocName")?.value || "").trim();
    if (!name){
      alert("이름을 입력하세요");
      return;
    }

    const roles = $$("#ocRoleChips .chip.on").map(x=>x.dataset.role).filter(Boolean);
    const weapon = $("#ocWeapon")?.value || "";

    const id = "oc:" + cryptoRandomId();

    originalCharacters.push({
      id,
      codename: codename || "OC",
      name,
      roles: roles.slice(0,2).length ? roles.slice(0,2) : ["전사"],
      weaponChoices: weapon ? [weapon] : []
    });

    Store.saveOC(originalCharacters);
    UI.Log.add(`✅ 오리지널 추가: ${name}`);
    renderPool();
    closeOCModal();
  }

  function clearOC(){
    if (!confirm("오리지널 실험체를 전부 삭제할까요?")) return;
    originalCharacters = [];
    Store.clearOC();
    UI.Log.add("✅ 오리지널 초기화 완료");
    renderPool();
  }

  function saveOC(){
    Store.saveOC(originalCharacters);
    UI.Log.add("✅ 오리지널 저장 완료");
  }

  function loadOC(){
    originalCharacters = Store.loadOC();
    UI.Log.add(`✅ 오리지널 불러오기: ${originalCharacters.length}명`);
    renderPool();
  }

  // --------------------------
  // 랜덤 배치 / 팀 초기화
  // --------------------------
  function fillRandom(emptyOnly){
    const pool = getCharacterPool();
    if (pool.length === 0){
      alert("실험체 풀이 비어있습니다(data.js 확인)");
      return;
    }

    for (let ti=0; ti<SIM_RULES.maxTeams; ti++){
      for (let si=0; si<SIM_RULES.teamSize; si++){
        const curId = slotId(lobbyState.teams[ti][si]);
        if (emptyOnly && curId) continue;

        let pick = null;

        // 팀 내부 중복 금지라서, 몇 번 시도 후 가능한 것 선택
        for (let tries=0; tries<60; tries++){
          const cand = pool[Math.floor(Math.random()*pool.length)];
          if (!hasDupInTeam(ti, cand.id, si)){
            pick = cand;
            break;
          }
        }
        // 그래도 못 찾으면 그냥 랜덤(풀 충분하면 거의 안 나옴)
        if (!pick) pick = pool[Math.floor(Math.random()*pool.length)];

        lobbyState.teams[ti][si] = { id: pick.id };
      }
    }

    saveLobby();
    renderTeams();
    safeMapPreview();
  }

  function clearTeams(){
    lobbyState = makeEmptyLobby();
    saveLobby();
    UI.Log.add("✅ 팀 비우기 완료");
    renderTeams();
    safeMapPreview();
  }

  // --------------------------
  // init
  // --------------------------
  Lobby.init = () => {
    originalCharacters = Store.loadOC();
    lobbyState = Store.loadLobby() || makeEmptyLobby();

    // 패널 접기
    $("#btnTogglePool")?.addEventListener("click", ()=>togglePanel("poolBody","btnTogglePool"));
    $("#btnToggleTeams")?.addEventListener("click", ()=>togglePanel("teamsBody","btnToggleTeams"));
    $("#btnToggleMap")?.addEventListener("click", ()=>togglePanel("mapBody","btnToggleMap"));

    // 검색
    $("#poolSearch")?.addEventListener("input", renderPool);
    $("#btnClearSearch")?.addEventListener("click", ()=>{
      const s = $("#poolSearch");
      if (s) s.value = "";
      renderPool();
    });

    // 오리지널 모달
    $("#btnOCOpen")?.addEventListener("click", openOCModal);
    $("#ocModalClose")?.addEventListener("click", closeOCModal);
    $("#ocModalX")?.addEventListener("click", closeOCModal);

    $("#btnAddOC")?.addEventListener("click", addOC);
    $("#btnSaveOC")?.addEventListener("click", saveOC);
    $("#btnLoadOC")?.addEventListener("click", loadOC);
    $("#btnOCClear")?.addEventListener("click", clearOC);

    // 팀 버튼
    $("#btnFillEmptyRandom")?.addEventListener("click", ()=>fillRandom(true));
    $("#btnFillAllRandom")?.addEventListener("click", ()=>fillRandom(false));
    $("#btnClearTeams")?.addEventListener("click", clearTeams);
    $("#btnStartSim")?.addEventListener("click", startSim);

    // 오리지널 UI 준비
    renderRoleChips();
    renderWeaponSelect();

    // 렌더
    renderPool();
    renderTeams();
    safeMapPreview();

    UI.Log.add("✅ Lobby.init 완료");
  };

  Lobby.getLobbyState = () => lobbyState;
  Lobby.getCharacterPool = () => getCharacterPool();

  window.Lobby = Lobby;
})();