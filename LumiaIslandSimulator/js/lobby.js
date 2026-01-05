// js/lobby.js
(() => {
  const Lobby = {};

  let originalCharacters = [];
  let lobbyState = null;
  let selectedId = null;

  const $ = UI.q;
  const $$ = UI.qq;

  function deepClone(x){ return JSON.parse(JSON.stringify(x)); }

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

  // ---- 풀 렌더 ----
  function renderPool(){
    const list = $("#poolList");
    if (!list) return;
    const query = ($("#poolSearch")?.value || "").trim();

    const pool = getCharacterPool();
    const filtered = query
      ? pool.filter(c => {
          const q = query.toLowerCase();
          return (c.name||"").toLowerCase().includes(q) || (c.codename||"").toLowerCase().includes(q);
        })
      : pool;

    list.innerHTML = "";
    for (const c of filtered){
      const card = UI.el("div", "card" + (selectedId === c.id ? " selected" : ""));
      card.draggable = true;
      card.dataset.charId = c.id;

      const top = UI.el("div","card-top");
      const left = UI.el("div","");
      const name = UI.el("div","card-name", c.name);
      const code = UI.el("div","card-code", c.codename || "");
      left.appendChild(name); left.appendChild(code);

      const right = UI.el("div","pills");
      (c.roles||[]).slice(0,3).forEach(r => right.appendChild(UI.el("span","pill", r)));
      const w = (c.weaponChoices||[]).join("/");
      if (w) right.appendChild(UI.el("span","pill", w));

      top.appendChild(left);
      top.appendChild(right);
      card.appendChild(top);

      card.addEventListener("click", () => setSelected(c.id));

      // 드래그: 풀 -> 슬롯
      card.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", JSON.stringify({ type:"pool", charId:c.id }));
        e.dataTransfer.effectAllowed = "copy";
      });

      list.appendChild(card);
    }
  }

  // ---- 팀 렌더 ----
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
        const slot = lobbyState.teams[ti][si];
        const id = slot ? (typeof slot === "string" ? slot : slot.id) : null;
        const c = id ? findChar(id) : null;

        const node = UI.el("div","slot" + (id ? " filled" : ""));
        node.dataset.team = String(ti);
        node.dataset.slot = String(si);
        node.draggable = !!id; // 슬롯 자체가 드래그되도록
        node.addEventListener("click", () => {
          if (!selectedId) return;
          lobbyState.teams[ti][si] = { id: selectedId };
          saveLobby();
          renderTeams();
          MapUI.setOccupancy(Lobby.buildOccupancyPreview());
        });

        // 표시
        const title = UI.el("div","slot-title");
        title.appendChild(UI.el("div","slot-name", c ? c.name : "빈 슬롯"));
        title.appendChild(UI.el("div","slot-hint", c ? (c.codename||"") : "클릭=배치"));
        node.appendChild(title);
        if (c){
          node.appendChild(UI.el("div","slot-sub", `${(c.roles||[]).join(", ")} · ${(c.weaponChoices||[]).join("/")}`));
        }

        // 드래그 시작(슬롯 -> 슬롯)
        node.addEventListener("dragstart", (e) => {
          if (!id) return;
          node.classList.add("dragging");
          e.dataTransfer.setData("text/plain", JSON.stringify({ type:"slot", fromTeam:ti, fromSlot:si }));
          e.dataTransfer.effectAllowed = "move";
        });
        node.addEventListener("dragend", () => node.classList.remove("dragging"));

        // 드롭 타겟(풀/슬롯 둘 다 받음)
        node.addEventListener("dragover", (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        });
        node.addEventListener("drop", (e) => {
          e.preventDefault();
          let payload = null;
          try { payload = JSON.parse(e.dataTransfer.getData("text/plain")); } catch {}
          if (!payload) return;

          if (payload.type === "pool"){
            lobbyState.teams[ti][si] = { id: payload.charId };
            saveLobby();
            renderTeams();
            MapUI.setOccupancy(Lobby.buildOccupancyPreview());
            return;
          }

          if (payload.type === "slot"){
            const ft = payload.fromTeam, fs = payload.fromSlot;
            if (ft === ti && fs === si) return;

            // swap / move
            const a = lobbyState.teams[ft][fs];
            const b = lobbyState.teams[ti][si];
            lobbyState.teams[ti][si] = a;
            lobbyState.teams[ft][fs] = b;

            saveLobby();
            renderTeams();
            MapUI.setOccupancy(Lobby.buildOccupancyPreview());
          }
        });

        body.appendChild(node);
      }

      teamBox.appendChild(body);
      grid.appendChild(teamBox);
    }
  }

  function anyTeamHasEmptySlot(){
    for (const team of lobbyState.teams){
      for (const s of team){
        if (!s) return true;
        const id = (typeof s === "string") ? s : s.id;
        if (!id) return true;
      }
    }
    return false;
  }

  function allEmpty(){
    let filled = 0;
    for (const team of lobbyState.teams){
      for (const s of team){
        const id = s ? ((typeof s === "string") ? s : s.id) : null;
        if (id) filled++;
      }
    }
    return filled === 0;
  }

  function startSim(){
    if (allEmpty() || anyTeamHasEmptySlot()){
      alert("실험체가 부족합니다");
      UI.Log.add("❌ 실험체가 부족합니다");
      return;
    }
    const pool = getCharacterPool();
    Sim.startFromLobby(deepClone(lobbyState), deepClone(pool));
  }

  // 지도 호버용 “미리보기”(시뮬 시작 전엔 임의 배치)
  Lobby.buildOccupancyPreview = () => {
    const occ = {};
    const zones = window.ZONES || [];
    const pickZone = (ti, si) => zones[(ti*3 + si) % zones.length]; // 고정 분산
    for (let ti=0; ti<SIM_RULES.maxTeams; ti++){
      for (let si=0; si<SIM_RULES.teamSize; si++){
        const s = lobbyState.teams[ti][si];
        const id = s ? ((typeof s === "string") ? s : s.id) : null;
        if (!id) continue;
        const c = findChar(id);
        const z = pickZone(ti, si);
        occ[z] = occ[z] || [];
        let row = occ[z].find(x => x.team === (ti+1));
        if (!row){ row = { team:ti+1, names:[] }; occ[z].push(row); }
        row.names.push(c?.name || id);
      }
    }
    return occ;
  };

  // --- 오리지널 모달 ---
  function renderRoleChips(){
    const box = $("#ocRoleChips");
    if (!box) return;
    box.innerHTML = "";
    for (const r of window.ROLE_LIST){
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
    for (const w of window.WEAPON_LIST){
      const opt = document.createElement("option");
      opt.value = w;
      opt.textContent = w;
      sel.appendChild(opt);
    }
  }

  function openOCModal(){ UI.setModal($("#ocModal"), true); }
  function closeOCModal(){ UI.setModal($("#ocModal"), false); }

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
      roles: roles.length ? roles : ["전사"],
      weaponChoices: weapon ? [weapon] : []
    });

    Store.saveOC(originalCharacters);
    renderPool();
    closeOCModal();
  }

  function cryptoRandomId(){
    if (window.crypto?.getRandomValues){
      const buf = new Uint32Array(2);
      crypto.getRandomValues(buf);
      return (buf[0].toString(16) + buf[1].toString(16));
    }
    return String(Date.now()) + String(Math.random()).slice(2);
  }

  function clearOC(){
    if (!confirm("오리지널 실험체를 전부 삭제할까요?")) return;
    originalCharacters = [];
    Store.clearOC();
    renderPool();
  }

  function saveOC(){ Store.saveOC(originalCharacters); UI.Log.add("✅ 오리지널 저장 완료"); }
  function loadOC(){
    originalCharacters = Store.loadOC();
    UI.Log.add(`✅ 오리지널 불러오기: ${originalCharacters.length}명`);
    renderPool();
  }

  function fillRandom(emptyOnly){
    const pool = getCharacterPool();
    if (pool.length === 0) return;

    for (let ti=0; ti<SIM_RULES.maxTeams; ti++){
      for (let si=0; si<SIM_RULES.teamSize; si++){
        const cur = lobbyState.teams[ti][si];
        const curId = cur ? ((typeof cur === "string") ? cur : cur.id) : null;
        if (emptyOnly && curId) continue;

        const pick = pool[Math.floor(Math.random()*pool.length)];
        lobbyState.teams[ti][si] = { id: pick.id };
      }
    }

    saveLobby();
    renderTeams();
    MapUI.setOccupancy(Lobby.buildOccupancyPreview());
  }

  function clearTeams(){
    lobbyState = makeEmptyLobby();
    saveLobby();
    renderTeams();
    MapUI.setOccupancy(Lobby.buildOccupancyPreview());
  }

  Lobby.init = () => {
    // 로드
    originalCharacters = Store.loadOC();
    lobbyState = Store.loadLobby() || makeEmptyLobby();

    // 패널 접기
    $("#btnTogglePool")?.addEventListener("click", ()=>togglePanel("poolBody","btnTogglePool"));
    $("#btnToggleTeams")?.addEventListener("click", ()=>togglePanel("teamsBody","btnToggleTeams"));
    $("#btnToggleMap")?.addEventListener("click", ()=>togglePanel("mapBody","btnToggleMap"));

    // 풀 검색
    $("#poolSearch")?.addEventListener("input", renderPool);
    $("#btnClearSearch")?.addEventListener("click", ()=>{
      $("#poolSearch").value = "";
      renderPool();
    });

    // 오리지널
    $("#btnOCOpen")?.addEventListener("click", openOCModal);
    $("#ocModalClose")?.addEventListener("click", closeOCModal);
    $("#ocModalX")?.addEventListener("click", closeOCModal);

    $("#btnAddOC")?.addEventListener("click", addOC);
    $("#btnSaveOC")?.addEventListener("click", saveOC);
    $("#btnLoadOC")?.addEventListener("click", loadOC);
    $("#btnOCClear")?.addEventListener("click", clearOC);

    // 팀
    $("#btnFillEmptyRandom")?.addEventListener("click", ()=>fillRandom(true));
    $("#btnFillAllRandom")?.addEventListener("click", ()=>fillRandom(false));
    $("#btnClearTeams")?.addEventListener("click", clearTeams);
    $("#btnStartSim")?.addEventListener("click", startSim);

    renderRoleChips();
    renderWeaponSelect();

    renderPool();
    renderTeams();

    MapUI.setOccupancy(Lobby.buildOccupancyPreview());
  };

  Lobby.getLobbyState = () => lobbyState;
  Lobby.getCharacterPool = () => getCharacterPool();

  window.Lobby = Lobby;
})();
