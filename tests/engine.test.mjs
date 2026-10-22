import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generate, analyze, getModel, parseNumber } from '../dist/engine.js';

const { experiments } = JSON.parse(await readFile(new URL('../dist/tables.json', import.meta.url), 'utf8'));
const inputs = exp => exp.tables.flatMap(t => t.rows.flat()).filter(c => c.input);
const options = { seed: 'regression-v1', noise: 0.3, k: 2, bLimit: 0, mode: 'regenerate' };

test('13 个实验、33 张原表的全部 836 个输入项有有限输出且种子可复现', () => {
  assert.equal(experiments.length, 13);
  assert.equal(experiments.reduce((n, e) => n + e.tables.length, 0), 33);
  assert.equal(experiments.reduce((n, e) => n + inputs(e).length, 0), 836);
  for (const exp of experiments) {
    assert.equal(typeof getModel(exp.id).simulate, 'function');
    const first = generate(exp, {}, options), second = generate(exp, {}, options);
    assert.deepEqual(first.values, second.values, exp.id);
    assert.equal(first.stats.filledCount, inputs(exp).length, exp.id);
    for (const cell of inputs(exp)) {
      assert.notEqual(String(first.values[cell.id] ?? '').trim(), '', cell.id);
      assert.doesNotMatch(String(first.values[cell.id]), /NaN|Infinity/, cell.id);
    }
  }
});

test('再生成保留手动值，一键补全保留已有生成值，源状态不被修改', () => {
  for (const exp of experiments) {
    const original = generate(exp, {}, options), editable = inputs(exp);
    const lockedId = editable[0].id;
    const state = {
      values: { [lockedId]: original.values[lockedId] },
      locked: { [lockedId]: true }, provenance: { [lockedId]: 'manual' }
    };
    const snapshot = structuredClone(state);
    const result = generate(exp, state, { ...options, seed: 'another-seed' });
    assert.equal(result.values[lockedId], state.values[lockedId], exp.id);
    assert.deepEqual(state, snapshot, exp.id);
    const filled = generate(exp, { values: original.values, provenance: original.provenance }, { ...options, seed: 'new', mode: 'fill' });
    assert.deepEqual(filled.values, original.values, exp.id);
  }
});

test('迈克耳孙的两个已填位移约束可以反推 600 nm 波长', () => {
  const exp = experiments.find(e => e.id === 'exp08');
  const state = { values: { 'exp08-t1-r1c1': '10.00000', 'exp08-t1-r1c2': '10.01500' }, locked: { 'exp08-t1-r1c1': true, 'exp08-t1-r1c2': true } };
  const result = generate(exp, state, { ...options, noise: 0 });
  assert.ok(Math.abs(result.usedParameters.laser - 600) < 1e-6);
  assert.equal(result.values['exp08-t1-r1c6'], '10.07500');
  assert.equal(parseNumber(result.values['exp08-t1-r4c1']), 600);
});

test('参数改变后清除不再有效的旧模拟值，同时保留锁定读数和源状态', () => {
  const exp = experiments.find(e => e.id === 'exp14');
  const first = generate(exp, {}, options);
  const lockedId = 'exp14-t1-r1c1';
  const state = {
    values: { ...first.values, [lockedId]: '8.000000e14' },
    provenance: { ...first.provenance, [lockedId]: 'manual' },
    locked: { [lockedId]: true },
    params: { planck: 3, work: 2 }, fixedParams: { planck: true, work: true }
  };
  const snapshot = structuredClone(state);
  assert.equal(analyze(exp, state, options).values['exp14-t1-r1c2'], first.values['exp14-t1-r1c2']);
  const result = generate(exp, state, options);
  for (let r = 1; r <= 5; r++) {
    const cutoff = `exp14-t1-r${r}c2`;
    assert.ok(first.values[cutoff]);
    assert.equal(result.values[cutoff], undefined, cutoff);
    assert.equal(result.provenance[cutoff], undefined, cutoff);
  }
  assert.equal(result.values[lockedId], state.values[lockedId]);
  assert.equal(result.provenance[lockedId], 'manual');
  assert.equal(result.stats.filledCount, first.stats.filledCount - 5);
  assert.ok(result.warnings.some(w => w.includes('不能产生本模型中的光电发射')));
  assert.deepEqual(state, snapshot);
});

test('分光计案例保留双游标输入、满足合理上限，并报告不可达上限', () => {
  const exp = experiments.find(e => e.id === 'exp09');
  const state = {
    values: { 'exp09-t1-r3c1': '35°0′', 'exp09-t1-r3c2': '215°0′' },
    locked: { 'exp09-t1-r3c1': true, 'exp09-t1-r3c2': true },
    params: { apex: 60, grating: 600, angleResolution: 1 },
    fixedParams: { apex: true, grating: true, angleResolution: true }
  };
  const example = { ...options, seed: 'spectrometer-demo-01', targetU: 0.1, bLimit: 0.01 };
  const result = generate(exp, state, example);
  assert.equal(result.stats.filledCount, 52);
  assert.equal(result.stats.lockedCount, 2);
  assert.equal(result.stats.meetsTarget, true);
  assert.ok(Math.abs(result.stats.primary.mean - 60) < 0.1);
  assert.equal(result.values['exp09-t1-r3c1'], '35°0′');
  const impossible = generate(exp, state, { ...example, targetU: 0.001, bLimit: 1 });
  assert.equal(impossible.stats.meetsTarget, false);
  assert.ok(impossible.warnings.some(w => w.includes('无法达到')));
  assert.equal(impossible.values['exp09-t1-r3c2'], '215°0′');
});

test('空表不报告虚假的统计结果，角度输入不混淆十进制度与度分', () => {
  for (const exp of experiments) assert.equal(analyze(exp, {}, options).stats.primary, null, exp.id);
  assert.ok(Math.abs(parseNumber('35° 20′') - (35 + 20 / 60)) < 1e-9);
  assert.equal(parseNumber('35.20'), 35.2);
  assert.equal(parseNumber('35° 60′'), null);
});

test('负误差限、非法参数和非数字锁定读数被拒绝', () => {
  const exp = experiments.find(e => e.id === 'exp09');
  assert.throws(() => generate(exp, {}, { ...options, bLimit: -1 }), /不能为负/);
  assert.throws(() => generate(exp, { params: { apex: -5 } }, options), /有效范围/);
  assert.throws(() => generate(exp, { values: { 'exp09-t1-r3c1': 'bad' }, locked: { 'exp09-t1-r3c1': true } }, options), /有效数值/);
});
