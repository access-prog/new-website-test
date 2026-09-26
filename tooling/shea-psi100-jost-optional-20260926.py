#!/usr/bin/env python3
"""PSI-100 (fallback face limited to the Jost faces' unicode-range so glyphs Jost lacks keep the old fallback path; <select> keeps its old 'Jost',sans-serif stack because Chrome sizes the menulist box from every font in the stack): Jost font-display swap -> optional + size-matched local Arial fallback ('Jost Fallback').
Fast/normal loads: Jost (preloaded) is ready inside the optional block period -> identical render.
Slow first-time loads: text paints once in the metric-matched fallback, no late swap / reflow.
Overrides from fontTools vs /System Arial, weight-300 (body + LCP subtitle) frequency-weighted advance:
size-adjust 93.08%, ascent 114.96%, descent 40.29%, line-gap 0. Root *.html with the psi100 font block only."""
import glob, os, sys
ROOT = sys.argv[1] if len(sys.argv) > 1 else '.'
MARK = '/*psi100-jost-optional-20260926*/'
FACE_OLD = "@font-face{font-family:'Jost';font-style:normal;font-weight:300 600;font-display:swap;"
FACE_NEW = "@font-face{font-family:'Jost';font-style:normal;font-weight:300 600;font-display:optional;"
FALLBACK = (MARK + "@font-face{font-family:'Jost Fallback';src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('Arimo');"
            "font-weight:300 600;size-adjust:93.08%;ascent-override:114.96%;descent-override:40.29%;line-gap-override:0%;unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF,U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}select{font-family:\"Jost\",sans-serif!important}")
BLOCK_START = "<style>/*psi100-fonts-20260926*/"
n = 0
for f in sorted(glob.glob(os.path.join(ROOT, '*.html'))):
    s = open(f, encoding='utf-8', newline='').read()
    if MARK in s or BLOCK_START not in s: continue
    assert s.count(BLOCK_START) == 1 and s.count(FACE_OLD) == 2, f
    s = s.replace(FACE_OLD, FACE_NEW)
    s = s.replace(BLOCK_START, BLOCK_START + FALLBACK)
    k = s.count("font-family:'Jost'")
    assert k > 0, f
    s = s.replace("font-family:'Jost'", "font-family:'Jost','Jost Fallback'")
    # the two @font-face rules above must keep the bare family name
    s = s.replace("@font-face{font-family:'Jost','Jost Fallback';", "@font-face{font-family:'Jost';")
    assert s.count("@font-face{font-family:'Jost';") == 2, f
    open(f, 'w', encoding='utf-8', newline='').write(s); n += 1
print(n, 'files changed')
