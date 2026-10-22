"""Extract reviewable building-footprint candidates from a converted DXF.

The CAD file is read-only. No candidate is treated as a verified building.
"""
import json
import math
import re
import sys
from itertools import chain, islice
from collections import Counter

import ezdxf
from ezdxf import path as dxf_path
from ezdxf.disassemble import recursive_decompose
from ezdxf.lldxf.const import DXFInvalidLineType, DXFStructureError


def area(points):
    return abs(sum(x * points[(i + 1) % len(points)][1] - points[(i + 1) % len(points)][0] * y
                   for i, (x, y) in enumerate(points)) / 2)


def sheet_hint(layer):
    parts = [part.strip() for part in layer.split('$0$')]
    return next((part[:80] for part in reversed(parts)
                 if any(word in part for word in ('平面图', '总平面', '立面图', '剖面图'))), '')


def height_hint(label):
    return bool(re.search(r'层高|层数|建筑高度|檐口|屋面|标高|室外地坪|总高度|\d+\s*层|[±+−-]\s*\d+[.]\d+\b', label, re.I)
                or re.fullmatch(r'\(?\d{1,2}F\)?|\d{1,2}[.]\d{3}', label))


def extract(path):
    doc = ezdxf.readfile(path)
    skipped_blocks = 0

    def safe_entities():
        nonlocal skipped_blocks
        for root in doc.modelspace():
            # Provenance is local to the converted DXF, never the original DWG.
            root_handle = root.dxf.get('handle')
            try:
                for ordinal, entity in enumerate(recursive_decompose((root,))):
                    yield root_handle, ordinal, entity
            except (DXFStructureError, DXFInvalidLineType, ZeroDivisionError):
                # A broken external block must not hide the other sheets.
                skipped_blocks += 1

    entities = iter(safe_entities())
    head = list(islice(entities, 100))
    # $INSUNITS is frequently unset on real drawings. Report the assumption.
    unit = doc.units
    scale = {4: .001, 5: .01, 6: 1}.get(unit)
    if scale is None:
        # Do not claim this is verified; the UI lets the user switch units.
        sample = []
        for _, _, e in head:
            if e.dxftype() == 'LWPOLYLINE':
                sample.extend((p[0], p[1]) for p in list(e.get_points())[:2])
                if len(sample) >= 30:
                    break
        scale = .001 if sample and max(abs(v) for p in sample for v in p) > 100000 else 1
    candidates = []
    annotations = []
    counts = Counter()
    truncated = False
    for index, (root_handle, ordinal, entity) in enumerate(chain(head, entities)):
        if index >= 500000:
            truncated = True
            break
        kind = entity.dxftype()
        counts[kind] += 1
        if kind in ('TEXT', 'MTEXT', 'ATTRIB'):
            try:
                label = (entity.plain_text() if kind == 'MTEXT' else entity.dxf.text).strip()
                point = entity.dxf.insert
                if (2 <= len(label) <= 60 and (any('\u4e00' <= c <= '\u9fff' for c in label) or height_hint(label))
                        and math.isfinite(point.x) and math.isfinite(point.y)):
                    annotations.append((point.x, point.y, ' '.join(label.split())[:60], entity.dxf.layer))
            except (AttributeError, ValueError, TypeError):
                pass
        if kind not in ('LWPOLYLINE', 'POLYLINE'):
            continue
        try:
            if kind == 'LWPOLYLINE':
                if entity.has_arc:
                    points = [(float(p.x), float(p.y)) for p in dxf_path.make_path(entity).flattening(distance=.2 / scale, segments=4)]
                else:
                    points = [(float(p[0]), float(p[1])) for p in entity.get_points()]
            elif entity.is_2d_polyline:
                points = [(float(v.dxf.location.x), float(v.dxf.location.y)) for v in entity.vertices]
            else:
                continue
            if len(points) < 3 or len(points) > 180 or not all(math.isfinite(v) for p in points for v in p):
                continue
            if math.dist(points[0], points[-1]) < .01:
                points.pop()
            if len(points) < 3:
                continue
            width = (max(x for x, _ in points) - min(x for x, _ in points)) * scale
            depth = (max(y for _, y in points) - min(y for _, y in points)) * scale
            size = area(points) * scale * scale
            if not (4 <= width <= 350 and 4 <= depth <= 350 and 60 <= size <= 80000):
                continue
            length = sum(math.dist(points[i], points[i + 1]) for i in range(len(points) - 1))
            endpoint_distance = math.dist(points[0], points[-1])
            closed = bool(entity.is_closed or endpoint_distance * scale < .05)
            # A closed polyline has an implicit last-to-first edge, not an opening.
            gap = 0 if closed else endpoint_distance
            if not closed and gap > max(2 / scale, length * .15):
                continue
            layer = entity.dxf.layer
            upper = layer.upper()
            if any(s in upper for s in ('BTTK', '图框', 'TITLE', 'ANNO', 'TEXT', 'DIM', 'HATCH', 'RAIL', 'SITE-RADL', 'SITE-UG')):
                continue
            score = (8 if 'SITE-BLD' in upper else 6 if 'WALL' in upper else 3 if 'STRS' in upper else
                     5 if any(s in upper for s in ('建筑', '轮廓', '外墙', 'CONTOUR')) else -2 if layer == '0' else 0)
            score += 2 if closed else 1 if gap / max(length, 1) < .02 else -3
            score += 2 if 100 <= size <= 30000 else -2
            candidates.append(dict(index=index, layer=layer, points=points, width=round(width, 2),
                                   depth=round(depth, 2), area=round(size, 2),
                                   closed=closed, gap=round(gap * scale, 2), score=score,
                                   convertedDxfRootHandle=root_handle,
                                   decomposedEntityOrdinalWithinRoot=ordinal))
        except (AttributeError, ValueError, TypeError):
            continue
    candidates.sort(key=lambda c: (-c['score'], -c['area']))
    # Repeated nested block references can emit the same footprint many times.
    unique = []
    for item in candidates:
        bounds = [min(p[i] for p in item['points']) for i in (0, 1)] + [max(p[i] for p in item['points']) for i in (0, 1)]
        if any(all(abs(a - b) * scale < 1 for a, b in zip(bounds, other['_bounds'])) and
               abs(item['area'] - other['area']) < max(1, item['area'] * .03) for other in unique):
            continue
        item['_bounds'] = bounds
        unique.append(item)
        if len(unique) > 200:
            break
    candidate_limit_reached = len(unique) > 200
    unique = unique[:200]
    has_sheet_context = any(sheet_hint(item['layer']) for item in unique)
    if unique:
        origin = [min(c['_bounds'][i] for c in unique) for i in (0, 1)]
    else:
        origin = [0, 0]
    for item in unique:
        sheet = sheet_hint(item['layer'])
        if sheet:
            item['sheetHint'] = sheet[:80]
        x0, y0, x1, y1 = item['_bounds']
        pad = 3 / scale
        nearby = []
        for x, y, label, layer in annotations:
            if x0 - pad <= x <= x1 + pad and y0 - pad <= y <= y1 + pad:
                # A bound DWG may place several floor plans on the same coordinates.
                # Proximity alone must not attach basement notes to a first-floor outline.
                if has_sheet_context and (not sheet or sheet_hint(layer) != sheet):
                    continue
                upper = layer.upper()
                if any(word in upper for word in ('DOOR', 'GLAZ', 'DIMS', 'GRID', 'TITLE', '图框')):
                    continue
                distance = math.dist(((x0+x1)/2, (y0+y1)/2), (x, y)) * scale
                nearby.append((distance, label, layer))
        seen = set()
        labels = []
        for distance, label, layer in sorted(nearby):
            if label in seen:
                continue
            seen.add(label)
            labels.append(dict(text=label, layer=layer[:100], distance=round(distance, 1)))
            if len(labels) == 6:
                break
        if labels:
            item['localAnnotations'] = labels
        item.pop('_bounds')
        item['points'] = [[round((x - origin[0]) * scale, 4), round((y - origin[1]) * scale, 4)] for x, y in item['points']]
    reference_hints = []
    seen_hints = set()
    # Legend headings such as "标高符号及标高文字" describe notation, not a level.
    ordered_hints = sorted((entry for entry in annotations if height_hint(entry[2]) and
                            (re.search(r'\d', entry[2]) or re.search(r'[一二三四五六七八九十]+\s*层', entry[2]))),
                           key=lambda entry: bool(re.fullmatch(r'\d{1,2}[.]\d{3}', entry[2])))
    for _, _, label, layer in ordered_hints:
        if not height_hint(label) or (label, layer) in seen_hints:
            continue
        seen_hints.add((label, layer))
        reference_hints.append(dict(text=label, layer=layer[:100], sheetHint=sheet_hint(layer) or None))
        if len(reference_hints) == 40:
            break
    return dict(units='mm' if scale == .001 else 'cm' if scale == .01 else 'm',
                origin=[round(value * scale, 4) for value in origin],
                unitsConfirmed=unit in (4, 5, 6), candidates=unique,
                referenceHints=reference_hints,
                scanned=sum(counts.values()), truncated=truncated, skippedBlocks=skipped_blocks,
                candidateLimitReached=candidate_limit_reached)


if __name__ == '__main__':
    print(json.dumps(extract(sys.argv[1]), ensure_ascii=False, separators=(',', ':')))
