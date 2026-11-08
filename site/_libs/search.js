(function () {
  var panel = document.getElementById("lessons-panel");
  if (panel) {
    var wide = window.matchMedia("(min-width: 1100px)");
    var fitPanel = function () { panel.open = wide.matches; };
    wide.addEventListener("change", fitPanel);
    fitPanel();

    var currentPath = window.location.pathname.replace(/index\.html$/, "");
    var active = Array.prototype.find.call(panel.querySelectorAll("a"), function (link) {
      return link.pathname === currentPath;
    });
    if (active) {
      active.classList.add("active");
      active.setAttribute("aria-current", "page");
      var headings = document.querySelectorAll("main h2[id]");
      if (active.closest(".side-lessons") && headings.length) {
        var topics = document.createElement("ul");
        topics.className = "side-topics";
        headings.forEach(function (heading) {
          var item = document.createElement("li");
          var link = document.createElement("a");
          link.href = "#" + heading.id;
          link.textContent = heading.textContent;
          item.appendChild(link);
          topics.appendChild(item);
        });
        active.parentNode.appendChild(topics);
      }
      panel.scrollTop = Math.max(0, active.offsetTop - panel.clientHeight / 3);
    }
  }

  var fontSelect = document.getElementById("font-select");
  fontSelect.value = document.documentElement.dataset.font;
  fontSelect.addEventListener("change", function () {
    document.documentElement.dataset.font = fontSelect.value;
    try { localStorage.setItem("reading-font", fontSelect.value); } catch (e) {}
  });

  function caseClass(text) {
    var label = text.trim().toLowerCase();
    if (/^nom(inative|\.|\b)/.test(label)) return "case-nom";
    if (/^gen(itive|\.|\b)/.test(label)) return "case-gen";
    if (/^part(itive|\.|\b)/.test(label)) return "case-par";
    return "";
  }

  document.querySelectorAll("main table").forEach(function (table) {
    var rows = Array.prototype.slice.call(table.rows);
    if (!rows.length) return;
    var columns = Array.prototype.map.call(rows[0].cells, function (cell) {
      var name = caseClass(cell.textContent);
      if (name) cell.classList.add(name);
      return name;
    });
    rows.slice(1).forEach(function (row) {
      var first = row.cells[0];
      var rowCase = first && first.textContent.length < 25 ? caseClass(first.textContent) : "";
      if (rowCase) first.classList.add(rowCase);
      Array.prototype.forEach.call(row.cells, function (cell, index) {
        var name = columns[index] || rowCase;
        if (name) cell.classList.add(name);
      });
    });
  });

  var scriptUrl = document.currentScript.src;
  var base = scriptUrl.slice(0, scriptUrl.indexOf("/libs/search.js"));
  var input = document.getElementById("search-input");
  var box = document.getElementById("search-results");
  var entries = null;

  function fold(s) {
    return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function load() {
    if (entries) return Promise.resolve();
    return fetch(base + "/assets/search-index.json")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        entries = data.map(function (e) {
          e.foldedTitle = fold(e.title);
          e.foldedText = fold(e.text);
          return e;
        });
      });
  }

  function snippet(entry, term) {
    var at = term ? entry.foldedText.indexOf(term) : -1;
    if (at < 0) return entry.text.slice(0, 90);
    var start = Math.max(0, at - 35);
    return (start > 0 ? "…" : "") + entry.text.slice(start, at + 65) + "…";
  }

  function find(query) {
    var section = query.match(/^\s*(?:§+|ss)?\s*(\d{1,3})\s*$/i);
    if (section) {
      var n = Number(section[1]);
      return entries.filter(function (e) { return e.secs.indexOf(n) >= 0; })
        .map(function (e) { return { e: e, section: n }; });
    }
    var terms = fold(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return entries.map(function (e) {
      var score = 0;
      for (var i = 0; i < terms.length; i++) {
        var inTitle = e.foldedTitle.indexOf(terms[i]) >= 0;
        if (!inTitle && e.foldedText.indexOf(terms[i]) < 0) return null;
        score += inTitle ? 3 : 1;
      }
      return { e: e, score: score, term: terms[0] };
    }).filter(Boolean).sort(function (a, b) {
      return b.score - a.score || a.e.lesson - b.e.lesson;
    }).slice(0, 25);
  }

  function render() {
    if (!entries) return;
    var query = input.value;
    if (!query.trim()) { box.hidden = true; return; }
    var results = find(query);
    box.innerHTML = results.length ? results.map(function (r) {
      var url = base + (r.section ? r.e.url.split("#")[0] + "#s-" + r.section : r.e.url);
      return '<a href="' + url + '"><span class="result-title">' + escapeHtml(r.e.title) +
        (r.section ? " (§ " + r.section + ")" : "") + '</span><span class="result-meta">' +
        escapeHtml(r.e.lessonTitle) + '</span><span class="result-snippet">' +
        escapeHtml(snippet(r.e, r.term)) + "</span></a>";
    }).join("") : '<div class="no-results">No matches</div>';
    box.hidden = false;
  }

  input.addEventListener("focus", load);
  input.addEventListener("input", function () { load().then(render); });
  input.addEventListener("keydown", function (event) {
    if (event.key === "Escape") { box.hidden = true; input.blur(); }
    if (event.key === "Enter") {
      var first = box.querySelector("a");
      if (first) window.location.href = first.href;
    }
  });
  document.addEventListener("click", function (event) {
    if (!event.target.closest(".search")) box.hidden = true;
  });
})();
