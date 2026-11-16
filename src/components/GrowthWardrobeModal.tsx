import React, { useState } from 'react';
import { 
  X, 
  RotateCcw, 
  Sparkles, 
  Check, 
  Lock, 
  Crown, 
  AlertTriangle 
} from 'lucide-react';
import { CatLevel } from '../types';

interface GrowthWardrobeModalProps {
  isOpen: boolean;
  onClose: () => void;
  xp: number;
  level: CatLevel;
  displayLevel: CatLevel;
  onSelectDisplayLevel: (lvl: CatLevel) => void;
  hasUnlockedAllAges: boolean;
  onResetProgress: () => void;
}

interface StageInfo {
  id: CatLevel;
  name: string;
  icon: string;
  accessory: string;
  difficultyHint: string;
  requiredXp: number;
}

const STAGES: StageInfo[] = [
  { id: 'baby', name: 'Малыш', icon: '👶', accessory: 'Нежный слюнявчик', difficultyHint: 'Слова из 3 букв', requiredXp: 0 },
  { id: 'kitten', name: 'Котёнок-непоседа', icon: '🐱', accessory: 'Игривый бантик', difficultyHint: 'Слова 4–5 букв', requiredXp: 250 },
  { id: 'teen', name: 'Подросток-стиляга', icon: '😼', accessory: 'Модный чубчик', difficultyHint: 'Слова 5–7 букв', requiredXp: 700 },
  { id: 'adult', name: 'Кот-путешественник', icon: '🦁', accessory: 'Ошейник с бубенчиком', difficultyHint: 'Слова 7–10 букв', requiredXp: 1500 },
  { id: 'smart', name: 'Учёный профессор', icon: '🎩', accessory: 'Круглые очки и бабочка', difficultyHint: 'Длинные слова и фразы', requiredXp: 3000 },
  { id: 'master', name: 'Великий Магистр', icon: '👑', accessory: 'Звёздный колпак волшебника', difficultyHint: 'Фразы из 2 слов', requiredXp: 6000 },
  { id: 'cosmic', name: 'Космический Император', icon: '🌌', accessory: 'Корона галактики и нимб', difficultyHint: 'Фразы из 2 слов', requiredXp: 12000 },
];

export const GrowthWardrobeModal: React.FC<GrowthWardrobeModalProps> = ({
  isOpen,
  onClose,
  xp,
  level,
  displayLevel,
  onSelectDisplayLevel,
  hasUnlockedAllAges,
  onResetProgress
}) => {
  const [showConfirmReset, setShowConfirmReset] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentStageIndex = STAGES.findIndex(s => s.id === level);
  const nextStage = STAGES[currentStageIndex + 1];
  const currentThreshold = STAGES[currentStageIndex]?.requiredXp || 0;
  const nextThreshold = nextStage?.requiredXp || 12000;
  const xpNeeded = Math.max(0, nextThreshold - xp);
  const progressRatio = nextStage 
    ? Math.min(100, Math.round(((xp - currentThreshold) / (nextThreshold - currentThreshold)) * 100))
    : 100;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in select-none">
      <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-slate-200 flex flex-col max-h-[88vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-50 via-orange-50/40 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-500 text-white flex items-center justify-center text-2xl shadow-md shadow-orange-200">
              🐾
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">
                Рост и облик котика
              </h2>
              <p className="text-xs text-slate-500">
                Следи за взрослением питомца и меняй его образ в гардеробе!
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-white/80 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4">
          
          {/* Progress Card */}
          <div className="bg-gradient-to-r from-purple-50 via-indigo-50/50 to-pink-50 p-4 rounded-2xl border border-purple-200 shadow-sm flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wide">
                  Текущий возраст:
                </span>
                <h3 className="text-lg font-black text-slate-800">
                  {STAGES[currentStageIndex]?.name} {STAGES[currentStageIndex]?.icon}
                </h3>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold text-slate-400 block">Опыт (XP):</span>
                <span className="text-xl font-black font-mono text-purple-600">
                  {xp} XP
                </span>
              </div>
            </div>

            {/* Progress bar to next age */}
            <div className="mt-1">
              <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                <span>
                  {nextStage ? `До «${nextStage.name}» осталось:` : 'Максимальный возраст достигнут!'}
                </span>
                {nextStage && <span className="font-bold text-purple-700 font-mono">{xpNeeded} XP</span>}
              </div>
              <div className="w-full h-3 bg-purple-100/80 rounded-full overflow-hidden p-0.5 border border-purple-200">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full transition-all duration-500 shadow-sm"
                  style={{ width: `${progressRatio}%` }}
                />
              </div>
            </div>
          </div>

          {/* Wardrobe / Age Picker */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                <span>Выбор облика питомца:</span>
                {xp >= 12000 && hasUnlockedAllAges && (
                  <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Crown className="w-3 h-3 text-amber-600" />
                    Все облики разблокированы!
                  </span>
                )}
              </h4>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {STAGES.map((stage, idx) => {
                const isCurrentLook = displayLevel === stage.id;
                const isUnlocked = xp >= stage.requiredXp || idx <= currentStageIndex;

                return (
                  <button
                    key={stage.id}
                    type="button"
                    disabled={!isUnlocked}
                    onClick={() => {
                      if (isUnlocked) {
                        onSelectDisplayLevel(stage.id);
                      }
                    }}
                    className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between relative ${
                      isCurrentLook
                        ? 'bg-purple-50/90 border-purple-500 ring-2 ring-purple-200 shadow-md'
                        : isUnlocked
                        ? 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 shadow-sm cursor-pointer active:scale-95'
                        : 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    {isCurrentLook && (
                      <span className="absolute top-2 right-2 w-5 h-5 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    )}

                    {!isUnlocked && (
                      <span className="absolute top-2 right-2 p-1 text-slate-400">
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                    )}

                    <div className="text-3xl mb-1">{stage.icon}</div>
                    <div>
                      <span className="text-xs font-black text-slate-800 block">
                        {stage.name}
                      </span>
                      <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                        {stage.accessory}
                      </span>
                      <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md inline-block mt-1">
                        {stage.difficultyHint}
                      </span>
                      {!isUnlocked && (
                        <span className="text-[9px] text-purple-600 font-bold block mt-1">
                          от {stage.requiredXp} XP
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reset Growth Section */}
          <div className="mt-2 pt-3 border-t border-slate-200">
            <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <span className="text-xs font-black text-rose-950 block">
                  Сбросить рост котика?
                </span>
                <p className="text-[11px] text-rose-800 leading-snug mt-0.5">
                  Опыт вернётся на 0, а котик снова станет Малышом, чтобы можно было вырастить его заново.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowConfirmReset(true)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-rose-200 flex-shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Сбросить рост</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition"
          >
            Готово
          </button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmReset && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 text-center animate-fade-in">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-1">
              Точно сбросить рост?
            </h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Котик снова станет маленьким новорождённым Малышом с 0 XP. Твои рекорды скорости и достижения в таблице останутся!
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmReset(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetProgress();
                  setShowConfirmReset(false);
                  onClose();
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition shadow-md shadow-rose-200"
              >
                Да, начать заново
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
