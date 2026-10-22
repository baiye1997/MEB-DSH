"""Render numbered, bounded CAD linework for DSH review; never infer a building identity."""
import json
import math
import sys
from html import escape
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

import ezdxf
from ezdxf import path as dxf_path
from ezdxf.disassemble import recursive_decompose
from ezdxf.lldxf.const import DXFInvalidLineType, DXFStructureError

extractor_spec = spec_from_file_location('dwg_extract', Path(__file__).with_name('dwg-extract.py'))
extractor_module = module_from_spec(extractor_spec)
extractor_spec.loader.exec_module(extractor_module)
extract = extractor_module.extract


def drawing_points(entity, scale):
    kind = entity.dxftype()
    if kind == 'LINE':
        return [(entity.dxf.start.x, entity.dxf.start.y), (entity.dxf.end.x, entity.dxf.end.y)]
    if kind == 'LWPOLYLINE':
        if entity.has_arc:
            return [(p.x, p.y) for p in dxf_path.make_path(entity).flattening(distance=0.25 / scale, segments=8)][:600]
        return [(p[0], p[1]) for p in entity.get_points()][:600]
    if kind == 'POLYLINE' and entity.is_2d_polyline:
        return [(v.dxf.location.x, v.dxf.location.y) for v in entity.vertices][:600]
    if kind in ('ARC', 'CIRCLE'):
        return [(p.x, p.y) for p in dxf_path.make_path(entity).flattening(distance=0.25 / scale, segments=8)][:600]
    return []


def render(path, selected, source_name='DWG'):
    review = extract(path)
    if not selected or len(selected) > 24 or len(set(selected)) != len(selected):
        raise ValueError('Choose 1 to 24 distinct candidate numbers')
    if any(not isinstance(n, int) or n < 1 or n > len(review['candidates']) for n in selected):
        raise ValueError('Candidate number is outside this drawing')
    scale = {'mm': .001, 'cm': .01, 'm': 1}[review['units']]
    ox, oy = review['origin']
    tiles = []
    for number in selected:
        candidate = review['candidates'][number - 1]
        points = candidate['points']
        xs, ys = [p[0] for p in points], [p[1] for p in points]
        margin = max(6, max(max(xs) - min(xs), max(ys) - min(ys)) * .22)
        tiles.append(dict(number=number, candidate=candidate,
                          frame=(min(xs) - margin, min(ys) - margin, max(xs) + margin, max(ys) + margin),
                          paths=[]))
    doc = ezdxf.readfile(path)
    for root in doc.modelspace():
        try:
            entities = recursive_decompose((root,))
            for entity in entities:
                if all(len(tile['paths']) >= 2200 for tile in tiles):
                    break
                try:
                    points = drawing_points(entity, scale)
                except (AttributeError, ValueError, TypeError, ZeroDivisionError):
                    continue
                if len(points) < 2 or not all(math.isfinite(x) and math.isfinite(y) for x, y in points):
                    continue
                local = [((x * scale) - ox, (y * scale) - oy) for x, y in points]
                bx0 = min(x for x, _ in local)
                by0 = min(y for _, y in local)
                bx1 = max(x for x, _ in local)
                by1 = max(y for _, y in local)
                for tile in tiles:
                    if len(tile['paths']) >= 2200:
                        continue
                    x0, y0, x1, y1 = tile['frame']
                    if bx1 < x0 or bx0 > x1 or by1 < y0 or by0 > y1:
                        continue
                    tile['paths'].append(local)
        except (DXFStructureError, DXFInvalidLineType, ZeroDivisionError):
            continue

    pages = []
    for start in range(0, len(tiles), 6):
        page = tiles[start:start + 6]
        page_width = 1600 if len(page) > 1 else 812
        height = 84 + math.ceil(len(page) / 2) * 522 + 38
        svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{page_width}" height="{height}" viewBox="0 0 {page_width} {height}">',
               f'<rect width="{page_width}" height="{height}" fill="#eef2f7"/>',
               f'<text x="32" y="47" font-family="sans-serif" font-size="23" font-weight="700" fill="#152536">{escape(source_name[:52])} · 候选轮廓</text>',
               *([f'<text x="{page_width - 32}" y="46" text-anchor="end" font-family="sans-serif" font-size="16" fill="#526173">红色为候选轮廓；图像不能证明楼栋身份</text>'] if page_width > 1000 else [])]
        for slot, tile in enumerate(page):
            left = 24 + (slot % 2) * 788
            top = 68 + (slot // 2) * 522
            x0, y0, x1, y1 = tile['frame']
            factor = min(724 / max(x1 - x0, .01), 398 / max(y1 - y0, .01))
            px = lambda x: left + 32 + (x - x0) * factor
            py = lambda y: top + 445 - (y - y0) * factor
            clip = f'cad-review-{start + slot}'
            c = tile['candidate']
            svg += [f'<rect x="{left}" y="{top}" width="764" height="502" rx="13" fill="#fff" stroke="#b9c8d7"/>',
                    f'<text x="{left + 24}" y="{top + 33}" font-family="sans-serif" font-size="21" font-weight="700" fill="#152536">#{tile["number"]} · {c["width"]} × {c["depth"]} m</text>',
                    f'<text x="{left + 742}" y="{top + 32}" text-anchor="end" font-family="sans-serif" font-size="13" fill="#617083">{escape(c.get("sheetHint") or c["layer"][:52])}</text>',
                    f'<defs><clipPath id="{clip}"><rect x="{left + 20}" y="{top + 48}" width="724" height="398"/></clipPath></defs>',
                    f'<g clip-path="url(#{clip})">']
            for points in tile['paths']:
                coords = ' '.join(f'{px(x):.1f},{py(y):.1f}' for x, y in points)
                svg.append(f'<polyline points="{coords}" fill="none" stroke="#536679" stroke-width="1" opacity=".62"/>')
            focus = ' '.join(f'{px(x):.1f},{py(y):.1f}' for x, y in c['points'])
            svg += [f'<polygon points="{focus}" fill="#e45e58" fill-opacity=".14" stroke="#c73532" stroke-width="3.2" stroke-linejoin="round"/>', '</g>']
            notes = ' · '.join(item['text'] for item in c.get('localAnnotations', [])[:2])
            footer = f'附近解析文字（仅作线索）：{notes}' if notes else '无可靠附近文字；绑定图可能叠印多层，请对照完整原图。'
            svg.append(f'<text x="{left + 24}" y="{top + 477}" font-family="sans-serif" font-size="15" fill="#526173">{escape(footer[:72])}</text>')
        svg += [f'<text x="32" y="{height - 13}" font-family="sans-serif" font-size="13" fill="#617083">编号与本次 DWG 提取候选列表一致 · 第 {start // 6 + 1} / {math.ceil(len(tiles) / 6)} 页 · 缺失块 {review["skippedBlocks"]} 处</text>', '</svg>']
        pages.append(''.join(svg))
    return dict(candidateNumbers=selected, sourceCandidates=len(review['candidates']), pages=pages,
                skippedBlocks=review['skippedBlocks'])


if __name__ == '__main__':
    print(json.dumps(render(sys.argv[1], json.loads(sys.argv[2]), sys.argv[3] if len(sys.argv) > 3 else 'DWG'), ensure_ascii=False))
