// js/ui.js
(() => {
  const UI = {};

  UI.q  = (sel, el=document) => el.querySelector(sel);
  UI.qq = (sel, el=document) => Array.from(el.querySelectorAll(sel));

  UI.el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  UI.setModal = (modalEl, on) => {
    if (!modalEl) return;
    modalEl.classList.toggle("on", !!on);
  };

  UI.Log = (() => {
    let box = null;
    function init(el){ box = el; }
    function add(text, dim=false){
      if (!box) return;
      const p = UI.el("div", "logline" + (dim ? " dim" : ""), text);
      box.appendChild(p);
      box.scrollTop = box.scrollHeight;
    }
    function clear(){
      if (!box) return;
      box.innerHTML = "";
    }
    return { init, add, clear };
  })();

  window.UI = UI;
})();
