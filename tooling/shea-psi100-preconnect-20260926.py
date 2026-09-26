#!/usr/bin/env python3
"""PSI-100: drop the two preconnects PSI flags as unused now that GA4 loads on interaction only
(googletagmanager.com, google-analytics.com). Root *.html only; thank-you/ (eager tags) and Blog/ untouched.
Each line removed whole (leading indent + trailing newline), exactly once per file, asserted."""
import glob, os, re, sys
ROOT = sys.argv[1] if len(sys.argv) > 1 else '.'
PATS = [re.compile(r'[ \t]*<link rel="preconnect" href="https://www\.googletagmanager\.com">\r?\n'),
        re.compile(r'[ \t]*<link rel="preconnect" href="https://www\.google-analytics\.com">\r?\n')]
n = 0
for f in sorted(glob.glob(os.path.join(ROOT, '*.html'))):
    s = open(f, encoding='utf-8', newline='').read()
    hits = [len(p.findall(s)) for p in PATS]
    if hits == [0, 0]: continue
    assert hits == [1, 1], (f, hits)
    for p in PATS: s = p.sub('', s, count=1)
    open(f, 'w', encoding='utf-8', newline='').write(s); n += 1
print(n, 'files changed')
