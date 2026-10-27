/**
 * Truespace — Барный кейтеринг и финансы
 * Settings & Directories View (`src/client/components/settings/SettingsView.tsx`)
 *
 * Provides customization of:
 * 1. Accounts (Счета): Edit names, custom types, descriptions, add & delete accounts
 * 2. Partners (Партнёры): Add partners, editable custom roles (no hardcoding), delete
 * 3. Categories (Статьи): Clean compact cards, type, direction, color, add & delete
 *
 * All edits occur inside focused modal dialogs rather than inflating cards in the grid.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Wallet,
  Users,
  Tag,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Loader2,
  Building2,
  Landmark,
  CreditCard,
  Shield,
  RotateCcw,
  Banknote,
  Coins,
  Smartphone,
  PiggyBank,
  Briefcase,
  Zap,
  LucideIcon,
  UserPlus,
  AlertTriangle,
  Link2,
  Copy,
  QrCode,
  Share2,
  Send,
  KeyRound,
  Lock,
  Mail,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext.js';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../api/apiClient.js';
import { formatRubles } from '../../utils/formatters.js';
import { Account, Category, Partner, TransactionDirection, UserRole, CompanyInvite, TaxSystem, CompanyTaxSettings, LegalEntity, LegalEntityType, LegalEntityTaxSystem } from '../../../shared/types.js';
import { calculateTaxReserve } from '../../utils/taxCalculator.js';

type SettingsTab = 'accounts' | 'partners' | 'categories' | 'organization' | 'profile' | 'legal_entities';

const PRESET_COLORS = [
  '#10b981', // изумрудный (касса / наличные)
  '#2563eb', // синий (банк / р-счёт)
  '#7c3aed', // фиолетовый (карта / сбп)
  '#0284c7', // циан (резерв / сейф)
  '#d97706', // янтарный (золото / фонд)
  '#e11d48', // рубиновый (акцент)
  '#64748b', // сланцевый (нейтральный)
  '#ec4899', // розовый
  '#f97316', // оранжевый
];

const ACCOUNT_ICON_MAP: Record<string, LucideIcon> = {
  'banknote': Banknote,
  'coins': Coins,
  'landmark': Landmark,
  'credit-card': CreditCard,
  'smartphone': Smartphone,
  'wallet': Wallet,
  'shield': Shield,
  'piggy-bank': PiggyBank,
  'briefcase': Briefcase,
  'zap': Zap,
};

const ACCOUNT_ICONS = [
  { id: 'banknote', label: 'Купюры / Касса', icon: Banknote },
  { id: 'coins', label: 'Монеты / Мелочь', icon: Coins },
  { id: 'landmark', label: 'Банк / Р/с', icon: Landmark },
  { id: 'credit-card', label: 'Карта', icon: CreditCard },
  { id: 'smartphone', label: 'СБП / Онлайн', icon: Smartphone },
  { id: 'wallet', label: 'Кошелёк', icon: Wallet },
  { id: 'shield', label: 'Сейф / Защита', icon: Shield },
  { id: 'piggy-bank', label: 'Копилка / Резерв', icon: PiggyBank },
  { id: 'briefcase', label: 'Бизнес / Дела', icon: Briefcase },
  { id: 'zap', label: 'Молния / Быстрые', icon: Zap },
];

const PRODUCTION_SITE_URL = 'http://shved4656.fvds.ru';

function getInviteBaseUrl(): string {
  if (typeof window === 'undefined') return PRODUCTION_SITE_URL;
  const host = window.location.hostname;
  // If previewing locally (localhost / 127.0.0.1 / 192.168.x.x), always generate links pointing to the live production site
  if (!host || host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.startsWith('192.168.')) {
    return PRODUCTION_SITE_URL;
  }
  return window.location.origin;
}

export const SettingsView: React.FC = () => {
  const {
    accounts,
    refreshAccounts,
    partners,
    refreshPartners,
    categories,
    refreshCategories,
    resetAccountBalances,
    addToast,
    transactions,
    events,
    legalEntities,
    createLegalEntity,
    updateLegalEntity,
    deleteLegalEntity,
  } = useFinance();

  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const saved = localStorage.getItem('findoctor_settings_tab') as SettingsTab | null;
    if (saved && ['accounts', 'partners', 'categories', 'organization', 'profile', 'legal_entities'].includes(saved)) {
      return saved;
    }
    return 'accounts';
  });
  const [isSaving, setIsSaving] = useState(false);

  const {
    currentCompany,
    updateCompanyDetails,
    currentUser,
    userRole,
    companyMembers,
    inviteMember,
    deleteCompany,
    updateProfile,
    changeUserPassword,
    requestEmailChangeCode,
    verifyOldEmailCode,
    confirmNewEmail,
    requestPasswordCode,
    forgotPassword,
    refreshAuthData,
  } = useAuth();
  const [orgName, setOrgName] = useState(currentCompany?.name || '');
  const [isSavingOrg, setIsSavingOrg] = useState(false);

  // Compute accurate company tariff display (respects paidUntil & trialEndsAt)
  const tariffInfo = useMemo(() => {
    if (!currentCompany) return { text: '—', color: 'var(--muted-foreground)', detail: '' };
    const now = Date.now();
    if (currentCompany.paidUntil && new Date(currentCompany.paidUntil).getTime() > now) {
      const paidDate = new Date(currentCompany.paidUntil);
      const isVipForever = paidDate.getFullYear() > 2100;
      return {
        text: isVipForever ? 'PRO • Бессрочный доступ (VIP)' : `PRO • Оплачено до ${paidDate.toLocaleDateString('ru-RU')}`,
        color: '#059669',
        detail: isVipForever ? 'Оплаченный бессрочный доступ активен' : `Доступ оплачен до ${paidDate.toLocaleDateString('ru-RU')}`,
      };
    }
    if (currentCompany.trialEndsAt && new Date(currentCompany.trialEndsAt).getTime() > now) {
      const trialDate = new Date(currentCompany.trialEndsAt);
      const daysLeft = Math.max(0, Math.ceil((trialDate.getTime() - now) / (1000 * 60 * 60 * 24)));
      return {
        text: `PRO Trial • ${daysLeft} ${daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'}`,
        color: '#d97706',
        detail: `Пробный период действует до ${trialDate.toLocaleDateString('ru-RU')}`,
      };
    }
    if (currentCompany.plan === 'pro') {
      return {
        text: 'PRO • Срок истёк',
        color: '#dc2626',
        detail: 'Требуется продление подписки',
      };
    }
    return {
      text: 'Базовый (Бесплатный)',
      color: 'var(--muted-foreground)',
      detail: 'Стандартный доступ к системе',
    };
  }, [currentCompany]);

  // Compute stylish monogram initials for company (e.g. "BE" for "BRILLIANT EVENT")
  const companyInitials = useMemo(() => {
    const name = (currentCompany?.name || 'Brilliant Event').trim();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }, [currentCompany?.name]);

  // Profile & Personal Data state
  const [profileFullName, setProfileFullName] = useState(currentUser?.fullName || '');
  const [profileRoleTitle, setProfileRoleTitle] = useState(() => {
    return userRole === 'owner' ? 'Владелец / Основатель' : userRole === 'admin' ? 'Партнёр / Управляющий' : 'Сотрудник команды';
  });
  const [isSavingName, setIsSavingName] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<string | null>(null);

  // Email 2-Step Security Verification Flow state
  const [isEmailFlowOpen, setIsEmailFlowOpen] = useState(false);
  const [emailStep, setEmailStep] = useState<'step1_old' | 'step2_new'>('step1_old');
  const [currentPassForEmail, setCurrentPassForEmail] = useState('');
  const [oldEmailCode, setOldEmailCode] = useState<string[]>(['', '', '', '', '', '']);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [newEmailCode, setNewEmailCode] = useState<string[]>(['', '', '', '', '', '']);
  const [emailFeedback, setEmailFeedback] = useState<string | null>(null);
  const [isSendingOldCode, setIsSendingOldCode] = useState(false);
  const [isSendingNewCode, setIsSendingNewCode] = useState(false);
  const [isFinalizingEmail, setIsFinalizingEmail] = useState(false);

  // Password Security Verification Flow state
  const [isPassFlowOpen, setIsPassFlowOpen] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [repeatPass, setRepeatPass] = useState('');
  const [passCode, setPassCode] = useState<string[]>(['', '', '', '', '', '']);
  const [passFeedback, setPassFeedback] = useState<string | null>(null);
  const [isSendingPassCode, setIsSendingPassCode] = useState(false);
  const [isFinalizingPass, setIsFinalizingPass] = useState(false);
  const [isForgotSending, setIsForgotSending] = useState(false);
  const [sessionTerminated, setSessionTerminated] = useState(false);

  const resetSecurityFlows = useCallback(() => {
    setIsEmailFlowOpen(false);
    setEmailStep('step1_old');
    setCurrentPassForEmail('');
    setOldEmailCode(['', '', '', '', '', '']);
    setNewEmailInput('');
    setNewEmailCode(['', '', '', '', '', '']);
    setEmailFeedback(null);

    setIsPassFlowOpen(false);
    setCurrentPass('');
    setNewPass('');
    setRepeatPass('');
    setPassCode(['', '', '', '', '', '']);
    setPassFeedback(null);
  }, []);

  const handleSelectTab = (tab: SettingsTab) => {
    resetSecurityFlows();
    setActiveTab(tab);
    localStorage.setItem('findoctor_settings_tab', tab);
  };

  useEffect(() => {
    if (currentUser) {
      setProfileFullName(currentUser.fullName || '');
    }
  }, [currentUser]);

  const handleCodeBoxInput = (
    index: number,
    value: string,
    stateArr: string[],
    setStateArr: React.Dispatch<React.SetStateAction<string[]>>,
    containerId: string
  ) => {
    const rawDigits = value.replace(/\D/g, '');
    if (rawDigits.length > 1) {
      const digits = rawDigits.slice(0, 6).split('');
      const updated = [...stateArr];
      digits.forEach((d, i) => {
        if (i < 6) updated[i] = d;
      });
      setStateArr(updated);
      const container = document.getElementById(containerId);
      if (container) {
        const inputs = container.querySelectorAll<HTMLInputElement>('.profile-code-input');
        const targetIdx = Math.min(digits.length, 5);
        inputs[targetIdx]?.focus();
      }
      return;
    }

    const updated = [...stateArr];
    updated[index] = rawDigits.slice(-1);
    setStateArr(updated);

    if (rawDigits && index < 5) {
      const container = document.getElementById(containerId);
      if (container) {
        const inputs = container.querySelectorAll<HTMLInputElement>('.profile-code-input');
        inputs[index + 1]?.focus();
      }
    }
  };

  const handleSaveProfileName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !profileFullName.trim()) return;
    setIsSavingName(true);
    setProfileFeedback(null);
    try {
      await updateProfile(currentUser.id, { fullName: profileFullName.trim() });
      setProfileFeedback('✅ Изменения профиля успешно сохранены');
      addToast('Имя профиля успешно сохранено', 'success');
    } catch (err: any) {
      setProfileFeedback(`Ошибка: ${err.message || 'Не удалось обновить профиль'}`);
      addToast(err.message || 'Ошибка обновления имени', 'error');
    } finally {
      setIsSavingName(false);
    }
  };

  // Email Change Handlers (OWASP 2-Step Verification)
  const handleSendOldEmailCode = async () => {
    if (!currentUser || !currentPassForEmail) return;
    setIsSendingOldCode(true);
    setEmailFeedback(null);
    try {
      await requestEmailChangeCode(currentUser.id, currentPassForEmail);
      setEmailFeedback(`✅ Проверочный код выслан на вашу текущую почту ${currentUser.email}`);
    } catch (err: any) {
      setEmailFeedback(`Ошибка: ${err.message || 'Не удалось отправить проверочный код'}`);
    } finally {
      setIsSendingOldCode(false);
    }
  };

  const handleVerifyOldCodeAndProceed = () => {
    const code = oldEmailCode.join('').trim();
    if (code.length !== 6) {
      setEmailFeedback('Ошибка: введите полный 6-значный код из письма');
      return;
    }
    setEmailStep('step2_new');
    setEmailFeedback(null);
  };

  const handleSendNewEmailCode = async () => {
    if (!currentUser || !newEmailInput.includes('@')) {
      setEmailFeedback('Ошибка: введите корректный новый адрес email');
      return;
    }
    setIsSendingNewCode(true);
    setEmailFeedback(null);
    try {
      await verifyOldEmailCode(currentUser.id, oldEmailCode.join('').trim(), newEmailInput.trim().toLowerCase());
      setEmailFeedback(`✅ Код подтверждения отправлен на новый адрес ${newEmailInput}`);
    } catch (err: any) {
      setEmailFeedback(`Ошибка: ${err.message || 'Не удалось отправить код'}`);
    } finally {
      setIsSendingNewCode(false);
    }
  };

  const handleConfirmNewEmail = async () => {
    if (!currentUser) return;
    const code = newEmailCode.join('').trim();
    if (code.length !== 6) {
      setEmailFeedback('Ошибка: введите полный 6-значный проверочный код с нового адреса');
      return;
    }
    setIsFinalizingEmail(true);
    setEmailFeedback(null);
    try {
      await confirmNewEmail(currentUser.id, newEmailInput.trim().toLowerCase(), code);
      await refreshAuthData();
      addToast(`Email успешно изменён на ${newEmailInput.trim().toLowerCase()}`, 'success');
      resetSecurityFlows();
    } catch (err: any) {
      setEmailFeedback(`Ошибка: ${err.message || 'Не удалось завершить смену Email'}`);
    } finally {
      setIsFinalizingEmail(false);
    }
  };

  // Password Change Handlers (Step-up Verification with Email Code)
  const handleSendPassCode = async () => {
    if (!currentUser || !currentPass) return;
    setIsSendingPassCode(true);
    setPassFeedback(null);
    try {
      await requestPasswordCode(currentUser.id, currentPass);
      setPassFeedback(`✅ Код подтверждения отправлен на ваш email ${currentUser.email}`);
    } catch (err: any) {
      setPassFeedback(`Ошибка: ${err.message || 'Не удалось отправить код'}`);
    } finally {
      setIsSendingPassCode(false);
    }
  };

  const handleConfirmPasswordChange = async () => {
    if (!currentUser) return;
    if (newPass.length < 6) {
      setPassFeedback('Ошибка: пароль должен содержать минимум 6 символов');
      return;
    }
    if (newPass !== repeatPass) {
      setPassFeedback('Ошибка: новый пароль и повтор не совпадают');
      return;
    }
    const code = passCode.join('').trim();
    setIsFinalizingPass(true);
    setPassFeedback(null);
    try {
      await changeUserPassword(currentUser.id, newPass, currentPass, code || undefined);
      await refreshAuthData();
      addToast('Пароль успешно обновлён', 'success');
      resetSecurityFlows();
    } catch (err: any) {
      setPassFeedback(`Ошибка: ${err.message || 'Не удалось обновить пароль'}`);
    } finally {
      setIsFinalizingPass(false);
    }
  };

  const handleForgotPasswordClick = async () => {
    if (!currentUser?.email) return;
    setIsForgotSending(true);
    try {
      await forgotPassword(currentUser.email);
      addToast(`Инструкции по восстановлению отправлены на ${currentUser.email}`, 'info');
    } catch (err: any) {
      addToast(err.message || 'Ошибка отправки инструкций', 'error');
    } finally {
      setIsForgotSending(false);
    }
  };

  // Invite member state (Links, QR, Email)
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteTab, setInviteTab] = useState<'link' | 'email'>('link');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('staff');
  const [inviteExpiresDays] = useState<number>(7);
  const [isInviting, setIsInviting] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [generatedInvite, setGeneratedInvite] = useState<CompanyInvite | null>(null);
  const [invitesList, setInvitesList] = useState<CompanyInvite[]>([]);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [showQrCode, setShowQrCode] = useState(false);

  const fetchInvites = useCallback(async () => {
    if (!currentCompany) return;
    try {
      const list = await api.getCompanyInvites(currentCompany.id);
      setInvitesList(list.filter((i) => i.status === 'active'));
    } catch {
      // ignore
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    if (activeTab === 'organization' && currentCompany?.id) {
      fetchInvites();
    }
  }, [activeTab, currentCompany?.id, fetchInvites]);

  const handleGenerateLink = async () => {
    if (!currentCompany) return;
    setIsGeneratingLink(true);
    try {
      const inv = await api.createCompanyInvite(currentCompany.id, {
        role: inviteRole,
        expiresDays: inviteExpiresDays > 0 ? inviteExpiresDays : undefined,
      });
      setGeneratedInvite(inv);
      await fetchInvites();
      addToast('Ссылка-приглашение создана!', 'success');
    } catch (err: any) {
      addToast(err.message || 'Ошибка создания ссылки', 'error');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    let copied = false;

    // 1. Modern secure clipboard API
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
        copied = false;
      }
    }

    // 2. HTTP non-secure context fallback (document.execCommand)
    if (!copied && typeof document !== 'undefined') {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        textarea.setAttribute('readonly', '');
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, 99999);
        copied = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        // ignore
      }
    }

    setCopiedInviteId(id);
    addToast('Ссылка скопирована в буфер обмена!', 'success');
    setTimeout(() => {
      setCopiedInviteId(null);
    }, 2500);
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!currentCompany) return;
    try {
      await api.revokeCompanyInvite(currentCompany.id, inviteId);
      addToast('Ссылка-приглашение отозвана', 'success');
      if (generatedInvite?.id === inviteId) setGeneratedInvite(null);
      await fetchInvites();
    } catch (err: any) {
      addToast(err.message || 'Ошибка отзыва ссылки', 'error');
    }
  };

  // Delete company modal state
  const [isDeleteCompanyModalOpen, setIsDeleteCompanyModalOpen] = useState(false);
  const [deleteCompanyNameConfirm, setDeleteCompanyNameConfirm] = useState('');
  const [isDeletingCompany, setIsDeletingCompany] = useState(false);

  useEffect(() => {
    if (currentCompany?.name) {
      setOrgName(currentCompany.name);
    }
  }, [currentCompany?.name]);

  const handleSaveOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany || !orgName.trim()) return;
    setIsSavingOrg(true);
    try {
      await updateCompanyDetails(currentCompany.id, { name: orgName.trim() });
      addToast('Название организации успешно обновлено', 'success');
    } catch (err: any) {
      addToast(err.message || 'Ошибка обновления организации', 'error');
    } finally {
      setIsSavingOrg(false);
    }
  };

  // Taxation system state
  const [taxSystem, setTaxSystem] = useState<TaxSystem>(() => {
    return currentCompany?.taxSystem || currentCompany?.taxSettings?.system || 'usn_income';
  });
  const [taxRate, setTaxRate] = useState<number>(() => {
    return currentCompany?.taxRate ?? currentCompany?.taxSettings?.rate ?? 6;
  });
  const [applyOnlyToBank, setApplyOnlyToBank] = useState<boolean>(() => {
    return currentCompany?.taxSettings?.applyOnlyToBank ?? false;
  });
  const [isSavingTax, setIsSavingTax] = useState(false);

  useEffect(() => {
    if (currentCompany) {
      setTaxSystem(currentCompany.taxSystem || currentCompany.taxSettings?.system || 'usn_income');
      setTaxRate(currentCompany.taxRate ?? currentCompany.taxSettings?.rate ?? 6);
      setApplyOnlyToBank(currentCompany.taxSettings?.applyOnlyToBank ?? false);
    }
  }, [currentCompany]);

  const liveTaxPreview = useMemo(() => {
    return calculateTaxReserve(transactions, accounts, {
      system: taxSystem,
      rate: Number(taxRate) || 0,
      applyOnlyToBank,
    }, new Date(), events);
  }, [transactions, accounts, taxSystem, taxRate, applyOnlyToBank, events]);

  const handleSaveTaxSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany) return;
    setIsSavingTax(true);
    try {
      const newTaxSettings: CompanyTaxSettings = {
        system: taxSystem,
        rate: Number(taxRate) || 0,
        applyOnlyToBank,
      };
      await updateCompanyDetails(currentCompany.id, {
        taxSystem,
        taxRate: Number(taxRate) || 0,
        taxSettings: newTaxSettings,
      });
      addToast('Настройки налогообложения успешно сохранены', 'success');
    } catch (err: any) {
      addToast(err.message || 'Ошибка сохранения настроек налогов', 'error');
    } finally {
      setIsSavingTax(false);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      await inviteMember(inviteEmail.trim(), inviteRole, inviteFullName.trim() || undefined);
      addToast(`Приглашение отправлено на ${inviteEmail.trim()}`, 'success');
      setIsInviteModalOpen(false);
      setInviteEmail('');
      setInviteFullName('');
      setInviteRole('accountant');
    } catch (err: any) {
      addToast(err.message || 'Ошибка отправки приглашения', 'error');
    } finally {
      setIsInviting(false);
    }
  };

  const handleDeleteCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany) return;
    if (deleteCompanyNameConfirm.trim() !== currentCompany.name.trim()) {
      addToast(`Введите точное название «${currentCompany.name}» для подтверждения`, 'error');
      return;
    }
    setIsDeletingCompany(true);
    try {
      await deleteCompany(currentCompany.id);
      addToast(`Организация «${currentCompany.name}» удалена`, 'success');
      setIsDeleteCompanyModalOpen(false);
    } catch (err: any) {
      addToast(err.message || 'Ошибка удаления организации', 'error');
    } finally {
      setIsDeletingCompany(false);
    }
  };

  // ==========================================
  // MODAL DIALOG STATES
  // ==========================================
  const [modalAccount, setModalAccount] = useState<
    { mode: 'create' } | { mode: 'edit'; account: Account } | null
  >(null);
  const [accName, setAccName] = useState('');
  const [accTypeSelect, setAccTypeSelect] = useState<'cash' | 'bank' | 'card' | 'safe' | 'custom'>('cash');
  const [customAccTypeName, setCustomAccTypeName] = useState('');
  const [accBalance, setAccBalance] = useState<number>(0);
  const [accDesc, setAccDesc] = useState('');
  const [accColor, setAccColor] = useState<string>('#10b981');
  const [accIcon, setAccIcon] = useState<string>('banknote');
  const [accLegalEntityId, setAccLegalEntityId] = useState<string>('');

  const [modalLegalEntity, setModalLegalEntity] = useState<
    { mode: 'create' } | { mode: 'edit'; entity: LegalEntity } | null
  >(null);
  const [leName, setLeName] = useState('');
  const [leType, setLeType] = useState<LegalEntityType>('llc');
  const [leTaxSystem, setLeTaxSystem] = useState<LegalEntityTaxSystem>('osno');
  const [leTaxRate, setLeTaxRate] = useState<number | string>(20);
  const [leVatRate, setLeVatRate] = useState<number | string>(20);
  const [leInn, setLeInn] = useState('');
  const [leDesc, setLeDesc] = useState('');
  const [leIsDefault, setLeIsDefault] = useState(false);

  const [modalPartner, setModalPartner] = useState<
    { mode: 'create' } | { mode: 'edit'; partner: Partner } | null
  >(null);
  const [partnerName, setPartnerName] = useState('');
  const [partnerRole, setPartnerRole] = useState('');

  const [modalCategory, setModalCategory] = useState<
    { mode: 'create' } | { mode: 'edit'; category: Category } | null
  >(null);
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<'expense' | 'income'>('expense');
  const [catDirection, setCatDirection] = useState<TransactionDirection | 'all'>('operational');
  const [catColor, setCatColor] = useState('#2563eb');

  // ==========================================
  // ACCOUNT ACTIONS
  // ==========================================
  const openCreateAccount = () => {
    setAccName('');
    setAccTypeSelect('cash');
    setCustomAccTypeName('');
    setAccBalance(0);
    setAccDesc('');
    setAccColor('#10b981');
    setAccIcon('banknote');
    setAccLegalEntityId('');
    setModalAccount({ mode: 'create' });
  };

  const openEditAccount = (acc: Account) => {
    setAccName(acc.name);
    if (acc.type === 'cash' || acc.type === 'bank' || acc.type === 'card' || acc.type === 'safe') {
      setAccTypeSelect(acc.type);
      setCustomAccTypeName('');
    } else {
      setAccTypeSelect('custom');
      setCustomAccTypeName(acc.type || '');
    }
    setAccBalance(acc.currentBalance);
    setAccDesc(acc.description || '');

    // Resolve color and icon with contextual defaults
    const fallbackColor = acc.color || (
      acc.type === 'bank' ? '#2563eb' :
      acc.type === 'card' ? '#7c3aed' :
      (acc.type as string) === 'safe' ? '#0284c7' :
      '#10b981'
    );
    const fallbackIcon = acc.icon || (
      acc.id === 'cash_2' ? 'coins' :
      acc.type === 'bank' || acc.id === 'bank_1' ? 'landmark' :
      acc.type === 'card' || acc.id === 'bank_2' || acc.id === 'card_sbp' ? 'credit-card' :
      (acc.type as string) === 'safe' ? 'shield' :
      'banknote'
    );
    setAccColor(fallbackColor);
    setAccIcon(fallbackIcon);
    setAccLegalEntityId(acc.legalEntityId || '');
    setModalAccount({ mode: 'edit', account: acc });
  };

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) return;

    const resolvedType = accTypeSelect === 'custom'
      ? (customAccTypeName.trim() || 'Счёт')
      : accTypeSelect;
    const targetLe = legalEntities.find((le) => le.id === accLegalEntityId);

    setIsSaving(true);
    try {
      if (modalAccount?.mode === 'create') {
        await api.createAccount({
          name: accName.trim(),
          type: resolvedType,
          description: accDesc.trim(),
          initialBalance: accBalance || 0,
          color: accColor,
          icon: accIcon,
          legalEntityId: accLegalEntityId || undefined,
          legalEntityName: targetLe ? targetLe.name : undefined,
        });
        addToast('Новый счёт создан', 'success');
      } else if (modalAccount?.mode === 'edit') {
        await api.saveAccount(modalAccount.account.id, {
          name: accName.trim(),
          type: resolvedType,
          description: accDesc.trim(),
          currentBalance: accBalance,
          initialBalance: accBalance,
          color: accColor,
          icon: accIcon,
          legalEntityId: accLegalEntityId || undefined,
          legalEntityName: targetLe ? targetLe.name : undefined,
        });
        addToast('Счёт и остаток успешно сохранены', 'success');
      }
      await refreshAccounts();
      setModalAccount(null);
    } catch (err: any) {
      addToast(err.message || 'Ошибка сохранения счёта', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetBalances = async () => {
    if (!window.confirm('Обнулить остатки всех счетов до 0 ₽? Это полезно, если вы начинаете вести учёт с нуля и будете вносить реальные операции или выписки.')) {
      return;
    }
    await resetAccountBalances();
    await refreshAccounts();
  };

  const handleDeleteAccount = async (id: string, name: string) => {
    if (!window.confirm(`Вы уверены, что хотите удалить счёт «${name}»?`)) return;
    setIsSaving(true);
    try {
      await api.deleteAccount(id);
      await refreshAccounts();
      addToast(`Счёт «${name}» удалён`, 'success');
      setModalAccount(null);
    } catch (err: any) {
      addToast(err.message || 'Ошибка удаления счёта', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================
  // ==========================================
  // LEGAL ENTITY ACTIONS
  // ==========================================
  const openCreateLegalEntity = () => {
    setLeName('');
    setLeType('llc');
    setLeTaxSystem('osno');
    setLeTaxRate(20);
    setLeVatRate(20);
    setLeInn('');
    setLeDesc('');
    setLeIsDefault(false);
    setModalLegalEntity({ mode: 'create' });
  };

  const openEditLegalEntity = (le: LegalEntity) => {
    setLeName(le.name);
    setLeType(le.type);
    setLeTaxSystem(le.taxSystem);
    setLeTaxRate(le.taxRate !== undefined ? le.taxRate : 20);
    setLeVatRate(le.vatRate !== undefined ? le.vatRate : 20);
    setLeInn(le.inn || '');
    setLeDesc(le.description || '');
    setLeIsDefault(Boolean(le.isDefault));
    setModalLegalEntity({ mode: 'edit', entity: le });
  };

  const handleTaxSystemChange = (sys: LegalEntityTaxSystem) => {
    setLeTaxSystem(sys);
    if (sys === 'osno') {
      setLeTaxRate(20);
      setLeVatRate(20);
    } else if (sys === 'usn_income_vat5') {
      setLeTaxRate(6);
      setLeVatRate(5);
    } else if (sys === 'usn_income_vat7') {
      setLeTaxRate(6);
      setLeVatRate(7);
    } else if (sys === 'usn_income') {
      setLeTaxRate(6);
      setLeVatRate(0);
    } else if (sys === 'usn_income_expense') {
      setLeTaxRate(15);
      setLeVatRate(0);
    } else if (sys === 'npd') {
      setLeTaxRate(6);
      setLeVatRate(0);
    } else if (sys === 'none') {
      setLeTaxRate(0);
      setLeVatRate(0);
    }
  };

  const handleLegalEntitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leName.trim()) return;

    setIsSaving(true);
    try {
      if (modalLegalEntity?.mode === 'create') {
        await createLegalEntity({
          name: leName.trim(),
          type: leType,
          taxSystem: leTaxSystem,
          taxRate: leTaxRate !== '' ? Number(leTaxRate) : undefined,
          vatRate: leVatRate !== '' ? Number(leVatRate) : undefined,
          inn: leInn.trim() || undefined,
          description: leDesc.trim() || undefined,
          isDefault: leIsDefault,
        });
        addToast('Новое юрлицо добавлено в контур группы', 'success');
      } else if (modalLegalEntity?.mode === 'edit') {
        await updateLegalEntity(modalLegalEntity.entity.id, {
          name: leName.trim(),
          type: leType,
          taxSystem: leTaxSystem,
          taxRate: leTaxRate !== '' ? Number(leTaxRate) : undefined,
          vatRate: leVatRate !== '' ? Number(leVatRate) : undefined,
          inn: leInn.trim() || undefined,
          description: leDesc.trim() || undefined,
          isDefault: leIsDefault,
        });
        addToast('Параметры юрлица успешно сохранены', 'success');
      }
      setModalLegalEntity(null);
    } catch (err: any) {
      addToast(err.message || 'Ошибка сохранения юрлица', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLegalEntity = async (id: string, name: string) => {
    const attached = accounts.filter((a) => a.legalEntityId === id);
    if (attached.length > 0) {
      alert(`Невозможно удалить «${name}», так как к нему привязаны счета (${attached.map((a) => a.name).join(', ')}). Сначала отвяжите их или удалите.`);
      return;
    }
    if (!window.confirm(`Вы уверены, что хотите удалить юрлицо «${name}» из контура группы?`)) return;
    setIsSaving(true);
    try {
      await deleteLegalEntity(id);
      addToast(`Юрлицо «${name}» удалено`, 'success');
      setModalLegalEntity(null);
    } catch (err: any) {
      addToast(err.message || 'Ошибка удаления юрлица', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================
  // PARTNER ACTIONS
  // ==========================================
  const openCreatePartner = () => {
    setPartnerName('');
    setPartnerRole('');
    setModalPartner({ mode: 'create' });
  };

  const openEditPartner = (p: Partner) => {
    setPartnerName(p.name);
    setPartnerRole(p.role || '');
    setModalPartner({ mode: 'edit', partner: p });
  };

  const handlePartnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerName.trim()) return;

    setIsSaving(true);
    try {
      if (modalPartner?.mode === 'create') {
        await api.createPartner({
          name: partnerName.trim(),
          role: partnerRole.trim() || undefined,
        });
        addToast(`Партнёр ${partnerName} добавлен`, 'success');
      } else if (modalPartner?.mode === 'edit') {
        await api.updatePartner(modalPartner.partner.id, {
          name: partnerName.trim(),
          role: partnerRole.trim() || undefined,
        });
        addToast('Партнёр обновлён', 'success');
      }
      await refreshPartners();
      setModalPartner(null);
    } catch (err: any) {
      addToast(err.message || 'Ошибка сохранения партнёра', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePartner = async (id: string, name: string) => {
    if (!window.confirm(`Удалить партнёра «${name}»?`)) return;
    setIsSaving(true);
    try {
      await api.deletePartner(id);
      await refreshPartners();
      addToast(`Партнёр «${name}» удалён`, 'success');
      setModalPartner(null);
    } catch (err: any) {
      addToast(err.message || 'Ошибка удаления партнёра', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================
  // CATEGORY ACTIONS
  // ==========================================
  const openCreateCategory = () => {
    setCatName('');
    setCatType('expense');
    setCatDirection('operational');
    setCatColor('#2563eb');
    setModalCategory({ mode: 'create' });
  };

  const openEditCategory = (cat: Category) => {
    setCatName(cat.name);
    setCatType(cat.type === 'income' ? 'income' : 'expense');
    setCatDirection(cat.direction || (cat.isEventSpecific ? 'operational' : 'all'));
    setCatColor(cat.color || '#2563eb');
    setModalCategory({ mode: 'edit', category: cat });
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    setIsSaving(true);
    try {
      if (modalCategory?.mode === 'create') {
        await api.createCategory({
          companyId: currentCompany?.id,
          name: catName.trim(),
          type: catType,
          direction: catDirection,
          color: catColor,
          isEventSpecific: catDirection === 'operational',
        });
        addToast(`Статья «${catName}» создана`, 'success');
      } else if (modalCategory?.mode === 'edit') {
        await api.saveCategory(modalCategory.category.id, {
          companyId: currentCompany?.id,
          name: catName.trim(),
          type: catType,
          direction: catDirection,
          color: catColor,
          isEventSpecific: catDirection === 'operational',
        });
        addToast('Статья обновлена', 'success');
      }
      await refreshCategories();
      setModalCategory(null);
    } catch (err: any) {
      addToast(err.message || 'Ошибка сохранения статьи', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!window.confirm(`Удалить статью «${name}» из справочника?`)) return;
    setIsSaving(true);
    try {
      await api.deleteCategory(id);
      await refreshCategories();
      addToast(`Статья «${name}» удалена`, 'success');
      setModalCategory(null);
    } catch (err: any) {
      addToast(err.message || 'Ошибка удаления статьи', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Helper labels
  const getAccountBadge = (acc: Account) => {
    let Icon: LucideIcon = Wallet;
    if (acc.icon && ACCOUNT_ICON_MAP[acc.icon]) {
      Icon = ACCOUNT_ICON_MAP[acc.icon];
    } else if (acc.type === 'bank' || acc.id === 'bank_1') {
      Icon = Landmark;
    } else if (acc.type === 'cash' || acc.id === 'cash_1') {
      Icon = Banknote;
    } else if (acc.id === 'cash_2') {
      Icon = Coins;
    } else if (acc.type === 'card' || acc.id === 'bank_2' || acc.id === 'card_sbp') {
      Icon = CreditCard;
    } else if ((acc.type as string) === 'safe') {
      Icon = Shield;
    }

    let label = 'Счёт';
    let colorClass = 'badge-card';
    if (acc.type === 'bank') {
      label = 'Безналичный счёт';
      colorClass = 'badge-bank';
    } else if (acc.type === 'cash') {
      label = 'Касса наличных';
      colorClass = 'badge-cash';
    } else if (acc.type === 'card') {
      label = 'Карта / СБП';
      colorClass = 'badge-card';
    } else if (acc.type === 'safe') {
      label = 'Сейф / Резерв';
      colorClass = 'badge-bank';
    } else if (acc.type) {
      label = acc.type;
    }

    return { label, icon: Icon, colorClass };
  };

  const getCategoryDirectionLabel = (cat: Category) => {
    if (cat.direction === 'operational' || cat.isEventSpecific) {
      return 'Для мероприятий';
    }
    if (cat.direction === 'business') {
      return 'Накладные расходы';
    }
    if (cat.direction === 'dividends') {
      return 'Дивиденды';
    }
    return 'Универсальная';
  };

  return (
    <div className="settings-view settings-linear-layout">
      {/* Top Full-Width Unified Page Header Card (Matches Reports, Events, Analytics & Journal) */}
      <div className="reports-header-card" style={{ gridColumn: '1 / -1' }}>
        <div className="reports-header-title">
          <div className="reports-header-icon">
            {activeTab === 'organization' && <Building2 size={20} />}
            {activeTab === 'legal_entities' && <Briefcase size={20} />}
            {activeTab === 'accounts' && <Wallet size={20} />}
            {activeTab === 'categories' && <Tag size={20} />}
            {activeTab === 'partners' && <Users size={20} />}
            {activeTab === 'profile' && <KeyRound size={20} />}
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>
              {activeTab === 'organization' && 'Организация и тариф'}
              {activeTab === 'legal_entities' && 'Юрлица и налоги группы'}
              {activeTab === 'accounts' && 'Управление счетами'}
              {activeTab === 'categories' && 'Классификатор статей'}
              {activeTab === 'partners' && 'Партнёры и соучредители'}
              {activeTab === 'profile' && 'Мой профиль и безопасность'}
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', margin: '2px 0 0 0' }}>
              {activeTab === 'organization' && 'Реквизиты рабочего пространства, управление командой и параметрами доступа'}
              {activeTab === 'legal_entities' && 'ООО, ИП и касса. Счета привязываются к юрлицам для раздельного расчёта НДС и налога на прибыль'}
              {activeTab === 'accounts' && 'Редактируйте назначение касс, тип учёта или добавляйте новые счета'}
              {activeTab === 'categories' && 'Статьи расходов и доходов для распределения операций и аналитики'}
              {activeTab === 'partners' && 'Участники бизнеса для выплаты дивидендов и персональных изъятий'}
              {activeTab === 'profile' && 'Управление личными данными, смена почты и пароля со строгой двухфакторной защитой'}
            </p>
          </div>
        </div>

        <div className="reports-actions-group">
          {activeTab === 'legal_entities' && (
            <button type="button" onClick={openCreateLegalEntity} className="btn-settings-add" style={{ height: '38px', margin: 0 }}>
              <Plus size={15} />
              <span>Добавить юрлицо</span>
            </button>
          )}
          {activeTab === 'accounts' && (
            <>
              <button
                type="button"
                onClick={handleResetBalances}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '38px',
                  padding: '0 14px',
                  fontSize: '0.82rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  color: '#dc2626',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                <RotateCcw size={14} />
                <span>Обнулить остатки</span>
              </button>
              <button type="button" onClick={openCreateAccount} className="btn-settings-add" style={{ height: '38px', margin: 0 }}>
                <Plus size={15} />
                <span>Добавить счёт</span>
              </button>
            </>
          )}
          {activeTab === 'categories' && (
            <button type="button" onClick={openCreateCategory} className="btn-settings-add" style={{ height: '38px', margin: 0 }}>
              <Plus size={15} />
              <span>Добавить статью</span>
            </button>
          )}
          {activeTab === 'partners' && (
            <button type="button" onClick={openCreatePartner} className="btn-settings-add" style={{ height: '38px', margin: 0 }}>
              <Plus size={15} />
              <span>Добавить партнёра</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. Left Sidebar Navigation (Linear / Stripe Standard) */}
      <aside className="settings-sidebar" aria-label="Разделы настроек">
        <div className="settings-nav-group">
          <div className="settings-nav-group-title">Рабочее пространство</div>
          <div className="settings-nav-items">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'organization'}
              onClick={() => handleSelectTab('organization')}
              className={`settings-sidebar-link ${activeTab === 'organization' ? 'active' : ''}`}
            >
              <div className="settings-sidebar-link-left">
                <Building2 size={16} />
                <span>Организация и тариф</span>
              </div>
            </button>
          </div>
        </div>

        <div className="settings-nav-group">
          <div className="settings-nav-group-title">Финансовый учёт</div>
          <div className="settings-nav-items">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'legal_entities'}
              onClick={() => handleSelectTab('legal_entities')}
              className={`settings-sidebar-link ${activeTab === 'legal_entities' ? 'active' : ''}`}
            >
              <div className="settings-sidebar-link-left">
                <Briefcase size={16} />
                <span>Юрлица группы</span>
              </div>
              <span className="settings-sidebar-count">{legalEntities.length}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'accounts'}
              onClick={() => handleSelectTab('accounts')}
              className={`settings-sidebar-link ${activeTab === 'accounts' ? 'active' : ''}`}
            >
              <div className="settings-sidebar-link-left">
                <Wallet size={16} />
                <span>Счета компании</span>
              </div>
              <span className="settings-sidebar-count">{accounts.length}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'categories'}
              onClick={() => handleSelectTab('categories')}
              className={`settings-sidebar-link ${activeTab === 'categories' ? 'active' : ''}`}
            >
              <div className="settings-sidebar-link-left">
                <Tag size={16} />
                <span>Статьи учёта</span>
              </div>
              <span className="settings-sidebar-count">{categories.length}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'partners'}
              onClick={() => handleSelectTab('partners')}
              className={`settings-sidebar-link ${activeTab === 'partners' ? 'active' : ''}`}
            >
              <div className="settings-sidebar-link-left">
                <Users size={16} />
                <span>Партнёры / доли</span>
              </div>
              <span className="settings-sidebar-count">{partners.length}</span>
            </button>
          </div>
        </div>

        <div className="settings-nav-group">
          <div className="settings-nav-group-title">Личный профиль</div>
          <div className="settings-nav-items">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'profile'}
              onClick={() => handleSelectTab('profile')}
              className={`settings-sidebar-link ${activeTab === 'profile' ? 'active' : ''}`}
            >
              <div className="settings-sidebar-link-left">
                <KeyRound size={16} />
                <span>Безопасность и пароль</span>
              </div>
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Main Right Content Panel */}
      <main className="settings-main-panel">

      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* TAB 0: LEGAL ENTITIES                                                     */}
      {/* ========================================================================= */}
      {activeTab === 'legal_entities' && (
        <div className="settings-content-section animate-fade-in">
          <div className="settings-subbar">
            <div>
              <h3 className="settings-subheading">Юрлица и системы налогообложения</h3>
              <p className="settings-subtext">ООО, ИП, спецрежимы (УСН 6%, УСН 15%, ОСНО с НДС) и касса. Счета привязываются к юрлицам для автоматического учёта входящего и исходящего НДС и налога на прибыль</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={openCreateLegalEntity}
                className="btn-settings-add"
              >
                <Plus size={15} />
                <span>Добавить юрлицо</span>
              </button>
            </div>
          </div>

          {/* Educational Callout */}
          <div
            style={{
              padding: '16px 20px',
              borderRadius: '12px',
              background: '#f6f2ea',
              border: '1px solid #c5b08e',
              marginBottom: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#8c734b', fontSize: '0.95rem' }}>
              <Briefcase size={16} />
              <span>Реальный финансовый контур группы компаний</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--foreground)', lineHeight: 1.5 }}>
              Привязывайте расчётные счета к юрлицам. Если операция проходит по счёту ООО на ОСНО, система автоматически начислит 20% НДС с выручки и уменьшит налог на входящий НДС по расходам с УПД/СФ. Для счетов ИП (УСН 6% + 5% НДС) налоги рассчитаются по правилам 2025 года без лишних кликов.
            </p>
          </div>

          {/* Legal Entities Cards Grid */}
          <div className="settings-card-grid">
            {legalEntities.map((le) => {
              const attachedAccounts = accounts.filter((a) => a.legalEntityId === le.id);
              const isLlc = le.type === 'llc';
              const isIp = le.type === 'sole_proprietor';
              const isCash = le.type === 'cash';

              return (
                <div
                  key={le.id}
                  className="settings-item-card"
                  onClick={() => openEditLegalEntity(le)}
                  style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                >
                  <div>
                    <div className="settings-card-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: isLlc ? 'rgba(37, 99, 235, 0.12)' : isIp ? '#f6f2ea' : isCash ? 'rgba(16, 185, 129, 0.12)' : 'var(--muted)',
                            color: isLlc ? '#2563eb' : isIp ? '#8c734b' : isCash ? '#10b981' : 'var(--foreground)',
                            border: isIp ? '1px solid #c5b08e' : isLlc ? '1px solid rgba(37, 99, 235, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                          }}
                        >
                          <Building2 size={11} />
                          <span>{isLlc ? 'ООО' : isIp ? 'ИП' : isCash ? 'Касса и сейф' : 'Самозанятый'}</span>
                        </span>

                        {le.isDefault && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: 'rgba(217, 119, 6, 0.12)',
                              color: '#d97706',
                              border: '1px solid rgba(217, 119, 6, 0.25)',
                            }}
                          >
                            По умолчанию
                          </span>
                        )}
                      </div>

                      <div className="category-card-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => openEditLegalEntity(le)}
                          className="btn-card-action"
                          title="Редактировать юрлицо"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLegalEntity(le.id, le.name)}
                          className="btn-card-action btn-card-delete"
                          title="Удалить юрлицо"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <h4 className="settings-card-title" style={{ marginTop: '8px' }}>{le.name}</h4>
                    {le.inn && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', margin: '2px 0 0 0' }}>
                        ИНН: {le.inn}
                      </p>
                    )}
                    {le.description && (
                      <p className="settings-card-meta" style={{ marginTop: '4px' }}>{le.description}</p>
                    )}

                    {/* Tax System Pill */}
                    <div style={{ marginTop: '10px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '3px 9px',
                          borderRadius: '6px',
                          background: le.taxSystem === 'osno' ? 'rgba(37, 99, 235, 0.08)' : le.taxSystem === 'none' ? 'var(--muted)' : 'rgba(217, 119, 6, 0.08)',
                          color: le.taxSystem === 'osno' ? '#2563eb' : le.taxSystem === 'none' ? 'var(--muted-foreground)' : '#d97706',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <Landmark size={12} />
                        <span>
                          {le.taxSystem === 'osno' && `ОСНО: НДС ${le.vatRate ?? 20}% + Прибыль ${le.taxRate ?? 20}%`}
                          {le.taxSystem === 'usn_income_vat5' && 'УСН 6% + 5% НДС (без вычетов)'}
                          {le.taxSystem === 'usn_income_vat7' && 'УСН 6% + 7% НДС (без вычетов)'}
                          {le.taxSystem === 'usn_income' && `УСН «Доходы» (${le.taxRate ?? 6}%)`}
                          {le.taxSystem === 'usn_income_expense' && `УСН «Доходы - Расходы» (${le.taxRate ?? 15}%)`}
                          {le.taxSystem === 'npd' && `Самозанятость (${le.taxRate ?? 6}%)`}
                          {le.taxSystem === 'none' && 'Без налога (Управленческий контур)'}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Attached Accounts Box */}
                  <div
                    style={{
                      marginTop: '14px',
                      paddingTop: '10px',
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginBottom: '5px', fontWeight: 600 }}>
                      Привязанные счета ({attachedAccounts.length}):
                    </div>
                    {attachedAccounts.length > 0 ? (
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                        {attachedAccounts.map((acc) => (
                          <span
                            key={acc.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.72rem',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              background: 'var(--muted)',
                              color: 'var(--foreground)',
                              border: '1px solid var(--border)',
                            }}
                          >
                            <Wallet size={10} />
                            <span>{acc.name}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', fontStyle: 'italic' }}>
                        Нет привязанных счетов
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 1: ACCOUNTS                                                           */}
      {/* ========================================================================= */}
      {activeTab === 'accounts' && (
        <div className="settings-content-section animate-fade-in">
          <div className="settings-subbar">
            <div>
              <h3 className="settings-subheading">Управление счетами</h3>
              <p className="settings-subtext">Редактируйте назначение касс, тип учёта или добавляйте новые счета</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleResetBalances}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  fontSize: '0.82rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  color: '#dc2626',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
                title="Сбросить остатки всех счетов до 0 ₽ для начала учёта с нуля"
              >
                <RotateCcw size={14} />
                <span>Обнулить остатки (до 0 ₽)</span>
              </button>
              <button
                type="button"
                onClick={openCreateAccount}
                className="btn-settings-add"
              >
                <Plus size={15} />
                <span>Добавить счёт</span>
              </button>
            </div>
          </div>

          {/* Accounts Grid */}
          <div className="settings-card-grid">
            {accounts.map((acc) => {
              const badgeInfo = getAccountBadge(acc);
              const BadgeIcon = badgeInfo.icon;

              return (
                <div
                  key={acc.id}
                  className="settings-item-card"
                  onClick={() => openEditAccount(acc)}
                  style={{ cursor: 'pointer' }}
                >
                  <div>
                    <div className="settings-card-header">
                      <span
                        className={`settings-account-type-badge ${!acc.color ? badgeInfo.colorClass : ''}`}
                        style={acc.color ? {
                          backgroundColor: `${acc.color}18`,
                          color: acc.color,
                          border: `1px solid ${acc.color}40`,
                        } : undefined}
                      >
                        <BadgeIcon size={12} aria-hidden="true" />
                        <span>{badgeInfo.label}</span>
                      </span>

                      <div className="category-card-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => openEditAccount(acc)}
                          className="btn-card-action"
                          title="Редактировать счёт"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAccount(acc.id, acc.name)}
                          className="btn-card-action btn-card-delete"
                          title="Удалить счёт"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <h4 className="settings-card-title">{acc.name}</h4>
                    {acc.legalEntityName && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: '#f6f2ea',
                            color: '#8c734b',
                            border: '1px solid #c5b08e',
                          }}
                        >
                          <Briefcase size={11} />
                          <span>{acc.legalEntityName}</span>
                        </span>
                      </div>
                    )}
                    {acc.description && <p className="settings-card-meta">{acc.description}</p>}
                  </div>

                  <div className="settings-balance-panel">
                    <span className="settings-balance-label">Текущий остаток</span>
                    <span className="settings-card-balance">{formatRubles(acc.currentBalance)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PARTNERS                                                           */}
      {/* ========================================================================= */}
      {activeTab === 'partners' && (
        <div className="settings-content-section animate-fade-in">
          <div className="settings-subbar">
            <div>
              <h3 className="settings-subheading">Партнёры и соучредители</h3>
              <p className="settings-subtext">Участники бизнеса для выплаты дивидендов и персональных изъятий</p>
            </div>
            <button
              type="button"
              onClick={openCreatePartner}
              className="btn-settings-add"
            >
              <Plus size={15} />
              <span>Добавить партнёра</span>
            </button>
          </div>

          {/* Partners Grid */}
          <div className="settings-card-grid">
            {partners.map((p) => {
              return (
                <div
                  key={p.id}
                  className="settings-item-card"
                  onClick={() => openEditPartner(p)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="settings-partner-row">
                    <div className="settings-partner-info">
                      <div className="settings-partner-avatar" aria-hidden="true">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="settings-card-title">{p.name}</h4>
                        {p.role ? (
                          <span className="settings-partner-role">{p.role}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="category-card-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => openEditPartner(p)}
                        className="btn-card-action"
                        title="Редактировать партнёра"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePartner(p.id, p.name)}
                        className="btn-card-action btn-card-delete"
                        title="Удалить партнёра"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CATEGORIES (Clean, Minimalist Cards - No Wrapping Glitches)        */}
      {/* ========================================================================= */}
      {activeTab === 'categories' && (
        <div className="settings-content-section animate-fade-in">
          <div className="settings-subbar">
            <div>
              <h3 className="settings-subheading">Классификатор статей</h3>
              <p className="settings-subtext">Статьи расходов и доходов для распределения операций и аналитики</p>
            </div>
            <button
              type="button"
              onClick={openCreateCategory}
              className="btn-settings-add"
            >
              <Plus size={15} />
              <span>Добавить статью</span>
            </button>
          </div>

          {/* Categories Grid (Clean compact cards) */}
          <div className="settings-categories-grid">
            {categories.map((cat) => {
              const isExpense = cat.type === 'expense';
              const directionLabel = getCategoryDirectionLabel(cat);

              return (
                <div
                  key={cat.id}
                  className="settings-category-card"
                  onClick={() => openEditCategory(cat)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="category-card-top-row">
                    <div className="category-card-name-wrap">
                      <span
                        className="category-color-dot-sm"
                        style={{ backgroundColor: cat.color || '#2563eb' }}
                      />
                      <span className="category-title-text" title={cat.name}>
                        {cat.name}
                      </span>
                    </div>

                    <div className="category-card-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => openEditCategory(cat)}
                        className="btn-card-action"
                        title="Редактировать статью"
                        aria-label="Редактировать статью"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                        className="btn-card-action btn-card-delete"
                        title="Удалить статью"
                        aria-label="Удалить статью"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="category-card-badges-row">
                    <span className={isExpense ? 'badge-pill-expense' : 'badge-pill-income'}>
                      {isExpense ? 'Расход' : 'Доход'}
                    </span>
                    <span className="badge-pill-scope">
                      {directionLabel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: ORGANIZATION & TEAM (EXECUTIVE STANDARD)                          */}
      {/* ========================================================================= */}
      {activeTab === 'organization' && (
        <div className="settings-content-section animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Executive Brand & Tariff Hero Card */}
          <section className="settings-hero-card">
            <div className="settings-hero-main">
              <div className="settings-brand-cluster">
                <div className="settings-brand-monogram">
                  {companyInitials}
                </div>
                <div className="settings-brand-details">
                  <h2>
                    <span>{currentCompany?.name || 'BRILLIANT EVENT'}</span>
                    <span className="settings-tariff-pill">
                      <span className="settings-tariff-pill-dot" style={{ backgroundColor: tariffInfo.color }} />
                      <span style={{ color: tariffInfo.color }}>{tariffInfo.text}</span>
                    </span>
                  </h2>
                  <p>
                    Управление финансами, кассами и рентабельностью проектов • Код: {currentCompany?.slug || 'brilliant-event'}
                  </p>
                </div>
              </div>

              {(userRole === 'owner' || userRole === 'admin' || currentCompany?.ownerId === currentUser?.id || currentUser?.isSuperAdmin) && (
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('company-name-input');
                    if (el) {
                      el.focus();
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                  }}
                  className="btn-rename-subtle"
                >
                  <Edit2 size={13} />
                  <span>Переименовать</span>
                </button>
              )}
            </div>

            {/* 4-Item Executive Meta Grid */}
            <div className="settings-hero-meta-grid">
              <div className="settings-meta-cell">
                <span className="settings-meta-title">Тарифный статус</span>
                <span className="settings-meta-val" style={{ color: tariffInfo.color }}>
                  {tariffInfo.text}
                </span>
                <span className="settings-meta-sub">{tariffInfo.detail || 'Активная подписка'}</span>
              </div>

              <div className="settings-meta-cell">
                <span className="settings-meta-title">Владелец профиля</span>
                <span className="settings-meta-val">
                  {currentUser?.fullName || 'Владелец'}
                </span>
                <span className="settings-meta-sub">{currentUser?.email || '—'}</span>
              </div>

              {(() => {
                const isOwnerRole =
                  userRole === 'owner' ||
                  currentCompany?.ownerId === currentUser?.id ||
                  Boolean(currentUser?.isSuperAdmin);
                return (
                  <div className="settings-meta-cell">
                    <span className="settings-meta-title">Ваша роль</span>
                    <span className="settings-meta-val">
                      {isOwnerRole
                        ? 'Владелец компании'
                        : userRole === 'admin'
                        ? 'Администратор'
                        : userRole === 'accountant'
                        ? 'Бухгалтер'
                        : 'Сотрудник'}
                    </span>
                    <span className="settings-meta-sub">
                      {isOwnerRole || userRole === 'admin' ? 'Полные права доступа' : 'Ограниченный доступ'}
                    </span>
                  </div>
                );
              })()}

              {(() => {
                const count = Math.max(1, companyMembers.length);
                const mod100 = count % 100;
                const mod10 = count % 10;
                const label =
                  mod100 >= 11 && mod100 <= 14
                    ? 'участников'
                    : mod10 === 1
                    ? 'участник'
                    : mod10 >= 2 && mod10 <= 4
                    ? 'участника'
                    : 'участников';
                return (
                  <div className="settings-meta-cell">
                    <span className="settings-meta-title">Команда</span>
                    <span className="settings-meta-val">
                      {count} {label}
                    </span>
                    <span className="settings-meta-sub">
                      {invitesList.length > 0 ? `${invitesList.length} активных инвайтов` : 'Доступ открыт'}
                    </span>
                  </div>
                );
              })()}
            </div>
          </section>

          {/* Structured Workspace Settings (Parameters) */}
          <section className="settings-section-card">
            <div className="settings-section-header">
              <div>
                <h3 className="settings-section-title">Параметры организации</h3>
                <p className="settings-section-subtitle">
                  Отображение наименования организации в шапке CRM, чеках и управленческой отчётности
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveOrganization} className="settings-row-item">
              <div className="settings-row-info">
                <div className="settings-row-label">Название организации</div>
                <div className="settings-row-desc">
                  Официальное публичное наименование в выгрузках P&L, чеках и актах
                </div>
              </div>
              <div className="settings-input-edit-wrap">
                <input
                  id="company-name-input"
                  type="text"
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="settings-text-input"
                  placeholder="например: Brilliant Event"
                  disabled={userRole !== 'owner' && userRole !== 'admin' && !currentUser?.isSuperAdmin}
                />
                {(userRole === 'owner' || userRole === 'admin' || currentUser?.isSuperAdmin) && (
                  <button
                    type="submit"
                    disabled={isSavingOrg || !orgName.trim() || orgName.trim() === currentCompany?.name}
                    className="btn-settings-save"
                    style={{ padding: '8px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
                  >
                    {isSavingOrg ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Сохранение...</span>
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        <span>Сохранить</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>

            <div className="settings-row-item">
              <div className="settings-row-info">
                <div className="settings-row-label">Основная валюта и формат дат</div>
                <div className="settings-row-desc">
                  Российский рубль (₽) • Часовой пояс Москва (UTC+3)
                </div>
              </div>
              <div>
                <span style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--foreground)',
                  background: 'var(--muted)',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                }}>
                  ₽ RUB (ДД.ММ.ГГГГ)
                </span>
              </div>
            </div>
          </section>

          {/* Taxation System & Tax Reserve */}
          <section className="settings-section-card">
            <div className="settings-section-header">
              <div>
                <h3 className="settings-section-title">Система налогообложения и резерв</h3>
                <p className="settings-section-subtitle">
                  Автоматический расчёт резерва на налоги за текущий квартал, чтобы защитить компанию от кассового разрыва
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveTaxSettings} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="settings-row-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
                <div className="settings-row-info">
                  <div className="settings-row-label">Налоговый режим</div>
                  <div className="settings-row-desc">
                    Выберите систему налогообложения вашей компании для автоматической оценки налога
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', width: '100%' }}>
                  <button
                    type="button"
                    onClick={() => { setTaxSystem('usn_income'); setTaxRate(6); }}
                    className="ui-tab-pill"
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      textAlign: 'left',
                      background: taxSystem === 'usn_income' ? '#f6f2ea' : 'var(--card)',
                      borderColor: taxSystem === 'usn_income' ? '#c5b08e' : 'var(--border)',
                      color: taxSystem === 'usn_income' ? 'var(--foreground)' : 'var(--muted-foreground)',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>УСН «Доходы» (6%)</span>
                    <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>Для агентств и услуг</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setTaxSystem('usn_income_expense'); setTaxRate(15); }}
                    className="ui-tab-pill"
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      textAlign: 'left',
                      background: taxSystem === 'usn_income_expense' ? '#f6f2ea' : 'var(--card)',
                      borderColor: taxSystem === 'usn_income_expense' ? '#c5b08e' : 'var(--border)',
                      color: taxSystem === 'usn_income_expense' ? 'var(--foreground)' : 'var(--muted-foreground)',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>УСН «Доходы-Расходы» (15%)</span>
                    <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>С чистой прибыли</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setTaxSystem('npd'); setTaxRate(6); }}
                    className="ui-tab-pill"
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      textAlign: 'left',
                      background: taxSystem === 'npd' ? '#f6f2ea' : 'var(--card)',
                      borderColor: taxSystem === 'npd' ? '#c5b08e' : 'var(--border)',
                      color: taxSystem === 'npd' ? 'var(--foreground)' : 'var(--muted-foreground)',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Самозанятость / НПД (6%)</span>
                    <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>Соло-организаторы</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setTaxSystem('custom'); }}
                    className="ui-tab-pill"
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      textAlign: 'left',
                      background: taxSystem === 'custom' ? '#f6f2ea' : 'var(--card)',
                      borderColor: taxSystem === 'custom' ? '#c5b08e' : 'var(--border)',
                      color: taxSystem === 'custom' ? 'var(--foreground)' : 'var(--muted-foreground)',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Своя ставка (%)</span>
                    <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>Региональные льготы</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setTaxSystem('none'); }}
                    className="ui-tab-pill"
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      textAlign: 'left',
                      background: taxSystem === 'none' ? '#f6f2ea' : 'var(--card)',
                      borderColor: taxSystem === 'none' ? '#c5b08e' : 'var(--border)',
                      color: taxSystem === 'none' ? 'var(--foreground)' : 'var(--muted-foreground)',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Не рассчитывать налоги</span>
                    <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>Чистая управленка</span>
                  </button>
                </div>
              </div>

              {taxSystem !== 'none' && (
                <>
                  <div className="settings-row-item">
                    <div className="settings-row-info">
                      <div className="settings-row-label">Применяемая ставка налога (%)</div>
                      <div className="settings-row-desc">
                        Процент отчислений, используемый для расчёта квартального резерва
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={taxRate}
                        onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
                        className="settings-text-input"
                        style={{ width: '90px', textAlign: 'center', fontWeight: 700 }}
                      />
                      <span style={{ fontWeight: 600, color: 'var(--muted-foreground)' }}>%</span>
                    </div>
                  </div>

                  <div className="settings-row-item">
                    <div className="settings-row-info">
                      <div className="settings-row-label">Только безналичные счета (Р/С и эквайринг)</div>
                      <div className="settings-row-desc">
                        Если включено, расчёт налога ведётся только с официальных безналичных поступлений в банк (нал на площадке не учитывается)
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={applyOnlyToBank}
                          onChange={(e) => setApplyOnlyToBank(e.target.checked)}
                          style={{ width: '18px', height: '18px', accentColor: '#8c734b', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '13px', fontWeight: 500 }}>Только банк</span>
                      </label>
                    </div>
                  </div>

                  {/* Live calculation banner */}
                  <div style={{
                    background: '#fcfaf6',
                    border: '1px solid #e7ded0',
                    borderRadius: '8px',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    flexWrap: 'wrap',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f5efe4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c734b' }}>
                        <Landmark size={18} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)' }}>
                          Оценка резерва за {liveTaxPreview.quarterLabel}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                          Налоговая база: {formatRubles(liveTaxPreview.taxableBase)} ({liveTaxPreview.systemLabel})
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'block' }}>К резервированию на налог:</span>
                      <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#d97706' }}>
                        {formatRubles(liveTaxPreview.taxAmount)}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {(userRole === 'owner' || userRole === 'admin' || currentUser?.isSuperAdmin) && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' }}>
                  <button
                    type="submit"
                    disabled={isSavingTax}
                    className="btn-settings-save"
                    style={{ padding: '8px 20px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    {isSavingTax ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Сохранение...</span>
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        <span>Сохранить настройки налогообложения</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </form>
          </section>

          {/* Team & Members */}
          <section className="settings-section-card">
            <div className="settings-section-header">
              <div>
                <h3 className="settings-section-title">Команда и права доступа ({companyMembers.length || 1})</h3>
                <p className="settings-section-subtitle">
                  Сотрудники с доступом к этой организации и их ролевые ограничения
                </p>
              </div>

              {(userRole === 'owner' || userRole === 'admin' || currentUser?.isSuperAdmin) && (
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(true)}
                  className="btn-settings-add"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  <UserPlus size={15} />
                  <span>+ Пригласить сотрудника</span>
                </button>
              )}
            </div>

            {/* Members List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              {companyMembers.length === 0 ? (
                // Fallback for single current user
                <div className="settings-team-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="settings-avatar-circle">
                      {currentUser?.fullName?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <div className="settings-user-name">
                        {currentUser?.fullName || 'Владелец'} (Вы)
                      </div>
                      <div className="settings-user-email">
                        {currentUser?.email || '—'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      className="settings-role-badge"
                      style={{
                        backgroundColor: 'rgba(217, 119, 6, 0.12)',
                        color: '#d97706',
                        border: '1px solid rgba(217, 119, 6, 0.3)',
                      }}
                    >
                      Владелец
                    </span>
                    <div className="settings-status-indicator">
                      <span />
                      В сети
                    </div>
                  </div>
                </div>
              ) : (
                companyMembers.map((m) => {
                  const memberUser = m.user;
                  const isSelf = memberUser?.id === currentUser?.id;
                  const roleInfo =
                    m.membership.role === 'owner'
                      ? { label: 'Владелец', color: '#d97706', bg: 'rgba(217, 119, 6, 0.12)', border: 'rgba(217, 119, 6, 0.3)', desc: 'Полный доступ ко всем финансовым операциям' }
                      : m.membership.role === 'admin'
                      ? { label: 'Администратор', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.1)', border: 'rgba(37, 99, 235, 0.25)', desc: 'Управление операциями и отчётами' }
                      : m.membership.role === 'accountant'
                      ? { label: 'Бухгалтер', color: '#059669', bg: 'rgba(5, 150, 105, 0.1)', border: 'rgba(5, 150, 105, 0.25)', desc: 'Проведение платежей и аналитика' }
                      : { label: 'Сотрудник', color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)', border: 'rgba(100, 116, 139, 0.25)', desc: 'Просмотр разрешённых мероприятий' };

                  return (
                    <div key={m.membership.id} className="settings-team-item">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px' }}>
                        <div
                          className="settings-avatar-circle"
                          style={{
                            backgroundColor: roleInfo.bg,
                            color: roleInfo.color,
                          }}
                        >
                          {memberUser?.fullName?.[0]?.toUpperCase() || memberUser?.email?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div className="settings-user-name">
                            {memberUser?.fullName || 'Сотрудник'} {isSelf && '(Вы)'}
                          </div>
                          <div className="settings-user-email">
                            {memberUser?.email || '—'}
                          </div>
                        </div>
                      </div>

                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
                          {roleInfo.desc}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span
                          className="settings-role-badge"
                          style={{
                            backgroundColor: roleInfo.bg,
                            color: roleInfo.color,
                            border: `1px solid ${roleInfo.border}`,
                          }}
                        >
                          {roleInfo.label}
                        </span>

                        <div className="settings-status-indicator">
                          <span />
                          {isSelf ? 'В сети' : 'Активен'}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Active Invite Links Block */}
            {invitesList.length > 0 && (
              <div style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Link2 size={15} style={{ color: '#d97706' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>
                      Активные ссылки-приглашения ({invitesList.length})
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
                    Отправьте сотруднику для подключения к этой CRM
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {invitesList.map((inv) => {
                    const fullUrl = `${getInviteBaseUrl()}/?invite=${inv.token}`;
                    const isCopied = copiedInviteId === inv.id;
                    const roleBadge =
                      inv.role === 'owner' ? { label: 'Владелец', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' } :
                      inv.role === 'accountant' ? { label: 'Бухгалтер', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' } :
                      { label: 'Гость / Сотрудник', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' };

                    return (
                      <div
                        key={inv.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--muted)',
                          border: '1px solid var(--border)',
                          gap: '12px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: roleBadge.bg,
                            color: roleBadge.color,
                          }}>
                            {roleBadge.label}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--foreground)', fontFamily: 'monospace' }}>
                            .../?invite={inv.token.substring(0, 10)}...
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
                            Использовано: {inv.usedCount}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(fullUrl, inv.id)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                              backgroundColor: isCopied ? 'rgba(16, 185, 129, 0.15)' : 'var(--card)',
                              color: isCopied ? '#10b981' : 'var(--foreground)',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            {isCopied ? <Check size={12} /> : <Copy size={12} />}
                            <span>{isCopied ? 'Скопировано!' : 'Копировать'}</span>
                          </button>

                          <a
                            href={`https://t.me/share/url?url=${encodeURIComponent(fullUrl)}&text=${encodeURIComponent(`Приглашаю в команду компании «${currentCompany?.name || 'FINDOCTOR'}»: `)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Отправить в Telegram"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(0, 136, 204, 0.15)',
                              color: '#0088cc',
                              border: '1px solid rgba(0, 136, 204, 0.3)',
                              textDecoration: 'none',
                            }}
                          >
                            <Send size={13} />
                          </a>

                          <button
                            type="button"
                            onClick={() => handleRevokeInvite(inv.id)}
                            title="Отозвать ссылку"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(239, 68, 68, 0.08)',
                              color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Danger Zone */}
          <section className="settings-danger-box">
            <div>
              <div className="settings-danger-title">
                <AlertTriangle size={15} style={{ color: '#dc2626', display: 'inline-block', marginRight: '6px', verticalAlign: '-2px' }} />
                <span>Опасная зона: Удаление организации</span>
              </div>
              <div className="settings-danger-desc">
                Безвозвратное удаление компании «<strong>{currentCompany?.name}</strong>». Будут навсегда удалены все привязанные счета, финансовые операции, мероприятия, статьи расходов и права участников. Это действие невозможно отменить.
              </div>
            </div>

            {currentCompany?.id === 'company_platform_admin' ? (
              <div style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
                🛡️ Системное рабочее пространство защищено от удаления.
              </div>
            ) : (userRole === 'owner' || userRole === 'admin' || currentUser?.isSuperAdmin) ? (
              <button
                type="button"
                onClick={() => {
                  setDeleteCompanyNameConfirm('');
                  setIsDeleteCompanyModalOpen(true);
                }}
                className="btn-danger-action"
              >
                <Trash2 size={15} />
                <span>Удалить эту организацию...</span>
              </button>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
                Удаление организации доступно только её владельцу.
              </div>
            )}
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: PROFILE & SECURITY (MODERN EXECUTIVE SUITE)                        */}
      {/* ========================================================================= */}
      {activeTab === 'profile' && (
        <div className="settings-content-section animate-fade-in">
          <div className="settings-subbar">
            <div>
              <h3 className="settings-subheading">Мой профиль и безопасность</h3>
              <p className="settings-subtext">
                Управление личными данными, смена почты и пароля со строгой двухфакторной защитой
              </p>
            </div>
          </div>

          <div className="profile-workspace-grid">
            {/* Card 1: Personal Profile Data (Full-Width Horizontal Card — No Tetris) */}
            <div className="profile-panel-card" style={{ gridColumn: '1 / -1' }}>
              <div className="profile-panel-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div className="profile-avatar-circle">
                    {profileFullName.trim() ? profileFullName.trim()[0].toUpperCase() : (currentUser?.email ? currentUser.email[0].toUpperCase() : 'U')}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--foreground)' }}>
                      {profileFullName || 'Личный профиль'}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
                        {currentUser?.email}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        background: userRole === 'owner' ? 'rgba(184, 155, 114, 0.18)' : 'rgba(37, 99, 235, 0.1)',
                        color: userRole === 'owner' ? '#8c734b' : '#2563eb',
                      }}>
                        {userRole === 'owner' ? 'Владелец' : userRole === 'admin' ? 'Администратор' : 'Сотрудник'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSaveProfileName} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                  <div className="settings-input-group">
                    <label className="settings-input-label">Имя и фамилия</label>
                    <input
                      type="text"
                      required
                      value={profileFullName}
                      onChange={(e) => setProfileFullName(e.target.value)}
                      className="settings-text-input"
                      placeholder="Например, Владислав Швецов"
                    />
                  </div>

                  <div className="settings-input-group">
                    <label className="settings-input-label">Должность в компании</label>
                    <input
                      type="text"
                      value={profileRoleTitle}
                      onChange={(e) => setProfileRoleTitle(e.target.value)}
                      className="settings-text-input"
                      placeholder="Например, Главный финдиректор / Шеф-бармен"
                    />
                  </div>
                </div>

                {profileFeedback && (
                  <div style={{ fontSize: '12px', color: '#059669', fontWeight: 500 }}>
                    {profileFeedback}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSavingName}
                  className="btn-settings-add"
                  style={{ width: 'fit-content', padding: '8px 18px', fontSize: '13px' }}
                >
                  {isSavingName ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  <span>Сохранить изменения</span>
                </button>
              </form>
            </div>

            {/* Card 2: Active Sessions */}
            <div className="profile-panel-card">
              <div className="profile-panel-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="profile-icon-badge" style={{ background: 'var(--accent)', border: '1px solid var(--color-champagne)', color: 'var(--foreground)' }}>
                    <Smartphone size={18} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--foreground)' }}>
                      Активные сессии
                    </h4>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted-foreground)' }}>
                      Устройства, с которых выполнен вход в систему
                    </p>
                  </div>
                </div>
              </div>

              <div className="profile-security-box">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>
                      Текущий браузер (Windows / Web)
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--muted-foreground)', marginTop: '2px' }}>
                      IP: {typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1'} • Активен прямо сейчас
                    </div>
                  </div>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#059669',
                    background: 'rgba(5, 150, 105, 0.1)',
                    padding: '3px 8px',
                    borderRadius: '9999px',
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669' }} />
                    Онлайн
                  </span>
                </div>
              </div>

              <div style={{ marginTop: 'auto' }}>
                <button
                  type="button"
                  onClick={() => {
                    setSessionTerminated(true);
                    addToast('Все другие активные сессии успешно завершены', 'success');
                    setTimeout(() => setSessionTerminated(false), 3000);
                  }}
                  disabled={sessionTerminated}
                  className="btn-form-cancel"
                  style={{ fontSize: '12px', padding: '6px 14px' }}
                >
                  {sessionTerminated ? 'Сессии завершены' : 'Завершить другие сессии'}
                </button>
              </div>
            </div>

            {/* Card 3: Email 2-Step Verification */}
            <div className="profile-panel-card">
                <div className="profile-panel-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="profile-icon-badge" style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>
                      <Mail size={18} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--foreground)' }}>
                        Email для входа в систему
                      </h4>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted-foreground)' }}>
                        Основной логин учётной записи и адрес уведомлений
                      </p>
                    </div>
                  </div>
                </div>

                {/* Email Box */}
                <div className="profile-security-box">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginBottom: '2px' }}>
                        Текущий рабочий Email:
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--foreground)' }}>
                        {currentUser?.email}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#059669',
                          background: 'rgba(5, 150, 105, 0.1)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                        }}>
                          <Check size={12} />
                          Защищён 2FA
                        </span>
                      </div>
                    </div>

                    {!isEmailFlowOpen && (
                      <button
                        type="button"
                        onClick={() => {
                          resetSecurityFlows();
                          setIsEmailFlowOpen(true);
                        }}
                        className="btn-form-cancel"
                        style={{ fontSize: '12px', padding: '6px 14px', fontWeight: 600 }}
                      >
                        <Edit2 size={13} style={{ marginRight: '4px' }} />
                        Изменить Email
                      </button>
                    )}
                  </div>

                  {/* Flow Step 1: Current Password & Old Email Verification */}
                  {isEmailFlowOpen && emailStep === 'step1_old' && (
                    <div className="profile-flow-expand">
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#b45309',
                        background: '#fef3c7',
                        border: '1px solid #fde68a',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        width: 'fit-content',
                      }}>
                        Шаг 1 из 2: Защита от перехвата аккаунта
                      </div>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
                        Для безопасности введите текущий пароль. Мы отправим 6-значный код на ваш текущий адрес <strong>{currentUser?.email}</strong>.
                      </p>

                      <div className="settings-input-group">
                        <label className="settings-input-label">Текущий пароль учётной записи</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="password"
                            value={currentPassForEmail}
                            onChange={(e) => setCurrentPassForEmail(e.target.value)}
                            placeholder="Введите ваш текущий пароль"
                            className="settings-text-input"
                            autoComplete="current-password"
                          />
                          <button
                            type="button"
                            onClick={handleSendOldEmailCode}
                            disabled={isSendingOldCode || !currentPassForEmail}
                            className="btn-settings-add"
                            style={{ flexShrink: 0, padding: '0 12px', fontSize: '12px' }}
                          >
                            {isSendingOldCode ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                            <span>{isSendingOldCode ? 'Отправка...' : 'Выслать код'}</span>
                          </button>
                        </div>
                      </div>

                      {emailFeedback && (
                        <div style={{ fontSize: '12px', color: emailFeedback.startsWith('Ошибка') ? '#dc2626' : '#059669', fontWeight: 500 }}>
                          {emailFeedback}
                        </div>
                      )}

                      <div id="settings-old-code-container" style={{ marginTop: '4px' }}>
                        <span style={{ fontSize: '11.5px', color: 'var(--muted-foreground)', display: 'block', marginBottom: '6px' }}>
                          Введите 6-значный проверочный код из письма:
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {oldEmailCode.map((val, idx) => (
                            <input
                              key={idx}
                              type="text"
                              maxLength={1}
                              value={val}
                              onChange={(e) => handleCodeBoxInput(idx, e.target.value, oldEmailCode, setOldEmailCode, 'settings-old-code-container')}
                              className="profile-code-input"
                            />
                          ))}
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                          <button
                            type="button"
                            onClick={handleVerifyOldCodeAndProceed}
                            disabled={oldEmailCode.join('').length !== 6}
                            className="btn-settings-add"
                            style={{ padding: '7px 14px', fontSize: '12px' }}
                          >
                            Подтвердить и ввести новый Email →
                          </button>
                          <button
                            type="button"
                            onClick={resetSecurityFlows}
                            className="btn-form-cancel"
                            style={{ padding: '7px 12px', fontSize: '12px' }}
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Flow Step 2: New Email Code Verification */}
                  {isEmailFlowOpen && emailStep === 'step2_new' && (
                    <div className="profile-flow-expand">
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#1d4ed8',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        width: 'fit-content',
                      }}>
                        Шаг 2 из 2: Привязка нового адреса
                      </div>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
                        Старый адрес подтверждён! Теперь укажите новый рабочий Email и подтвердите его кодом.
                      </p>

                      <div className="settings-input-group">
                        <label className="settings-input-label">Новый адрес электронной почты</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="email"
                            value={newEmailInput}
                            onChange={(e) => setNewEmailInput(e.target.value)}
                            placeholder="name@company.ru"
                            className="settings-text-input"
                          />
                          <button
                            type="button"
                            onClick={handleSendNewEmailCode}
                            disabled={isSendingNewCode || !newEmailInput.includes('@')}
                            className="btn-settings-add"
                            style={{ flexShrink: 0, padding: '0 12px', fontSize: '12px' }}
                          >
                            {isSendingNewCode ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                            <span>{isSendingNewCode ? 'Отправка...' : 'Выслать код'}</span>
                          </button>
                        </div>
                      </div>

                      {emailFeedback && (
                        <div style={{ fontSize: '12px', color: emailFeedback.startsWith('Ошибка') ? '#dc2626' : '#059669', fontWeight: 500 }}>
                          {emailFeedback}
                        </div>
                      )}

                      <div id="settings-new-code-container" style={{ marginTop: '4px' }}>
                        <span style={{ fontSize: '11.5px', color: 'var(--muted-foreground)', display: 'block', marginBottom: '6px' }}>
                          Введите код подтверждения с нового адреса:
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {newEmailCode.map((val, idx) => (
                            <input
                              key={idx}
                              type="text"
                              maxLength={1}
                              value={val}
                              onChange={(e) => handleCodeBoxInput(idx, e.target.value, newEmailCode, setNewEmailCode, 'settings-new-code-container')}
                              className="profile-code-input"
                            />
                          ))}
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                          <button
                            type="button"
                            onClick={handleConfirmNewEmail}
                            disabled={isFinalizingEmail || newEmailCode.join('').length !== 6}
                            className="btn-settings-add"
                            style={{ padding: '7px 14px', fontSize: '12px' }}
                          >
                            {isFinalizingEmail ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            <span>{isFinalizingEmail ? 'Сохранение...' : 'Завершить смену Email'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={resetSecurityFlows}
                            className="btn-form-cancel"
                            style={{ padding: '7px 12px', fontSize: '12px' }}
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 4: Password Security & Step-up Code Verification */}
              <div className="profile-panel-card">
                <div className="profile-panel-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="profile-icon-badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                      <Lock size={18} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--foreground)' }}>
                        Безопасность и пароль
                      </h4>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted-foreground)' }}>
                        Защита входа в кассы и финансовую отчётность
                      </p>
                    </div>
                  </div>
                </div>

                <div className="profile-security-box">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginBottom: '2px' }}>
                        Статус доступа:
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--foreground)' }}>
                        Пароль учётной записи активен
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#059669',
                          background: 'rgba(5, 150, 105, 0.1)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                        }}>
                          <Shield size={12} />
                          Требует подтверждения по Email
                        </span>
                      </div>
                    </div>

                    {!isPassFlowOpen && (
                      <button
                        type="button"
                        onClick={() => {
                          resetSecurityFlows();
                          setIsPassFlowOpen(true);
                        }}
                        className="btn-form-cancel"
                        style={{ fontSize: '12px', padding: '6px 14px', fontWeight: 600 }}
                      >
                        <Lock size={13} style={{ marginRight: '4px' }} />
                        Сменить пароль
                      </button>
                    )}
                  </div>

                  {/* Expandable Password Flow */}
                  {isPassFlowOpen && (
                    <div className="profile-flow-expand">
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#047857',
                        background: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        width: 'fit-content',
                      }}>
                        Подтверждение смены пароля
                      </div>

                      <div className="settings-input-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label className="settings-input-label">Текущий пароль</label>
                          <button
                            type="button"
                            onClick={handleForgotPasswordClick}
                            disabled={isForgotSending}
                            style={{
                              fontSize: '11.5px',
                              color: 'var(--primary)',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              padding: 0,
                            }}
                          >
                            {isForgotSending ? 'Отправка...' : 'Забыли пароль?'}
                          </button>
                        </div>
                        <input
                          type="password"
                          value={currentPass}
                          onChange={(e) => setCurrentPass(e.target.value)}
                          placeholder="Введите ваш текущий пароль"
                          className="settings-text-input"
                          autoComplete="current-password"
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                        <div className="settings-input-group">
                          <label className="settings-input-label">Новый пароль</label>
                          <input
                            type="password"
                            value={newPass}
                            onChange={(e) => setNewPass(e.target.value)}
                            placeholder="Минимум 6 символов"
                            className="settings-text-input"
                            autoComplete="new-password"
                          />
                        </div>
                        <div className="settings-input-group">
                          <label className="settings-input-label">Повторите пароль</label>
                          <input
                            type="password"
                            value={repeatPass}
                            onChange={(e) => setRepeatPass(e.target.value)}
                            placeholder="Повторите новый пароль"
                            className="settings-text-input"
                            autoComplete="new-password"
                          />
                        </div>
                      </div>

                      {/* Code verification sub-box */}
                      <div style={{ padding: '12px', background: 'var(--muted)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--foreground)', marginBottom: '3px' }}>
                          🛡️ Подтверждение безопасности через Email
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginBottom: '8px' }}>
                          На ваш адрес <strong>{currentUser?.email}</strong> будет выслан 6-значный одноразовый код.
                        </div>
                        <button
                          type="button"
                          onClick={handleSendPassCode}
                          disabled={isSendingPassCode || !currentPass}
                          className="btn-settings-add"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          {isSendingPassCode ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
                          <span>{isSendingPassCode ? 'Отправка...' : 'Выслать код на почту'}</span>
                        </button>

                        {passFeedback && (
                          <div style={{ fontSize: '12px', marginTop: '8px', color: passFeedback.startsWith('Ошибка') ? '#dc2626' : '#059669', fontWeight: 500 }}>
                            {passFeedback}
                          </div>
                        )}

                        <div id="settings-pass-code-container" style={{ marginTop: '8px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--muted-foreground)', display: 'block', marginBottom: '5px' }}>
                            Код подтверждения:
                          </span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {passCode.map((val, idx) => (
                              <input
                                key={idx}
                                type="text"
                                maxLength={1}
                                value={val}
                                onChange={(e) => handleCodeBoxInput(idx, e.target.value, passCode, setPassCode, 'settings-pass-code-container')}
                                className="profile-code-input"
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                        <button
                          type="button"
                          onClick={handleConfirmPasswordChange}
                          disabled={isFinalizingPass || !newPass || newPass !== repeatPass}
                          className="btn-settings-add"
                          style={{ padding: '7px 14px', fontSize: '12px' }}
                        >
                          {isFinalizingPass ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                          <span>{isFinalizingPass ? 'Обновление...' : 'Обновить пароль'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={resetSecurityFlows}
                          className="btn-form-cancel"
                          style={{ padding: '7px 12px', fontSize: '12px' }}
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ACCOUNT (CREATE / EDIT)                                          */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* MODAL: LEGAL ENTITY                                                       */}
      {/* ========================================================================= */}
      {modalLegalEntity && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setModalLegalEntity(null)}>
          <div className="settings-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="settings-modal-header">
              <div>
                <h3 className="settings-modal-title">
                  {modalLegalEntity.mode === 'create' ? 'Новое юрлицо группы' : 'Параметры юрлица'}
                </h3>
                <p className="settings-modal-subtitle">
                  Задайте форму собственности и систему налогообложения для раздельного учёта
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalLegalEntity(null)}
                className="btn-modal-close"
                title="Закрыть"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleLegalEntitySubmit} className="settings-modal-form">
              <div className="settings-input-group">
                <label className="settings-input-label">Наименование компании / юрлица</label>
                <input
                  type="text"
                  required
                  value={leName}
                  onChange={(e) => setLeName(e.target.value)}
                  className="settings-text-input"
                  placeholder="например: ООО «Ивент Групп» или ИП Иванов И.И."
                />
              </div>

              <div className="settings-input-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="settings-input-group">
                  <label className="settings-input-label">Организационная форма</label>
                  <select
                    value={leType}
                    onChange={(e) => setLeType(e.target.value as LegalEntityType)}
                    className="settings-text-input"
                  >
                    <option value="llc">ООО (Юрлицо)</option>
                    <option value="sole_proprietor">ИП (Предприниматель)</option>
                    <option value="cash">Касса и сейф (Наличные)</option>
                    <option value="self_employed">Самозанятый (НПД)</option>
                  </select>
                </div>

                <div className="settings-input-group">
                  <label className="settings-input-label">ИНН (необязательно)</label>
                  <input
                    type="text"
                    value={leInn}
                    onChange={(e) => setLeInn(e.target.value)}
                    className="settings-text-input"
                    placeholder="7701234567"
                  />
                </div>
              </div>

              <div className="settings-input-group">
                <label className="settings-input-label">Система налогообложения</label>
                <select
                  value={leTaxSystem}
                  onChange={(e) => handleTaxSystemChange(e.target.value as LegalEntityTaxSystem)}
                  className="settings-text-input"
                >
                  <option value="osno">ОСНО (НДС 20% с вычетом + Налог на прибыль 20%)</option>
                  <option value="usn_income_vat5">УСН «Доходы» 6% + НДС 5% (правило 2025, без вычетов)</option>
                  <option value="usn_income_vat7">УСН «Доходы» 6% + НДС 7% (правило 2025, без вычетов)</option>
                  <option value="usn_income">УСН «Доходы» (6%)</option>
                  <option value="usn_income_expense">УСН «Доходы минус расходы» (15%)</option>
                  <option value="npd">НПД (Самозанятость 6%)</option>
                  <option value="none">Без налога (Управленческая касса / сейф)</option>
                </select>
              </div>

              {leTaxSystem !== 'none' && (
                <div className="settings-input-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="settings-input-group">
                    <label className="settings-input-label">
                      {leTaxSystem === 'osno' ? 'Налог на прибыль (%)' : 'Ставка налога (%)'}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={leTaxRate}
                      onChange={(e) => setLeTaxRate(e.target.value)}
                      className="settings-text-input"
                      placeholder="20"
                    />
                  </div>

                  {(leTaxSystem === 'osno' || leTaxSystem === 'usn_income_vat5' || leTaxSystem === 'usn_income_vat7') && (
                    <div className="settings-input-group">
                      <label className="settings-input-label">Ставка НДС (%)</label>
                      <input
                        type="number"
                        step="any"
                        value={leVatRate}
                        onChange={(e) => setLeVatRate(e.target.value)}
                        className="settings-text-input"
                        placeholder="20"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="settings-input-group">
                <label className="settings-input-label">Описание / Назначение</label>
                <input
                  type="text"
                  value={leDesc}
                  onChange={(e) => setLeDesc(e.target.value)}
                  className="settings-text-input"
                  placeholder="Основное юрлицо для безналичных договоров банкетов"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
                <input
                  type="checkbox"
                  id="le-default-checkbox"
                  checked={leIsDefault}
                  onChange={(e) => setLeIsDefault(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#c5b08e', cursor: 'pointer' }}
                />
                <label htmlFor="le-default-checkbox" style={{ fontSize: '0.82rem', color: 'var(--foreground)', cursor: 'pointer' }}>
                  Сделать основным юрлицом группы компаний
                </label>
              </div>

              <div className="settings-modal-footer">
                {modalLegalEntity.mode === 'edit' ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteLegalEntity(modalLegalEntity.entity.id, modalLegalEntity.entity.name)}
                    className="btn-modal-danger"
                  >
                    <Trash2 size={14} />
                    <span>Удалить юрлицо</span>
                  </button>
                ) : <div />}

                <div className="settings-modal-footer-right">
                  <button
                    type="button"
                    onClick={() => setModalLegalEntity(null)}
                    className="btn-form-cancel"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="btn-form-submit"
                  >
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    <span>{modalLegalEntity.mode === 'create' ? 'Создать юрлицо' : 'Сохранить'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalAccount && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setModalAccount(null)}>
          <div className="settings-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header">
              <div>
                <h3 className="settings-modal-title">
                  {modalAccount.mode === 'create' ? 'Новый счёт (кошелёк)' : 'Редактирование счёта'}
                </h3>
                <p className="settings-modal-subtitle">
                  Укажите название, тип и параметры счёта
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalAccount(null)}
                className="btn-modal-close"
                title="Закрыть"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAccountSubmit} className="settings-modal-form">
              <div className="settings-input-group">
                <label className="settings-input-label">Название счёта</label>
                <input
                  type="text"
                  required
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  className="settings-text-input"
                  placeholder="например, Т-Банк Расчётный или Нал Склад"
                />
              </div>

              <div className="settings-input-group">
                <label className="settings-input-label">Тип счёта</label>
                <select
                  value={accTypeSelect}
                  onChange={(e) => setAccTypeSelect(e.target.value as any)}
                  className="settings-text-input"
                >
                  <option value="cash">Касса наличных</option>
                  <option value="bank">Безналичный расчётный счёт</option>
                  <option value="card">Карта / СБП (переводы)</option>
                  <option value="safe">Сейф / Резерв</option>
                  <option value="custom">+ Свой тип счёта...</option>
                </select>
              </div>

              <div className="settings-input-group">
                <label className="settings-input-label">Привязка к юрлицу группы</label>
                <select
                  value={accLegalEntityId}
                  onChange={(e) => setAccLegalEntityId(e.target.value)}
                  className="settings-text-input"
                >
                  <option value="">Без привязки (управленческий счёт / касса)</option>
                  {legalEntities.map((le) => (
                    <option key={le.id} value={le.id}>
                      {le.name} ({le.type === 'llc' ? 'ООО' : le.type === 'sole_proprietor' ? 'ИП' : 'Касса'}, {le.taxSystem.toUpperCase()})
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '4px' }}>
                  Операции по этому счёту автоматически относятся к выбранному юрлицу для расчёта налогов и НДС
                </span>
              </div>

              {accTypeSelect === 'custom' && (
                <div className="settings-input-group animate-fade-in">
                  <label className="settings-input-label">Название своего типа счёта</label>
                  <input
                    type="text"
                    required
                    value={customAccTypeName}
                    onChange={(e) => setCustomAccTypeName(e.target.value)}
                    className="settings-text-input"
                    placeholder="например: Эквайринг, Депозит, Крипта"
                  />
                </div>
              )}

              <div className="settings-input-group">
                <label className="settings-input-label">
                  {modalAccount.mode === 'create' ? 'Начальный баланс (₽)' : 'Текущий остаток (₽)'}
                </label>
                <input
                  type="number"
                  step="any"
                  value={accBalance !== undefined ? accBalance : ''}
                  placeholder="0"
                  onChange={(e) => setAccBalance(parseFloat(e.target.value) || 0)}
                  className="settings-text-input"
                />
                {modalAccount.mode === 'edit' && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '4px' }}>
                    Вы можете скорректировать фактический остаток (например, указать 0 ₽ или реальный баланс)
                  </span>
                )}
              </div>

              <div className="settings-input-group">
                <label className="settings-input-label">Описание / Назначение</label>
                <input
                  type="text"
                  value={accDesc}
                  placeholder="Для безналичных оплат или личной кассы"
                  onChange={(e) => setAccDesc(e.target.value)}
                  className="settings-text-input"
                />
              </div>

              {/* Значок и цвет счёта */}
              <div className="settings-input-group">
                <label className="settings-input-label">Значок и цвет счёта</label>

                {/* Live Preview */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--surface-sunken)',
                  marginBottom: '12px',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: `${accColor}18`,
                    color: accColor,
                    border: `1.5px solid ${accColor}40`,
                    flexShrink: 0,
                  }}>
                    {React.createElement(ACCOUNT_ICON_MAP[accIcon] || Banknote, { size: 20 })}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {accName.trim() || 'Новый счёт'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                      Так счёт будет выглядеть на карточках и в списках
                    </div>
                  </div>
                </div>

                {/* Color Palette Chips */}
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '6px' }}>
                    Цвет бейджа:
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setAccColor(c)}
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          backgroundColor: c,
                          border: accColor === c ? '2px solid var(--foreground)' : '2px solid transparent',
                          outline: accColor === c ? `2px solid ${c}` : 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0,
                          transition: 'transform 0.15s ease',
                          transform: accColor === c ? 'scale(1.15)' : 'scale(1)',
                        }}
                        title={c}
                      >
                        {accColor === c && <Check size={13} color="#fff" strokeWidth={3} />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Icon Grid */}
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '6px' }}>
                    Иконка счёта:
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                    {ACCOUNT_ICONS.map((item) => {
                      const IconComp = item.icon;
                      const isSelected = accIcon === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setAccIcon(item.id)}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            padding: '8px 4px',
                            borderRadius: '6px',
                            border: isSelected ? `1.5px solid ${accColor}` : '1px solid var(--border)',
                            backgroundColor: isSelected ? `${accColor}15` : 'var(--surface-elevated)',
                            color: isSelected ? accColor : 'var(--foreground)',
                            cursor: 'pointer',
                            fontSize: '0.7rem',
                            transition: 'all 0.15s ease',
                          }}
                          title={item.label}
                        >
                          <IconComp size={18} />
                          <span style={{ fontSize: '0.65rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                            {item.label.split(' / ')[0]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="settings-modal-footer">
                {modalAccount.mode === 'edit' ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteAccount(modalAccount.account.id, modalAccount.account.name)}
                    className="btn-modal-danger"
                  >
                    <Trash2 size={14} />
                    <span>Удалить счёт</span>
                  </button>
                ) : <div />}

                <div className="settings-modal-footer-right">
                  <button
                    type="button"
                    onClick={() => setModalAccount(null)}
                    className="btn-form-cancel"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="btn-form-submit"
                  >
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    <span>{modalAccount.mode === 'create' ? 'Создать счёт' : 'Сохранить'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: PARTNER (CREATE / EDIT)                                          */}
      {/* ========================================================================= */}
      {modalPartner && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setModalPartner(null)}>
          <div className="settings-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header">
              <div>
                <h3 className="settings-modal-title">
                  {modalPartner.mode === 'create' ? 'Новый партнёр' : 'Редактирование партнёра'}
                </h3>
                <p className="settings-modal-subtitle">
                  Укажите имя и опциональную роль в бизнесе
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalPartner(null)}
                className="btn-modal-close"
                title="Закрыть"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handlePartnerSubmit} className="settings-modal-form">
              <div className="settings-input-group">
                <label className="settings-input-label">Имя партнёра</label>
                <input
                  type="text"
                  required
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  className="settings-text-input"
                  placeholder="например: Влад, Никита, Алексей"
                />
              </div>

              <div className="settings-input-group">
                <label className="settings-input-label">Роль / Должность (необязательно)</label>
                <input
                  type="text"
                  value={partnerRole}
                  onChange={(e) => setPartnerRole(e.target.value)}
                  className="settings-text-input"
                  placeholder="например: Соучредитель, Шеф-бармен, Инвестор (или оставьте пустым)"
                />
              </div>

              <div className="settings-modal-footer">
                {modalPartner.mode === 'edit' ? (
                  <button
                    type="button"
                    onClick={() => handleDeletePartner(modalPartner.partner.id, modalPartner.partner.name)}
                    className="btn-modal-danger"
                  >
                    <Trash2 size={14} />
                    <span>Удалить</span>
                  </button>
                ) : <div />}

                <div className="settings-modal-footer-right">
                  <button
                    type="button"
                    onClick={() => setModalPartner(null)}
                    className="btn-form-cancel"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="btn-form-submit"
                  >
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    <span>{modalPartner.mode === 'create' ? 'Добавить партнёра' : 'Сохранить'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CATEGORY (CREATE / EDIT)                                         */}
      {/* ========================================================================= */}
      {modalCategory && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setModalCategory(null)}>
          <div className="settings-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header">
              <div>
                <h3 className="settings-modal-title">
                  {modalCategory.mode === 'create' ? 'Новая статья учёта' : 'Редактирование статьи'}
                </h3>
                <p className="settings-modal-subtitle">
                  Настройте название, тип операции, назначение и цвет метки
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalCategory(null)}
                className="btn-modal-close"
                title="Закрыть"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCategorySubmit} className="settings-modal-form">
              <div className="settings-input-group">
                <label className="settings-input-label">Название статьи</label>
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="settings-text-input"
                  placeholder="например, Сервировка, Лёд, Аренда"
                />
              </div>

              <div className="settings-modal-grid-2">
                <div className="settings-input-group">
                  <label className="settings-input-label">Тип статьи</label>
                  <select
                    value={catType}
                    onChange={(e) => setCatType(e.target.value as any)}
                    className="settings-text-input"
                  >
                    <option value="expense">Расход (списание)</option>
                    <option value="income">Доход (поступление)</option>
                  </select>
                </div>

                <div className="settings-input-group">
                  <label className="settings-input-label">Назначение</label>
                  <select
                    value={catDirection}
                    onChange={(e) => setCatDirection(e.target.value as any)}
                    className="settings-text-input"
                  >
                    <option value="operational">Для мероприятий (себестоимость)</option>
                    <option value="business">Накладные расходы бизнеса</option>
                    <option value="dividends">Выплаты соучредителям</option>
                    <option value="all">Универсальная статья</option>
                  </select>
                </div>
              </div>

              <div className="settings-input-group">
                <label className="settings-input-label">Цвет статьи</label>
                <div className="settings-color-picker-row">
                  <div className="color-swatches-row">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCatColor(c)}
                        className={`color-swatch-dot ${catColor === c ? 'swatch-active' : ''}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={catColor}
                    onChange={(e) => setCatColor(e.target.value)}
                    className="color-native-input"
                    title="Выбрать свой цвет"
                  />
                </div>
              </div>

              <div className="settings-modal-footer">
                {modalCategory.mode === 'edit' ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(modalCategory.category.id, modalCategory.category.name)}
                    className="btn-modal-danger"
                  >
                    <Trash2 size={14} />
                    <span>Удалить статью</span>
                  </button>
                ) : <div />}

                <div className="settings-modal-footer-right">
                  <button
                    type="button"
                    onClick={() => setModalCategory(null)}
                    className="btn-form-cancel"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="btn-form-submit"
                  >
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    <span>{modalCategory.mode === 'create' ? 'Создать статью' : 'Сохранить'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: INVITE TEAM MEMBER                                              */}
      {/* ========================================================================= */}
      {isInviteModalOpen && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setIsInviteModalOpen(false)}>
          <div className="settings-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="settings-modal-header">
              <div>
                <h3 className="settings-modal-title">
                  Пригласить сотрудника
                </h3>
                <p className="settings-modal-subtitle">
                  Доступ в организацию «{currentCompany?.name || 'Организация'}»
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="btn-modal-close"
                title="Закрыть"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '0 24px', marginBottom: '16px' }}>
              <div style={{
                display: 'flex',
                gap: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                padding: '4px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
              }}>
                <button
                  type="button"
                  onClick={() => setInviteTab('link')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    backgroundColor: inviteTab === 'link' ? 'var(--primary, #3b82f6)' : 'transparent',
                    color: inviteTab === 'link' ? '#fff' : 'var(--muted-foreground)',
                  }}
                >
                  <Link2 size={14} />
                  <span>Ссылка и QR-код</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInviteTab('email')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    backgroundColor: inviteTab === 'email' ? 'var(--primary, #3b82f6)' : 'transparent',
                    color: inviteTab === 'email' ? '#fff' : 'var(--muted-foreground)',
                  }}
                >
                  <Send size={14} />
                  <span>По Email</span>
                </button>
              </div>
            </div>

            {inviteTab === 'link' ? (
              <div className="settings-modal-form" style={{ paddingTop: 0 }}>
                {/* Role selection for Link */}
                <div className="settings-input-group">
                  <label className="settings-input-label">Роль для приглашённого по ссылке</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div
                      onClick={() => setInviteRole('staff')}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: `1.5px solid ${inviteRole === 'staff' ? '#10b981' : 'var(--border)'}`,
                        backgroundColor: inviteRole === 'staff' ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: inviteRole === 'staff' ? '#10b981' : 'var(--foreground)' }}>
                          Сотрудник / Бармен на выезде
                        </span>
                        <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.12)' }}>
                          Популярно
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
                        Быстрый ввод чеков, расходов и чаевых со смартфона без доступа к остаткам счетов и марже.
                      </div>
                    </div>

                    <div
                      onClick={() => setInviteRole('accountant')}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: `1.5px solid ${inviteRole === 'accountant' ? '#3b82f6' : 'var(--border)'}`,
                        backgroundColor: inviteRole === 'accountant' ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: inviteRole === 'accountant' ? '#3b82f6' : 'var(--foreground)' }}>
                          Бухгалтер / Финменеджер
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
                        Просмотр всех счетов, отчётов, внесение и проверка операций.
                      </div>
                    </div>

                    <div
                      onClick={() => setInviteRole('owner')}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: `1.5px solid ${inviteRole === 'owner' ? '#f59e0b' : 'var(--border)'}`,
                        backgroundColor: inviteRole === 'owner' ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: inviteRole === 'owner' ? '#f59e0b' : 'var(--foreground)' }}>
                          Совладелец / Главный финдиректор
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
                        Полный доступ ко всей системе, управление компанией и дивидендами.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Generated Link Display */}
                {generatedInvite ? (
                  <div style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Check size={14} /> Ссылка готова для отправки:
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        readOnly
                        value={`${getInviteBaseUrl()}/?invite=${generatedInvite.token}`}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        title="Нажмите, чтобы выделить всё"
                        className="settings-text-input"
                        style={{ fontSize: '12px', fontFamily: 'monospace', cursor: 'pointer' }}
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(`${getInviteBaseUrl()}/?invite=${generatedInvite.token}`, generatedInvite.id)}
                        className="btn-form-submit"
                        style={{ padding: '0 14px', whiteSpace: 'nowrap' }}
                      >
                        {copiedInviteId === generatedInvite.id ? <Check size={14} /> : <Copy size={14} />}
                        <span>{copiedInviteId === generatedInvite.id ? 'Скопировано!' : 'Копировать'}</span>
                      </button>
                    </div>

                    {/* Quick Share Buttons */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                      <a
                        href={`https://t.me/share/url?url=${encodeURIComponent(`${getInviteBaseUrl()}/?invite=${generatedInvite.token}`)}&text=${encodeURIComponent(`Присоединяйся к команде «${currentCompany?.name || 'Truespace'}» в TrueSpace: `)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          flex: 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          backgroundColor: '#0088cc',
                          color: '#fff',
                          textDecoration: 'none',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        <Send size={14} />
                        <span>В Telegram</span>
                      </a>

                      <a
                        href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Присоединяйся к команде «${currentCompany?.name || 'Truespace'}» в TrueSpace: ${getInviteBaseUrl()}/?invite=${generatedInvite.token}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          flex: 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          backgroundColor: '#25d366',
                          color: '#fff',
                          textDecoration: 'none',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        <Share2 size={14} />
                        <span>В WhatsApp</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => setShowQrCode(!showQrCode)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                          backgroundColor: showQrCode ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                          color: showQrCode ? '#f59e0b' : 'var(--foreground)',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <QrCode size={14} />
                        <span>{showQrCode ? 'Скрыть QR' : 'QR-код'}</span>
                      </button>
                    </div>

                    {/* QR Code Card */}
                    {showQrCode && (
                      <div style={{
                        marginTop: '8px',
                        textAlign: 'center',
                        padding: '16px',
                        borderRadius: '8px',
                        backgroundColor: '#fff',
                        color: '#000',
                      }}>
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${getInviteBaseUrl()}/?invite=${generatedInvite.token}`)}`}
                          alt="QR-код для входа"
                          style={{ width: '160px', height: '160px', margin: '0 auto 8px', display: 'block' }}
                        />
                        <div style={{ fontSize: '11px', color: '#666', fontWeight: 500 }}>
                          Бармен наводит камеру смартфона прямо на площадке и мгновенно входит в команду!
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isGeneratingLink}
                    onClick={handleGenerateLink}
                    className="btn-form-submit"
                    style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                  >
                    {isGeneratingLink ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                    <span>{isGeneratingLink ? 'Генерация ссылки...' : 'Создать ссылку-приглашение'}</span>
                  </button>
                )}

                <div className="settings-modal-footer">
                  <div />
                  <div className="settings-modal-footer-right">
                    <button
                      type="button"
                      onClick={() => setIsInviteModalOpen(false)}
                      className="btn-form-cancel"
                    >
                      Закрыть
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Tab 2: Classic Email Invite */
              <form onSubmit={handleInviteMember} className="settings-modal-form" style={{ paddingTop: 0 }}>
                <div className="settings-input-group">
                  <label className="settings-input-label">Email сотрудника</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="settings-text-input"
                    placeholder="colleague@example.com"
                    autoFocus
                  />
                </div>

                <div className="settings-input-group">
                  <label className="settings-input-label">Имя и фамилия (опционально)</label>
                  <input
                    type="text"
                    value={inviteFullName}
                    onChange={(e) => setInviteFullName(e.target.value)}
                    className="settings-text-input"
                    placeholder="например: Евгений Петров"
                  />
                </div>

                <div className="settings-modal-footer">
                  <div />
                  <div className="settings-modal-footer-right">
                    <button
                      type="button"
                      onClick={() => setIsInviteModalOpen(false)}
                      className="btn-form-cancel"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      disabled={isInviting || !inviteEmail.trim()}
                      className="btn-form-submit"
                    >
                      {isInviting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                      <span>{isInviting ? 'Отправка...' : 'Отправить на почту'}</span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      </main>

      {/* Modal: Delete Current Company Confirmation */}
      {isDeleteCompanyModalOpen && currentCompany && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setIsDeleteCompanyModalOpen(false)}>
          <div className="settings-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="settings-modal-header">
              <div>
                <h3 className="settings-modal-title" style={{ color: '#ef4444' }}>
                  Удаление организации
                </h3>
                <p className="settings-modal-subtitle">
                  Подтверждение безвозвратного удаления
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteCompanyModalOpen(false)}
                className="btn-modal-close"
                title="Закрыть"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleDeleteCompany} className="settings-modal-form" style={{ marginTop: '14px' }}>
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  fontSize: '0.85rem',
                  lineHeight: 1.5,
                  color: '#ef4444',
                }}
              >
                Все финансовые записи, кассы и мероприятия компании «{currentCompany.name}» будут безвозвратно стёрты.
              </div>

              <div className="settings-input-group" style={{ marginTop: '14px' }}>
                <label className="settings-input-label" style={{ fontSize: '0.82rem' }}>
                  Для подтверждения введите точное имя компании: <strong>{currentCompany.name}</strong>
                </label>
                <input
                  type="text"
                  required
                  value={deleteCompanyNameConfirm}
                  onChange={(e) => setDeleteCompanyNameConfirm(e.target.value)}
                  className="settings-text-input"
                  placeholder={currentCompany.name}
                  autoFocus
                />
              </div>

              <div className="settings-modal-actions" style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setIsDeleteCompanyModalOpen(false)}
                  className="btn-modal-cancel"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isDeletingCompany || deleteCompanyNameConfirm.trim() !== currentCompany.name.trim()}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: deleteCompanyNameConfirm.trim() === currentCompany.name.trim() ? '#ef4444' : 'rgba(239, 68, 68, 0.3)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 600,
                    cursor: deleteCompanyNameConfirm.trim() === currentCompany.name.trim() ? 'pointer' : 'not-allowed',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.85rem',
                  }}
                >
                  {isDeletingCompany ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Удаление...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      <span>Да, удалить компанию</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
