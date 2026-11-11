const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DAILY_CHALLENGE_MODIFIERS, getDailyChallengeModifierIds, formatPlayTime } = require('../js/game-utils.js');

const root = path.resolve(__dirname, '..');

test('daily modifiers are deterministic, supported, and unique per seed', () => {
    const combinations = new Set();
    for (const seed of [0, 1, 20260101, 0xffffffff]) {
        const selected = getDailyChallengeModifierIds(seed);
        assert.equal(selected.length, 2);
        assert.equal(new Set(selected).size, 2);
        assert.deepEqual(selected, getDailyChallengeModifierIds(seed));
        assert.ok(selected.every(id => DAILY_CHALLENGE_MODIFIERS.some(modifier => modifier.id === id)));
        combinations.add(selected.sort().join(','));
    }
    assert.ok(combinations.size > 1);
});

test('play time formatting handles seconds, minutes, and hours', () => {
    assert.equal(formatPlayTime(0), '0 min 00 s');
    assert.equal(formatPlayTime(125), '2 min 05 s');
    assert.equal(formatPlayTime(3600), '1 h 00 min');
    assert.equal(formatPlayTime(3665), '1 h 01 min');
    assert.equal(formatPlayTime(Number.NaN), '0 min 00 s');
});

test('shop audit compares the complete rendered product id set', () => {
    const catalogue = fs.readFileSync(path.join(root, 'js/secondary-missions.js'), 'utf8');
    const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const expected = [...catalogue.matchAll(/^\s*'([^']+)',?$/gm)].map(match => match[1]);
    const rendered = [...page.matchAll(/data-product-id="([^"]+)"/g)].map(match => match[1]);
    assert.equal(expected.length, 18);
    assert.deepEqual([...rendered].sort(), [...expected].sort());
    assert.match(fs.readFileSync(path.join(root, 'js/save-progression.js'), 'utf8'), /renderedProductIdSet\.size === renderedProductIds\.length/);
    assert.match(fs.readFileSync(path.join(root, 'js/save-progression.js'), 'utf8'), /\.every\(id => renderedProductIdSet\.has\(id\)\)/);
});

test('active play time is counted only in focused, visible gameplay', () => {
    const runtime = fs.readFileSync(path.join(root, 'js/game-runtime.js'), 'utf8');
    assert.match(runtime, /if \(gameState !== 'PLAYING'\) return;\s*if \(!document\.hidden && document\.hasFocus\(\)\)/);
    assert.match(runtime, /phase3Stats\.playSeconds \+= elapsedSeconds/);
});

test('cloud saves use explicit owner-only RLS and no service role key', () => {
    const schema = fs.readFileSync(path.join(root, 'supabase-schema.sql'), 'utf8');
    const config = fs.readFileSync(path.join(root, 'js/supabase-config.js'), 'utf8');
    assert.match(schema, /enable row level security/i);
    assert.equal((schema.match(/auth\.uid\(\).*user_id/gi) || []).length >= 2, true);
    assert.doesNotMatch(config, /service_role/i);
});
