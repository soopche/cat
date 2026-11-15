export type AppMode = 
  | 'classic_pet' 
  | 'speed_text' 
  | 'word_goal' 
  | 'letter_sprint' 
  | 'cat_chat';

export type CatLevel = 
  | 'baby' 
  | 'kitten' 
  | 'teen' 
  | 'adult' 
  | 'smart' 
  | 'master';

export type CatAction = 
  | 'idle' 
  | 'eating' 
  | 'sleeping' 
  | 'dance' 
  | 'jump' 
  | 'run' 
  | 'shake' 
  | 'love' 
  | 'bow' 
  | 'spin' 
  | 'sway' 
  | 'blink' 
  | 'lying'
  | 'smart'
  | 'magic';

export interface PetStats {
  hunger: number;
  sleep: number;
  clean: number;
  happiness: number;
  intelligence: number;
}

export interface AchievementItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
  isUnlocked: boolean;
  isClaimed?: boolean;
}

export interface TypingResult {
  wpm: number;
  cpm: number;
  accuracy: number;
  wordsCount: number;
  timeSeconds: number;
  errorsCount: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'cat';
  text: string;
  timestamp: number;
}

export interface CatLetter {
  id: string;
  statType: 'hunger' | 'clean' | 'happiness' | 'sleep' | 'intelligence';
  title: string;
  text: string;
  actionText: string;
  categoryToOpen: string;
}
