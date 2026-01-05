// js/storage.js
(() => {
  const Store = {};
  const KEY_OC = "LISIM_OC_V1";
  const KEY_LOBBY = "LISIM_LOBBY_V1";

  Store.loadOC = () => {
    try { return JSON.parse(localStorage.getItem(KEY_OC) || "[]"); }
    catch { return []; }
  };
  Store.saveOC = (arr) => {
    localStorage.setItem(KEY_OC, JSON.stringify(arr || []));
  };
  Store.clearOC = () => {
    localStorage.removeItem(KEY_OC);
  };

  Store.loadLobby = () => {
    try { return JSON.parse(localStorage.getItem(KEY_LOBBY) || "null"); }
    catch { return null; }
  };
  Store.saveLobby = (obj) => {
    localStorage.setItem(KEY_LOBBY, JSON.stringify(obj || null));
  };
  Store.clearLobby = () => {
    localStorage.removeItem(KEY_LOBBY);
  };

  Store.resetAll = () => {
    Store.clearOC();
    Store.clearLobby();
  };

  window.Store = Store;
})();
