"""Package the Kiko layer kit for the web: crop, downscale, WebP, and a rig file.

usage: python3 tools/build_rig.py path/to/kiko-phase1-kit   (needs Pillow)
Writes assets/rig/*.webp and kiko-rig.js next to this tools/ folder.
"""
import json, os, sys
from PIL import Image

KIT = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
man = json.load(open(f"{KIT}/assets/kiko/manifest.json"))
# Crop the shared canvas to Kiko plus room for motion; keep a 5:6 frame.
CX0, CY0, CX1, CY1 = 180, 80, 1210, 1316
CW, CH = CX1 - CX0, CY1 - CY0
SCALE = 0.5
pct = lambda v, total: round(v / total * 100, 3)

layers, groups = [], {}
for n in man["nodes"]:
    piv = n["pivot"]
    entry = {"id": n["id"], "parent": n["parent"], "pivot": [pct(piv[0] - CX0, CW), pct(piv[1] - CY0, CH)]}
    if n["type"] == "group":
        groups[n["id"]] = entry
        continue
    im = Image.open(f"{KIT}/{n['file']}").convert("RGBA")
    bx0, by0, bx1, by1 = im.getbbox()
    bx0, by0, bx1, by1 = max(bx0 - 3, CX0), max(by0 - 3, CY0), min(bx1 + 3, CX1), min(by1 + 3, CY1)
    part = im.crop((bx0, by0, bx1, by1))
    part = part.resize((max(1, round(part.width * SCALE)), max(1, round(part.height * SCALE))), Image.LANCZOS)
    part.save(f"{OUT}/assets/rig/{n['id']}.webp", quality=88, method=6)
    entry.update(z=n["z"], box=[pct(bx0 - CX0, CW), pct(by0 - CY0, CH), pct(bx1 - bx0, CW), pct(by1 - by0, CH)])
    if "variant" in n:
        entry["variant"] = n["variant"]
    layers.append(entry)

layers.sort(key=lambda l: l["z"])
rig = {"aspect": [CW, CH], "groups": groups, "layers": layers, "limitsRad": man["recommendedRotationLimitsRadians"]}
with open(f"{OUT}/kiko-rig.js", "w") as f:
    f.write("/* Kiko's puppet rig, generated from the Phase 1 layer kit (assets/kiko/manifest.json).\n"
            " * Positions and pivots are percentages of a 5:6 frame cropped from the kit's 1505×1405 canvas.\n"
            " * Regenerate rather than editing by hand. */\n")
    f.write("const KIKO_RIG = " + json.dumps(rig, ensure_ascii=False, indent=1) + ";\n")
print("layers", len(layers), "groups", list(groups), "frame", CW, CH)
