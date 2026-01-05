// js/map.js  (배그식 금지구역: 안전지대가 점점 좁아짐)
(() => {
  const MapUI = {};

  // 단계(=일차)별로 "안전지역 집합"을 줄여가는 방식
  // safeSet: 현재 안전 지역들
  // nextBanSet: 다음에 금지로 바뀔 후보(노랑 표시)
  // bannedSet: 이미 금지된 지역들(빨강 표시)
  let stage = 0;

  let allZones = [];
  let safeSet = new Set();
  let nextBanSet = new Set();
  let bannedSet = new Set();

  let occupancy = {}; // zoneName -> [{team, names[]}]

  // 엔드게임(6~7일차)
  let endgame = {
    enabled: false,
    tempSafe: new Set(),   // 6일차 임시 안전지대(2곳)
    finalSafe: null        // 7일차 최종 안전지대(1곳)
  };

  function shuffle(arr){
    const a = arr.slice();
    for (let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
  }

  function initZones(){
    allZones = (window.ZONES || []).slice();
    safeSet = new Set(allZones);
    nextBanSet = new Set();
    bannedSet = new Set();
    stage = 0;

    endgame.enabled = false;
    endgame.tempSafe = new Set();
    endgame.finalSafe = null;
  }

  // 이번 stage에서 “몇 개를 금지로 만들지” (점점 빨라지게)
  function banCountByStage(s){
    // 대충 1~3개 정도씩 줄어들게(너무 급격하면 재미없음)
    if (s <= 1) return 1;
    if (s <= 3) return 2;
    if (s <= 6) return 3;
    return 4;
  }

  // 다음에 금지될(노랑) 후보를 뽑는다
  function computeNextBan(){
    // 엔드게임 최종 안전지대가 있으면 그 지역만 “진짜 안전”
    if (endgame.enabled && endgame.finalSafe){
      nextBanSet = new Set([...safeSet].filter(z => z !== endgame.finalSafe));
      return;
    }

    // 6일차 임시 안전지대가 활성화되면: 임시 안전지대 2곳만 남기고 나머지는 노랑 후보
    if (endgame.enabled && endgame.tempSafe.size){
      nextBanSet = new Set([...safeSet].filter(z => !endgame.tempSafe.has(z)));
      return;
    }

    // 일반 단계: safeSet에서 일부를 노랑으로 지정
    const safeArr = [...safeSet];
    if (safeArr.length <= 1){
      nextBanSet = new Set();
      return;
    }

    // "연구소" 너무 빨리 막히지 않게 약간 뒤로 미룸(가능하면 마지막까지 남기기)
    let candidates = safeArr.slice();
    if (candidates.length > 2 && candidates.includes("연구소")){
      // 연구소는 후보에서 제외(마지막 2개 남을 때쯤 허용)
      candidates = candidates.filter(z => z !== "연구소");
      if (!candidates.length) candidates = safeArr.slice();
    }

    candidates = shuffle(candidates);

    const n = Math.min(banCountByStage(stage + 1), Math.max(0, safeArr.length - 1));
    nextBanSet = new Set(candidates.slice(0, n));
  }

  // 상태 반환(색상용)
  // danger(빨강): bannedSet
  // warn(노랑): nextBanSet
  // normal(정상): safeSet
  function getStatus(zone){
    if (bannedSet.has(zone)) return "danger";
    if (nextBanSet.has(zone)) return "warn";
    if (safeSet.has(zone)) return "normal";
    return "danger";
  }

  function render(){
    const grid = UI.q("#mapGrid");
    const infoBody = UI.q("#mapInfoBody");
    if (!grid || !infoBody) return;

    grid.innerHTML = "";
    for (const z of allZones){
      const st = getStatus(z);
      const node = UI.el("div", "zone " + st);
      node.dataset.zone = z;

      const title = UI.el("div","zone-title", z);

      let subText = "호버로 정보";
      if (endgame.enabled && endgame.finalSafe && z === endgame.finalSafe) subText = "최종 안전지대";
      else if (endgame.enabled && endgame.tempSafe.size && endgame.tempSafe.has(z)) subText = "임시 안전지대";
      else if (st === "danger") subText = "금지구역";
      else if (st === "warn") subText = "금지예정";
      else subText = "정상";

      const sub = UI.el("div","zone-sub", subText);

      node.appendChild(title);
      node.appendChild(sub);

      node.addEventListener("mouseenter", () => {
        const st2 = getStatus(z);
        const occ = occupancy[z] || [];

        let lines = [];
        let label = (st2 === "danger") ? "금지구역" : (st2 === "warn") ? "금지예정" : "정상";
        lines.push(`[${z}] 상태: ${label}`);

        if (endgame.enabled && endgame.finalSafe && z === endgame.finalSafe){
          lines.push(`(7일차 최종 안전지대)`);
        } else if (endgame.enabled && endgame.tempSafe.size && endgame.tempSafe.has(z)){
          lines.push(`(6일차 임시 안전지대)`);
        }

        if (occ.length === 0) lines.push("팀 없음");
        else {
          for (const t of occ){
            lines.push(`Team ${t.team}: ${t.names.join(", ")}`);
          }
        }

        infoBody.textContent = lines.join("\n");
      });

      grid.appendChild(node);
    }
  }

  // ---------- 공개 API ----------
  MapUI.init = () => {
    initZones();
    computeNextBan();

    UI.q("#btnAdvanceBan")?.addEventListener("click", () => {
      MapUI.advanceBanStage(true);
    });

    render();
  };

  MapUI.reset = () => {
    initZones();
    computeNextBan();
    occupancy = {};
    render();
    const info = UI.q("#mapInfoBody");
    if (info) info.textContent = "지역에 마우스를 올려주세요.";
  };

  // ✅ 단계 진행: “노랑 후보(nextBanSet)”을 실제 금지(빨강)로 편입
  MapUI.advanceBanStage = (logAlso=false) => {
    // nextBan을 banned로 확정
    for (const z of nextBanSet){
      safeSet.delete(z);
      bannedSet.add(z);
    }

    stage++;
    computeNextBan();
    render();

    if (logAlso){
      const warned = [...nextBanSet];
      const banned = [...bannedSet];

      if (warned.length) UI?.Log?.add?.(`⚠ 금지예정: ${warned.join(", ")}`);
      if (banned.length) UI?.Log?.add?.(`⛔ 금지구역: ${bannedSet.size}개 지역`);
    }
  };

  MapUI.getStatus = (zone) => getStatus(zone);

  MapUI.setOccupancy = (occMap) => {
    occupancy = occMap || {};
  };

  // ✅ sim.js가 쓰는 “배그식” API
  MapUI.getBannedSet = () => new Set(bannedSet);
  MapUI.getSafeSet = () => new Set(safeSet);

  // (호환용) 이전 코드가 혹시 쓰면 최소 동작하도록
  MapUI.getBannedZone = () => null;
  MapUI.getWarnedZone = () => null;

  // ✅ 엔드게임: 6일차 임시 안전지대(2곳)
  MapUI.startEndgame = (zones2) => {
    endgame.enabled = true;
    endgame.finalSafe = null;
    endgame.tempSafe = new Set((zones2 || []).filter(Boolean).slice(0,2));

    // 임시 안전지대 2곳만 “안전 후보”로 남기기 위해 nextBan 재계산
    computeNextBan();
    render();
  };

  // ✅ 최종 안전지대: 7일차(1곳)
  MapUI.setFinalSafe = (zone) => {
    if (!zone) return;
    endgame.enabled = true;
    endgame.finalSafe = zone;

    // 최종 안전지대만 남기기 위해 safeSet 정리
    // (남아있는 safeSet에 없으면 추가)
    safeSet.add(zone);
    for (const z of allZones){
      if (z !== zone) {
        safeSet.delete(z);
        bannedSet.add(z);
      }
    }

    nextBanSet = new Set();
    render();
  };

  window.MapUI = MapUI;
})();