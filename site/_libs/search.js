(function () {
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
