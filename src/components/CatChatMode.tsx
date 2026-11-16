import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Send, 
  Trash2, 
  Volume2, 
  Sparkles, 
  Cat, 
  MessageSquareHeart,
  Smile
} from 'lucide-react';
import { ChatMessage, CatLevel } from '../types';
import { CatAvatar } from './CatAvatar';
import { VirtualKeyboard } from './VirtualKeyboard';
import { 
  playCorrectBeep, 
  playSuccessFanfare, 
  speakRussianText 
} from '../utils/soundAndEffects';

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
  },
  {
    id: 'pets',
    text: 'А у тебя дома или у бабушки живут другие питомцы? Собачка, рыбки или хомячок?',
    category: 'pets',
    suggestions: ['У меня есть собака 🐕', 'У меня кошка 🐈', 'Рыбки в аквариуме 🐠', 'Пока нет питомца']
  },
  {
    id: 'happiness',
    text: 'А что заставляет тебя улыбаться и чувствовать себя по-настоящему счастливым?',
    category: 'feelings',
    suggestions: ['Обнимашки с родителями 🤗', 'Игры с друзьями', 'Подарки и праздники 🎁', 'Каникулы и отдых']
  },
  {
    id: 'travel',
    text: 'В какой город или сказочное место ты мечтаешь поехать в путешествие?',
    category: 'travel',
    suggestions: ['На тёплое море 🌊', 'В аквапарк 🏄', 'В парк аттракционов 🎡', 'В поход с палаткой ⛺']
  },
  {
    id: 'sweets',
    text: 'Если бы можно было выбрать сладкое угощение прямо сейчас, что бы ты съел?',
    category: 'sweets',
    suggestions: ['Шоколадный торт 🎂', 'Спелую клубнику 🍓', 'Клубничное мороженое 🍧', 'Сладкий арбуз 🍉']
  },
  {
    id: 'magic',
    text: 'Если бы у тебя была настоящая волшебная палочка, какое одно желание ты бы загадал?',
    category: 'magic',
    suggestions: ['Чтобы все были здоровы ❤️', 'Огромный сундук игрушек 🎁', 'Живого динозаврика 🦕']
  },
  {
    id: 'sport',
    text: 'На чём ты больше любишь кататься — на самокате, велосипеде, роликах или санках?',
    category: 'sport',
    suggestions: ['На велосипеде 🚲', 'На самокате 🛴', 'На роликах 🛼', 'На санках зимой 🛷']
  },
  {
    id: 'dreams',
    text: 'Кем ты мечтаешь стать, когда вырастешь взрослым?',
    category: 'dreams',
    suggestions: ['Космонавтом 👨‍🚀', 'Врачом 👩‍⚕️', 'Художником 🎨', 'Изобретателем 🤖', 'Ветеринаром 🐾']
  },
  {
    id: 'books',
    text: 'Ты любишь, когда мама или папа читают тебе сказки перед сном?',
    category: 'books',
    suggestions: ['Да, обожаю сказки! 📖', 'Я сам уже читаю книжки 📚', 'Люблю истории про приключения']
  },
  {
    id: 'sea',
    text: 'Ты любишь купаться в море или речке и строить замки из песка?',
    category: 'summer',
    suggestions: ['Обожаю строить замки из песка 🏰', 'Люблю нырять и плавать 🏊', 'Люблю собирать ракушки 🐚']
  }
];

const DEFAULT_WELCOME_MSG: ChatMessage = {
  id: 'welcome_1',
  sender: 'cat',
  text: 'Привет, мой дорогой друг! Мяу! 🐾 Я твой говорящий котик. Напиши мне что-нибудь в строке внизу, и давай поговорим! А как тебя зовут?',
  timestamp: Date.now()
};

export const CatChatMode: React.FC<CatChatModeProps> = ({
  catLevel,
  soundEnabled,
  onAddXp,
  kbScale,
  onSetKbScale,
  isMobileMode,
  onToggleMobileMode,
  isRewardMode,
  onWordCompleted,
  onChatSent
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

  // Stored child name — once set, we never mistake words like "бананы" for names!
  const [childName, setChildName] = useState<string | null>(() => {
    return localStorage.getItem('typecat_chat_child_name') || null;
  });

  // The topic of the question the cat just asked
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

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isCatThinking]);

  // Helper to format proper names (e.g., "мелисса" -> "Мелисса")
  const formatName = (raw: string): string => {
    const cleaned = raw.replace(/(меня|зовут|мое|моё|имя|привет|я)/gi, '').trim();
    if (!cleaned) return "Дружок";
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
  };

  // Formulate intelligent contextual replies
  const formulateSmartReply = (userInput: string): { replyText: string; nextSuggestions: string[] } => {
    const text = userInput.trim().toLowerCase();
    let acknowledgment = "";
    let effectiveName = childName;

    // 1. NAME DETECTION (STRICT):
    // Name is ONLY parsed if the cat explicitly asked for the name in currentTopicId === 'name',
    // OR if the child explicitly types "меня зовут X" / "мое имя X".
    const isExplicitNameIntro = text.includes('меня зовут') || text.includes('мое имя') || text.includes('моё имя');
    const isAnsweringNameQuestion = currentTopicId === 'name' && !childName;

    if (isExplicitNameIntro || isAnsweringNameQuestion) {
      const extracted = formatName(userInput);
      effectiveName = extracted;
      setChildName(extracted);
      acknowledgment = `Очень приятно познакомиться, ${extracted}! Какое красивое и нежное имя! Мур-мяу! 🐾`;
    }
    // GREETINGS
    else if (text.includes('привет') || text.includes('здравствуй') || text.includes('салют') || text.includes('хай') || text.includes('доброе утро') || text.includes('добрый день')) {
      const phrases = [
        effectiveName ? `Привет-привет, ${effectiveName}! Мурр! Я так счастлив болтать с тобой!` : "Привет-привет, мурр! Я так счастлив болтать с тобой!",
        effectiveName ? `Мяу! Привет, ${effectiveName}! Я как раз сладко потягивался и думал о нашей игре!` : "Мяу! Привет! Я как раз сладко потягивался и думал о нашей игре!",
        "Привет, мой лучший друг! Мои кошачьи ушки сразу навострились от радости!"
      ];
      acknowledgment = phrases[Math.floor(Math.random() * phrases.length)];
    }
    // HOW ARE YOU
    else if (text.includes('как дела') || text.includes('как ты') || text.includes('как настроение') || text.includes('как поживаешь')) {
      const phrases = [
        effectiveName ? `У меня всё просто замечательно, ${effectiveName}! Помурлыкал и готов играть!` : "У меня всё просто замечательно! Помурлыкал и готов играть!",
        "Мурр! Мои дела чудесно, особенно сейчас, когда мы с тобой так здорово общаемся!",
        "Отлично! Я полон сил и энергии! Мяу!"
      ];
      acknowledgment = phrases[Math.floor(Math.random() * phrases.length)];
    }
    // FOOD & FRUITS (Recognizes bananas, apples, pizza, ice cream, etc.)
    else if (currentTopicId === 'food' || text.includes('банан') || text.includes('пицц') || text.includes('морожен') || text.includes('торт') || text.includes('шоколад') || text.includes('каш') || text.includes('суп') || text.includes('блин') || text.includes('ягод') || text.includes('яблок') || text.includes('клубник') || text.includes('арбуз') || text.includes('пельмен') || text.includes('макарон') || text.includes('конфет') || text.includes('еда') || text.includes('кушать')) {
      if (text.includes('банан')) {
        acknowledgment = effectiveName 
          ? `О, бананы! ${effectiveName}, это же так сладко, вкусно и очень полезно! Обезьянки и котики в восторге! 🍌`
          : "О, бананы! Это же так сладко, вкусно и очень полезно! Обезьянки и котики в восторге! 🍌";
      } else if (text.includes('пицц')) {
        acknowledgment = "Ммм, горячая пицца с тянущимся сыром! Это настоящее объедение! Ням-ням! 🍕";
      } else if (text.includes('морожен')) {
        acknowledgment = "Мороженое — самое освежающее и сладкое лакомство на свете! Мой любимый десерт! 🍦";
      } else if (text.includes('яблок') || text.includes('клубник') || text.includes('ягод') || text.includes('арбуз')) {
        acknowledgment = "Свежие сочные фрукты и ягоды — это чистые витамины и здоровье! Молодец, что любишь такое! 🍓";
      } else {
        acknowledgment = effectiveName 
          ? `Ммм, звучит невероятно вкусно, ${effectiveName}! У меня аж животик аппетитно заурчал! Мурр! 🥣`
          : "Ммм, звучит невероятно вкусно! У меня аж животик аппетитно заурчал! Мурр! 🥣";
      }
    }
    // COLORS
    else if (currentTopicId === 'color' || text.includes('син') || text.includes('красн') || text.includes('зелен') || text.includes('желт') || text.includes('розов') || text.includes('фиолет') || text.includes('оранж') || text.includes('бел') || text.includes('черн') || text.includes('голуб') || text.includes('бирюз')) {
      acknowledgment = effectiveName 
        ? `Ого, ${effectiveName}, это потрясающий цвет! Очень яркий, красивый и благородный! Мои зелёные кошачьи глазки тоже им любуются! 🎨`
        : "Ого, это потрясающий цвет! Очень яркий, красивый и благородный! Мои зелёные кошачьи глазки тоже им любуются! 🎨";
    }
    // ANIMALS
    else if (currentTopicId === 'animal' || text.includes('собак') || text.includes('пес') || text.includes('кошк') || text.includes('кот') || text.includes('хомяк') || text.includes('панд') || text.includes('динозавр') || text.includes('рыбк') || text.includes('дельфин') || text.includes('попугай') || text.includes('тигр') || text.includes('лев') || text.includes('медвед') || text.includes('енот')) {
      if (text.includes('собак') || text.includes('пес')) {
        acknowledgment = "Собачки — такие верные и преданные друзья! Мы, котики, с ними очень даже дружим! 🐶";
      } else if (text.includes('динозавр')) {
        acknowledgment = "Вау, динозавры! Огромные, сильные и древние великаны! Захватывающе! 🦖";
      } else if (text.includes('дельфин')) {
        acknowledgment = "Дельфины такие умные и добрые, обожают прыгать через волны! 🐬";
      } else {
        acknowledgment = "Ух ты, какие они классные! Животные — удивительные создания природы! Мяу! 🐾";
      }
    }
    // GAMES & HOBBIES
    else if (currentTopicId === 'game' || text.includes('лег') || text.includes('прятк') || text.includes('догонялк') || text.includes('машинк') || text.includes('кукл') || text.includes('роблокс') || text.includes('майнкрафт') || text.includes('мяч')) {
      acknowledgment = effectiveName 
        ? `Вау, ${effectiveName}! Это отличная игра, в неё никогда не бывает скучно играть! 🎮`
        : "Вау! Это отличная игра, в неё никогда не бывает скучно играть! 🎮";
    }
    // SUPERPOWERS
    else if (currentTopicId === 'superpower' || text.includes('летать') || text.includes('невидим') || text.includes('волшеб') || text.includes('маги') || text.includes('палочк') || text.includes('суперсил') || text.includes('телепорт')) {
      acknowledgment = "Ничего себе! С такой суперсилой ты был бы настоящим сказочным супергероем! 🦸";
    }
    // SPACE
    else if (currentTopicId === 'space' || text.includes('космос') || text.includes('лун') || text.includes('раке') || text.includes('звезд') || text.includes('марс')) {
      acknowledgment = "Космос — это невероятная тайна! Представь: лететь в невесомости прямо к звёздам! 🚀";
    }
    // SEASONS
    else if (currentTopicId === 'season' || text.includes('лет') || text.includes('зим') || text.includes('осен') || text.includes('весн') || text.includes('снег') || text.includes('солнц')) {
      acknowledgment = "Прекрасный выбор! В этом времени года всегда столько поводов для радости и прогулок! ☀️";
    }
    // CARTOONS & STORIES
    else if (currentTopicId === 'cartoon' || text.includes('мульт') || text.includes('сказк') || text.includes('книг') || text.includes('патруль') || text.includes('паук') || text.includes('три кота')) {
      acknowledgment = "О да, я тоже знаю эту историю! Очень добрый, весёлый и храбрый персонаж! 🎬";
    }
    // DREAMS & PROFESSIONS
    else if (currentTopicId === 'dreams' || text.includes('врач') || text.includes('космонавт') || text.includes('художник') || text.includes('ветеринар') || text.includes('учитель')) {
      acknowledgment = effectiveName 
        ? `Какая замечательная и благородная мечта, ${effectiveName}! У такого умного котика-друга всё обязательно получится! 🌟`
        : "Какая замечательная и благородная мечта! У тебя обязательно всё получится! 🌟";
    }
    // LOVE & FRIENDSHIP
    else if (text.includes('люблю') || text.includes('друг') || text.includes('друж') || text.includes('нравиш') || text.includes('милый') || text.includes('хороший') || text.includes('обожаю')) {
      acknowledgment = effectiveName 
        ? `Мур-мур-мур! Я тоже тебя очень-очень люблю, ${effectiveName}! Ты самый заботливый и добрый хозяин! ❤️`
        : "Мур-мур-мур! Я тоже тебя очень-очень люблю! Ты самый верный и добрый друг! ❤️";
    }
    // AFFIRMATIONS (Да, конечно, ага)
    else if (text === 'да' || text.startsWith('да,') || text.includes('конечно') || text.includes('ага') || text.includes('давай') || text.includes('хочу')) {
      acknowledgment = "Ура, я с тобой согласен всеми четырьмя мягкими лапками и пушистым хвостиком! Мяу!";
    }
    // NEGATIONS (Нет, не хочу)
    else if (text === 'нет' || text.startsWith('нет,') || text.includes('не знаю') || text.includes('не хочу')) {
      acknowledgment = "Понял тебя! У каждого своё мнение и вкус, и это абсолютно здорово и правильно! 🐱";
    }
    // FREEFORM / CREATIVE ANSWERS
    else {
      const freeformCompliments = [
        effectiveName ? `Как интересно ты рассуждаешь, ${effectiveName}! Мурр!` : "Как интересно ты рассуждаешь! Мурр!",
        "Ого, как любопытно! Мне так нравится читать твои умные ответы!",
        effectiveName ? `Мяу! С каждым твоим словом я узнаю тебя всё лучше, ${effectiveName}!` : "Мяу! С каждым твоим словом я узнаю тебя всё лучше!",
        "Какая замечательная мысль! Ты очень творческий и чуткий собеседник! ✨",
        "Ты так ловко и быстро печатаешь пальчиками! Я горжусь тобой! 🐾"
      ];
      acknowledgment = freeformCompliments[Math.floor(Math.random() * freeformCompliments.length)];
    }

    // 2. Select next UNASKED question so questions never repeat!
    let availableQuestions = CAT_QUESTIONS_BANK.filter(q => !askedQuestionIds.includes(q.id));
    if (availableQuestions.length === 0) {
      // If all questions exhausted, reset asked pool except the current one
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

  // Handle Send message
  const handleSendMessage = useCallback((customText?: string) => {
    const textToSend = (customText !== undefined ? customText : inputValue).trim();
    if (!textToSend) return;

    const userMsg: ChatMessage = {
      id: 'user_' + Date.now(),
      sender: 'user',
      text: textToSend,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    if (soundEnabled) playCorrectBeep();

    // Reward XP for child practicing typing
    const xpReward = Math.min(25, Math.max(5, Math.round(textToSend.length * 0.8)));
    onAddXp(xpReward);

    // Notify word count for reward mode and achievements
    const wordsCount = textToSend.split(/\s+/).filter(Boolean).length;
    if (wordsCount > 0) {
      const avgLen = Math.round(textToSend.length / wordsCount);
      onWordCompleted?.(wordsCount, avgLen);
    }
    onChatSent?.();

    // Cat thinks and answers
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
  }, [inputValue, soundEnabled, onAddXp, askedQuestionIds, currentTopicId, childName]);

  // Clear dialog: wipes chat history, resets child name, resets topic to greeting
  const handleClearHistory = () => {
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

  // Virtual keyboard support
  const handleVirtualKey = (char: string) => {
    if (char === ' ') {
      setInputValue(prev => prev + ' ');
    } else {
      setInputValue(prev => prev + char);
    }
  };

  return (
    <div translate="no" className="notranslate w-full max-w-4xl flex flex-col items-center gap-3">
      {/* Top Banner with Cat and Info */}
      <div className="w-full bg-white/95 rounded-2xl shadow-sm border border-slate-200 p-3 sm:p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center">
            <CatAvatar
              action={catAction}
              stage={catLevel}
              scaleOverride={0.4}
            />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
              <span>Диалог с любимым котиком</span>
              {childName && (
                <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                  <span>🐾</span>
                  <span>Друг: {childName}</span>
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500">
              Печатай ответы и вопросы — котик слушает, понимает темы и запоминает твоё имя!
            </p>
          </div>
        </div>

        {/* Clear History Button */}
        <button
          type="button"
          onClick={handleClearHistory}
          className="p-2.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition border border-transparent hover:border-rose-200 flex items-center gap-1"
          title="Очистить всю историю переписки"
        >
          <Trash2 className="w-4 h-4" />
          <span className="text-xs font-bold hidden sm:inline">Очистить</span>
        </button>
      </div>

      {/* Enlarged Chat Messages Feed */}
      <div className="w-full bg-white rounded-3xl p-4 sm:p-6 shadow-md border-2 border-slate-200 min-h-[440px] max-h-[580px] sm:min-h-[480px] sm:max-h-[620px] overflow-y-auto flex flex-col gap-3.5 select-text">
        {messages.map((msg) => {
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
                  {!isUser && soundEnabled && (
                    <button
                      type="button"
                      onClick={() => speakRussianText(msg.text)}
                      className="text-slate-400 hover:text-purple-600 p-1 rounded-lg hover:bg-slate-200/70 transition flex-shrink-0"
                      title="Озвучить ответ котика"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-full bg-purple-100 border border-purple-300 flex items-center justify-center text-xs font-bold text-purple-700 flex-shrink-0 mt-0.5 shadow-sm">
                  Ты
                </div>
              )}
            </div>
          );
        })}

        {/* Cat Thinking Indicator */}
        {isCatThinking && (
          <div className="flex items-center gap-2 text-xs text-purple-600 bg-purple-50 px-3.5 py-2 rounded-2xl w-fit animate-pulse border border-purple-200">
            <span>🐾 Котик мурлычет и печатает ответ...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Dynamic Suggestions below chat */}
      <div className="w-full flex items-center gap-1.5 overflow-x-auto pb-1 select-none">
        <span className="text-[11px] font-bold text-slate-400 uppercase flex-shrink-0 flex items-center gap-1">
          <Smile className="w-3.5 h-3.5 text-purple-500" />
          Подсказки:
        </span>
        {currentSuggestions.map((prompt) => (
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
          placeholder="Напечатай ответ или вопрос котику..."
          className="flex-1 px-4 py-2 text-sm sm:text-base border-0 focus:outline-none bg-transparent font-medium text-slate-800 placeholder-slate-400"
        />

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
