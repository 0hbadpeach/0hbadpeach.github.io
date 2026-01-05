// js/app.js
(() => {
  function addLog(msg){
    try {
      if (window.UI && UI.Log && typeof UI.Log.add === "function") UI.Log.add(msg);
    } catch {}
    try { console.log(msg); } catch {}
  }

  function hideLoadingOverlay(){
    try {
      const ov = document.getElementById("loadingOverlay");
      if (!ov) return;
      ov.classList.add("hidden");
      ov.style.display = "none";
    } catch {}
  }

  window.addEventListener("DOMContentLoaded", () => {
    addLog("🟩 app.js DOMContentLoaded");

    try {
      if (window.Sim && typeof Sim.bindUI === "function") {
        Sim.bindUI();
        addLog("🟩 Sim.bindUI OK");
      } else {
        addLog("🟥 Sim.bindUI 없음");
      }
    } catch (e) {
      addLog("🟥 Sim.bindUI 에러: " + (e && e.message ? e.message : e));
    }

    try {
      if (window.Lobby && typeof Lobby.init === "function") {
        Lobby.init();
        addLog("🟩 Lobby.init OK");
      } else {
        addLog("🟥 Lobby.init 없음");
      }
    } catch (e) {
      addLog("🟥 Lobby.init 에러: " + (e && e.message ? e.message : e));
    }

    try {
      if (window.MapUI && typeof MapUI.init === "function") {
        MapUI.init();
        addLog("🟩 MapUI.init OK");
      }
    } catch (e) {
      addLog("🟥 MapUI.init 에러: " + (e && e.message ? e.message : e));
    }

    // ✅ 어떤 상황이든 화면이 멈춘 채로 가려지는 걸 방지
    hideLoadingOverlay();
  });
})();