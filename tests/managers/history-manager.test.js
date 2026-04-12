// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryManager } from '../../src/managers/history-manager.js';

describe('HistoryManager', () => {
  /** @type {HistoryManager} */
  let hm;

  beforeEach(() => {
    hm = new HistoryManager();
  });

  // ─── Basic turn lifecycle ──────────────────────

  it('starts with empty history', () => {
    expect(hm.getTurns()).toEqual([]);
    expect(hm.length).toBe(0);
  });

  it('records a simple turn with direction and score', () => {
    hm.beginTurn(1, 'up', 0);
    hm.finalizeTurn(12);

    const turns = hm.getTurns();
    expect(turns).toHaveLength(1);
    expect(turns[0].move).toBe(1);
    expect(turns[0].direction).toBe('up');
    expect(turns[0].scoreBefore).toBe(0);
    expect(turns[0].scoreAfter).toBe(12);
  });

  it('stores most recent turn first', () => {
    hm.beginTurn(1, 'left', 0);
    hm.finalizeTurn(4);
    hm.beginTurn(2, 'right', 4);
    hm.finalizeTurn(12);

    const turns = hm.getTurns();
    expect(turns).toHaveLength(2);
    expect(turns[0].move).toBe(2);
    expect(turns[1].move).toBe(1);
  });

  it('adds score entry when score increases', () => {
    hm.beginTurn(1, 'down', 10);
    hm.finalizeTurn(26);

    const entries = hm.getTurns()[0].entries;
    const scoreEntry = entries.find((e) => e.type === 'score');
    expect(scoreEntry).toBeDefined();
    expect(scoreEntry.points).toBe(16);
  });

  it('does not add score entry when score stays the same', () => {
    hm.beginTurn(1, 'up', 10);
    hm.addFusions([[4, 4]]);
    hm.finalizeTurn(10);

    const entries = hm.getTurns()[0].entries;
    expect(entries.find((e) => e.type === 'score')).toBeUndefined();
    expect(entries.find((e) => e.type === 'fusion')).toBeDefined();
  });

  // ─── Fusions ──────────────────────────────────

  it('records fusions', () => {
    hm.beginTurn(1, 'up', 0);
    hm.addFusions([
      [2, 2],
      [8, 8],
    ]);
    hm.finalizeTurn(20);

    const turn = hm.getTurns()[0];
    expect(turn.fusions).toBe(2);
    const fusionEntry = turn.entries.find((e) => e.type === 'fusion');
    expect(fusionEntry.pairs).toEqual([
      [2, 2],
      [8, 8],
    ]);
  });

  it('ignores empty fusions array', () => {
    hm.beginTurn(1, 'up', 0);
    hm.addFusions([]);
    hm.finalizeTurn(0);

    // Turn has no entries and no score delta — it is discarded
    expect(hm.getTurns()).toHaveLength(0);
  });

  // ─── Powers ────────────────────────────────────

  it('records power activations', () => {
    hm.beginTurn(1, 'up', 0);
    hm.addPower('fire-h');
    hm.finalizeTurn(0);

    const entry = hm.getTurns()[0].entries.find((e) => e.type === 'power');
    expect(entry.powers).toEqual(['fire-h']);
  });

  it('merges multiple powers into one entry', () => {
    hm.beginTurn(1, 'up', 0);
    hm.addPower('fire-h');
    hm.addPower('bomb');
    hm.finalizeTurn(0);

    const entries = hm.getTurns()[0].entries.filter((e) => e.type === 'power');
    expect(entries).toHaveLength(1);
    expect(entries[0].powers).toEqual(['fire-h', 'bomb']);
  });

  // ─── Contamination ────────────────────────────

  it('records contamination', () => {
    hm.beginTurn(1, 'up', 0);
    hm.addContamination(4);
    hm.finalizeTurn(0);

    const entry = hm.getTurns()[0].entries.find((e) => e.type === 'contamination');
    expect(entry).toBeDefined();
    expect(entry.value).toBe(4);
  });

  // ─── Enemy events ─────────────────────────────

  it('records enemy spawn', () => {
    hm.beginTurn(1, 'up', 0);
    hm.addEnemySpawn('Algebrox', 8);
    hm.finalizeTurn(0);

    const entry = hm.getTurns()[0].entries.find((e) => e.type === 'enemy_spawn');
    expect(entry).toEqual({ type: 'enemy_spawn', name: 'Algebrox', level: 8 });
  });

  it('records enemy damage', () => {
    hm.beginTurn(1, 'up', 0);
    hm.addEnemyDamage('Algebrox', 8, 5);
    hm.finalizeTurn(0);

    const entry = hm.getTurns()[0].entries.find((e) => e.type === 'enemy_damage');
    expect(entry).toEqual({ type: 'enemy_damage', name: 'Algebrox', level: 8, damage: 5 });
  });

  it('records enemy defeated', () => {
    hm.beginTurn(1, 'up', 0);
    hm.addEnemyDefeated('Algebrox', 8);
    hm.finalizeTurn(0);

    const entry = hm.getTurns()[0].entries.find((e) => e.type === 'enemy_defeated');
    expect(entry).toEqual({ type: 'enemy_defeated', name: 'Algebrox', level: 8 });
  });

  // ─── Tiles lost ────────────────────────────────

  it('records tiles lost', () => {
    hm.beginTurn(1, 'up', 0);
    hm.addTilesLost([16, 8]);
    hm.finalizeTurn(0);

    const entry = hm.getTurns()[0].entries.find((e) => e.type === 'tiles_lost');
    expect(entry.values).toEqual([16, 8]);
  });

  it('ignores empty tiles lost array', () => {
    hm.beginTurn(1, 'up', 0);
    hm.addTilesLost([]);
    hm.finalizeTurn(0);

    // Turn has no entries and no score delta — it is discarded
    expect(hm.getTurns()).toHaveLength(0);
  });

  // ─── Combo bonus ──────────────────────────────

  it('records combo bonus', () => {
    hm.beginTurn(1, 'up', 0);
    hm.addComboBonus(240);
    hm.finalizeTurn(240);

    const entry = hm.getTurns()[0].entries.find((e) => e.type === 'combo_bonus');
    expect(entry.points).toBe(240);
  });

  // ─── No current turn guard ────────────────────

  it('silently ignores entries when no turn is active', () => {
    hm.addFusions([[2, 2]]);
    hm.addPower('fire-h');
    hm.addContamination(4);
    hm.addEnemySpawn('X', 2);
    hm.addEnemyDamage('X', 2, 1);
    hm.addEnemyDefeated('X', 2);
    hm.addTilesLost([8]);
    hm.addComboBonus(100);
    hm.finalizeTurn(0);

    expect(hm.getTurns()).toHaveLength(0);
  });

  // ─── Clear ────────────────────────────────────

  it('clears all history', () => {
    hm.beginTurn(1, 'up', 0);
    hm.finalizeTurn(4);
    hm.beginTurn(2, 'down', 4);
    hm.finalizeTurn(8);

    hm.clear();
    expect(hm.getTurns()).toHaveLength(0);
    expect(hm.length).toBe(0);
  });

  // ─── Max turns cap ────────────────────────────

  it('caps history at MAX_TURNS', () => {
    for (let i = 0; i < HistoryManager.MAX_TURNS + 10; i++) {
      hm.beginTurn(i + 1, 'up', i * 4);
      hm.finalizeTurn(i * 4 + 4); // score always increases so turn is kept
    }

    expect(hm.length).toBe(HistoryManager.MAX_TURNS);
    // Most recent turn should be the last added
    expect(hm.getTurns()[0].move).toBe(HistoryManager.MAX_TURNS + 10);
  });

  // ─── Serialize / Restore ──────────────────────

  it('serializes and restores history', () => {
    hm.beginTurn(1, 'left', 0);
    hm.addFusions([[2, 2]]);
    hm.addPower('ice');
    hm.finalizeTurn(4);

    hm.beginTurn(2, 'right', 4);
    hm.addEnemySpawn('Boss', 2048);
    hm.finalizeTurn(4);

    const serialized = hm.serialize();

    const hm2 = new HistoryManager();
    hm2.restore(serialized);

    expect(hm2.getTurns()).toEqual(hm.getTurns());
    expect(hm2.length).toBe(2);
  });

  it('restore handles null/undefined gracefully', () => {
    hm.restore(null);
    expect(hm.getTurns()).toEqual([]);

    hm.restore(undefined);
    expect(hm.getTurns()).toEqual([]);
  });

  // ─── Complex turn with multiple event types ───

  it('records a complex turn with all event types', () => {
    hm.beginTurn(5, 'down', 100);
    hm.addFusions([
      [4, 4],
      [16, 16],
    ]);
    hm.addPower('fire-h');
    hm.addTilesLost([8, 2]);
    hm.addContamination(32);
    hm.addEnemyDamage('Pythagorus', 16, 7);
    hm.addComboBonus(50);
    hm.finalizeTurn(190);

    const turn = hm.getTurns()[0];
    expect(turn.move).toBe(5);
    expect(turn.direction).toBe('down');
    expect(turn.fusions).toBe(2);
    expect(turn.entries).toHaveLength(7); // fusion, power, tiles_lost, contamination, enemy_damage, combo_bonus, score
    // Score entry is auto-added
    const scoreEntry = turn.entries.find((e) => e.type === 'score');
    expect(scoreEntry.points).toBe(90);
  });
});
