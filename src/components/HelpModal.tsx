import React from 'react';
import { 
  HelpCircle, 
  X, 
  Cat, 
  Zap, 
  Target, 
  BookmarkCheck, 
  Gift, 
  MessageCircle, 
  RotateCcw, 
  Shirt, 
  Mail,
  Crown
} from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 relative max-h-[85vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-500 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-400 text-white flex items-center justify-center shadow-md">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800">
              Как играть в Тайпинг-Котик
            </h2>
            <p className="text-xs text-slate-500">Памятка для юных мастеров печати и родителей</p>
          </div>
        </div>

        <div className="space-y-3.5 text-xs sm:text-sm text-slate-700">
          
          {/* Level growth & stat system */}
          <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200 flex items-start gap-3">
            <Crown className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div>
              <b className="text-purple-950 block mb-0.5">🌟 Долгий рост питомца и честные шкалы</b>
              • Чтобы заполнить шкалу (сытость, радость, чистота и др.) до 100%, нужно напечатать <b>15 слов в этой категории</b>.<br />
              • Каждую минуту все показатели питомца уменьшаются на <b>2%</b> от максимума.<br />
              • Уровни и сложность: <b>Малыш</b> (строго 3 буквы, одно слово) → <b>Котёнок</b> (4–5 букв) → <b>Подросток</b> (5–7 букв) → <b>Взрослый</b> (7–10 букв) → <b>Учёный</b> (8+ букв и простые фразы) → <b>Великий Магистр</b> (красивые фразы из 2 слов).
            </div>
          </div>

          {/* Reset progress */}
          <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200 flex items-start gap-3">
            <RotateCcw className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <b className="text-rose-950 block mb-0.5">🔄 Сброс роста котика и выбор возраста</b>
              Возле счётчика опыта есть кнопка <b>«Сброс роста»</b>. Она позволяет обнулить рост питомца и вырастить его заново с самого начала!
              А если ты уже вырастил котика до конца (Магистр), в шапке появляется <b>«Выбор облика»</b> — котика можно в любой момент переодеть в любой возраст!
            </div>
          </div>

          {/* Mode 1 */}
          <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 flex items-start gap-3">
            <Zap className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <b className="text-blue-950 block mb-0.5">1. Режим «Скорость текста»</b>
              Печатай добрые детские сказки и рассказы. Можно нажать «Генерировать» или загрузить файл `.txt` со своим текстом.
            </div>
          </div>

          {/* Mode 2 */}
          <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start gap-3">
            <Target className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <b className="text-emerald-950 block mb-0.5">2. Режим «Марафон слов»</b>
              Выбери 10, 25, 50, 100 или задай <b>любое своё число слов</b>! Котик бежит к золотому кубку по мере твоего прогресса.
            </div>
          </div>

          {/* Mode 3 */}
          <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200 flex items-start gap-3">
            <BookmarkCheck className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div>
              <b className="text-purple-950 block mb-0.5">3. Режим «Буквенный спринт»</b>
              Котик случайно предлагает букву. Напечатай заданное число слов на эту букву, чтобы открыть следующую букву, пока не истечёт таймер!
            </div>
          </div>

          {/* Mode 4 */}
          <div className="p-3 bg-pink-50 rounded-2xl border border-pink-200 flex items-start gap-3">
            <MessageCircle className="w-5 h-5 text-pink-600 flex-shrink-0 mt-0.5" />
            <div>
              <b className="text-pink-950 block mb-0.5">4. Режим «Диалог с котиком»</b>
              Печатай котику любые фразы и вопросы. Котик отвечает, расспрашивает о тебе, твоих любимых играх и друзьях. История диалога сохраняется!
            </div>
          </div>

          {/* Cabinet: Communication */}
          <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-3">
            <Cat className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <b className="text-amber-950 block mb-0.5">💬 Раздел «Общение» в шкафчике</b>
              Слева в шкафчике добавлен раздел разговорных слов и фраз: *«Привет»*, *«Как дела»*, *«Спасибо»*, *«Сколько тебе лет?»*, *«Погода отличная»* и более 40 других выражений!
            </div>
          </div>

          {/* Reward trainer */}
          <div className="p-3 bg-orange-50 rounded-2xl border border-orange-200 flex items-start gap-3">
            <Gift className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <b className="text-orange-950 block mb-0.5">🎁 Тренировка за награду (во всех режимах!)</b>
              Включи кнопку «Награда» — теперь <b>каждое слово во всех режимах</b> (марафон слов, тексты, буквы, диалог с котиком и уход за питомцем) увеличивает время отдыха. Накопив минуты, включай большой таймер для мультиков или игр!
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200">
            <h4 className="font-bold text-slate-800 mb-2">Горячие клавиши (Hotkeys):</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <span className="bg-slate-100 p-2 rounded-xl font-mono text-slate-700"><b>Alt + 1</b>: Озвучить моё слово</span>
              <span className="bg-slate-100 p-2 rounded-xl font-mono text-slate-700"><b>Alt + 2</b>: Озвучить котика</span>
              <span className="bg-slate-100 p-2 rounded-xl font-mono text-slate-700"><b>Alt + 3</b>: Записать свой голос (микрофон)</span>
              <span className="bg-slate-100 p-2 rounded-xl font-mono text-slate-700"><b>Alt + 4</b>: Написать слово сначала</span>
              <span className="bg-slate-100 p-2 rounded-xl font-mono text-slate-700"><b>Enter</b>: Следующее слово</span>
              <span className="bg-slate-100 p-2 rounded-xl font-mono text-slate-700"><b>Esc</b>: Сброс ввода</span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 py-2.5 bg-slate-900 text-white rounded-2xl font-bold text-xs hover:bg-slate-800 transition"
        >
          Понятно, вперёд играть!
        </button>
      </div>
    </div>
  );
};
