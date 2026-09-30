import test from 'node:test';
import assert from 'node:assert/strict';
import {riskPositionSize,detectRegime,evaluateAlertRule,createPaperTrade,closePaperTrade} from './proFeatures.js';
test('risk sizing respects risk budget',()=>{const r=riskPositionSize({capital:10000,riskPct:1,entry:200,stop:190});assert.equal(r.riskAmount,100);assert.equal(r.quantity,10);});
test('regime requires adequate observations',()=>assert.equal(detectRegime([100,101]).regime,'insufficient_data'));
test('alert rule evaluates thresholds',()=>assert.equal(evaluateAlertRule({field:'price',operator:'above',threshold:10},{price:11}).triggered,true));
test('paper trade computes long and short PnL',()=>{const t=createPaperTrade({side:'buy',entry:100,quantity:2});assert.equal(closePaperTrade(t,110).pnl,20);const s=createPaperTrade({side:'sell',entry:100,quantity:2});assert.equal(closePaperTrade(s,90).pnl,20);});
test('rejects invalid risk and trade inputs',()=>{assert.throws(()=>riskPositionSize({capital:10,riskPct:20,entry:5,stop:4}));assert.throws(()=>createPaperTrade({side:'hold',entry:5,quantity:1}));});
