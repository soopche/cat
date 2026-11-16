import React from 'react';
import { CatAction, CatLevel } from '../types';
import { WORD_EMOJIS } from '../data/words';

interface CatAvatarProps {
  mood?: 'happy' | 'sad' | 'excited' | 'sleepy';
  action: CatAction;
  stage: CatLevel;
  currentWord?: string;
  category?: string;
  scaleOverride?: number;
}

export const CatAvatar: React.FC<CatAvatarProps> = ({
  action,
  stage,
  currentWord = '',
  category = '',
  scaleOverride
}) => {
  const showEmoji = action !== 'idle' && category !== 'QUIZ';
  const activeEmoji = showEmoji ? (WORD_EMOJIS[currentWord] || '') : '';

  const getAnimationClass = () => {
    switch (action) {
      case 'dance': return 'animate-bounce';
      case 'jump': return 'animate-bounce-high';
      case 'run': return 'translate-x-6 transition-transform duration-300';
      case 'shake': return 'animate-wiggle';
      case 'love': return 'scale-110 transition-transform duration-500';
      case 'bow': return 'translate-y-4 rotate-6 transition-transform duration-500';
      case 'spin': return 'animate-spin-slow';
      case 'sway': return 'animate-sway';
      case 'magic': return 'animate-pulse scale-105';
      default: return '';
    }
  };

  let defaultScale = 1;
  if (stage === 'baby') defaultScale = 0.65;
  else if (stage === 'kitten') defaultScale = 0.78;
  else if (stage === 'teen') defaultScale = 0.88;
  else if (stage === 'adult') defaultScale = 0.98;
  else if (stage === 'smart') defaultScale = 1.05;
  else if (stage === 'master') defaultScale = 1.12;
  else if (stage === 'cosmic') defaultScale = 1.16;

  const finalScale = scaleOverride ?? defaultScale;

  return (
    <div 
      className={`relative transition-all duration-500 select-none flex items-center justify-center ${getAnimationClass()}`}
      style={{ transform: `scale(${finalScale})` }}
    >
      <svg viewBox="0 -50 220 270" className="w-56 h-56 sm:w-64 sm:h-64 drop-shadow-2xl">
        <defs>
          <radialGradient id="catBodyGrad" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#FFA94D" />
            <stop offset="80%" stopColor="#F76707" />
            <stop offset="100%" stopColor="#D9480F" />
          </radialGradient>
          <radialGradient id="catBellyGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFF9DB" />
            <stop offset="100%" stopColor="#FFE8CC" />
          </radialGradient>
          <linearGradient id="magicHatGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7048E8" />
            <stop offset="100%" stopColor="#4C1D95" />
          </linearGradient>
          <linearGradient id="cosmicCrownGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
          <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Cosmic Halo & Star Aura for 7th stage */}
        {stage === 'cosmic' && (
          <g>
            <circle cx="105" cy="95" r="88" fill="none" stroke="#8B5CF6" strokeWidth="2.5" strokeDasharray="8 6" opacity="0.55" />
            <circle cx="105" cy="95" r="78" fill="none" stroke="#FACC15" strokeWidth="1.5" opacity="0.45" />
            <text x="18" y="15" fontSize="20">🌌</text>
            <text x="182" y="20" fontSize="20">🪐</text>
            <text x="22" y="185" fontSize="18">✨</text>
            <text x="180" y="185" fontSize="20">🌟</text>
          </g>
        )}

        {/* Master Cat Magic Sparkles */}
        {stage === 'master' && (
          <g className="animate-spin-slow origin-center opacity-80">
            <text x="30" y="20" fontSize="18" fill="#F59F00">✨</text>
            <text x="180" y="30" fontSize="20" fill="#F59F00">⭐</text>
            <text x="40" y="170" fontSize="16" fill="#F59F00">✨</text>
            <text x="175" y="180" fontSize="18" fill="#F59F00">🌟</text>
          </g>
        )}

        {/* Tail with swish */}
        <path
          d="M140,150 Q175,120 165,85 T145,55"
          fill="none"
          stroke="#F76707"
          strokeWidth="14"
          strokeLinecap="round"
          className={`origin-bottom-left transition-all duration-1000 ${
            ['dance', 'shake', 'run', 'sway', 'magic'].includes(action) ? 'animate-wiggle' : ''
          }`}
        />

        {/* Body */}
        {action === 'lying' ? (
          <ellipse cx="105" cy="160" rx="72" ry="32" fill="url(#catBodyGrad)" />
        ) : (
          <ellipse cx="105" cy="140" rx="52" ry="62" fill="url(#catBodyGrad)" />
        )}

        {/* Belly */}
        {action !== 'lying' && (
          <ellipse cx="105" cy="145" rx="27" ry="38" fill="url(#catBellyGrad)" />
        )}

        {/* Baby bib */}
        {stage === 'baby' && action !== 'lying' && (
          <g>
            <path d="M75,150 Q105,190 135,150 Q125,130 105,130 Q85,130 75,150" fill="white" stroke="#E9ECEF" strokeWidth="2" />
            <circle cx="105" cy="155" r="4" fill="#FF8787" />
          </g>
        )}

        {/* Adult Cat collar & golden bell */}
        {(stage === 'adult' || stage === 'master') && action !== 'lying' && (
          <g>
            <path d="M82,125 Q105,136 128,125" fill="none" stroke="#E03131" strokeWidth="6" strokeLinecap="round" />
            <circle cx="105" cy="133" r="5.5" fill="#FCC419" stroke="#E67700" strokeWidth="1.5" />
            <circle cx="105" cy="133" r="1.5" fill="#5C3600" />
          </g>
        )}

        {/* Cosmic Emperor Star Medallion & Mantle Collar */}
        {stage === 'cosmic' && action !== 'lying' && (
          <g>
            <path d="M76,123 Q105,140 134,123" fill="none" stroke="#6D28D9" strokeWidth="8" strokeLinecap="round" />
            <path d="M78,123 Q105,138 132,123" fill="none" stroke="#FACC15" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="105" cy="135" r="8" fill="#4C1D95" stroke="#FACC15" strokeWidth="2" />
            <text x="105" y="139" fontSize="10" textAnchor="middle">🌟</text>
          </g>
        )}

        {/* Head and Face Group */}
        <g className={`transition-transform duration-500 ${action === 'eating' ? 'translate-y-3' : ''} ${action === 'bow' ? 'translate-y-7 rotate-12' : ''}`}>
          
          {/* Ears */}
          <path d="M68,52 L52,10 L88,40 Z" fill="#F76707" />
          <path d="M68,50 L58,22 L82,42 Z" fill="#FFA8A8" opacity="0.9" />

          <path d="M142,52 L158,10 L122,40 Z" fill="#F76707" />
          <path d="M142,50 L152,22 L128,42 Z" fill="#FFA8A8" opacity="0.9" />

          {/* Head Base */}
          <circle cx="105" cy="80" r="48" fill="url(#catBodyGrad)" />

          {/* Cheeks Blush */}
          <circle cx="75" cy="94" r="9" fill="#FF8787" opacity="0.45" filter="url(#softGlow)" />
          <circle cx="135" cy="94" r="9" fill="#FF8787" opacity="0.45" filter="url(#softGlow)" />

          {/* Baby Bow */}
          {(stage === 'baby' || stage === 'kitten') && (
            <g transform="translate(105, 33)">
              <path d="M-14,-9 L0,0 L-14,9 Z" fill="#FF6B6B" />
              <path d="M14,-9 L0,0 L14,9 Z" fill="#FF6B6B" />
              <circle cx="0" cy="0" r="4" fill="#E03131" />
            </g>
          )}

          {/* Teen Tuft */}
          {stage === 'teen' && (
            <path d="M96,33 Q105,18 114,33" fill="none" stroke="#F76707" strokeWidth="4" strokeLinecap="round" />
          )}

          {/* Master Wizard Star Hat */}
          {stage === 'master' && (
            <g transform="translate(105, 30)">
              {/* Hat cone */}
              <path d="M-28,4 L0,-45 L28,4 Z" fill="url(#magicHatGrad)" stroke="#FCC419" strokeWidth="2" />
              {/* Hat brim */}
              <ellipse cx="0" cy="4" rx="34" ry="8" fill="#5B21B6" stroke="#FCC419" strokeWidth="2" />
              {/* Gold Star on Hat */}
              <text x="0" y="-12" fontSize="14" textAnchor="middle" fill="#FCC419">⭐</text>
            </g>
          )}

          {/* Cosmic Emperor Galaxy Crown & Halo */}
          {stage === 'cosmic' && (
            <g transform="translate(105, 28)">
              <ellipse cx="0" cy="-28" rx="28" ry="6" fill="none" stroke="#38BDF8" strokeWidth="3" filter="url(#softGlow)" />
              <path d="M-26,6 L-22,-18 L-10,-4 L0,-24 L10,-4 L22,-18 L26,6 Z" fill="url(#cosmicCrownGrad)" stroke="#FEF08A" strokeWidth="2" />
              <circle cx="0" cy="-10" r="4" fill="#38BDF8" />
              <circle cx="-14" cy="-3" r="3" fill="#F43F5E" />
              <circle cx="14" cy="-3" r="3" fill="#F43F5E" />
            </g>
          )}

          {/* Eyes Logic */}
          {action === 'sleeping' || action === 'blink' || action === 'love' || action === 'bow' ? (
            <>
              {action === 'love' ? (
                <>
                  <text x="80" y="85" fontSize="22" textAnchor="middle">❤️</text>
                  <text x="130" y="85" fontSize="22" textAnchor="middle">❤️</text>
                </>
              ) : (
                <>
                  <path d="M82,75 Q92,82 102,75" fill="none" stroke="#212529" strokeWidth="3.5" strokeLinecap="round" />
                  <path d="M128,75 Q118,82 108,75" fill="none" stroke="#212529" strokeWidth="3.5" strokeLinecap="round" />
                </>
              )}
            </>
          ) : (
            <>
              {/* Big Anime Eyes */}
              <circle cx="88" cy="74" r={stage === 'baby' || stage === 'kitten' ? 8 : 6} fill="#212529" />
              <circle cx="122" cy="74" r={stage === 'baby' || stage === 'kitten' ? 8 : 6} fill="#212529" />
              <circle cx="90" cy="71" r="2.5" fill="white" />
              <circle cx="86" cy="76" r="1.2" fill="white" />
              <circle cx="124" cy="71" r="2.5" fill="white" />
              <circle cx="120" cy="76" r="1.2" fill="white" />
            </>
          )}

          {/* Smart Glasses */}
          {(stage === 'smart' || stage === 'master') && (
            <g opacity="0.95">
              <circle cx="88" cy="74" r="15" fill="none" stroke="#2B2C34" strokeWidth="2.5" />
              <circle cx="122" cy="74" r="15" fill="none" stroke="#2B2C34" strokeWidth="2.5" />
              <line x1="103" y1="74" x2="107" y2="74" stroke="#2B2C34" strokeWidth="2.5" />
            </g>
          )}

          {/* Cute Nose */}
          <polygon points="102,86 108,86 105,91" fill="#FF6B6B" />

          {/* Mouth */}
          {action === 'eating' ? (
            <ellipse cx="105" cy="98" rx="6" ry="8" fill="#C92A2A" />
          ) : (
            <path
              d="M97,93 Q101,98 105,94 Q109,98 113,93"
              fill="none"
              stroke="#212529"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          )}

          {/* Whiskers */}
          <line x1="62" y1="88" x2="40" y2="84" stroke="#495057" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="62" y1="94" x2="38" y2="94" stroke="#495057" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="62" y1="100" x2="42" y2="104" stroke="#495057" strokeWidth="1.5" strokeLinecap="round" />

          <line x1="148" y1="88" x2="170" y2="84" stroke="#495057" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="148" y1="94" x2="172" y2="94" stroke="#495057" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="148" y1="100" x2="168" y2="104" stroke="#495057" strokeWidth="1.5" strokeLinecap="round" />
        </g>

        {/* Smart Bowtie */}
        {stage === 'smart' && action !== 'lying' && (
          <g transform="translate(105, 130)">
            <path d="M-12,-6 L0,0 L-12,6 Z" fill="#E03131" />
            <path d="M12,-6 L0,0 L12,6 Z" fill="#E03131" />
            <circle cx="0" cy="0" r="3" fill="#C92A2A" />
          </g>
        )}

        {/* Paws */}
        {action === 'lying' ? (
          <>
            <ellipse cx="65" cy="162" rx="11" ry="16" fill="#FFF9DB" />
            <ellipse cx="145" cy="162" rx="11" ry="16" fill="#FFF9DB" />
          </>
        ) : (
          <>
            <ellipse cx="85" cy="182" rx="13" ry="10" fill="#FFF9DB" />
            <ellipse cx="125" cy="182" rx="13" ry="10" fill="#FFF9DB" />
            {action === 'run' ? (
              <>
                <ellipse cx="65" cy="132" rx="10" ry="20" fill="#F76707" className="animate-pulse" />
                <ellipse cx="145" cy="132" rx="10" ry="20" fill="#F76707" />
              </>
            ) : (
              <>
                <ellipse cx="85" cy="132" rx="10" ry="20" fill="#F76707" />
                <ellipse cx="125" cy="132" rx="10" ry="20" fill="#F76707" />
              </>
            )}
          </>
        )}

        {/* Floating Emoji bubble */}
        {activeEmoji && (
          <g className="animate-fade-in-up">
            <circle cx="165" cy="35" r="26" fill="white" stroke="#FFE066" strokeWidth="3" filter="url(#softGlow)" />
            <text x="165" y="45" fontSize="28" textAnchor="middle" className="animate-bounce">
              {activeEmoji}
            </text>
          </g>
        )}

        {/* Zzz sleeping bubbles */}
        {action === 'sleeping' && !activeEmoji && (
          <g>
            <text x="160" y="45" className="text-3xl font-extrabold fill-blue-500 opacity-80 animate-ping">
              Zzz
            </text>
          </g>
        )}

        {/* Wind puff on run */}
        {action === 'run' && (
          <text x="20" y="155" className="text-2xl fill-gray-400 animate-pulse">
            💨
          </text>
        )}
      </svg>
    </div>
  );
};
