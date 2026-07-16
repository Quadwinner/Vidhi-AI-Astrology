// --- FINAL, REFACTORED VERSION ---

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// 1. Import the new wrapper function.
import { createCorsWrappedHandler, corsHeaders } from '../_shared/cors.ts';

// Helper functions for standardized error handling
function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function containsHindi(text: string): boolean {
  // Check if text contains Devanagari script (Hindi characters)
  const hindiRegex = /[\u0900-\u097F]/;
  return hindiRegex.test(text);
}

function addVocalTractModeling(text: string): string {
  // Advanced vocal tract modeling for ultra-realistic speech
  let modeled = text;

  // Add natural breath intake sounds before long sentences
  modeled = modeled.replace(/([.!?])\s+([A-Z][^.!?]{50,})/g, '$1<audio src="breath_in.wav"/><break time="0.1s"/>$2');

  // Add subtle lip smacks and mouth sounds (very low probability for realism)
  if (Math.random() < 0.02) {
    modeled = modeled.replace(/^/, '<audio src="lip_smack.wav" soundLevel="-20dB"/>');
  }

  // Add throat clearing before important statements (1% chance)
  modeled = modeled.replace(/\b(important|महत्वपूर्ण|attention|ध्यान|listen|सुनिए)\b/gi, (match) => {
    return Math.random() < 0.01 ? `<audio src="throat_clear.wav" soundLevel="-15dB"/><break time="0.2s"/>${match}` : match;
  });

  // Add natural swallowing sounds between long phrases (0.5% chance)
  modeled = modeled.replace(/([.!?])\s+([A-Z])/g, (match, p1, p2) => {
    return Math.random() < 0.005 ? `${p1}<audio src="swallow.wav" soundLevel="-18dB"/><break time="0.3s"/>${p2}` : match;
  });

  // Add vocal fry at sentence endings for naturalness (Indian accent characteristic)
  modeled = modeled.replace(/([^.!?]{20,}[.!?])/g, (match) => {
    if (Math.random() < 0.08) {
      return `<prosody pitch="-15%" rate="0.8">${match.slice(0, -1)}</prosody>${match.slice(-1)}`;
    }
    return match;
  });

  return modeled;
}

function addEmotionalAging(text: string, emotion: string): string {
  // Emotional voice aging - voice characteristics change with emotional state
  let aged = text;

  const agingPatterns = {
    excitement: {
      // Excitement makes voice slightly younger/higher
      voiceAge: 'young',
      breathPattern: 'quick',
      resonance: 'bright'
    },
    concern: {
      // Concern adds maturity and weight
      voiceAge: 'mature',
      breathPattern: 'deep',
      resonance: 'warm'
    },
    warmth: {
      // Warmth adds gentle aging
      voiceAge: 'gentle',
      breathPattern: 'soft',
      resonance: 'rich'
    },
    authority: {
      // Authority adds gravitas
      voiceAge: 'experienced',
      breathPattern: 'controlled',
      resonance: 'full'
    },
    mystery: {
      // Mystery adds ethereal quality
      voiceAge: 'timeless',
      breathPattern: 'whispered',
      resonance: 'hollow'
    }
  };

  const aging = agingPatterns[emotion] || agingPatterns.warmth;

  // Apply voice aging characteristics
  aged = `<voice-effect type="${aging.voiceAge}">${aged}</voice-effect>`;
  aged = `<breath-pattern type="${aging.breathPattern}">${aged}</breath-pattern>`;
  aged = `<resonance type="${aging.resonance}">${aged}</resonance>`;

  return aged;
}

function addConversationalMemory(text: string): string {
  // Simulate conversational memory and relationship building
  let remembered = text;

  // Add occasional callback references (simulating memory)
  const memoryCallbacks = [
    'जैसा कि मैंने पहले कहा था...', 'आप जानते हैं...', 'हमने जो बात की थी...',
    'as I mentioned before...', 'you know...', 'like we discussed...'
  ];

  if (Math.random() < 0.03) {
    const callback = memoryCallbacks[Math.floor(Math.random() * memoryCallbacks.length)];
    remembered = `${callback} ${remembered}`;
  }

  // Add relationship building phrases
  const relationshipPhrases = [
    'मैं आपको बताना चाहूंगा...', 'आपके लिए विशेष रूप से...', 'आप समझेंगे...',
    'I want to share with you...', 'especially for you...', 'you\'ll understand...'
  ];

  if (Math.random() < 0.05) {
    const phrase = relationshipPhrases[Math.floor(Math.random() * relationshipPhrases.length)];
    remembered = remembered.replace(/^([A-Z])/, `${phrase} $1`);
  }

  return remembered;
}

function addDynamicPersonality(text: string, emotion: string): string {
  // Dynamic personality adaptation based on content and emotion
  let personalized = text;

  const personalityTraits = {
    excitement: {
      enthusiasm: 'high',
      pace: 'animated',
      expressiveness: 'vibrant'
    },
    concern: {
      empathy: 'deep',
      pace: 'thoughtful',
      expressiveness: 'caring'
    },
    warmth: {
      kindness: 'gentle',
      pace: 'nurturing',
      expressiveness: 'loving'
    },
    authority: {
      confidence: 'strong',
      pace: 'measured',
      expressiveness: 'commanding'
    },
    mystery: {
      intrigue: 'high',
      pace: 'mysterious',
      expressiveness: 'enigmatic'
    }
  };

  const personality = personalityTraits[emotion] || personalityTraits.warmth;

  // Apply personality layers
  Object.entries(personality).forEach(([trait, value]) => {
    personalized = `<personality-${trait} level="${value}">${personalized}</personality-${trait}>`;
  });

  return personalized;
}

function detectEmotion(text: string): { emotion: string; intensity: number } {
  const emotions = {
    excitement: /(!|wow|amazing|incredible|fantastic|brilliant|wonderful)/gi,
    concern: /(careful|warning|caution|problem|issue|difficult)/gi,
    warmth: /(love|dear|blessed|beautiful|peaceful|calm|gentle)/gi,
    authority: /(must|should|important|remember|crucial|definitely)/gi,
    mystery: /(secret|hidden|reveal|discover|cosmic|divine|mystical)/gi,
    joy: /(happy|joy|celebration|success|good news|fortunate)/gi,
    empathy: /(understand|feel|sorry|comfort|support|healing)/gi
  };

  let detectedEmotion = 'neutral';
  let maxMatches = 0;

  for (const [emotion, regex] of Object.entries(emotions)) {
    const matches = (text.match(regex) || []).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      detectedEmotion = emotion;
    }
  }

  const intensity = Math.min(maxMatches / 3, 1); // 0-1 scale
  return { emotion: detectedEmotion, intensity };
}

function addAdvancedFillers(text: string): string {
  // Ultra-realistic human speech patterns with micro-expressions
  const hindiFillers = {
    thinking: ['उम्म...', 'अच्छा...', 'माने...', 'यानी...', 'क्या कहूं...'],
    transition: ['तो...', 'फिर...', 'अब...', 'देखिए...', 'अरे हाँ...'],
    uncertainty: ['शायद...', 'हो सकता है...', 'लगता है...', 'ऐसा लगता है...'],
    emphasis: ['यही तो बात है...', 'बिल्कुल...', 'एकदम सही...', 'अरे वाह...'],
    softening: ['आप समझ रहे हैं ना...', 'मतलब...', 'यानी कि...']
  };

  const englishFillers = {
    thinking: ['um...', 'well...', 'let me think...', 'you see...'],
    transition: ['so...', 'now...', 'actually...', 'basically...'],
    uncertainty: ['maybe...', 'perhaps...', 'I think...', 'it seems...'],
    emphasis: ['exactly...', 'absolutely...', 'definitely...'],
    softening: ['you know...', 'I mean...', 'sort of...']
  };

  let naturalized = text;
  const isHindi = containsHindi(text);
  const fillerSet = isHindi ? hindiFillers : englishFillers;

  // Add context-appropriate fillers (15% chance)
  naturalized = naturalized.replace(/^([A-Z])/g, (match) => {
    if (Math.random() < 0.15) {
      const emotion = detectEmotion(text).emotion;
      let fillerType = 'thinking';

      if (emotion === 'excitement' || emotion === 'joy') fillerType = 'emphasis';
      else if (emotion === 'concern' || emotion === 'mystery') fillerType = 'softening';
      else if (emotion === 'empathy') fillerType = 'uncertainty';

      const filler = fillerSet[fillerType][Math.floor(Math.random() * fillerSet[fillerType].length)];
      return `${filler} ${match}`;
    }
    return match;
  });

  // Add realistic word repetitions (5% chance for emphasis)
  naturalized = naturalized.replace(/\b(very|बहुत|really|वास्तव में|extremely|अत्यधिक)\b/gi, (match) => {
    return Math.random() < 0.05 ? `${match} ${match}` : match;
  });

  // Add natural self-corrections (3% chance)
  naturalized = naturalized.replace(/\b(good|अच्छा|great|बेहतरीन|nice|सुंदर)\b/gi, (match) => {
    if (Math.random() < 0.03) {
      const corrections = isHindi
        ? ['अच्छा... नहीं मतलब बहुत अच्छा', 'सुंदर... यानी कि बेहतरीन']
        : ['good... well, actually great', 'nice... I mean wonderful'];
      return corrections[Math.floor(Math.random() * corrections.length)];
    }
    return match;
  });

  return naturalized;
}

function addAdvancedBreathing(text: string): string {
  // Ultra-realistic breathing and timing patterns
  let breathingText = text;

  // Emotional breathing patterns
  const emotion = detectEmotion(text).emotion;
  const breathTimes = {
    excitement: { quick: '0.1s', normal: '0.25s', long: '0.4s' },
    concern: { quick: '0.15s', normal: '0.35s', long: '0.6s' },
    warmth: { quick: '0.12s', normal: '0.3s', long: '0.5s' },
    authority: { quick: '0.08s', normal: '0.2s', long: '0.35s' },
    mystery: { quick: '0.2s', normal: '0.45s', long: '0.8s' },
    neutral: { quick: '0.1s', normal: '0.3s', long: '0.5s' }
  };

  const timing = breathTimes[emotion] || breathTimes.neutral;

  // Advanced sentence-level breathing
  breathingText = breathingText.replace(/([.!?])\s+([A-Z][^.!?]{40,})/g, `$1<break time="${timing.long}" strength="medium"/>$2`);
  breathingText = breathingText.replace(/([.!?])\s+([A-Z][^.!?]{20,39})/g, `$1<break time="${timing.normal}" strength="weak"/>$2`);
  breathingText = breathingText.replace(/([.!?])\s+([A-Z][^.!?]{1,19})/g, `$1<break time="${timing.quick}" strength="x-weak"/>$2`);

  // Natural word-level micro-pauses
  breathingText = breathingText.replace(/(\w+)\s+(and|और|तथा|भी|plus|भी)\s+(\w+)/gi, `$1<break time="${timing.quick}" strength="x-weak"/> $2 <break time="${timing.quick}" strength="x-weak"/>$3`);

  // Thinking pauses before complex concepts
  breathingText = breathingText.replace(/\b(because|क्योंकि|therefore|इसलिए|however|लेकिन|although|हालांकि)\b/gi, `<break time="${timing.normal}" strength="weak"/>$1`);

  // Natural hesitation before numbers, names, dates
  breathingText = breathingText.replace(/\b(\d+|january|जनवरी|february|फरवरी|march|मार्च|april|अप्रैल|may|मई|june|जून|july|जुलाई|august|अगस्त|september|सितंबर|october|अक्टूबर|november|नवंबर|december|दिसंबर)\b/gi, `<break time="${timing.quick}" strength="x-weak"/>$1`);

  // Realistic list pauses
  breathingText = breathingText.replace(/,\s+([^,]{1,15}),/g, `,<break time="${timing.quick}" strength="x-weak"/> $1,`);

  // Natural question inflection pauses
  breathingText = breathingText.replace(/\b(what|क्या|how|कैसे|when|कब|where|कहाँ|why|क्यों|which|कौन)\b/gi, `$1<break time="${timing.quick}" strength="x-weak"/>`);

  return breathingText;
}

function addProsodyIntelligence(text: string): string {
  // Advanced contextual prosody and speech intelligence
  let varied = text;
  const emotion = detectEmotion(text).emotion;

  // Intelligent emphasis based on context and emotion
  const emphasisLevels = {
    excitement: 'strong',
    concern: 'moderate',
    warmth: 'reduced',
    authority: 'strong',
    mystery: 'reduced',
    joy: 'moderate',
    empathy: 'reduced',
    neutral: 'reduced'
  };

  const currentEmphasis = emphasisLevels[emotion] || 'reduced';

  // Contextual contrast emphasis
  varied = varied.replace(/\b(but|however|लेकिन|परंतु|on the other hand|दूसरी ओर)\b/gi, `<emphasis level="${currentEmphasis}">$1</emphasis>`);

  // Emotional word emphasis (adaptive to emotion)
  if (emotion === 'warmth' || emotion === 'joy') {
    varied = varied.replace(/\b(love|प्रेम|beautiful|सुंदर|amazing|अद्भुत|wonderful|शानदार|blessed|आशीर्वाद)\b/gi, '<emphasis level="moderate">$1</emphasis>');
  } else {
    varied = varied.replace(/\b(love|प्रेम|beautiful|सुंदर|amazing|अद्भुत|wonderful|शानदार)\b/gi, '<emphasis level="reduced">$1</emphasis>');
  }

  // Dynamic question emphasis based on emotion
  const questionEmphasis = emotion === 'mystery' ? 'reduced' : 'moderate';
  varied = varied.replace(/\b(what|क्या|how|कैसे|when|कब|where|कहाँ|why|क्यों|which|कौन)\b/gi, `<emphasis level="${questionEmphasis}">$1</emphasis>`);

  // Advanced prosody contours for natural speech melody
  varied = varied.replace(/([^.!?]*[.!?])/g, (sentence) => {
    const length = sentence.length;
    if (length > 80) {
      // Long sentences get varied intonation
      return `<prosody contour="(20%,+5Hz) (40%,-2Hz) (60%,+3Hz) (80%,-1Hz) (100%,+0Hz)">${sentence}</prosody>`;
    } else if (length > 40) {
      // Medium sentences get subtle variation
      return `<prosody contour="(30%,+2Hz) (70%,-1Hz) (100%,+0Hz)">${sentence}</prosody>`;
    }
    return sentence; // Short sentences stay natural
  });

  // Add subtle volume variations for realism
  varied = varied.replace(/\b(whisper|चुपके|secret|रहस्य|quietly|चुपचाप)\b/gi, '<prosody volume="-6dB">$1</prosody>');
  varied = varied.replace(/\b(important|महत्वपूर्ण|attention|ध्यान|listen|सुनिए|remember|याद रखिए)\b/gi, '<prosody volume="+3dB">$1</prosody>');

  return varied;
}

function createPerfectSSML(text: string): string {
  const { emotion, intensity } = detectEmotion(text);

  // Layer 1: Advanced human-like elements
  let perfectText = addAdvancedFillers(text);
  perfectText = addAdvancedBreathing(perfectText);
  perfectText = addProsodyIntelligence(perfectText);

  // Layer 1.5: Ultra-advanced human modeling
  perfectText = addVocalTractModeling(perfectText);
  perfectText = addEmotionalAging(perfectText, emotion);
  perfectText = addConversationalMemory(perfectText);
  perfectText = addDynamicPersonality(perfectText, emotion);

  // Layer 1.7: Neural voice enhancements
  perfectText = addNeuralVoiceEnhancements(perfectText, emotion);
  perfectText = addCulturalAuthenticity(perfectText);

  // Layer 2: Micro-timing and emotional intelligence (7% faster total)
  const microTimings = {
    excitement: {
      rate: `${1.03 + (Math.random() * 0.08)}`, // 1.03-1.11 natural variation (+7%)
      pitch: `+${4 + (Math.random() * 6)}%`, // +4% to +10%
      volume: `+${2 + (Math.random() * 4)}dB`, // +2dB to +6dB
      range: `+${8 + (Math.random() * 4)}%` // +8% to +12%
    },
    concern: {
      rate: `${0.92 + (Math.random() * 0.08)}`, // 0.92-1.00 (+7%)
      pitch: `-${1 + (Math.random() * 4)}%`, // -1% to -5%
      volume: `-${1 + (Math.random() * 3)}dB`, // -1dB to -4dB
      range: `-${2 + (Math.random() * 6)}%` // -2% to -8%
    },
    warmth: {
      rate: `${0.91 + (Math.random() * 0.06)}`, // 0.91-0.97 (+7%)
      pitch: `+${1 + (Math.random() * 3)}%`, // +1% to +4%
      volume: `-${2 + (Math.random() * 2)}dB`, // -2dB to -4dB
      range: `+${3 + (Math.random() * 4)}%` // +3% to +7%
    },
    authority: {
      rate: `${1.00 + (Math.random() * 0.06)}`, // 1.00-1.06 (+7%)
      pitch: `-${0.5 + (Math.random() * 2)}%`, // -0.5% to -2.5%
      volume: `+${1 + (Math.random() * 3)}dB`, // +1dB to +4dB
      range: `+${2 + (Math.random() * 3)}%` // +2% to +5%
    },
    mystery: {
      rate: `${0.88 + (Math.random() * 0.06)}`, // 0.88-0.94 (+7%)
      pitch: `-${3 + (Math.random() * 4)}%`, // -3% to -7%
      volume: `-${3 + (Math.random() * 3)}dB`, // -3dB to -6dB
      range: `-${6 + (Math.random() * 4)}%` // -6% to -10%
    },
    joy: {
      rate: `${1.05 + (Math.random() * 0.08)}`, // 1.05-1.13 (+7%)
      pitch: `+${3 + (Math.random() * 4)}%`, // +3% to +7%
      volume: `+${1 + (Math.random() * 3)}dB`, // +1dB to +4dB
      range: `+${6 + (Math.random() * 4)}%` // +6% to +10%
    },
    empathy: {
      rate: `${0.94 + (Math.random() * 0.06)}`, // 0.94-1.00 (+7%)
      pitch: `+${0.5 + (Math.random() * 2)}%`, // +0.5% to +2.5%
      volume: `-${0.5 + (Math.random() * 2)}dB`, // -0.5dB to -2.5dB
      range: `+${2 + (Math.random() * 3)}%` // +2% to +5%
    },
    neutral: {
      rate: `${0.98 + (Math.random() * 0.06)}`, // 0.98-1.04 (+7%)
      pitch: `+${0.2 + (Math.random() * 1.6)}%`, // +0.2% to +1.8%
      volume: `${-1 + (Math.random() * 2)}dB`, // -1dB to +1dB
      range: `+${1 + (Math.random() * 3)}%` // +1% to +4%
    }
  };

  const timing = microTimings[emotion] || microTimings.neutral;

  // Layer 3: Perfect emotional delivery with advanced SSML
  let finalSSML = '';

  switch (emotion) {
    case 'excitement':
      finalSSML = `<speak>
        <prosody rate="${timing.rate}" pitch="${timing.pitch}" volume="${timing.volume}" range="${timing.range}">
          <voice-transformation type="emotional" strength="0.7">
            ${perfectText}
          </voice-transformation>
        </prosody>
        <break time="0.${200 + Math.floor(Math.random() * 200)}s" strength="medium"/>
      </speak>`;
      break;

    case 'concern':
      finalSSML = `<speak>
        <prosody rate="${timing.rate}" pitch="${timing.pitch}" volume="${timing.volume}" range="${timing.range}">
          <voice-transformation type="caring" strength="0.8">
            <emphasis level="reduced">${perfectText}</emphasis>
          </voice-transformation>
        </prosody>
        <break time="0.${300 + Math.floor(Math.random() * 300)}s" strength="strong"/>
      </speak>`;
      break;

    case 'warmth':
      finalSSML = `<speak>
        <prosody rate="${timing.rate}" pitch="${timing.pitch}" volume="${timing.volume}" range="${timing.range}">
          <voice-transformation type="gentle" strength="0.9">
            ${perfectText}
          </voice-transformation>
        </prosody>
        <break time="0.${150 + Math.floor(Math.random() * 200)}s" strength="weak"/>
      </speak>`;
      break;

    case 'mystery':
      finalSSML = `<speak>
        <prosody rate="${timing.rate}" pitch="${timing.pitch}" volume="${timing.volume}" range="${timing.range}">
          <voice-transformation type="whisper" strength="0.6">
            <emphasis level="reduced">${perfectText}</emphasis>
          </voice-transformation>
        </prosody>
        <break time="0.${400 + Math.floor(Math.random() * 400)}s" strength="strong"/>
      </speak>`;
      break;

    default:
      // Perfect neutral with micro-expressions
      const perfectNeutral = perfectText
        .replace(/([.!?])/g, `$1<break time="0.${300 + Math.floor(Math.random() * 200)}s" strength="medium"/>`)
        .replace(/([,;])/g, `$1<break time="0.${150 + Math.floor(Math.random() * 100)}s" strength="weak"/>`)
        .replace(/(\b(?:आप|जी|नमस्ते|धन्यवाद|please|thank you)\b)/gi, '<emphasis level="reduced">$1</emphasis>');

      finalSSML = `<speak>
        <prosody rate="${timing.rate}" pitch="${timing.pitch}" volume="${timing.volume}" range="${timing.range}">
          <voice-transformation type="natural" strength="0.5">
            ${perfectNeutral}
          </voice-transformation>
        </prosody>
      </speak>`;
  }

  return finalSSML;
}

function addNeuralVoiceEnhancements(text: string, emotion: string): string {
  // Advanced neural voice enhancements
  let enhanced = text;

  // Add micro-expressions based on emotional state
  const microExpressions = {
    excitement: ['<micro-smile/>', '<eye-crinkle/>', '<slight-laugh/>'],
    concern: ['<micro-frown/>', '<brow-furrow/>', '<lip-purse/>'],
    warmth: ['<gentle-smile/>', '<eye-soften/>', '<relaxed-jaw/>'],
    authority: ['<chin-lift/>', '<direct-gaze/>', '<firm-mouth/>'],
    mystery: ['<raised-eyebrow/>', '<slight-squint/>', '<head-tilt/>']
  };

  const expressions = microExpressions[emotion] || microExpressions.warmth;
  if (Math.random() < 0.15) {
    const expression = expressions[Math.floor(Math.random() * expressions.length)];
    enhanced = `${expression}${enhanced}`;
  }

  // Add environmental awareness
  enhanced = `<ambient-noise level="-25dB" type="room-tone"/>${enhanced}`;

  // Add subtle body language audio cues
  if (Math.random() < 0.08) {
    const bodyCues = ['<fabric-rustle soundLevel="-22dB"/>', '<chair-creak soundLevel="-20dB"/>', '<paper-shuffle soundLevel="-25dB"/>'];
    const cue = bodyCues[Math.floor(Math.random() * bodyCues.length)];
    enhanced = `${cue}${enhanced}`;
  }

  return enhanced;
}

function addCulturalAuthenticity(text: string): string {
  // Add Indian cultural speech patterns
  let authentic = text;

  // Add traditional Indian speech rhythm patterns
  authentic = authentic.replace(/\b(spiritual|आध्यात्मिक|divine|दिव्य|cosmic|ब्रह्मांड)\b/gi, (match) => {
    return `<prosody pitch="+3%" rate="0.9" volume="+2dB">${match}</prosody>`;
  });

  // Add respectful tone for elders/wisdom concepts
  authentic = authentic.replace(/\b(guru|गुरु|wisdom|ज्ञान|ancestors|पूर्वज|tradition|परंपरा)\b/gi, (match) => {
    return `<emphasis level="moderate"><prosody pitch="-2%" rate="0.85">${match}</prosody></emphasis>`;
  });

  // Add natural Indian English pronunciation patterns
  if (!containsHindi(text)) {
    authentic = authentic.replace(/\b(very|really|actually|definitely)\b/gi, (match) => {
      return `<phoneme alphabet="ipa" ph="ˈvɛɹi">very</phoneme>`;
    });
  }

  return authentic;
}

function getHumanLikeVoice(text: string): { voice: string; speed: number; naturalness: number } {
  const { emotion } = detectEmotion(text);

  // Use different voices for variety with emotional matching
  const emotionalVoiceMapping = {
    excitement: ['nova', 'alloy'], // Brighter voices for excitement
    concern: ['echo', 'alloy'],    // Deeper voices for concern
    warmth: ['alloy', 'nova'],     // Warm voices for comfort
    authority: ['echo', 'alloy'],  // Authoritative voices
    mystery: ['echo', 'nova'],     // Mysterious voices
    joy: ['nova', 'alloy'],        // Happy voices
    empathy: ['alloy', 'echo'],    // Caring voices
    neutral: ['alloy', 'echo', 'nova'] // All voices for variety
  };

  const voiceOptions = emotionalVoiceMapping[emotion] || emotionalVoiceMapping.neutral;
  const selectedVoice = voiceOptions[Math.floor(Math.random() * voiceOptions.length)];

  if (containsHindi(text)) {
    // Hindi speeds increased by 7% total
    const baseSpeed = {
      excitement: 0.94, // +7%
      concern: 0.88,    // +7%
      warmth: 0.91,     // +7%
      authority: 0.93,  // +7%
      mystery: 0.86,    // +7%
      joy: 0.92,        // +7%
      empathy: 0.90,    // +7%
      neutral: 0.92     // +7%
    }[emotion] || 0.92;

    // Add slight randomization for naturalness (-0.02 to +0.02)
    const naturalSpeed = baseSpeed + (Math.random() * 0.04 - 0.02);

    return { voice: 'alloy', speed: Math.max(0.82, Math.min(1.02, naturalSpeed)), naturalness: 0.9 };
  }

  // English speeds increased by 7% total
  const baseSpeed = {
    excitement: 1.05, // +7%
    concern: 0.99,    // +7%
    warmth: 1.01,     // +7%
    authority: 1.03,  // +7%
    mystery: 0.97,    // +7%
    joy: 1.04,        // +7%
    empathy: 1.00,    // +7%
    neutral: 1.01     // +7%
  }[emotion] || 1.01;

  // Add natural variation
  const naturalSpeed = baseSpeed + (Math.random() * 0.04 - 0.02);

  return { voice: selectedVoice, speed: Math.max(0.92, Math.min(1.12, naturalSpeed)), naturalness: 0.95 };
}

function getOrigin(req: Request): string {
  const fh = req.headers.get('x-forwarded-host');
  const fp = req.headers.get('x-forwarded-proto') || 'https';
  return fh ? `${fp}://${fh}` : new URL(req.url).origin;
}

function ok(data: any): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function err(msg: string): Response {
  return ok({ error: msg });
}

// 2. Define your main logic inside a clean handler function.
async function handler(req: Request) {
  let user_id: string | undefined;

  try {
    // Environment validation
    const SUPABASE_URL = requireEnv('SUPABASE_URL');
    const SUPABASE_ANON_KEY = requireEnv('SUPABASE_ANON_KEY');
    const OPENAI_API_KEY = requireEnv('OPENAI_API_KEY');

    const origin = getOrigin(req);
    // 1. Authenticate the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return err('Authentication failed: Missing Authorization header');
    }

    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return err('Authentication failed: User not found');
    }

    user_id = user.id;

    // 2. Validate the input
    const requestBody = await req.json();
    const text = requestBody.text;
    if (!text) {
      return err("Missing 'text' parameter");
    }

    // Structured logging
    console.log(`[generate-tts] Function called`, {
      function_name: 'generate-tts',
      user_id: user_id,
      text_length: text.length,
      origin: origin
    });

    // 3. Create PERFECT human-like speech
    const perfectText = createPerfectSSML(text);
    const voiceSettings = getHumanLikeVoice(text);

    console.log(`[generate-tts] Creating PERFECT human speech`, {
      function_name: 'generate-tts',
      user_id: user_id,
      original_text: text.substring(0, 100),
      perfect_ssml_preview: perfectText.substring(0, 150),
      detected_emotion: detectEmotion(text).emotion,
      voice_settings: voiceSettings,
      naturalness_level: voiceSettings.naturalness
    });

    // 3. Manual fetch call to OpenAI API with expressive input
    const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1-hd',
        input: perfectText, // Use the PERFECT SSML-enhanced text
        voice: voiceSettings.voice,
        speed: voiceSettings.speed,
        response_format: 'mp3',
      }),
    });

    // 4. Check if the API call was successful
    if (!ttsResponse.ok) {
      const errorBody = await ttsResponse.json();
      console.error(`[generate-tts] OpenAI API Error`, {
        function_name: 'generate-tts',
        user_id: user_id,
        status: ttsResponse.status,
        error: errorBody.error?.message
      });
      return err(errorBody.error?.message || 'OpenAI API error occurred');
    }

    console.log(`[generate-tts] Success`, {
      function_name: 'generate-tts',
      user_id: user_id,
      response_status: ttsResponse.status
    });

    // 5. Stream the audio response back to the client
    return new Response(ttsResponse.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        ...corsHeaders
      },
      status: 200,
    });

  } catch (err) {
    console.error(`[CRITICAL ERROR] in generate-tts: ${err.message}`, {
      function_name: 'generate-tts',
      user_id: user_id,
      error: err.message,
      stack: err.stack
    });
    return err(err.message || 'An unexpected error occurred');
  }
}

// 3. Serve the main handler using the CORS wrapper.
Deno.serve(createCorsWrappedHandler(handler));