import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_IMPORT_COLUMNS,MAX_IMPORT_ROWS,parseDelimited} from './excel-import-format.js';

test('delimited import preserves quoted commas, newlines and escaped quotes',()=>{
 assert.deepEqual(parseDelimited('name,detail\n"A,1","line 1\nline 2"\n"say ""yes""",ok'),[['name','detail'],['A,1','line 1\nline 2'],['say "yes"','ok']]);
 assert.deepEqual(parseDelimited('a\tb\r\n1\t2','\t'),[['a','b'],['1','2']]);
});

test('delimited import rejects oversized shapes and unclosed quotes',()=>{
 assert.throws(()=>parseDelimited('x'.repeat(MAX_IMPORT_COLUMNS+1).replaceAll('x', 'x,')),/最多支持/);
 assert.throws(()=>parseDelimited(Array.from({length:MAX_IMPORT_ROWS+1},()=> 'x').join('\n')),/最多支持/);
 assert.throws(()=>parseDelimited('"未闭合,1'),/引号不完整/);
});
