// js/map.js
(() => {
  const MapUI = {};

  let banIndex = 0;
  let banPlan = [];
  let occupancy = {}; // zoneName -> [{team, names[]}]

  function shuffle(arr){
    const a = arr.slice();
    for (let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
  }

  function makeBanPlan(){
    // 연구소를 너무 빨리 막지 않게(마지막 쪽으로)
    const zones = window.ZONES.filter(z => z !== "연구소");
    const plan = shuffle(zones);
    plan.push("연구소");
    return plan;
  }

  function getStatus(zone){
    const banned = banPlan[banIndex-1];   // 지난 단계 = 금지구역
    const warned = banPlan[banIndex];     // 이번 단계 = 금지예정
    if (zone === banned) return "danger";
    if (zone === warned) return "warn";
    return "normal";
  }

  function render(){
    const grid = UI.q("#mapGrid");
    const infoBody = UI.q("#mapInfoBody");
    if (!grid || !infoBody) return;

    grid.innerHTML = "";
    for (const z of window.ZONES){
      const st = getStatus(z);
      const node = UI.el("div", "zone " + st);
      node.dataset.zone = z;

      const title = UI.el("div","zone-title", z);
      const sub = UI.el("div","zone-sub","호버로 정보");

      node.appendChild(title);
      node.appendChild(sub);

      node.addEventListener("mouseenter", () => {
        const st2 = getStatus(z);
        const occ = occupancy[z] || [];
        let lines = [];
        lines.push(`[${z}] 상태: ${st2 === "danger" ? "금지구역" : st2 === "warn" ? "금지예정" : "정상"}`);

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

  MapUI.init = () => {
    banIndex = 0;
    banPlan = makeBanPlan();
    occupancy = {};

    UI.q("#btnAdvanceBan")?.addEventListener("click", () => {
      MapUI.advanceBanStage(true);
    });

    render();
  };

  MapUI.reset = () => {
    banIndex = 0;
    banPlan = makeBanPlan();
    occupancy = {};
    render();
    UI.q("#mapInfoBody").textContent = "지역에 마우스를 올려주세요.";
  };

  MapUI.advanceBanStage = (logAlso=false) => {
    if (banIndex >= banPlan.length) return;
    const warned = banPlan[banIndex];
    const banned = banPlan[banIndex-1];

    banIndex++;
    render();

    if (logAlso){
      if (warned) UI.Log.add(`⚠ 금지예정: ${warned}`);
      if (banned) UI.Log.add(`⛔ 금지구역: ${banned}`);
    }
  };

  MapUI.getStatus = (zone) => getStatus(zone);

  MapUI.setOccupancy = (occMap) => {
    occupancy = occMap || {};
  };

  MapUI.getBannedZone = () => banPlan[banIndex-1] || null;
  MapUI.getWarnedZone = () => banPlan[banIndex] || null;

  window.MapUI = MapUI;
})();
