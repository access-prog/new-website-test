/* bv-attr.js v1 (Bloomview, 2026-10-01) - first-touch lead attribution. Source of truth:
   ~/localdominator/attribution-kit/bv-attr.js. Rules mirror lead_sources.py classify_url/referrer.
   - FIRST touch in localStorage, written once, never overwritten. A visit with an origin signal
     (utm, click id, external referrer) writes it; a brand-new visitor with no signal is Direct.
     An internal click-through never writes anything.
   - Adds bv_channel / bv_landing / bv_evidence to every same-origin form POST and to the
     phone-click beacon, so the server log records how the person arrived. Never blocks a submit
     or a dial: every step is wrapped, and a failure simply sends the original payload. */
(function () {
  var K = "bv_ft", W = window, D = document;
  function host(u) { try { return new URL(u).hostname.toLowerCase(); } catch (e) { return ""; } }
  var own = location.hostname.toLowerCase().replace(/^www\./, "");
  function isOwn(h) { h = h.replace(/^www\./, ""); return h === own || h.slice(-own.length - 1) === "." + own; }
  function has(a, s) { for (var i = 0; i < a.length; i++) if (s.indexOf(a[i]) > -1) return true; return false; }
  var AI = ["chatgpt", "openai", "perplexity", "gemini.google", "copilot", "claude.ai", "you.com"];
  var SOC = ["facebook.", "instagram.", "t.co", "twitter.", "x.com", "linkedin.", "nextdoor.", "tiktok.", "youtube.", "pinterest.", "reddit."];
  var SE = ["bing.", "duckduckgo.", "yahoo.", "ecosia.", "brave.", "yandex.", "baidu."];

  function classify() {
    var q = {}, p = new URLSearchParams(location.search);
    p.forEach(function (v, k) { q[k.toLowerCase()] = v; });
    var camp = (q.utm_campaign || "").toLowerCase(), src = (q.utm_source || "").toLowerCase(),
        med = (q.utm_medium || "").toLowerCase();
    var gbp = camp.indexOf("gbp") === 0 || ["gbp", "gmb", "google_business", "googlebusiness"].indexOf(src) > -1;
    var click = ["gclid", "gbraid", "wbraid", "gad_source", "gad_campaignid"].filter(function (k) { return k in q; });
    if (click.length && gbp) return ["ambiguous", click[0] + " + " + camp];
    if (click.length) return ["google_ads", click[0]];
    if ("msclkid" in q) return ["bing_ads", "msclkid"];
    if (gbp) return ["gbp", "utm_campaign=" + (camp || src)];
    if (["cpc", "ppc", "paid", "paidsearch", "paid_search", "paid_social", "cpm"].indexOf(med) > -1) {
      if (["google", "adwords", "googleads"].indexOf(src) > -1) return ["google_ads", "utm " + src + "/" + med];
      if (["bing", "microsoft"].indexOf(src) > -1) return ["bing_ads", "utm " + src + "/" + med];
      if (["fb", "facebook", "ig", "instagram", "meta"].indexOf(src) > -1) return ["meta_ads", "utm " + src + "/" + med];
    }
    if (has(AI, src)) return ["ai_search", "utm_source=" + src];
    if (src === "google" && (med === "organic" || !med)) return ["google_search", "utm google/" + (med || "none")];
    if (["social", "organic_social", "bio"].indexOf(med) > -1 || ["fb", "facebook", "ig", "instagram"].indexOf(src) > -1) return ["social", "utm " + src + "/" + med];
    if (med === "email" || src === "email") return ["email", "utm " + src + "/" + med];
    if (src) return ["referral", "utm " + src + "/" + med];
    if ("fbclid" in q) return ["social", "fbclid"];
    var h = host(D.referrer);
    if (h && !isOwn(h)) {
      if (has(AI, h)) return ["ai_search", "referrer " + h];
      if (/(^|\.)google\.[a-z.]+$/.test(h)) return ["google_search", "referrer " + h];
      if (has(SE, h)) return ["other_search", "referrer " + h];
      if (has(SOC, h)) return ["social", "referrer " + h];
      return ["referral", "referrer " + h];
    }
    return null;                                   /* no origin signal on this page view */
  }

  var ft = null;
  try { ft = JSON.parse(localStorage.getItem(K) || "null"); } catch (e) {}
  try {
    var c = classify();
    var land = (location.pathname + location.search).slice(0, 190);
    if (!ft && c) ft = { c: c[0], e: c[1], l: land, t: Date.now() };
    else if (!ft && !(D.referrer && isOwn(host(D.referrer)))) ft = { c: "direct", e: "no referrer, no tags", l: land, t: Date.now() };
    if (ft) localStorage.setItem(K, JSON.stringify(ft));
  } catch (e) {}

  function fields() {
    if (!ft) return null;
    return { bv_channel: ft.c, bv_landing: String(ft.l || "").split("#")[0], bv_evidence: ft.e };
  }
  W.bvAttr = fields;

  /* phone-click beacon: append to whatever the page sends to the phone-click endpoint */
  try {
    var sb = navigator.sendBeacon && navigator.sendBeacon.bind(navigator);
    if (sb) navigator.sendBeacon = function (url, data) {
      try {
        var f = fields();
        if (f && /phone-click/.test(String(url))) {
          if (data instanceof URLSearchParams || data instanceof FormData) {
            data.append("ch", f.bv_channel); data.append("land", f.bv_landing); data.append("ev", f.bv_evidence);
          } else if (typeof data === "string" && data.indexOf("=") > -1 && data.charAt(0) !== "{") {
            data += "&ch=" + encodeURIComponent(f.bv_channel) + "&land=" + encodeURIComponent(f.bv_landing) + "&ev=" + encodeURIComponent(f.bv_evidence);
          }
        }
      } catch (e) {}
      return sb(url, data);
    };
  } catch (e) {}

  /* forms: hidden inputs on any same-origin POST, added in the capture phase before submit */
  D.addEventListener("submit", function (ev) {
    try {
      var fm = ev.target, f = fields();
      if (!f || !fm || (fm.method || "").toLowerCase() !== "post") return;
      var a = fm.getAttribute("action") || location.href;
      var h = host(new URL(a, location.href).href);
      if (h && !isOwn(h)) return;
      for (var k in f) {
        var i = fm.querySelector('input[name="' + k + '"]');
        if (!i) { i = D.createElement("input"); i.type = "hidden"; i.name = k; fm.appendChild(i); }
        i.value = f[k];
      }
    } catch (e) {}
  }, true);
})();
