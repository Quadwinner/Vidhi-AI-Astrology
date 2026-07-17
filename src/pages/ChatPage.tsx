// src/pages/ChatPage.tsx

import {
  IconBriefcase, // Added
  IconCurrencyDollar, // Added
  IconHealthRecognition, // Added
  IconHeart,
  IconMessagePlus,
  IconPhone,
  IconPlus, // Added
  IconSparkles, // Added
  IconX
} from '@tabler/icons-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePricing } from '../context/PricingContext';
import { supabase } from '../supabaseClient';
import styles from './ChatPage.module.css';

// Import all necessary child components
import CategoryCard from '../components/CategoryCard';
import ChatInput from '../components/ChatInput';
import ChatMessage from '../components/ChatMessage';
import CustomAgoraCallScreen from '../components/CustomAgoraCallScreen';
import UltravoxCallScreen from '../components/UltravoxCallScreen';
import InitiateCallModal from '../components/InitiateCallModal';
import LoadingSpinner from '../components/LoadingSpinner';
import ProfileCard, { EnrichedProfile } from '../components/ProfileCard';
import SubscriptionModal from '../components/SubscriptionModal';
import { useCallProvider } from '../hooks/useCallProvider';

import LoadingPage from '../components/LoadingPage';
import { trackEvent } from '../utils/analytics';
import { categorizeQuestion } from '../utils/categoryDetection';
import { handleNotificationDeepLink } from '../utils/deepLinkHandler';
// import * as amplitude from '@amplitude/analytics-browser';
import { amplitudeApp } from '../index';

// --- IMPORTS FOR COMPATIBILITY FEATURE ---
import toast from 'react-hot-toast';
import CompatibilityProfileForm from '../components/CompatibilityProfileForm';

const WELCOME_MESSAGES = {
  // en: `Hi **{{NAME}}**. Your personalized astrological chart is ready, crafted from your birth details, born on {{DATE}} at {{TIME}} in {{PLACE}}. I’ve studied over 1 Million charts, so I can deliver clear, accurate insights quickly. Your first question is free—ask me anything about your destiny, career, relationships, or any challenge on your mind.`,
  en: `Hi **{{NAME}}**. Your personalized astrological chart is ready ({{DATE}}, {{TIME}}, {{PLACE}}).Your **first question is free**—career, love, or anything on your mind.`,
  // hi: `Namaste **{{NAME}}**. Aapka personalized jyotish chart taiyar hai, jo aapke janm vivaron par aadhaarit hai—{{DATE}} ko, {{TIME}} baje, {{PLACE}} me janm liya. Maine 1 Million+ charts ka adhyyan kiya hai, isliye me tezi se sahi aur spasht insights de sakta hoon. Aapka pehla prashn bilkul free hai—career, relationship ya kisi bhi challenge ke baare me pooch sakte hain.`,
  hi: `Namaste **{{NAME}}**. Aapka personalized jyotish chart taiyar hai ({{DATE}}, {{TIME}}, {{PLACE}}).Aap apna **pehla prashn free** puchh sakte hain—career, relationship ya koi bhi challenge.`,
  es: `Hola **{{NAME}}**. Tu carta astrológica personalizada está lista, creada con tus detalles de nacimiento: nacido el {{DATE}} a las {{TIME}} en {{PLACE}}. He estudiado más de 1 Millón de cartas, así que puedo darte información clara y precisa rápidamente. Tu primera pregunta es gratis—pregunta lo que quieras sobre tu destino, carrera o relaciones.`,
  zh: `Ni hao **{{NAME}}**. Ni de geren zhanxing ditu yijing zhunbei hao le, jiyu ni de chusheng xinxi—sheng yu {{DATE}} {{TIME}}, zai {{PLACE}}. Wo yanjiu guo 1 Million+ mingpan, neng kuaisu tigong zhunque de zhihui. Ni de diyi ge wenti mianfei—suibian wen ba!`,
  fr: `Bonjour **{{NAME}}**. Votre carte astrologique personnalisée est prête, créée à partir de vos détails de naissance—né le {{DATE}} à {{TIME}} à {{PLACE}}. J’ai étudié plus d’1 Million de cartes, donc je peux vous donner des insights clairs rapidement. Votre première question est gratuite—demandez ce que vous voulez.`,
  de: `Hallo **{{NAME}}**. Dein persönliches astrologisches Chart ist bereit, erstellt aus deinen Geburtsdaten—geboren am {{DATE}} um {{TIME}} in {{PLACE}}. Ich habe über 1 Million Charts studiert und kann dir schnelle, klare Einsichten geben. Deine erste Frage ist kostenlos—frag ruhig alles!`,
  ja: `Konnichiwa **{{NAME}}**. Anata no paasonarizu sareta seisensei charto ga junbi dekiteimasu—{{DATE}} {{TIME}}, {{PLACE}} de umareta joho o moto ni tsukurareta mono desu. Watashi wa 100 man ijou no charuto o benkyou shiteimasu node, seikaku na insaito o hayaku teikyoo dekimasu. Saisho no shitsumon wa muryou desu—nandemo kiite kudasai.`,
  ko: `Annyeong **{{NAME}}**. Dangsinui gaein jeongbo-reul gibonuro hyeongseongdoen jeongmyeong-ui saju chart-ga wanjeonhibnida—{{DATE}} {{TIME}}, {{PLACE}} eseo taeeonasin geos-eul gibonuro. 1 Million+ chart-reul yeonguhaesseumnida, ttaeron ppalli mich hwingilhage insaiteu-reul jeonhae deuril su issseumnida. Cheot beonjjae jilmun-eun free—mueosideun jilmun-hae juseyo.`,
  ru: `Privet **{{NAME}}**. Tvoya personalizirovannaya astrologicheskaya karta gotova—sozdana na osnove dannykh o rozhdenii: {{DATE}} v {{TIME}} v {{PLACE}}. Ya izuchil bolee 1 Million kart, poetomu mogu bystro dat’ tochnye i yasnye insayty. Tvoy pervyi vopros besplatnyi—sprosi vse, chto khotite.`,
  pt: `Olá **{{NAME}}**. Seu mapa astrológico personalizado está pronto, criado com seus dados de nascimento—nascido em {{DATE}} às {{TIME}} em {{PLACE}}. Eu estudei mais de 1 Milhão de mapas, então posso entregar insights claros rapidamente. Sua primeira pergunta é grátis—pergunte qualquer coisa!`,
  it: `Ciao **{{NAME}}**. Il tuo tema astrale personalizzato è pronto, creato dai tuoi dati di nascita—nato il {{DATE}} alle {{TIME}} a {{PLACE}}. Ho studiado oltre 1 Milione di carte, quindi posso offrirti intuizioni chiare rapidamente. La tua prima domanda è gratuita—chiedi pure qualsiasi cosa.`,
  mr: `Namaskar **{{NAME}}**. Tumcha personal jyotish chart tayyar aahe—{{DATE}} la, {{TIME}} vaazta, {{PLACE}} madhye tumcha janma jhala. Mi 1 Million+ charts cha abhyas kela aahe, mule mi tumhala lakshya-deu shaknaar insight lavkar devu shakto. Tumcha pahila prashna free aahe—karrier, relationship kiwa kahi hi vichara.`,
  bn: `Nomoskar **{{NAME}}**. Apnar personal astrology chart toiri—apnar jonmo totho theke: {{DATE}}, {{TIME}}, {{PLACE}}. Ami 1 Million+ chart porashona korechi, tai khub taratari sotik insights dite pari. Apnar prothom proshno free—destiny, career ba relationship niye jekono kichu jiggesh korun.`,
  ta: `Vanakkam **{{NAME}}**. Ungal personal astrology chart ready—{{DATE}} {{TIME}}-il, {{PLACE}}-il pirandha ungal birth details moolam. Naan 1 Million+ charts padithirukkiren, athaal nalla thulliyana insights vegamaal kodukka mudiyum. Ungal mudhal kelvi free—yenna venumnaalum kelunga.`,
  gu: `Namaste **{{NAME}}**. Tamaro personal astrology chart taiyar chhe—tamari janm mahiti par aadharit: {{DATE}}, {{TIME}}, {{PLACE}}. Hu 1 Million+ charts no abhyas karyo chhe, etle hu jaldi ane sachi insight api shaku chhu. Tamaro pehlo prashn free chhe—career, relationship ke biji koi vastu puchho.`,
  te: `Namaskaram **{{NAME}}**. Mee personal jyotishya chart siddham ayyindi—mee puttin samachaaram aadhaaramga: {{DATE}}, {{TIME}}, {{PLACE}}. Nenu 1 Million+ charts chadavanu jarigindi, anduke nenu meeku tvaraga, spashtanga insights ivvagalanu. Mee modati prashna free—mee destiny, career, relationships gurinchi yedaina adagandi.`,
  pa: `Sat Sri Akaal **{{NAME}}**. Tuhada personal astrology chart taiyaar hai—tuhade janam de vivaraan de adhaar te: {{DATE}}, {{TIME}}, {{PLACE}}. Main 1 Million+ charts da adhyyan kita hai, is karke main tuhanu tezi naal sahi insights de sakda haan. Tuhada pehla sawaal free hai—career, relationship ya kise vi mudde bare pucho.`
};

const LOW_BALANCE_MSG =
  "Great question To unlock your personalized answer, Aura Wallet balance is needed. Recharge and continue";

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  feedback?: 'like' | 'dislike' | null;
  // --- Interactive fields
  isInteractive?: boolean;
  interactiveOptions?: { id: string; name: string }[];
  onInteractiveSelect?: (id: string, name: string) => void;
  // --- NEW FIELDS FOR WIDGETS ---
  isWidget?: boolean;
  widgetType?: 'compatibility_form';
  widgetData?: {
    partner_name?: string | null;
    partner_dob?: string | null;
    partner_tob?: string | null;
    partner_gender?: string | null;
    // Location Data
    birth_place?: string;
    birth_lat?: string;
    birth_lng?: string;
    birth_timezone?: string;

    sub_category?: string;
    isLocked?: boolean;
    needsPayment?: boolean;
    partner_profile_id?: string;
  };
  onWidgetSubmit?: (data: any) => void;
}

interface QuestionData {
  [category: string]: string[];
}

// Fallback suggested questions shown when personalized generation is
// unavailable (e.g. not yet generated for this profile, or the LLM is
// rate-limited). Keeps the Suggested Questions panel visible either way.
const DEFAULT_SUGGESTED_QUESTIONS: QuestionData = {
  Love: [
    'What does my chart say about my love life this year?',
    'When is a favorable time for marriage for me?',
    'How can I improve harmony in my relationships?',
  ],
  Career: [
    'What career path best suits my birth chart?',
    'Is a job change favorable for me right now?',
    'When will I see growth in my profession?',
  ],
  Money: [
    'What do the planets say about my finances?',
    'When is a good time to invest or make big purchases?',
    'How can I attract more financial stability?',
  ],
  Health: [
    'What should I be mindful of for my health?',
    'Which remedies suit my chart for well-being?',
    'How can I improve my mental peace?',
  ],
  Spiritual: [
    'What is my spiritual path according to my chart?',
    'Which mantras or remedies are best for me?',
    'How can I grow spiritually this year?',
  ],
};

interface RecentChat {
  profile_id: string;
  profile_name: string;
  last_message_content: string;
  last_message_timestamp: string;
}

// --- HELPER: Detect Topic & Icon based on content ---
const getChatTopic = (content: string) => {
  const lower = content.toLowerCase();
  if (lower.includes('love') || lower.includes('relationship') || lower.includes('marriage') || lower.includes('partner') || lower.includes('compatibility')) {
    return { label: 'Love & Relationships', icon: <IconHeart size={14} color="#F472B6" /> };
  }
  if (lower.includes('job') || lower.includes('career') || lower.includes('business') || lower.includes('work') || lower.includes('promotion')) {
    return { label: 'Career & Growth', icon: <IconBriefcase size={14} color="#34D399" /> };
  }
  if (lower.includes('money') || lower.includes('finance') || lower.includes('wealth') || lower.includes('investment')) {
    return { label: 'Wealth & Finance', icon: <IconCurrencyDollar size={14} color="#60A5FA" /> };
  }
  if (lower.includes('health') || lower.includes('energy') || lower.includes('wellness') || lower.includes('mind')) {
    return { label: 'Health & Wellness', icon: <IconHealthRecognition size={14} color="#F87171" /> };
  }
  return { label: 'General Insight', icon: <IconSparkles size={14} color="#A78BFA" /> };
};

// --- UPDATED MODAL ---
const PartnerDetailsModal = ({ isOpen, onClose, onSave, partnerNameHint }: any) => {
  const [isSaving, setIsSaving] = useState(false);

  const handleFormSave = async (data: any) => {
    setIsSaving(true);
    try {
      await onSave(data);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(5px)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 99999, padding: '16px'
    }} onClick={onClose}>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#1e1e1e', color: '#ffffff', width: '100%', maxWidth: '800px',
          maxHeight: '85vh', overflowY: 'auto', borderRadius: '12px', border: '1px solid #333',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', display: 'flex', flexDirection: 'column', position: 'relative'
        }}
      >
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #333',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, backgroundColor: '#1e1e1e', zIndex: 10
        }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>
            New Compatibility Check
          </h3>
          <button onClick={onClose} style={{ background: '#2d2d2d', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}>
            <IconX size={16} />
          </button>
        </div>

        <div style={{ padding: '20px', flex: 1 }}>
          <CompatibilityProfileForm
            initialName={partnerNameHint}
            onSave={handleFormSave}
            isSaving={isSaving}
          />
        </div>

        <div style={{
          padding: '16px 20px', borderTop: '1px solid #333',
          display: 'flex', justifyContent: 'flex-end', backgroundColor: '#1e1e1e', position: 'sticky', bottom: 0, zIndex: 10
        }}>
          <button
            type="submit"
            form="compatibility-form"
            disabled={isSaving}
            style={{
              backgroundColor: '#A855F7', color: 'white', border: 'none', padding: '10px 20px',
              borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600, cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.7 : 1
            }}
          >
            {isSaving ? 'Analyzing...' : 'Save & Analyze'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- CLARIFICATION MESSAGE COMPONENT ---
const ClarificationMessage = ({ options, onSelect }: any) => (
  <div className={styles.clarificationContainer}>
    <p>I found a few profiles matching that name. Which one are you referring to?</p>
    <div className={styles.clarificationOptions}>
      {options.map((option: any) => (
        <button
          key={option.id}
          onClick={() => onSelect(option.id, option.name)}
          className={styles.clarificationButton}
        >
          {option.name}
        </button>
      ))}
    </div>
  </div>
);


function useViewport() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleWindowResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);
  return { isMobile: width <= 768 };
}

export default function ChatPage() {
  const { isMobile } = useViewport();

  const {
    user,
    planTier,
    walletBalance,
    updateWalletBalance,
    userProfiles,
    canAddProfile
  } = useAuth();

  const { prices, formatPrice, variant: monetizationVariant } = usePricing();
  const questionCost = prices['chat_message'] || 0;

  const { provider: adminSelectedProvider, loading: providerLoading } = useCallProvider();

  // --- LOCATION HOOK ---
  const location = useLocation();
  const navigate = useNavigate();

  // =========================================================
  // STATE DEFINITIONS
  // =========================================================

  // UI States
  const [isSubscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [isAllProfilesExpanded, setIsAllProfilesExpanded] = useState(false); // Default collapsed as requested implicitly by UX pattern
  const [showInitiateCallModal, setShowInitiateCallModal] = useState(false);
  const [selectedCallProvider, setSelectedCallProvider] = useState<'agora' | 'ultravox' | null>(null);

  // Data States
  const [profiles, setProfiles] = useState<EnrichedProfile[]>([]);
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<EnrichedProfile | null>(null);
  const [questions, setQuestions] = useState<QuestionData | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  // NEW: Sticky Context State
  const [activePartner, setActivePartner] = useState<{ id: string; name: string } | null>(null);

  // Scroll & Experiment States
  const [isUserAtBottom, setIsUserAtBottom] = useState(true);
  const [isAIStreaming, setIsAIStreaming] = useState(false);
  const [promptVariant, setPromptVariant] = useState('control');
  const [isVariantLoading, setIsVariantLoading] = useState(true);

  // --- COMPATIBILITY FEATURE STATES ---
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [partnerNameHint, setPartnerNameHint] = useState('');
  const [conversationContext, setConversationContext] = useState<{ type: string | null; data: any }>({ type: null, data: {} });

  // --- LAYOUT & PADDING STATES ---
  const [areQuestionsVisible, setAreQuestionsVisible] = useState(false);
  const [chatBottomPadding, setChatBottomPadding] = useState(150);

  // Refs
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const currentProfileSectionRef = useRef<HTMLDivElement>(null);
  const allProfilesSectionRef = useRef<HTMLDivElement>(null);
  const recentChatsSectionRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputContainerRef = useRef<HTMLDivElement | null>(null);

  const [pendingQuestion, setPendingQuestion] = useState<string>('');

  // Derived Constants
  const isPremiumUser = planTier === 'monthly' || planTier === 'yearly';
  const isCallFeatureEnabled = true;
  const isOutOfFunds = walletBalance !== null && walletBalance < questionCost;

  const [isCompatibilityEnabled, setIsCompatibilityEnabled] = useState(false);

  const handleCloseWidget = (messageId: string) => {
    setChatHistory(prev => prev.filter(msg => msg.id !== messageId));
  };

  // =========================================================
  // LAYOUT & SCROLL HELPERS
  // =========================================================

  const updateChatPadding = useCallback(() => {
    const inputHeight = inputContainerRef.current?.offsetHeight ?? 0;
    const basePadding = 120;
    const calculated = inputHeight > 0 ? inputHeight + 40 : basePadding;
    setChatBottomPadding(Math.max(calculated, basePadding));
  }, []);

  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    if (!isAIStreaming) {
      requestAnimationFrame(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth"
        });
      });
    }
  };

  // =========================================================
  // USE EFFECTS
  // =========================================================

  useEffect(() => {
    updateChatPadding();
    const timer = window.setTimeout(updateChatPadding, 350);
    return () => window.clearTimeout(timer);
  }, [updateChatPadding, areQuestionsVisible, questions, isMobile, chatHistory.length]);

  useEffect(() => {
    window.addEventListener('resize', updateChatPadding);
    return () => window.removeEventListener('resize', updateChatPadding);
  }, [updateChatPadding]);

  useEffect(() => {
    const fetchVariant = async () => {
      try {
        setIsVariantLoading(true);
        // UPDATED: Using new Experiment Name
        const FLAG_KEY = "hyper-personalization-test";

        await amplitudeApp.experiment.fetch();
        const variant = amplitudeApp.experiment.variant(FLAG_KEY);

        // If Amplitude returns the treatment, set it. Otherwise default to 'control'
        if (variant && variant.value === 'treatment-hyper-personalized') {
          setPromptVariant('treatment-hyper-personalized');
        } else {
          setPromptVariant('control');
        }
      } catch (e) {
        console.error("Experiment Fetch Error:", e);
        // Safety Fallback
        setPromptVariant('control');
      } finally {
        setIsVariantLoading(false);
      }
    };
    fetchVariant();
  }, []);

  useEffect(() => {
    if (!isAIStreaming && chatHistory.length > 0) {
      setTimeout(scrollToBottom, 30);
    }
  }, [chatHistory]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const threshold = 40;
      const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
      setIsUserAtBottom(isAtBottom);
    };
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    };
    if (showProfileDropdown) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileDropdown]);

  useEffect(() => {
    if (allProfilesSectionRef.current) allProfilesSectionRef.current.style.top = '';
    if (recentChatsSectionRef.current) recentChatsSectionRef.current.style.marginTop = '';
  }, [selectedProfile, isAllProfilesExpanded]);

  useEffect(() => {
    const fetchSidebarData = async () => {
      if (!user) return;
      if (profiles.length === 0) setIsLoadingProfiles(true);
      setError(null);
      try {
        const [profilesRes, recentChatsRes] = await Promise.all([
          supabase.from('user_profiles').select('id, name, preferred_language, user_birth_details(*)').eq('user_id', user.id),
          supabase.rpc('get_recent_chats')
        ]);

        if (profilesRes.error) throw profilesRes.error;
        if (recentChatsRes.error) throw recentChatsRes.error;

        const enrichedData = (profilesRes.data || []).map(profile => {
          const birthDetails = Array.isArray(profile.user_birth_details) ? profile.user_birth_details[0] : profile.user_birth_details;
          return { id: profile.id, name: profile.name, preferred_language: profile.preferred_language, gender: birthDetails?.gender || 'N/A', date_of_birth: birthDetails?.date_of_birth || '', time_of_birth: birthDetails?.time_of_birth || '', birth_place: birthDetails?.birth_place || 'N/A' };
        }) as EnrichedProfile[];

        setProfiles(enrichedData);
        setRecentChats(recentChatsRes.data || []);

        const newlyCreatedId = location.state?.newlyCreatedProfileId;
        const newlyCreatedProfile = newlyCreatedId
          ? enrichedData.find(p => p.id === newlyCreatedId)
          : null;

        if (newlyCreatedProfile) {
          setSelectedProfile(newlyCreatedProfile);
        }
        else if (enrichedData.length > 0 && !selectedProfile) {
          if (recentChatsRes.data.length > 0) {
            const mostRecentProfile = enrichedData.find(p => p.id === recentChatsRes.data[0].profile_id);
            setSelectedProfile(mostRecentProfile || enrichedData[0]);
          } else {
            setSelectedProfile(enrichedData[0]);
          }
        }

      } catch (err: any) {
        console.error("Failed to load sidebar data:", err);
        setError('Failed to load your profiles and chats.');
      } finally {
        setIsLoadingProfiles(false);
      }
    };
    fetchSidebarData();
  }, [user?.id]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shouldStart = params.get('startCall') === '1';
    if (!shouldStart) return;
    if (selectedProfile && !isCallActive) {
      setShowInitiateCallModal(true);
      params.delete('startCall');
      const updatedSearch = params.toString();
      navigate({ pathname: location.pathname, search: updatedSearch ? `?${updatedSearch}` : '' }, { replace: true });
    }
  }, [location, selectedProfile, isCallActive, navigate]);

  const cleanMessageContent = (content: string) => {
    if (content.includes("USER QUESTION:")) {
      const parts = content.split("USER QUESTION:");
      if (parts.length > 1) {
        return parts[1].trim();
      }
    }
    return content;
  };

  const handleOpenSubscriptionModal = () => {
    setShowInitiateCallModal(false);
    setSubscriptionModalOpen(true);
  };

  // 1. Create a ref to track the previous balance
  const prevBalanceRef = useRef<number | null>(walletBalance);

  // 2. Use this effect instead of the previous one
  useEffect(() => {
    // Check if balance exists and has INCREASED (meaning a recharge happened)
    if (
      walletBalance !== null &&
      prevBalanceRef.current !== null &&
      walletBalance > prevBalanceRef.current
    ) {
      // Only close the modal if a recharge actually occurred
      if (isSubscriptionModalOpen) {
        setSubscriptionModalOpen(false);
        toast.success("Wallet recharged successfully!");
      }
    }

    // Update the ref to the current balance for the next render
    prevBalanceRef.current = walletBalance;
  }, [walletBalance, isSubscriptionModalOpen]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== 'NOTIFICATION_CLICKED') return;
      handleNotificationDeepLink(data.data, (path: string) => navigate(path));
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [navigate]);

  useEffect(() => {
    const validateFeedback = (feedback: any): 'like' | 'dislike' | null => {
      if (feedback === 'like' || feedback === 'dislike') return feedback;
      return null;
    };
    const validateRole = (role: any): 'user' | 'assistant' => {
      if (role === 'user' || role === 'assistant') return role;
      return 'assistant';
    };

    const handleProfileSelect = async () => {
      if (!selectedProfile) return;
      setIsChatLoading(true);
      setError(null);
      setChatHistory([]);
      // Show curated suggestions immediately; personalized ones replace these
      // if/when the edge function returns them.
      setQuestions(DEFAULT_SUGGESTED_QUESTIONS);
      // Reset active partner on profile switch
      setActivePartner(null);

      try {
        // 1. Fetch history and persisted widget state. During a rolling deploy,
        // retry without widget_data until the schema migration reaches Supabase.
        let historyData: any[] | null = null;
        let historyError: any = null;

        const historyResult = await supabase
          .from('chat_history')
          .select('id, role, message_content, feedback, widget_data')
          .eq('profile_id', selectedProfile.id)
          .order('created_at', { ascending: true });

        historyData = historyResult.data;
        historyError = historyResult.error;

        if (historyError?.code === '42703' && historyError.message?.includes('widget_data')) {
          console.warn('[ChatPage] widget_data migration is pending; loading standard chat history.');
          const fallbackResult = await supabase
            .from('chat_history')
            .select('id, role, message_content, feedback')
            .eq('profile_id', selectedProfile.id)
            .order('created_at', { ascending: true });

          historyData = fallbackResult.data?.map(message => ({ ...message, widget_data: null })) || null;
          historyError = fallbackResult.error;
        }

        if (historyError) throw historyError;

        if (!historyData || historyData.length === 0) {
          const userLang = selectedProfile.preferred_language || 'en';
          const messageTemplate = WELCOME_MESSAGES[userLang as keyof typeof WELCOME_MESSAGES] || WELCOME_MESSAGES['en'];
          const finalMessageContent = messageTemplate
            .replace(/{{NAME}}/g, selectedProfile.name)
            .replace(/{{DATE}}/g, selectedProfile.date_of_birth)
            .replace(/{{TIME}}/g, selectedProfile.time_of_birth)
            .replace(/{{PLACE}}/g, selectedProfile.birth_place);

          setChatHistory([{
            id: `welcome_${Date.now()}`,
            role: 'assistant',
            content: finalMessageContent,
            feedback: null,
          }]);
        }
        else {
          // 2. Filter & Format
          const formattedHistory: ChatMessage[] = historyData
            .filter(msg => {
              const content = msg.message_content || "";
              if (content.startsWith("Based on the planetary influences in MY birth chart")) return false;
              if (content.startsWith("Compatibility analysis for")) return false;
              return true;
            })
            .map(dbMessage => {
              if (dbMessage.widget_data) {
                return {
                  id: dbMessage.id,
                  role: 'assistant',
                  content: '',
                  isWidget: true,
                  widgetType: 'compatibility_form',
                  widgetData: dbMessage.widget_data,
                  onWidgetSubmit: handleWidgetFormSubmit
                };
              }
              return {
                id: dbMessage.id,
                role: validateRole(dbMessage.role),
                content: cleanMessageContent(dbMessage.message_content || ""),
                feedback: validateFeedback(dbMessage.feedback),
              };
            });

          setChatHistory(formattedHistory);

          // --- FIX: RESTORE STICKY CONTEXT FROM HISTORY ---
          // Scan history for the last completed/locked compatibility check
          const lastLockedWidget = formattedHistory
            .filter(msg => msg.isWidget && msg.widgetData?.isLocked && msg.widgetData?.partner_profile_id)
            .pop();

          if (lastLockedWidget && lastLockedWidget.widgetData) {
            const { partner_profile_id, partner_name } = lastLockedWidget.widgetData;
            if (partner_profile_id && partner_name) {
              console.log("Restoring sticky context for:", partner_name);
              setActivePartner({ id: partner_profile_id, name: partner_name });
            }
          }
        }
      } catch (err: any) {
        console.error("Failed to fetch chat history:", err);
        setError("An error occurred while loading your conversation.");
      } finally {
        setIsChatLoading(false);
      }
      try {
        const { data: questionsData, error: questionsError } = await supabase.functions.invoke(
          'generate-personalized-questions',
          { body: { profile_id: selectedProfile.id } }
        );
        let processedQuestions: QuestionData = {};
        if (!questionsError && questionsData) {
          if (Array.isArray(questionsData)) {
            questionsData.forEach((category: any) => {
              if (category && typeof category === 'object' && category.name && Array.isArray(category.questions)) {
                processedQuestions[category.name] = category.questions;
              }
            });
          } else if (typeof questionsData === 'object') {
            processedQuestions = questionsData as QuestionData;
          }
        }

        // Keep only categories that actually contain questions.
        const validQuestions = Object.fromEntries(
          Object.entries(processedQuestions).filter(
            ([, qs]) => Array.isArray(qs) && qs.length > 0
          )
        ) as QuestionData;

        // Only replace the curated defaults when personalized questions are
        // genuinely present. Otherwise keep the defaults so chips never vanish.
        if (Object.keys(validQuestions).length > 0) {
          setQuestions(validQuestions);
        }
        // else: keep the DEFAULT_SUGGESTED_QUESTIONS already set above.
      } catch (err: any) {
        // Keep the defaults already shown.
      }
    };
    handleProfileSelect();
  }, [selectedProfile]);

  // =========================================================
  // HANDLERS
  // =========================================================

  const processStreamedResponse = async (response: Response, typingIndicatorId: string) => {
    if (!response.ok || !response.body) {
      const errorText = await response.text();
      console.error("Stream response error:", errorText);
      throw new Error(errorText || `Server error: ${response.statusText}`);
    }

    setIsAIStreaming(true);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    const stableResponseId = `assistant_${Date.now()}`;

    const updateMessage = (content: string) => {
      setChatHistory(prev => {
        const newHistory = [...prev];
        const index = newHistory.findIndex(msg =>
          msg.id === typingIndicatorId || msg.id === stableResponseId
        );
        if (index === -1) return prev;
        newHistory[index] = {
          ...newHistory[index],
          id: stableResponseId,
          role: 'assistant',
          content: content
        };
        return newHistory;
      });
    };

    let pendingUpdate = false;
    const scheduleUpdate = () => {
      if (!pendingUpdate) {
        pendingUpdate = true;
        requestAnimationFrame(() => {
          updateMessage(fullContent);
          pendingUpdate = false;
        });
      }
    };

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        scheduleUpdate();
      }
    } catch (streamError) {
      console.error("Error reading stream:", streamError);
      throw streamError;
    }

    updateMessage(fullContent);
    setIsAIStreaming(false);

    if (isUserAtBottom) {
      setTimeout(() => scrollToBottom(), 80);
    }
    return fullContent;
  };

  const handleGeneralChat = async (
    questionText: string,
    typingIndicatorId: string,
    accessToken: string,
    category?: string,
    subCategory?: string,
    originalQuestion?: string
  ) => {
    // 1. OPTIMISTIC DEDUCTION (With Safety Clamp)
    // We store the original balance to revert in case of error
    const previousBalance = walletBalance;

    if (walletBalance !== null && questionCost > 0) {
      // Safety: Never show negative balance on UI even if logic slips through
      const newBalance = Math.max(0, walletBalance - questionCost);
      updateWalletBalance(newBalance);
    }

    try {
      const userLocalDate = new Date().toLocaleDateString('en-CA');
      const response = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/get-chat-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          profile_id: selectedProfile?.id,
          question_text: questionText,
          original_question: originalQuestion,
          client_date: userLocalDate,
          experiment_variant: promptVariant,
          monetization_variant: monetizationVariant,
          category: category,
          sub_category: subCategory
        }),
      });

      // 2. HANDLE 402 PAYMENT REQUIRED
      // If backend says "Insufficient Funds", we refund the optimistic deduction
      if (response.status === 402) {
        if (previousBalance !== null) updateWalletBalance(previousBalance);
        setSubscriptionModalOpen(true);
        setChatHistory(prev => prev.map(msg =>
          msg.id === typingIndicatorId ? { ...msg, content: LOW_BALANCE_MSG } : msg
        ));
        return;
      }

      await processStreamedResponse(response, typingIndicatorId);
    } catch (err) {
      // Refund on Network Error
      if (previousBalance !== null) updateWalletBalance(previousBalance);
      throw err;
    }
  };

  // --- UPDATED: HANDLE COMPATIBILITY CHECK API ---
  const handleCompatibilityCheck = async (
    partnerNameHint: string | undefined,
    typingIndicatorId: string,
    accessToken: string,
    questionText: string,
    partnerId?: string
  ) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/get-compatibility-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          profile_id: selectedProfile?.id,
          partner_name_hint: partnerId ? undefined : (partnerNameHint || ''),
          partner_profile_id: partnerId,
          monetization_variant: monetizationVariant,
          question_text: questionText
        }),
      });

      // 1. Handle Payment Required (Server Side Check)
      if (response.status === 402) {
        setSubscriptionModalOpen(true);
        setChatHistory(prev => prev.map(msg =>
          msg.id === typingIndicatorId ? { ...msg, content: LOW_BALANCE_MSG } : msg
        ));
        setIsReplying(false);
        return;
      }

      // 2. Handle Interactivity/Clarification
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (data.status === 'needs_clarification') {
          setChatHistory(prev => prev.map(msg => msg.id === typingIndicatorId ? {
            id: `interactive_${Date.now()}`,
            role: 'assistant',
            content: '',
            isInteractive: true,
            interactiveOptions: data.options,
            onInteractiveSelect: (id, name) => handleClarificationSelect(id, name, accessToken, questionText)
          } : msg));
          setIsReplying(false);
          return;
        }
      }

      if (!response.ok) {
        const textError = await response.text();
        throw new Error(textError || response.statusText);
      }

      // 3. Update Balance (Visual)
      const previousBalance = walletBalance;
      if (walletBalance !== null && questionCost > 0) {
        updateWalletBalance(walletBalance - questionCost);
      }

      // 4. Stream Response
      await processStreamedResponse(response, typingIndicatorId);

      // 5. Update Follow-up Context
      setConversationContext({
        type: 'compatibility_follow_up',
        data: {
          partnerName: (partnerId ? partnerNameHint : partnerNameHint) || 'their partner',
          summary: 'Ashtakoot compatibility.'
        }
      });

    } catch (err: any) {
      console.error("Compatibility Error:", err);
      setChatHistory(prev => prev.map(msg =>
        msg.id === typingIndicatorId ?
          { ...msg, content: `An error occurred: ${err.message}` } :
          msg
      ));
      setIsReplying(false);
    }
  };

  const handleClarificationSelect = (partnerId: string, partnerName: string, accessToken: string, questionText: string) => {
    setChatHistory(prev => prev.filter(msg => !msg.isInteractive));
    const newId = `typing_${Date.now()}`;
    setChatHistory(prev => [...prev, { id: newId, role: 'assistant', content: 'AuraAI is typing...' }]);
    setIsReplying(true);
    handleCompatibilityCheck(partnerName, newId, accessToken, questionText, partnerId);
  };
  // --- NEW CHAT HANDLER ---
  const handleNewChat = () => {
    if (!selectedProfile) return;

    // 1. Clear current history state
    setChatHistory([]);
    
    // 2. Reset specific contexts
    setActivePartner(null);
    setPendingQuestion('');

    // 3. Re-generate Welcome Message
    const userLang = selectedProfile.preferred_language || 'en';
    const messageTemplate = WELCOME_MESSAGES[userLang as keyof typeof WELCOME_MESSAGES] || WELCOME_MESSAGES['en'];
    
    const finalMessageContent = messageTemplate
      .replace(/{{NAME}}/g, selectedProfile.name)
      .replace(/{{DATE}}/g, selectedProfile.date_of_birth)
      .replace(/{{TIME}}/g, selectedProfile.time_of_birth)
      .replace(/{{PLACE}}/g, selectedProfile.birth_place);

    // 4. Set history to just the welcome message
    setChatHistory([{
      id: `welcome_${Date.now()}`,
      role: 'assistant',
      content: finalMessageContent,
      feedback: null,
    }]);

    // Optional: Focus the input field if you have the ref available
    // inputContainerRef.current?.querySelector('input')?.focus();
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('is_active')
          .eq('setting_name', 'enable_compatibility_feature')
          .single();

        if (error) {
          console.error("Error fetching compatibility setting:", error);
          // Keep it false on error
          setIsCompatibilityEnabled(false);
        } else if (data) {
          console.log("Compatibility Feature Status:", data.is_active);
          setIsCompatibilityEnabled(data.is_active);
        }
      } catch (err) {
        console.error("Unexpected error fetching settings:", err);
        setIsCompatibilityEnabled(false);
      }
    };
    fetchSettings();
  }, []);

  // --- UPDATED: HANDLE WIDGET SUBMIT (Fixes Missing Green Tick) ---
  const handleWidgetFormSubmit = async (partnerData: any) => {
    setIsReplying(true);
    const { messageId, ...cleanPartnerData } = partnerData;
    let partnerProfileId = partnerData.partner_profile_id || cleanPartnerData.partner_profile_id;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      // 1. Create Partner Profile if needed
      if (!partnerProfileId) {
        const payload = { ...cleanPartnerData, source_profile_id: selectedProfile?.id };
        const { data: profileRes, error: profileError } = await supabase.functions.invoke('create-partner-profile', { body: payload });
        if (profileError) throw new Error(profileError.message);
        partnerProfileId = profileRes.profile?.id;
      }

      // 2. Prepare "Locked" Data
      const widgetPayload = {
        ...cleanPartnerData,
        partner_profile_id: partnerProfileId,
        isLocked: true,
        needsPayment: false
      };

      // 3. PERSISTENCE LOGIC (Crucial Fix)
      let finalDbId = messageId;

      // If the message ID is temporary (starts with "widget_") or undefined, we must INSERT it.
      if (!messageId || messageId.toString().startsWith('widget_')) {
        const { data: insertedMsg, error: insertError } = await supabase.from('chat_history').insert({
          profile_id: selectedProfile?.id,
          user_id: user?.id,
          role: 'assistant',
          message_content: '', // Empty content for widgets
          widget_data: widgetPayload
        }).select('id').single();

        if (insertError) throw insertError;
        finalDbId = insertedMsg.id;
      } else {
        // It's already in DB, just update it
        await supabase.from('chat_history').update({
          widget_data: widgetPayload
        }).eq('id', messageId);
      }

      // 4. Update Context
      if (partnerProfileId && cleanPartnerData.partner_name) {
        setActivePartner({ id: partnerProfileId, name: cleanPartnerData.partner_name });
      }

      // 5. Prepare "Ready" Message
      const partnerName = cleanPartnerData.partner_name;
      const lang = selectedProfile?.preferred_language || 'en';
      const readyMessages: any = {
        en: `Your details and **${partnerName}** are now analyzed. What would you like to explore next? (Marriage, Trust, or Future)`,
        hi: `Aapke aur **${partnerName}** ke details analyze ho chuke hain. Ab kya explore karna chahenge? (Shaadi, Trust, ya Future)`

      };
      const readyMessageContent = readyMessages[lang] || readyMessages['en'];
      const readyMsgId = `ready_${Date.now()}`;

      // 6. Save "Ready" Message
      await supabase.from('chat_history').insert({
        profile_id: selectedProfile?.id,
        user_id: user?.id,
        role: 'assistant',
        message_content: readyMessageContent
      });

      // 7. Atomic UI Update
      setChatHistory(prev => {
        const updatedHistory = prev.map(msg => {
          if (msg.id === messageId) {
            // Update the widget and give it the real DB ID
            return { ...msg, id: finalDbId, widgetData: widgetPayload };
          }
          return msg;
        });

        return [...updatedHistory, {
          id: readyMsgId,
          role: 'assistant',
          content: readyMessageContent
        }];
      });

      setIsReplying(false);
      toast.success("Charts Aligned!");

    } catch (err: any) {
      console.error(err);
      toast.error(`Error: ${err.message}`);
      setIsReplying(false);
    }
  };

  const handlePartnerFormSubmit = async (partnerData: any) => {
    setIsPartnerModalOpen(false);
    setIsReplying(true);
    const typingIndicator: ChatMessage = {
      id: `typing_${Date.now()}`,
      role: 'assistant',
      content: 'AuraAI is typing...'
    };
    setChatHistory(prev => [...prev, typingIndicator]);

    try {
      const payload = { ...partnerData, source_profile_id: selectedProfile?.id };
      const { error } = await supabase.functions.invoke('create-partner-profile', { body: payload });
      if (error) throw new Error(error.message);

      toast.success(`${partnerData.partner_name}'s profile saved!`);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const questionToSend = pendingQuestion || `Compatibility check with ${partnerData.partner_name}`;
        await handleCompatibilityCheck(
          partnerData.partner_name,
          typingIndicator.id!,
          session.access_token,
          questionToSend
        );
        setPendingQuestion('');
        setIsReplying(false);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to save profile: ${err.message}`);
      setChatHistory(prev => prev.filter(msg => msg.id !== typingIndicator.id));
      setIsReplying(false);
    }
  };


  // --- UPDATED: HANDLE SEND MESSAGE (General Teaser + Safety + Category Tracking) ---
  const handleSendMessage = async (questionText: string, source: 'User Input' | 'Suggested Question' = 'User Input') => {
    // Validate before tracking to avoid polluting analytics with invalid events
    if (!questionText.trim() || !selectedProfile || isReplying) return;

    // Detect question category (only for valid messages)
    const questionCategory = categorizeQuestion(questionText);

    trackEvent('Chat Message Sent', {
      source,
      profile_id: selectedProfile?.id,
      message_length: questionText.length,
      question_category: questionCategory
    });

    // Track category-specific event in CleverTap
    if (questionCategory !== 'default') {
      trackEvent(`Chat Question - ${questionCategory}`, {
        question_text: questionText.slice(0, 200),
        category: questionCategory,
        profile_id: selectedProfile?.id,
        source
      });
    }

    setIsReplying(true);

    // 1. Optimistic UI Update
    const typingId = `typing_${Date.now()}`;
    setChatHistory(prev => [...prev, { role: 'user', content: questionText }, { id: typingId, role: 'assistant', content: 'AuraAI is typing...' }]);
    scrollToBottom();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("User not authenticated");

      // --- HELPER: LOW BALANCE HANDLER ---
      const handleLowBalance = () => {
        setChatHistory(prev => prev.map(msg => msg.id === typingId ? {
          id: `assistant_${Date.now()}`, role: 'assistant', content: LOW_BALANCE_MSG, feedback: null
        } : msg));
        setIsReplying(false);
        setSubscriptionModalOpen(true);
      };

      // ---------------------------------------------------------
      // ANALYZE INTENT (for all paths - needed for CleverTap tracking)
      // ---------------------------------------------------------
      const { data: catData } = await supabase.functions.invoke('categorize-chat-intent', { body: { question_text: questionText, profile_id: selectedProfile.id } });
      const detectedCategory = catData?.category || 'general';
      const detectedSubCategory = catData?.sub_category;

      // ---------------------------------------------------------
      // LOGIC FORK: IS COMPATIBILITY FEATURE ENABLED?
      // ---------------------------------------------------------

      if (!isCompatibilityEnabled) {
        // --- CASE A: FEATURE DISABLED -> DIRECT GENERAL CHAT ---
        if (isOutOfFunds) { handleLowBalance(); return; }

        // Pass category and sub_category for CleverTap tracking
        await handleGeneralChat(questionText, typingId, session.access_token, detectedCategory, detectedSubCategory);
        return; // STOP HERE
      }

      // --- CASE B: FEATURE ENABLED -> CHECK CONTEXT ---

      // 1. Resolve Sticky Context
      let currentPartner = activePartner;

      // Fallback: Restore context from history if needed
      if (!currentPartner) {
        const lastLockedWidget = [...chatHistory].reverse().find(m =>
          m.isWidget && m.widgetData?.isLocked && m.widgetData?.partner_profile_id
        );
        if (lastLockedWidget?.widgetData) {
          currentPartner = {
            id: lastLockedWidget.widgetData.partner_profile_id!,
            name: lastLockedWidget.widgetData.partner_name!
          };
          setActivePartner(currentPartner);
        }
      }

      // 3. New Person/Date Detection
      const dateRegex = /\b(\d{1,2})[-/\s](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-/\s](\d{2,4})\b/i;
      const hasDateInfo = dateRegex.test(questionText);
      const isNewPersonIntent = hasDateInfo || /\b(another person|someone else|different|crush)\b/i.test(questionText);

      // 4. Sticky Context Rule
      const stickyKeywords = /\b(we|us|our|ours|relationship|marriage|bond|connection|compatibility|match|score|he|she|him|her)\b/i;
      const mentionsPartnerName = currentPartner && questionText.toLowerCase().includes(currentPartner.name.toLowerCase());

      const isRelationshipContext =
        (detectedCategory === 'love_compatibility' || stickyKeywords.test(questionText) || mentionsPartnerName)
        && !isNewPersonIntent;

      // --- ROUTING ---

      // ROUTE 1: STICKY CONTEXT (Active Partner)
      if (currentPartner && isRelationshipContext) {
        if (isOutOfFunds) { handleLowBalance(); return; }
        await handleCompatibilityCheck(currentPartner.name, typingId, session.access_token, questionText, currentPartner.id);
      }

      // ROUTE 2: NEW INQUIRY — only when the user actually references a specific
      // person/partner or a birth date. A bare "love_compatibility" category is NOT
      // enough: the categorizer often mislabels general questions (e.g. "mere life
      // ke baare me batao"), which used to hijack them into a brief teaser + form
      // instead of a full answer. Genuine compatibility asks still flow here.
      else if (isNewPersonIntent) {

        // A. Extract Data (Local Regex)
        let extractedDob = catData?.entities?.partner_dob;
        let extractedTob = catData?.entities?.partner_tob;

        if (!extractedDob) {
          const dateMatch = questionText.match(dateRegex);
          if (dateMatch) {
            const d = new Date(dateMatch[0]);
            if (!isNaN(d.getTime())) extractedDob = d.toISOString().split('T')[0];
          }
        }

        if (!extractedTob) {
          const timeMatch = questionText.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
          if (timeMatch) {
            let hours = parseInt(timeMatch[1]);
            const minutes = timeMatch[2] || '00';
            if (timeMatch[3].toLowerCase() === 'pm' && hours < 12) hours += 12;
            if (timeMatch[3].toLowerCase() === 'am' && hours === 12) hours = 0;
            extractedTob = `${hours.toString().padStart(2, '0')}:${minutes}`;
          }
        }

        // B. SEND TEASER (Updated to be Clean)
        // INSTRUCTION: Give insight based on USER's chart only. STOP asking for details.
        const teaserContext = `User Question: "${questionText}".
          Based ONLY on the planetary influences in the USER'S birth chart (Dasha, 5th/7th house trends), provide a brief, helpful astrological insight regarding their romantic timing or situation.
          CRITICAL INSTRUCTION: Do NOT mention that you need partner details. Do NOT ask for birth data. The user will see a form to enter it immediately after this message. Just answer the user's side of the equation.`;

        try {
          await handleGeneralChat(teaserContext, typingId, session.access_token, detectedCategory, detectedSubCategory, questionText);
        } catch (e) {
          // If General Chat fails (e.g. balance), stop logic
          if (isOutOfFunds) { handleLowBalance(); return; }
        }

        // C. SHOW FORM WIDGET
        const userGender = selectedProfile?.gender || '';
        let defaultPartnerGender = '';
        if (userGender === 'Male') defaultPartnerGender = 'Female';
        else if (userGender === 'Female') defaultPartnerGender = 'Male';

        const widgetMessage: ChatMessage = {
          id: `widget_${Date.now()}`,
          role: 'assistant',
          content: '',
          isWidget: true,
          widgetType: 'compatibility_form',
          widgetData: {
            partner_name: catData?.entities?.partner_name,
            partner_dob: extractedDob,
            partner_tob: extractedTob,
            partner_gender: catData?.entities?.partner_gender || defaultPartnerGender,
            sub_category: detectedSubCategory,
            needsPayment: false
          },
          onWidgetSubmit: handleWidgetFormSubmit
        };

        setChatHistory(prev => [...prev, widgetMessage]);
      }

      // ROUTE 3: GENERAL CHAT
      else {
        if (isOutOfFunds) { handleLowBalance(); return; }
        await handleGeneralChat(questionText, typingId, session.access_token, detectedCategory, detectedSubCategory);
      }

    } catch (err: any) {
      console.error(err);
      setChatHistory(prev => prev.map(msg => msg.id === typingId ? { ...msg, content: "An error occurred. Please try again." } : msg));
    } finally {
      setIsReplying(false);
    }
  };

  const handleSuggestedQuestionClick = (question: string) => {
    trackEvent('AI Generated Question Click', { question_text: question, profile_id: selectedProfile?.id });
    handleSendMessage(question);
  };

  const handleAddProfileClick = (e: React.MouseEvent) => {
    trackEvent('Add New Profile Clicked', { source: 'Chat Page', current_profile_count: userProfiles?.length ?? 0, can_add_profile: canAddProfile });
    if (!canAddProfile) {
      e.preventDefault();
      setSubscriptionModalOpen(true);
    }
  };

  const handleFeedback = async (messageToUpdate: ChatMessage, feedback: 'like' | 'dislike') => {
    trackEvent('Chat Message Feedback', { feedback, profile_id: selectedProfile?.id, message_id: messageToUpdate.id });
    let messageId = messageToUpdate.id;
    if (!messageId || messageId.startsWith('assistant_') || messageId.startsWith('welcome_') || messageId.startsWith('widget_')) {
      try {
        const { data, error } = await supabase.from('chat_history').select('id').eq('profile_id', selectedProfile!.id).eq('role', 'assistant').eq('message_content', messageToUpdate.content).order('created_at', { ascending: false }).limit(1).single();
        if (data) messageId = data.id;
      } catch (e) { console.error(e); }
    }

    setChatHistory(prev => prev.map(msg => (msg === messageToUpdate) ? { ...msg, id: messageId, feedback } : msg));

    if (messageId && !messageId.startsWith('assistant_') && !messageId.startsWith('welcome_') && !messageId.startsWith('widget_')) {
      try {
        await supabase.functions.invoke('update-message-feedback', { body: { message_id: messageId, feedback: feedback } });
      } catch (err) { console.error("Error submitting feedback", err); }
    }
  };

  const handleProfileClick = (profile: EnrichedProfile) => {
    if (isCallActive && selectedProfile && selectedProfile.id !== profile.id) {
      setShowProfileDropdown(false);
      return;
    }
    setSelectedProfile(profile);
    setShowProfileDropdown(false);
    setIsAllProfilesExpanded(false);
  };

  const startCallInternal = () => {
    if (!selectedProfile) {
      console.error("Attempted to start a call without a selected profile.");
      return;
    }
    // Use Ultravox for voice calls.
    setSelectedCallProvider('ultravox');
    setIsCallActive(true);
  };

  const handleStartCall = () => {
    trackEvent('Call Button Clicked', { source: 'Chat Page', profile_id: selectedProfile?.id, plan_tier: planTier });
    if (!selectedProfile) return;
    setShowInitiateCallModal(true);
  };

  const handleCallEnded = useCallback(() => {
    setIsCallActive(false);
    setSelectedCallProvider(null);
  }, []);

  return (
    <div className={styles.pageContainer}>
      <PartnerDetailsModal
        isOpen={isPartnerModalOpen}
        onClose={() => setIsPartnerModalOpen(false)}
        onSave={handlePartnerFormSubmit}
        partnerNameHint={partnerNameHint}
      />

      <SubscriptionModal isOpen={isSubscriptionModalOpen} onClose={() => setSubscriptionModalOpen(false)} />
      <InitiateCallModal
        isOpen={showInitiateCallModal}
        onClose={() => setShowInitiateCallModal(false)}
        onConfirm={() => { setShowInitiateCallModal(false); startCallInternal(); }}
        walletBalance={walletBalance}
        onBuyCoinsClick={handleOpenSubscriptionModal}
      />

      {!isMobile && (
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeaderContainer}>
            <h2 className={styles.sidebarHeader}>Your Conversations</h2>
            
            <div className={styles.sidebarActions}>
              <button 
                className={styles.newChatButton} 
                onClick={handleNewChat}
                disabled={isLoadingProfiles || !selectedProfile}
                title="Start a fresh conversation"
              >
                <IconMessagePlus size={18} />
                <span>New Chat</span>
              </button>

              <Link 
                to="/profiles/new" 
                className={styles.addProfileButton} 
                onClick={handleAddProfileClick}
                title={!canAddProfile ? "Upgrade to add more profiles" : "Add a new profile"}
              >
                <IconPlus size={18} />
                <span>Add New Profile</span>
              </Link>
            </div>
          </div>

          {isLoadingProfiles ? <LoadingSpinner /> : (
            <div className={styles.sidebarContent}>
              
              {/* --- Recent Chats Section (Renamed to Recent History) --- */}
              <div ref={recentChatsSectionRef} className={`${styles.sidebarSection} ${styles.recentChatsSection}`}>
                <h4 className={styles.sidebarSubHeader}>Recent History</h4>
                <div className={styles.recentChatsList}>
                  {recentChats.length > 0 ? (recentChats.map(chat => {
                    const isCurrent = selectedProfile?.id === chat.profile_id;
                    
                    // Logic to clean up content and derive topic
                    const rawContent = chat.last_message_content || "";
                    // Clean up common AI artifacts for preview
                    const cleanContent = rawContent
                      .replace(/\[ANSWER\]/g, '')
                      .replace(/\[\/ANSWER\]/g, '')
                      .replace(/AuraAI is typing\.\.\./g, 'Drafting prediction...')
                      .trim();
                    
                    const topicData = getChatTopic(cleanContent);

                    return (
                      <div 
                        key={chat.profile_id} 
                        className={`${styles.recentChatItem} ${isCurrent ? styles.current : ''}`} 
                        onClick={() => { 
                          const profileToSelect = profiles.find(p => p.id === chat.profile_id); 
                          if (profileToSelect) handleProfileClick(profileToSelect); 
                        }}
                      >
                        {/* TOPIC HEADER */}
                        <div className={styles.chatItemHeader}>
                          <span className={styles.chatTopicIcon}>{topicData.icon}</span>
                          <span className={styles.chatTopicLabel}>{topicData.label}</span>
                        </div>

                        {/* MESSAGE PREVIEW */}
                        <p className={styles.recentChatMessage}>
                          {cleanContent.substring(0, 60)}{cleanContent.length > 60 ? "..." : ""}
                        </p>

                        {/* FOOTER: Profile Name */}
                        <div className={styles.chatItemFooter}>
                          <span className={styles.chatProfileTag}>
                            {chat.profile_name}
                          </span>
                        </div>
                      </div>
                    );
                  })) : (<p className={styles.emptyStateMessage}>No recent conversations.</p>)}
                </div>
              </div>

              {/* --- All Profiles Section (Moved Below & Collapsible) --- */}
              <div ref={allProfilesSectionRef} className={`${styles.sidebarSection} ${styles.allProfilesSection}`}>
                <div className={styles.sectionHeaderWithToggle}>
                  <h4 className={styles.sidebarSubHeader}>My Profiles</h4>
                  <button className={styles.toggleButton} onClick={() => setIsAllProfilesExpanded(!isAllProfilesExpanded)}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={isAllProfilesExpanded ? styles.rotated : '180'}><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                </div>
                {isAllProfilesExpanded && (
                  <div className={styles.profileList}>
                    {profiles.map((profile, index) => (
                      <ProfileCard key={profile.id} profile={profile} index={index} isCurrent={selectedProfile?.id === profile.id} onClick={handleProfileClick} />
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </aside>
      )}

      <main className={styles.contentArea}>
        {isCallActive && selectedProfile ? (
          <>
            {selectedCallProvider === 'ultravox' && <UltravoxCallScreen profile={selectedProfile} onCallEnded={handleCallEnded} />}
            {selectedCallProvider === 'agora' && <CustomAgoraCallScreen profile={selectedProfile} onCallEnded={handleCallEnded} />}
            {!selectedCallProvider && <LoadingPage message="Initializing call service..." />}
          </>
        ) : (
          <>
            {!isLoadingProfiles && !selectedProfile && (
              <div className={styles.welcomeView}>
                <h2>Ask Aura AI</h2>
                <p>Select a profile to begin your personalized cosmic conversation.</p>
                {profiles.length === 0 && <Link to="/profiles/new" className={styles.createProfileButton}><IconPlus size={20} /><span>Create Your First Profile</span></Link>}
              </div>
            )}
            {selectedProfile && (
              isChatLoading ? <LoadingPage message={`Preparing chat for ${selectedProfile.name}...`} /> : (
                <div className={styles.chatCanvas}>
                  <div className={styles.topBar}>
                    <div className={styles.topBarLeft}>
                      <div className={styles.profileSelectorWrapper} ref={profileDropdownRef}>
                        <button className={styles.profileSelector} onClick={() => setShowProfileDropdown(!showProfileDropdown)}>
                          <div className={styles.profileAvatar}>{selectedProfile?.name?.charAt(0) || 'U'}</div>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                        </button>
                        {showProfileDropdown && (
                          <div className={styles.profileDropdown}>
                            {profiles.length > 0 && profiles.map((profile) => (
                              <button key={profile.id} className={`${styles.profileDropdownItem} ${selectedProfile?.id === profile.id ? styles.active : ''}`} onClick={() => handleProfileClick(profile)}>
                                <div className={styles.profileDropdownAvatar}>{profile.name.charAt(0)}</div>
                                <div className={styles.profileDropdownInfo}><span className={styles.profileDropdownName}>{profile.name}</span><span className={styles.profileDropdownDetails}>{profile.gender} • {profile.date_of_birth}</span></div>
                                {selectedProfile?.id === profile.id && <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 4L6 11L3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                              </button>
                            ))}
                            <Link to="/profiles/new" className={`${styles.profileDropdownItem} ${styles.createProfile} ${profiles.length > 0 ? styles.withSeparator : ''}`} onClick={(e) => { handleAddProfileClick(e); setShowProfileDropdown(false); }}>
                              <div className={styles.profileDropdownAvatar} style={{ background: 'rgba(255, 255, 255, 0.2)' }}><IconPlus size={18} /></div>
                              <div className={styles.profileDropdownInfo}><span className={styles.profileDropdownName}>Create Profile</span><span className={styles.profileDropdownDetails}>Add a new profile</span></div>
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={styles.topBarCenter}>
                      <button type="button" className="mobile-avatar-link call-button-nav" title="Start AI Voice Call" onClick={() => { const urlParams = new URLSearchParams(window.location.search); urlParams.set('startCall', '1'); navigate(`/chat?${urlParams.toString()}`); }}><IconPhone size={20} /></button>
                    </div>
                  </div>

                  <div className={styles.chatMessages} ref={messagesContainerRef} style={{ paddingBottom: `${chatBottomPadding}px` }}>
                    {chatHistory.map((msg, index) => {
                      if (msg.isInteractive && msg.interactiveOptions) {
                        return <ClarificationMessage key={index} options={msg.interactiveOptions} onSelect={msg.onInteractiveSelect} />;
                      }

                      const isLastMessage = index === chatHistory.length - 1;
                      const showVoicePrompt = msg.role === "assistant" && isLastMessage && !isReplying && chatHistory.length > 2 && (index % 4 === 0);

                      return (
                        <ChatMessage
                          key={msg.id || index}
                          message={msg}
                          userLanguage={selectedProfile?.preferred_language || 'en'} 
                          onCloseWidget={handleCloseWidget}
                          onFeedback={handleFeedback}
                          onStartCall={!isMobile ? handleStartCall : undefined}
                          showVoicePrompt={showVoicePrompt}
                          onTriggerReasoning={(text) => handleSendMessage(text, 'User Input')}
                        />
                      )
                    })}
                  </div>

                  <div className={styles.inputContainer} ref={inputContainerRef}>
                    {questions && Object.keys(questions).length > 0 && (
                      <div className={styles.categoriesDock}>
                        <CategoryCard categories={Object.entries(questions).map(([category, qs]) => ({ name: category, questions: Array.isArray(qs) ? qs : [] }))} onQuestionSelect={handleSuggestedQuestionClick} onVisibilityChange={setAreQuestionsVisible} />
                      </div>
                    )}
                    <ChatInput
                      isLoading={isReplying || isVariantLoading}
                      onSendMessage={(message) => handleSendMessage(message)}
                      isOutOfCoins={isOutOfFunds}
                      onUpgrade={() => setSubscriptionModalOpen(true)}
                      isPremiumUser={isPremiumUser}
                      onStartCall={!isMobile ? handleStartCall : undefined}
                      isCallFeatureEnabled={!isMobile ? isCallFeatureEnabled : undefined}
                      isMobile={isMobile}
                    />
                  </div>
                </div>
              )
            )}
            {error && <div className={styles.welcomeView}><p style={{ color: '#FF8A8A' }}>{error}</p></div>}
          </>
        )}
      </main>
    </div>
  );
}