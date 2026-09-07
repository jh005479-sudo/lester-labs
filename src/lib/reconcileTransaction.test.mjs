import assert from 'node:assert/strict'
import { test } from 'node:test'
import { keccak256 } from 'viem'
import { reconcileTransaction } from './reconcileTransaction.ts'
import { hasUnresolvedDuplicate } from './transactionHistory.ts'
const entry = { id:'pending', chainId:4441, account:`0x${'1'.repeat(40)}`, target:`0x${'2'.repeat(40)}`, hash:`0x${'3'.repeat(64)}`, inputHash:keccak256('0x1234'), value:'0', action:'createToken', stage:'submitted',createdAt:1,updatedAt:1 }
const client = {
  getTransactionReceipt: async()=>({from:entry.account,to:entry.target,blockNumber:10n,blockHash:'block10',status:'success'}),
  getBlockNumber:async()=>11n, getBlock:async()=>({hash:'block10'}), getTransaction:async()=>({input:'0x1234',value:0n}),
}
test('confirmed receipts reconcile after a reload and two blocks without submitting anything', async()=> {
  assert.equal((await reconcileTransaction({...entry},client)).stage,'confirmed')
  assert.equal((await reconcileTransaction(entry,{...client,getTransactionReceipt:async()=>({...await client.getTransactionReceipt(),status:'reverted'})})).stage,'reverted')
})
test('RPC failure, unconfirmed, reorg, wrong sender and different input remain unresolved',async()=>{
  for(const changed of [
    {getTransactionReceipt:async()=>{throw new Error('unavailable')}},
    {getBlockNumber:async()=>10n}, {getBlock:async()=>({hash:'other'})},
    {getTransactionReceipt:async()=>({...await client.getTransactionReceipt(),from:entry.target})},
    {getTransaction:async()=>({input:'0x5678',value:0n})},
    {getTransaction:async()=>({input:'0x1234',value:1n})},
  ]) assert.equal(await reconcileTransaction(entry,{...client,...changed}),null)
})
test('unresolved identical transactions block duplicate retries, while confirmed and different amounts do not',()=> {
  assert.equal(hasUnresolvedDuplicate([entry],entry),true)
  assert.equal(hasUnresolvedDuplicate([{...entry,stage:'unknown'}],entry),true)
  assert.equal(hasUnresolvedDuplicate([{...entry,stage:'confirmed'}],entry),false)
  assert.equal(hasUnresolvedDuplicate([entry],{...entry,value:'1'}),false)
})

test('a confirmed token receipt restores the project after the wizard has closed', async()=> {
  const { TOKEN_FACTORY_ADDRESS } = await import('../config/contracts.ts')
  const { encodeEventTopics, encodeAbiParameters, parseAbiItem } = await import('viem')
  const token = `0x${'9'.repeat(40)}`
  const log = {address:TOKEN_FACTORY_ADDRESS, topics:encodeEventTopics({abi:[parseAbiItem('event TokenCreated(address indexed tokenAddress,address indexed creator,string name,string symbol)')],eventName:'TokenCreated',args:{tokenAddress:token,creator:entry.account}}),data:encodeAbiParameters([{type:'string'},{type:'string'}],['Recovered project','REC'])}
  const update=await reconcileTransaction({...entry,target:TOKEN_FACTORY_ADDRESS},{...client,getTransactionReceipt:async()=>({...await client.getTransactionReceipt(),to:TOKEN_FACTORY_ADDRESS,logs:[log]})})
  assert.equal(update.asset,token)
  assert.equal(update.projectName,'Recovered project')
})
