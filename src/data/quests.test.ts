import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getCatLevelFromXp,
  getCatXpProgressInfo,
  getDailyQuestsForDate,
  LONG_TERM_QUEST_TEMPLATES,
  createInitialQuestCounters,
  evaluateAllQuests,
  parseLearnedAlphabetLetters,
  addLearnedAlphabetLetter,
  mergeLearnedAlphabetLetters
} from './quests';
import {
  formatSyllables,
  RUSSIAN_ALPHABET,
  WORDS_BY_LETTER,
  getNextCustomSprintLetter
} from './words';

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

test('RUSSIAN_ALPHABET has all 33 letters and getNextCustomSprintLetter cycles selected letters (e.g. А, О, Д)', () => {
  assert.equal(RUSSIAN_ALPHABET.length, 33);
  for (const letter of RUSSIAN_ALPHABET) {
    assert.ok(
      Array.isArray(WORDS_BY_LETTER[letter]) && WORDS_BY_LETTER[letter].length >= 5,
      `Expected at least 5 words for letter ${letter}`
    );
  }

  const selected = ['А', 'О', 'Д'];
  const step0 = getNextCustomSprintLetter(selected, 0);
  assert.equal(step0.letter, 'А');
  assert.equal(step0.nextIndex, 1);

  const step1 = getNextCustomSprintLetter(selected, step0.nextIndex);
  assert.equal(step1.letter, 'О');
  assert.equal(step1.nextIndex, 2);

  const step2 = getNextCustomSprintLetter(selected, step1.nextIndex);
  assert.equal(step2.letter, 'Д');
  assert.equal(step2.nextIndex, 0);

  const step3 = getNextCustomSprintLetter(selected, step2.nextIndex);
  assert.equal(step3.letter, 'А');
  assert.equal(step3.nextIndex, 1);
});

test('LONG_TERM_QUEST_TEMPLATES includes lt_alphabet_10 and lt_alphabet_all quests and tracks alphabet progress', () => {
  assert.equal(LONG_TERM_QUEST_TEMPLATES.length, 32);
  const uniqueIds = new Set(LONG_TERM_QUEST_TEMPLATES.map(q => q.id));
  assert.equal(uniqueIds.size, 32);

  let learned = '';
  for (const l of ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ё', 'Ж', 'З', 'И']) {
    learned = addLearnedAlphabetLetter(learned, l);
  }
  assert.equal(parseLearnedAlphabetLetters(learned).length, 10);

  const merged = mergeLearnedAlphabetLetters(learned, 'К,Л,А');
  assert.equal(parseLearnedAlphabetLetters(merged).length, 12);

  const counters = createInitialQuestCounters('2026-11-15');
  counters.dailyWords = 10;
  counters.totalWords = 60;
  counters.learnedAlphabetLetters = learned;

  const list = evaluateAllQuests({
    counters,
    stats: { hunger: 75, sleep: 75, clean: 75, happiness: 75, intelligence: 75 },
    xp: 500,
    streakDays: 2,
    hasUnlockedAllAges: false,
    claimedIds: ['lt_words_50']
  });

  assert.equal(list.length, 38);
  const alpha10 = list.find(q => q.id === 'lt_alphabet_10');
  assert.ok(alpha10);
  assert.equal(alpha10.isUnlocked, true);
  assert.equal(alpha10.currentProgress, 10);

  const alphaAll = list.find(q => q.id === 'lt_alphabet_all');
  assert.ok(alphaAll);
  assert.equal(alphaAll.isUnlocked, false);
  assert.equal(alphaAll.currentProgress, 10);
  assert.equal(alphaAll.targetProgress, 33);

  // Unlock full alphabet
  counters.learnedAlphabetLetters = RUSSIAN_ALPHABET.join(',');
  const listFull = evaluateAllQuests({
    counters,
    stats: { hunger: 75, sleep: 75, clean: 75, happiness: 75, intelligence: 75 },
    xp: 500,
    streakDays: 2,
    hasUnlockedAllAges: false,
    claimedIds: []
  });
  const alphaAllUnlocked = listFull.find(q => q.id === 'lt_alphabet_all');
  assert.ok(alphaAllUnlocked);
  assert.equal(alphaAllUnlocked.isUnlocked, true);
  assert.equal(alphaAllUnlocked.currentProgress, 33);
});

test('formatSyllables splits Russian words cleanly without trailing consonant hyphen', () => {
  assert.equal(formatSyllables('ОТДЫХ'), 'ОТ-ДЫХ');
  assert.equal(formatSyllables('МОЛОКО'), 'МО-ЛО-КО');
  assert.equal(formatSyllables('СУП'), 'СУП');
  assert.equal(formatSyllables('КОШКА'), 'КОШ-КА');
});
