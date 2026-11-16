import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getCatLevelFromXp,
  getCatXpProgressInfo,
  getDailyQuestsForDate,
  LONG_TERM_QUEST_TEMPLATES,
  createInitialQuestCounters,
  evaluateAllQuests
} from './quests';
import { formatSyllables } from './words';

test('getCatLevelFromXp and getCatXpProgressInfo handle 7300 XP as master progressing toward 12000 XP cosmic', () => {
  assert.equal(getCatLevelFromXp(0), 'baby');
  assert.equal(getCatLevelFromXp(250), 'kitten');
  assert.equal(getCatLevelFromXp(700), 'teen');
  assert.equal(getCatLevelFromXp(1500), 'adult');
  assert.equal(getCatLevelFromXp(3000), 'smart');
  assert.equal(getCatLevelFromXp(6000), 'master');
  assert.equal(getCatLevelFromXp(7300), 'master');
  assert.equal(getCatLevelFromXp(11999), 'master');
  assert.equal(getCatLevelFromXp(12000), 'cosmic');
  assert.equal(getCatLevelFromXp(20000), 'cosmic');

  const info7300 = getCatXpProgressInfo(7300);
  assert.equal(info7300.currentStage.level, 'master');
  assert.equal(info7300.nextStage?.level, 'cosmic');
  assert.equal(info7300.nextThreshold, 12000);
  assert.equal(info7300.xpNeededForNext, 4700);
  assert.equal(info7300.progressPercent, 22);
  assert.equal(info7300.isMaxLevel, false);

  const info12000 = getCatXpProgressInfo(12000);
  assert.equal(info12000.currentStage.level, 'cosmic');
  assert.equal(info12000.nextStage, null);
  assert.equal(info12000.isMaxLevel, true);
  assert.equal(info12000.progressPercent, 100);
});

test('getDailyQuestsForDate returns 6 quick 5-minute daily quests and rotates by date', () => {
  const day1 = getDailyQuestsForDate('2026-11-15');
  const day2 = getDailyQuestsForDate('2026-11-16');
  assert.equal(day1.length, 6);
  assert.equal(day2.length, 6);
  // Core daily quests are always included
  assert.ok(day1.some(q => q.id === 'daily_sprint_10'));
  assert.ok(day1.some(q => q.id === 'daily_sniper_92'));
  assert.ok(day1.some(q => q.id === 'daily_care_70'));
});

test('LONG_TERM_QUEST_TEMPLATES has exactly 30 challenging quests', () => {
  assert.equal(LONG_TERM_QUEST_TEMPLATES.length, 30);
  const uniqueIds = new Set(LONG_TERM_QUEST_TEMPLATES.map(q => q.id));
  assert.equal(uniqueIds.size, 30);
});

test('evaluateAllQuests computes 36 quests (6 daily + 30 long-term) with accurate progress and claims', () => {
  const counters = createInitialQuestCounters('2026-11-15');
  counters.dailyWords = 10;
  counters.totalWords = 60;

  const list = evaluateAllQuests({
    counters,
    stats: { hunger: 75, sleep: 75, clean: 75, happiness: 75, intelligence: 75 },
    xp: 500,
    streakDays: 2,
    hasUnlockedAllAges: false,
    claimedIds: ['lt_words_50']
  });

  assert.equal(list.length, 36);
  const dailyWordsQuest = list.find(q => q.id === 'daily_words_10_2026-11-15');
  assert.ok(dailyWordsQuest);
  assert.equal(dailyWordsQuest.isUnlocked, true);
  assert.equal(dailyWordsQuest.isClaimed, false);

  const lt50 = list.find(q => q.id === 'lt_words_50');
  assert.ok(lt50);
  assert.equal(lt50.isUnlocked, true);
  assert.equal(lt50.isClaimed, true);
});

test('formatSyllables splits Russian words cleanly without trailing consonant hyphen', () => {
  assert.equal(formatSyllables('ОТДЫХ'), 'ОТ-ДЫХ');
  assert.equal(formatSyllables('МОЛОКО'), 'МО-ЛО-КО');
  assert.equal(formatSyllables('СУП'), 'СУП');
  assert.equal(formatSyllables('КОШКА'), 'КОШ-КА');
});
