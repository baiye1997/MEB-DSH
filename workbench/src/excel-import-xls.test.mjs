import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseLegacyWorkbook} from './excel-import-xls.js';

test('legacy XLS import keeps sheet names, Unicode cells and numeric values',async()=>{
 const sheets=parseLegacyWorkbook(await readFile(new URL('../test-fixtures/import.xls',import.meta.url)));
 assert.deepEqual(sheets.map(sheet=>sheet.name),['表0','表1']);
 assert.deepEqual(sheets[0].matrix.slice(0,3),[['长标题','数量'],['测试0','1'],['中文文本','2.5']]);
});
