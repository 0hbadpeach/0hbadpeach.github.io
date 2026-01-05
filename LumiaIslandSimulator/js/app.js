// js/app.js
(() => {
  function setLoading(pct){
    const t = document.getElementById("loadingText");
    const f = document.getElementById("loadingBarFill");
    if (t) t.textContent = `Loading... (${pct}%)`;
    if (f) f.style.width = `${pct}%`;
  }

  function hideLoading(){
    const o = document.getElementById("loadingOverlay");
    if (o) o.style.display = "none";
  }

  function init(){
    setLoading(20);

    MapUI.init();
    setLoading(45);

    Lobby.init();
    setLoading(70);

    Sim.bindUI();
    setLoading(90);

    document.getElementById("btnResetAll")?.addEventListener("click", () => {
      if (!confirm("로컬 저장(오리지널/팀편성)을 포함해 전부 초기화할까요?")) return;
      Store.resetAll();
      location.reload();
    });

    setLoading(100);
    setTimeout(hideLoading, 250);
  }

  window.addEventListener("DOMContentLoaded", init);
})();
