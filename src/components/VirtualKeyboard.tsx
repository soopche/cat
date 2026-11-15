import React from 'react';
import { ZoomIn, ZoomOut, Smartphone } from 'lucide-react';

const KEYBOARD_LAYOUT = [
  ['Ё', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
  ['Й', 'Ц', 'У', 'К', 'Е', 'Н', 'Г', 'Ш', 'Щ', 'З', 'Х', 'Ъ'],
  ['Ф', 'Ы', 'В', 'А', 'П', 'Р', 'О', 'Л', 'Д', 'Ж', 'Э'],
  ['Я', 'Ч', 'С', 'М', 'И', 'Т', 'Ь', 'Б', 'Ю', '.']
];

interface VirtualKeyboardProps {
  currentExpectedChar?: string;
  hintKey?: string | null;
  onKeyPress: (char: string) => void;
  isMobileMode: boolean;
  onToggleMobileMode: () => void;
  kbScale: number;
  onSetKbScale: (scale: number) => void;
  disabled?: boolean;
}

export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({
  currentExpectedChar,
  hintKey,
  onKeyPress,
  isMobileMode,
  onToggleMobileMode,
  kbScale,
  onSetKbScale,
  disabled = false
}) => {
  const getKeyProps = (char: string) => {
    const isTarget = currentExpectedChar === char;
    const isHint = hintKey === char;

    let baseClass =
      "m-0.5 rounded-xl font-bold flex items-center justify-center transition-all select-none border-b-4 ";

    let colorClass = "bg-white text-slate-700 border-slate-300 shadow-sm ";

    if (disabled) {
      colorClass = "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed ";
    } else if (isHint) {
      colorClass = "bg-amber-300 text-amber-950 border-amber-500 ring-4 ring-amber-200 scale-105 animate-pulse shadow-md ";
    } else if (isTarget) {
      colorClass = "bg-sky-100 text-sky-800 border-sky-400 ring-2 ring-sky-300 scale-105 shadow ";
    } else if (isMobileMode) {
      colorClass = "bg-white text-slate-700 border-slate-300 hover:bg-sky-50 active:scale-95 active:border-b ";
    }

    const sizeStyle = {
      width: `${2.3 * kbScale}rem`,
      height: `${2.5 * kbScale}rem`,
      fontSize: `${1.1 * kbScale}rem`
    };

    return {
      className: baseClass + colorClass + (isMobileMode && !disabled ? "cursor-pointer" : "cursor-default"),
      style: sizeStyle
    };
  };

  const isSpaceTarget = currentExpectedChar === ' ';

  return (
    <div className="w-full max-w-4xl flex flex-col items-center">
      {/* Zoom and mobile controls toolbar */}
      <div className="w-full flex items-center justify-between px-2 mb-1.5 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleMobileMode}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border font-medium transition ${
              isMobileMode
                ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
            title="Экранная клавиатура: нажимать кнопки мышкой или пальцем"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Экранный ввод: {isMobileMode ? 'ВКЛ' : 'ВЫКЛ'}</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur px-2 py-0.5 rounded-lg border border-slate-200">
          <span className="text-[11px] font-medium text-slate-400 mr-1">Размер:</span>
          <button
            onClick={() => onSetKbScale(Math.max(0.65, Number((kbScale - 0.1).toFixed(2))))}
            className="p-1 rounded hover:bg-slate-100 text-slate-600"
            title="Уменьшить клавиши"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[11px] w-8 text-center text-slate-700">
            {Math.round(kbScale * 100)}%
          </span>
          <button
            onClick={() => onSetKbScale(Math.min(1.4, Number((kbScale + 0.1).toFixed(2))))}
            className="p-1 rounded hover:bg-slate-100 text-slate-600"
            title="Увеличить клавиши"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Keys Container */}
      <div className="bg-slate-200/80 backdrop-blur p-2.5 rounded-2xl shadow-inner border border-slate-300/80 w-full flex flex-col items-center select-none overflow-x-auto">
        {KEYBOARD_LAYOUT.map((row, rIdx) => (
          <div key={rIdx} className="flex justify-center mb-1 w-full gap-0.5">
            {row.map(char => {
              const kProps = getKeyProps(char);
              return (
                <button
                  key={char}
                  type="button"
                  tabIndex={-1}
                  disabled={disabled}
                  className={kProps.className}
                  style={kProps.style}
                  onClick={() => {
                    if (isMobileMode && !disabled) {
                      onKeyPress(char);
                    }
                  }}
                >
                  {char}
                </button>
              );
            })}
          </div>
        ))}

        {/* Space bar row */}
        <div className="flex justify-center mt-1 w-full">
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => {
              if (isMobileMode && !disabled) {
                onKeyPress(' ');
              }
            }}
            className={`rounded-xl font-bold flex items-center justify-center transition-all select-none border-b-4 ${
              disabled
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                : isSpaceTarget
                ? 'bg-sky-100 text-sky-800 border-sky-400 ring-4 ring-sky-200 scale-105 shadow-md'
                : 'bg-white text-slate-500 border-slate-300 shadow-sm hover:bg-sky-50'
            } ${isMobileMode && !disabled ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
            style={{
              width: `${16 * kbScale}rem`,
              height: `${2.4 * kbScale}rem`,
              fontSize: `${0.95 * kbScale}rem`
            }}
          >
            ПРОБЕЛ
          </button>
        </div>
      </div>
    </div>
  );
};
