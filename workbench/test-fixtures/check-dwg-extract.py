"""Run with workbench/.venv/bin/python after setup:cad."""
import importlib.util
import sys
import tempfile
from pathlib import Path

import ezdxf
from ezdxf.lldxf.const import DXFInvalidLineType

sys.dont_write_bytecode = True

source = Path(__file__).resolve().parents[1] / 'src' / 'dwg-extract.py'
spec = importlib.util.spec_from_file_location('dwg_extract', source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
evidence_source = source.with_name('dwg-evidence.py')
evidence_spec = importlib.util.spec_from_file_location('dwg_evidence', evidence_source)
evidence_module = importlib.util.module_from_spec(evidence_spec)
evidence_spec.loader.exec_module(evidence_module)

with tempfile.TemporaryDirectory() as directory:
    drawing = ezdxf.new()
    drawing.units = 4  # mm
    space = drawing.modelspace()
    space.add_blockref('MISSING-BLOCK', (0, 0))
    rectangle = [(0, 0), (40000, 0), (40000, 30000), (0, 30000)]
    space.add_lwpolyline(rectangle, close=True, dxfattribs={'layer': 'CLOSED-WALL'})
    space.add_text('教学楼', dxfattribs={'layer': 'A-ANNO', 'insert': (20000, 15000)})
    space.add_text('建筑高度 22.30m', dxfattribs={'layer': 'A-ANNO', 'insert': (90000, 15000)})
    space.add_text('+4.500', dxfattribs={'layer': 'A-LEVEL', 'insert': (90000, 16000)})
    space.add_text('8.400', dxfattribs={'layer': 'A-LEVEL', 'insert': (90000, 17000)})
    space.add_text('(4F)', dxfattribs={'layer': 'A-LEVEL', 'insert': (90000, 18000)})
    space.add_text('标高符号及标高文字', dxfattribs={'layer': 'A-ANNO-TABS', 'insert': (90000, 19000)})
    space.add_text('M1022', dxfattribs={'layer': 'A-DOOR-IDEN', 'insert': (20000, 15500)})
    almost_closed = [(100000, 0), (140000, 0), (140000, 30000),
                     (100000, 30000), (100000, 1000)]
    space.add_lwpolyline(almost_closed, dxfattribs={'layer': 'OPEN-WALL'})
    block = drawing.blocks.new('NESTED-FLOOR')
    block.add_lwpolyline(rectangle, close=True, dxfattribs={'layer': '项目$0$7 - 一层平面图$0$A-WALL'})
    block.add_text('教学楼一层', dxfattribs={'layer': '项目$0$7 - 一层平面图$0$A-ANNO', 'insert': (20000, 15000)})
    block.add_text('地下停车库', dxfattribs={'layer': '项目$0$6 - 地下室平面图$0$A-ANNO', 'insert': (20500, 15000)})
    space.add_blockref('NESTED-FLOOR', (200000, 0))
    path = Path(directory) / 'contours.dxf'
    drawing.saveas(path)
    result = module.extract(path)
    assert result['skippedBlocks'] == 1
    assert {hint['text'] for hint in result['referenceHints']} == {'建筑高度 22.30m', '+4.500', '8.400', '(4F)'}
    by_layer = {candidate['layer']: candidate for candidate in result['candidates']}
    assert by_layer['CLOSED-WALL']['gap'] == 0
    assert by_layer['CLOSED-WALL']['closed'] is True
    assert 'localAnnotations' not in by_layer['CLOSED-WALL']
    assert by_layer['OPEN-WALL']['gap'] == 1
    assert by_layer['OPEN-WALL']['closed'] is False
    nested = by_layer['项目$0$7 - 一层平面图$0$A-WALL']
    assert nested['sheetHint'] == '7 - 一层平面图'
    assert [label['text'] for label in nested['localAnnotations']] == ['教学楼一层']
    nested_root = next(insert for insert in space.query('INSERT') if insert.dxf.name == 'NESTED-FLOOR')
    assert nested['convertedDxfRootHandle'] == nested_root.dxf.handle and nested['decomposedEntityOrdinalWithinRoot'] == 0
    nested_number = next(i for i, candidate in enumerate(result['candidates'], 1) if candidate['layer'] == nested['layer'])
    evidence = evidence_module.render(path, [nested_number], '教学楼平面图.dwg')
    assert evidence['candidateNumbers'] == [nested_number]
    assert evidence['skippedBlocks'] == 1
    assert f'#{nested_number} ·' in evidence['pages'][0]
    assert '<polygon' in evidence['pages'][0]
    assert '教学楼平面图.dwg' in evidence['pages'][0]
    assert '教学楼一层' in evidence['pages'][0]
    try:
        evidence_module.render(path, [999])
    except ValueError:
        pass
    else:
        raise AssertionError('An unknown candidate number must be rejected')
    for index in range(210):
        x = 200000 + index * 50000
        space.add_lwpolyline([(x, 0), (x + 40000, 0),
                              (x + 40000, 30000), (x, 30000)],
                             close=True, dxfattribs={'layer': 'BUILDING-WALL'})
    drawing.saveas(path)
    limited = module.extract(path)
    assert len(limited['candidates']) == 200
    assert limited['candidateLimitReached'] is True

    # A malformed converted MLINE can fail while virtual entities are expanded.
    bad = ezdxf.new()
    bad.units = 4
    bad.modelspace().add_line((0, 0), (1, 1), dxfattribs={'layer': 'BAD-LINETYPE'})
    bad.modelspace().add_line((0, 0), (1, 1), dxfattribs={'layer': 'BAD-EXTRUSION'})
    bad.modelspace().add_lwpolyline(rectangle, close=True, dxfattribs={'layer': 'GOOD-WALL'})
    bad.saveas(path)
    decompose = module.recursive_decompose
    def fail_bad_linetype(entities):
        if entities[0].dxf.layer == 'BAD-LINETYPE':
            raise DXFInvalidLineType('Linetype "" not defined.')
        if entities[0].dxf.layer == 'BAD-EXTRUSION':
            raise ZeroDivisionError('invalid extrusion vector')
        yield from decompose(entities)
    module.recursive_decompose = fail_bad_linetype
    try:
        recovered = module.extract(path)
    finally:
        module.recursive_decompose = decompose
    assert recovered['skippedBlocks'] == 2
    assert recovered['candidates'][0]['layer'] == 'GOOD-WALL'

print('PASS: broken block recovery, numbered visual evidence, closure, nested sheet/annotation evidence, and the 200-candidate review limit.')
