import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeActivityLog, normalizeArchiveCursor, parseActivityCursor } from './activityIndex.ts'
import { rankWithinQuote, underlyingLPAmount } from './dexCharts.ts'
import { readBoundedJson } from './httpBounds.ts'
const address = `0x${'1'.repeat(40)}`
const topic = `0x${'2'.repeat(64)}`
const log = { address: { hash: address }, transaction_hash: `0x${'3'.repeat(64)}`, block_hash: `0x${'4'.repeat(64)}`, block_number: 10, index: 2, topics: [topic, null, null, null], data: '0x00' }
test('archive normalization preserves identity and rejects malformed or wrong-source records', () => {
  assert.equal(normalizeActivityLog(log, address, topic).blockHash, log.block_hash)
  for (const change of [{ address: {hash:`0x${'5'.repeat(40)}`} }, {topics:[topic,'bad']}, {topics:[topic,null,topic]}, {block_number:1.1}, {transaction_hash:'0x'}, {data:'0x0'}, {block_hash:null}]) assert.equal(normalizeActivityLog({...log,...change},address,topic),null)
})
test('archive pagination accepts the repeated fixed topic and rejects arbitrary cursor fields', () => {
  assert.deepEqual(normalizeArchiveCursor({block_number:10,index:2,items_count:50,topic},topic), {block_number:10,index:2,items_count:50})
  for (const input of ['{"url":"https://example.com"}', '{"block_number":-1}', '[1]', '{"index":1.5}']) assert.throws(()=>parseActivityCursor(input))
  assert.throws(()=>normalizeArchiveCursor({topic:`0x${'6'.repeat(64)}`},topic))
})
test('liquidity rankings compare the same quote asset and discard non-finite values', () => {
  const a={id:'a',quote:{address}, liquidity:4}, b={id:'b',quote:{address},liquidity:9}
  const other={id:'c',quote:{address:`0x${'7'.repeat(40)}`},liquidity:100000}
  assert.deepEqual(rankWithinQuote([a,other,b,{...a,liquidity:Infinity}],address,(entry)=>entry.liquidity).map(entry=>entry.id),['b','a'])
})
test('LP ownership math keeps precision across unequal token decimals', () => {
  assert.equal(underlyingLPAmount(5n*10n**18n,1000n*10n**6n,20n*10n**18n),250n*10n**6n)
  assert.equal(underlyingLPAmount(1n,10n**36n,3n),10n**36n/3n)
  assert.throws(()=>underlyingLPAmount(1n,1n,0n))
  assert.throws(()=>underlyingLPAmount(2n,1n,1n))
})
test('bounded JSON reading rejects oversized and malformed response data', async () => {
  assert.deepEqual(await readBoundedJson(new Response('{"ok":true}'),100),{ok:true})
  await assert.rejects(()=>readBoundedJson(new Response('x'.repeat(100)),20))
  await assert.rejects(()=>readBoundedJson(new Response('{bad'),20))
})
