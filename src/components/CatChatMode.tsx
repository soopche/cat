import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Send, 
  Trash2, 
  Volume2, 
  Smile,
  Users
} from 'lucide-react';
import { ChatMessage, CatLevel } from '../types';
import { CatAvatar } from './CatAvatar';
import { VirtualKeyboard } from './VirtualKeyboard';
import { 
  playCorrectBeep, 
  playSuccessFanfare, 
  speakRussianText 
} from '../utils/soundAndEffects';
import { CoopPlayerState } from '../utils/mqttCoopRoom';

export interface CoopChatMessageItem {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

interface CatChatModeProps {
  catLevel: CatLevel;
  soundEnabled: boolean;
  onAddXp: (amount: number) => void;
  kbScale: number;
  onSetKbScale: (s: number) => void;
  isMobileMode: boolean;
  onToggleMobileMode: () => void;
  isRewardMode?: boolean;
  onWordCompleted?: (wordsCount?: number, charLength?: number) => void;
  onChatSent?: () => void;
  // Co-op Friend Chat props
  isCoopRoomActive?: boolean;
  coopRoomCode?: string | null;
  coopPartner?: CoopPlayerState | null;
  coopChatMessages?: CoopChatMessageItem[];
  onSendCoopChatMessage?: (text: string) => void;
  onClearCoopChatMessages?: () => void;
  selfPlayerId?: string;
}

interface CatQuestion {
  id: string;
  text: string;
  category: string;
  suggestions: string[];
}

const CAT_QUESTIONS_BANK: CatQuestion[] = [
  {
    id: 'food',
    text: 'А что самое вкусненькое ты любишь кушать? Мяу!',
    category: 'food',
    suggestions: ['Бананы 🍌', 'Пицца 🍕', 'Мороженое 🍦', 'Блинчики 🥞', 'Клубника 🍓']
  },
  {
    id: 'color',
    text: 'А какой твой самый любимый цвет на свете?',
    category: 'favorites',
    suggestions: ['Синий 💙', 'Зелёный 💚', 'Красный ❤️', 'Жёлтый 💛', 'Розовый 💖']
  },
  {
    id: 'animal',
    text: 'Какое твоё самое любимое животное, кроме котиков? Мурр!',
    category: 'nature',
    suggestions: ['Собака 🐶', 'Панда 🐼', 'Динозавр 🦖', 'Дельфин 🐬', 'Хомяк 🐹']
  },
  {
    id: 'game',
    text: 'В какие игры ты больше всего любишь играть с друзьями или дома?',
    category: 'play',
    suggestions: ['Лего и конструктор', 'Прятки', 'Догонялки', 'Настольные игры', 'Роблокс']
  },
  {
    id: 'superpower',
    text: 'Если бы у тебя была суперсила, что бы ты выбрал — летать как птица или становиться невидимым?',
    category: 'imagination',
    suggestions: ['Уметь летать 🦅', 'Быть невидимым 👻', 'Телепортироваться ⚡', 'Говорить с животными 🐾']
  },
  {
    id: 'space',
    text: 'Ты любишь смотреть на ночные звёзды? Хотел бы полететь на космической ракете на Луну?',
    category: 'space',
    suggestions: ['Да, очень хочу на Луну! 🚀', 'Люблю смотреть на звёзды ✨', 'Хочу быть космонавтом']
  },
  {
    id: 'season',
    text: 'Какое твоё любимое время года — теплое лето, снежная зима или золотая осень?',
    category: 'seasons',
    suggestions: ['Лето ☀️', 'Зима со снегом ❄️', 'Весна 🌸', 'Осень с листьями 🍂']
  },
  {
    id: 'cartoon',
    text: 'Какой твой самый любимый мультик или сказочный герой?',
    category: 'cartoons',
    suggestions: ['Три кота 🐱', 'Щенячий патруль 🐾', 'Холодное сердце ❄️', 'Человек-паук 🕷️']
  },
  {
    id: 'toys',
    text: 'Какая твоя самая любимая игрушка в комнате?',
    category: 'toys',
    suggestions: ['Мягкий плюшевый мишка 🧸', 'Машинки 🚗', 'Куклы 👧', 'Конструктор']
  },
  {
    id: 'hobby',
    text: 'Чем тебе больше всего нравится заниматься: рисовать, лепить, петь или танцевать?',
    category: 'creative',
    suggestions: ['Рисовать красками 🎨', 'Лепить из пластилина', 'Петь и танцевать 💃', 'Гулять на улице']
  }
];

const DEFAULT_WELCOME_MSG: ChatMessage = {
  id: 'welcome_1',
  sender: 'cat',
  text: 'Привет, мой дорогой друг! Мяу! 🐾 Я твой говорящий котик. Напиши мне что-нибудь в строке внизу, и давай поговорим! А как тебя зовут?',
  timestamp: Date.now()
};

function getCoopFriendSuggestions(lastFriendMessage?: string): { catTip: string; suggestions: string[] } {
  const lower = (lastFriendMessage || '').toLowerCase();
  if (!lower) {
    return {
      catTip: 'Котик подсказывает: поздоровайся с другом или предложи начать соревнование!',
      suggestions: [
        'Привет! Рад играть вместе! 🐾',
        'Как твои дела?',
        'Давай побежим в Марафон слов! 🏁',
        'Пойдём в Буквенный спринт! 🔤',
        'Какая твоя любимая игра?'
      ]
    };
  }
  if (lower.includes('привет') || lower.includes('здравствуй')) {
    return {
      catTip: 'Котик мурлычет: друг поздоровался с тобой! Ответь ему дружелюбно:',
      suggestions: [
        'Привет-привет! Давай играть! 🐱',
        'Ура, мы в одной комнате! 🎉',
        'В какой режим пойдём соревноваться?',
        'Как твоё настроение?'
      ]
    };
  }
  if (lower.includes('марафон') || lower.includes('букв') || lower.includes('скорост') || lower.includes('игра')) {
    return {
      catTip: 'Котик подсказывает: друг зовёт на соревнование!',
      suggestions: [
        'Давай! Я готов! 🚀',
        'Отличная идея, начинай раунд!',
        'Давай на 25 слов на скорость! 🏆',
        'Удачи нам обоим! 🐾'
      ]
    };
  }
  return {
    catTip: 'Котик подсказывает интересные фразы для беседы с другом:',
    suggestions: [
      'Ты очень быстро печатаешь! ⚡',
      'Здорово играем! Давай ещё раунд! 🏆',
      'А какое твоё любимое животное? 🐶',
      'Что ты любишь из вкусняшек? 🍕',
      'Ты супер напарник! 🤝'
    ]
  };
}

export const CatChatMode: React.FC<CatChatModeProps> = ({
  catLevel,
  soundEnabled,
  onAddXp,
  kbScale,
  onSetKbScale,
  isMobileMode,
  onToggleMobileMode,
  onWordCompleted,
  onChatSent,
  isCoopRoomActive = false,
  coopRoomCode = null,
  coopPartner = null,
  coopChatMessages = [],
  onSendCoopChatMessage,
  onClearCoopChatMessages,
  selfPlayerId = ''
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('typecat_chat_history_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.warn("Failed to parse chat history", e);
      }
    }
    return [DEFAULT_WELCOME_MSG];
  });

  const [childName, setChildName] = useState<string | null>(() => {
    return localStorage.getItem('typecat_chat_child_name') || null;
  });

  const [currentTopicId, setCurrentTopicId] = useState<string>(() => {
    return localStorage.getItem('typecat_chat_current_topic') || 'name';
  });

  const [askedQuestionIds, setAskedQuestionIds] = useState<string[]>(['name']);
  const [inputValue, setInputValue] = useState<string>('');
  const [isCatThinking, setIsCatThinking] = useState<boolean>(false);
  const [catAction, setCatAction] = useState<any>('idle');
  const [currentSuggestions, setCurrentSuggestions] = useState<string[]>([
    "Привет!",
    "Меня зовут Саша",
    "Меня зовут Мелисса",
    "Как твои дела?",
    "Я учусь печатать!"
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Save state
  useEffect(() => {
    localStorage.setItem('typecat_chat_history_v1', JSON.stringify(messages));
    if (childName) {
      localStorage.setItem('typecat_chat_child_name', childName);
    } else {
      localStorage.removeItem('typecat_chat_child_name');
    }
    localStorage.setItem('typecat_chat_current_topic', currentTopicId);
  }, [messages, childName, currentTopicId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isCatThinking, coopChatMessages.length]);

  const formatName = (raw: string): string => {
    const cleaned = raw.replace(/(меня|зовут|мое|моё|имя|привет|я)/gi, '').trim();
    if (!cleaned) return "Дружок";
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
  };

  const formulateSmartReply = (userInput: string): { replyText: string; nextSuggestions: string[] } => {
    const text = userInput.trim().toLowerCase();
    let acknowledgment = "";
    let effectiveName = childName;

    const isExplicitNameIntro = text.includes('меня зовут') || text.includes('мое имя') || text.includes('моё имя');
    const isAnsweringNameQuestion = currentTopicId === 'name' && !childName;

    if (isExplicitNameIntro || isAnsweringNameQuestion) {
      const extracted = formatName(userInput);
      effectiveName = extracted;
      setChildName(extracted);
      acknowledgment = `Очень приятно познакомиться, ${extracted}! Какое красивое и нежное имя! Мур-мяу! 🐾`;
    } else if (text.includes('привет') || text.includes('здравствуй') || text.includes('салют')) {
      acknowledgment = effectiveName
        ? `Привет-привет, ${effectiveName}! Мурр! Я так счастлив болтать с тобой!`
        : "Привет-привет, мурр! Я так счастлив болтать с тобой!";
    } else if (text.includes('как дела') || text.includes('как ты')) {
      acknowledgment = effectiveName
        ? `У меня всё просто замечательно, ${effectiveName}! Помурлыкал и готов играть!`
        : "У меня всё просто замечательно! Помурлыкал и готов играть!";
    } else if (currentTopicId === 'food' || text.includes('банан') || text.includes('пицц') || text.includes('морожен') || text.includes('клубник')) {
      if (text.includes('банан')) {
        acknowledgment = effectiveName 
          ? `О, бананы! ${effectiveName}, это же так сладко, вкусно и очень полезно! 🍌`
          : "О, бананы! Это же так сладко, вкусно и очень полезно! 🍌";
      } else {
        acknowledgment = "Ммм, звучит невероятно вкусно! У меня аж животик аппетитно заурчал! Мурр! 🥣";
      }
    } else {
      const freeformCompliments = [
        effectiveName ? `Как интересно ты рассуждаешь, ${effectiveName}! Мурр!` : "Как интересно ты рассуждаешь! Мурр!",
        "Ого, как любопытно! Мне так нравится читать твои умные ответы!",
        "Какая замечательная мысль! Ты очень творческий и чуткий собеседник! ✨",
        "Ты так ловко и быстро печатаешь пальчиками! Я горжусь тобой! 🐾"
      ];
      acknowledgment = freeformCompliments[Math.floor(Math.random() * freeformCompliments.length)];
    }

    let availableQuestions = CAT_QUESTIONS_BANK.filter(q => !askedQuestionIds.includes(q.id));
    if (availableQuestions.length === 0) {
      availableQuestions = CAT_QUESTIONS_BANK.filter(q => q.id !== currentTopicId);
      setAskedQuestionIds([]);
    }

    const nextQuestion = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
    setAskedQuestionIds(prev => [...prev, nextQuestion.id]);
    setCurrentTopicId(nextQuestion.id);

    const replyText = `${acknowledgment} ${nextQuestion.text}`;
    return {
      replyText,
      nextSuggestions: nextQuestion.suggestions
    };
  };

  // Handle Send message (supports both Co-op Friend Chat and Solo Cat Chat)
  const handleSendMessage = useCallback((customText?: string) => {
    const textToSend = (customText !== undefined ? customText : inputValue).trim();
    if (!textToSend) return;

    setInputValue('');
    if (soundEnabled) playCorrectBeep();

    const xpReward = Math.min(25, Math.max(5, Math.round(textToSend.length * 0.8)));
    onAddXp(xpReward);

    const wordsCount = textToSend.split(/\s+/).filter(Boolean).length;
    if (wordsCount > 0) {
      const avgLen = Math.round(textToSend.length / wordsCount);
      onWordCompleted?.(wordsCount, avgLen);
    }
    onChatSent?.();

    if (isCoopRoomActive && onSendCoopChatMessage) {
      onSendCoopChatMessage(textToSend);
      setCatAction('love');
      setTimeout(() => setCatAction('idle'), 1200);
      return;
    }

    const userMsg: ChatMessage = {
      id: 'user_' + Date.now(),
      sender: 'user',
      text: textToSend,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setIsCatThinking(true);
    setCatAction('smart');

    setTimeout(() => {
      const { replyText, nextSuggestions } = formulateSmartReply(textToSend);
      const catMsg: ChatMessage = {
        id: 'cat_' + Date.now(),
        sender: 'cat',
        text: replyText,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, catMsg]);
      setCurrentSuggestions(nextSuggestions);
      setIsCatThinking(false);
      setCatAction('love');
      setTimeout(() => setCatAction('idle'), 1500);

      if (soundEnabled) {
        playSuccessFanfare();
        speakRussianText(replyText);
      }
    }, 700);
  }, [inputValue, soundEnabled, onAddXp, askedQuestionIds, currentTopicId, childName, isCoopRoomActive, onSendCoopChatMessage, onWordCompleted, onChatSent]);

  const handleClearHistory = () => {
    if (isCoopRoomActive && onClearCoopChatMessages) {
      onClearCoopChatMessages();
      return;
    }
    localStorage.removeItem('typecat_chat_history_v1');
    localStorage.removeItem('typecat_chat_child_name');
    localStorage.removeItem('typecat_chat_current_topic');
    setChildName(null);
    setCurrentTopicId('name');
    setAskedQuestionIds(['name']);
    setMessages([
      {
        id: 'welcome_' + Date.now(),
        sender: 'cat',
        text: 'Привет, мой дорогой друг! Мяу! 🐾 Наш диалог очищен. Давай поболтаем с чистого листа! Как тебя зовут?',
        timestamp: Date.now()
      }
    ]);
    setCurrentSuggestions([
      "Привет!",
      "Меня зовут Саша",
      "Меня зовут Мелисса",
      "Как твои дела?",
      "Я учусь печатать!"
    ]);
    if (soundEnabled) playSuccessFanfare();
  };

  const handleVirtualKey = (char: string) => {
    if (char === ' ') {
      setInputValue(prev => prev + ' ');
    } else {
      setInputValue(prev => prev + char);
    }
  };

  // Speak the latest message in the dialog (regardless of whether it is from user, friend, or cat)
  const handleSpeakLastMessage = useCallback(() => {
    if (isCoopRoomActive) {
      const lastCoopMsg = coopChatMessages[coopChatMessages.length - 1];
      if (lastCoopMsg?.text) {
        speakRussianText(lastCoopMsg.text);
        return;
      }
      if (inputValue.trim()) {
        speakRussianText(inputValue.trim());
      }
      return;
    }

    const lastSoloMsg = messages[messages.length - 1];
    if (lastSoloMsg?.text) {
      speakRussianText(lastSoloMsg.text);
      return;
    }
    if (inputValue.trim()) {
      speakRussianText(inputValue.trim());
    }
  }, [isCoopRoomActive, coopChatMessages, messages, inputValue]);

  // Global hotkey Alt + 1 in CatChatMode: speak the last message (mine, friend's, or cat's)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === '1' || e.code === 'Digit1')) {
        e.preventDefault();
        handleSpeakLastMessage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSpeakLastMessage]);

  // Determine active suggestions and cat tip when in Co-op Friend Chat mode
  const lastPartnerMessage = isCoopRoomActive
    ? [...coopChatMessages].reverse().find(m => m.senderId !== selfPlayerId)?.text
    : undefined;
  const coopHelper = getCoopFriendSuggestions(lastPartnerMessage);
  const activeSuggestions = isCoopRoomActive ? coopHelper.suggestions : currentSuggestions;

  return (
    <div translate="no" className="notranslate w-full max-w-4xl flex flex-col items-center gap-3">
      {/* Top Banner with Cat Helper and Info */}
      <div className="w-full bg-white/95 rounded-2xl shadow-sm border border-slate-200 p-3 sm:p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center">
            <CatAvatar
              action={catAction}
              stage={catLevel}
              scaleOverride={0.4}
            />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2 flex-wrap">
              {isCoopRoomActive ? (
                <>
                  <Users className="w-5 h-5 text-indigo-600" />
                  <span>Диалог со своим другом (Комната {coopRoomCode})</span>
                  {coopPartner && (
                    <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                      <span>🤝</span>
                      <span>На связи: {coopPartner.name}</span>
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span>Диалог с любимым котиком</span>
                  {childName && (
                    <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                      <span>🐾</span>
                      <span>Друг: {childName}</span>
                    </span>
                  )}
                </>
              )}
            </h3>
            <p className="text-xs text-slate-500">
              {isCoopRoomActive
                ? coopHelper.catTip
                : 'Печатай ответы и вопросы — котик слушает, понимает темы и запоминает твоё имя!'}
            </p>
          </div>
        </div>

        {/* Speak Last Message (Alt + 1) & Clear History Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              handleSpeakLastMessage();
            }}
            className="px-3 py-2 text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-xl transition border border-purple-200 flex items-center gap-1.5 text-xs font-bold shadow-2xs cursor-pointer"
            title="Озвучить последнее сообщение (Alt + 1)"
          >
            <Volume2 className="w-4 h-4 text-purple-600" />
            <span>Озвучить (Alt + 1)</span>
          </button>

          <button
            type="button"
            onClick={handleClearHistory}
            className="p-2.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition border border-transparent hover:border-rose-200 flex items-center gap-1"
            title="Очистить переписку"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-xs font-bold hidden sm:inline">Очистить</span>
          </button>
        </div>
      </div>

      {/* Chat Messages Feed (Co-op Friend Chat vs Solo Cat Chat) */}
      <div className="w-full bg-white rounded-3xl p-4 sm:p-6 shadow-md border-2 border-slate-200 min-h-[380px] max-h-[520px] overflow-y-auto flex flex-col gap-3.5 select-text">
        {isCoopRoomActive ? (
          coopChatMessages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400 gap-2">
              <span className="text-4xl">💬</span>
              <p className="font-bold text-slate-600 text-sm">
                Напиши первое сообщение своему другу в комнате {coopRoomCode}!
              </p>
              <p className="text-xs text-slate-400 max-w-md">
                Можешь напечатать свой текст на клавиатуре или выбрать любую подсказку от котика ниже.
              </p>
            </div>
          ) : (
            coopChatMessages.map((msg) => {
              const isSelf = msg.senderId === selfPlayerId;
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${isSelf ? 'justify-end' : 'justify-start'}`}
                >
                  {!isSelf && (
                    <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-300 flex items-center justify-center text-sm flex-shrink-0 mt-0.5 shadow-sm">
                      🐾
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] sm:max-w-[75%] p-3.5 sm:p-4 rounded-3xl text-sm sm:text-base leading-relaxed shadow-sm ${
                      isSelf
                        ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white rounded-tr-none font-medium'
                        : 'bg-sky-50 text-slate-800 border border-sky-200 rounded-tl-none font-medium'
                    }`}
                  >
                    <div className="text-[10px] font-black uppercase opacity-75 mb-0.5">
                      {isSelf ? 'Ты' : msg.senderName}
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="break-words">{msg.text}</span>
                      <button
                        type="button"
                        onClick={() => speakRussianText(msg.text)}
                        className={`p-1 rounded-lg transition flex-shrink-0 cursor-pointer ${
                          isSelf
                            ? 'text-white/80 hover:text-white hover:bg-white/20'
                            : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-200/70'
                        }`}
                        title={isSelf ? 'Озвучить моё сообщение' : 'Озвучить сообщение друга'}
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {isSelf && (
                    <div className="w-8 h-8 rounded-full bg-purple-100 border border-purple-300 flex items-center justify-center text-xs font-bold text-purple-700 flex-shrink-0 mt-0.5 shadow-sm">
                      Ты
                    </div>
                  )}
                </div>
              );
            })
          )
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-orange-100 border border-orange-300 flex items-center justify-center text-base flex-shrink-0 mt-0.5 shadow-sm">
                    🐱
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[75%] p-3.5 sm:p-4 rounded-3xl text-sm sm:text-base leading-relaxed shadow-sm ${
                    isUser
                      ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white rounded-tr-none font-medium'
                      : 'bg-slate-100 text-slate-800 border border-slate-200/80 rounded-tl-none font-medium'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="break-words">{msg.text}</span>
                    <button
                      type="button"
                      onClick={() => speakRussianText(msg.text)}
                      className={`p-1 rounded-lg transition flex-shrink-0 cursor-pointer ${
                        isUser
                          ? 'text-white/80 hover:text-white hover:bg-white/20'
                          : 'text-slate-400 hover:text-purple-600 hover:bg-slate-200/70'
                      }`}
                      title={isUser ? 'Озвучить моё сообщение' : 'Озвучить ответ котика'}
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-full bg-purple-100 border border-purple-300 flex items-center justify-center text-xs font-bold text-purple-700 flex-shrink-0 mt-0.5 shadow-sm">
                    Ты
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Cat Thinking Indicator */}
        {!isCoopRoomActive && isCatThinking && (
          <div className="flex items-center gap-2 text-xs text-purple-600 bg-purple-50 px-3.5 py-2 rounded-2xl w-fit animate-pulse border border-purple-200">
            <span>🐾 Котик мурлычет и печатает ответ...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Dynamic Suggestions below chat (Cat gives conversation suggestions in both Solo and Co-op!) */}
      <div className="w-full flex items-center gap-1.5 overflow-x-auto pb-1 select-none">
        <span className="text-[11px] font-bold text-slate-500 uppercase flex-shrink-0 flex items-center gap-1">
          <Smile className="w-3.5 h-3.5 text-purple-500" />
          {isCoopRoomActive ? 'Подсказки котика:' : 'Подсказки:'}
        </span>
        {activeSuggestions.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => handleSendMessage(prompt)}
            className="px-3 py-1.5 bg-white hover:bg-purple-50 text-purple-900 border border-purple-200 hover:border-purple-300 rounded-xl text-xs font-semibold whitespace-nowrap shadow-sm transition active:scale-95"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Message Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="w-full flex items-center gap-2 bg-white p-2 sm:p-2.5 rounded-2xl shadow-sm border-2 border-purple-100 focus-within:border-purple-400 transition"
      >
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={
            isCoopRoomActive
              ? 'Напиши сообщение своему другу...'
              : 'Напечатай ответ или вопрос котику...'
          }
          className="flex-1 px-4 py-2 text-sm sm:text-base border-0 focus:outline-none bg-transparent font-medium text-slate-800 placeholder-slate-400"
        />

        {inputValue.trim().length > 0 && (
          <button
            type="button"
            onClick={() => speakRussianText(inputValue.trim())}
            className="p-2.5 text-purple-600 hover:bg-purple-50 rounded-xl transition flex items-center gap-1 border border-purple-200 cursor-pointer"
            title="Озвучить набранный свой текст"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        )}

        <button
          type="submit"
          disabled={!inputValue.trim()}
          className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-40 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-md shadow-purple-200 transition active:scale-95"
          title="Отправить (Enter)"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Отправить</span>
        </button>
      </form>

      {/* Virtual Keyboard */}
      <VirtualKeyboard
        currentExpectedChar={undefined}
        hintKey={null}
        onKeyPress={handleVirtualKey}
        isMobileMode={isMobileMode}
        onToggleMobileMode={onToggleMobileMode}
        kbScale={kbScale}
        onSetKbScale={onSetKbScale}
      />
    </div>
  );
};
