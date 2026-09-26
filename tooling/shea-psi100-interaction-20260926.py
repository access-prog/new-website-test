#!/usr/bin/env python3
"""PSI-100 round 3 (Dylan, 2026-09-26): GA4 gtag.js + OpenAI pixel load ONLY on the first
pointerdown/keydown/touchstart/scroll (passive, once). Removes the 4 s after-load timer added in 746c9d1.
Stubs + inline config/event calls unchanged. Root *.html only; thank-you/ and Blog/ untouched."""
import glob, os, sys
ROOT = sys.argv[1] if len(sys.argv) > 1 else '.'
OLD = "/*psi100-tagdelay-20260926*/['pointerdown','keydown','touchstart','scroll'].forEach(function(x){addEventListener(x,L,{once:true,passive:true});});function O(){setTimeout(L,4000);}if(document.readyState==='complete'){O();}else{addEventListener('load',O);}})();"
NEW = "/*psi100-interaction-only-20260926*/['pointerdown','keydown','touchstart','scroll'].forEach(function(x){addEventListener(x,L,{once:true,passive:true});});})();"
n = 0
for f in sorted(glob.glob(os.path.join(ROOT, '*.html'))):
    s = open(f, encoding='utf-8', newline='').read()
    c = s.count(OLD)
    if not c: continue
    assert c in (1, 2), (f, c)
    open(f, 'w', encoding='utf-8', newline='').write(s.replace(OLD, NEW)); n += 1
print(n, 'files changed')
