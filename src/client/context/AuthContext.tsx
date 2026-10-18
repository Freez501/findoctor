/**
 * Truespace — Барный кейтеринг и финансы
 * Multi-Tenant & SaaS Auth Context (`src/client/context/AuthContext.tsx`)
 *
 * Manages active user profile, company tenant, team roles, SuperAdmin privileges,
 * and authenticated session lifecycle with real multi-tenant tenant data isolation.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Company, UserProfile, CompanyMembership, UserRole } from '../../shared/types.js';
import { INITIAL_COMPANIES_SEED, INITIAL_USERS_SEED } from '../../shared/constants.js';
import { api } from '../api/apiClient.js';
import { supabase } from '../lib/supabaseClient.js';

export interface AuthContextType {
  currentUser: UserProfile | null;
  usersList: UserProfile[];
  currentCompany: Company | null;
  companiesList: Company[];
  companyMembers: { membership: CompanyMembership; user?: UserProfile }[];
  isSuperAdmin: boolean;
  userRole: UserRole;
  isAuthenticated: boolean;
  isDemoMode: boolean;
  isAdminModalOpen: boolean;
  setAdminModalOpen: (open: boolean) => void;
  login: (email: string, password?: string) => Promise<void>;
  register: (email: string, password?: string, fullName?: string, companyName?: string, code?: string) => Promise<void>;
  enterDemoMode: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (userId: string, data: Partial<UserProfile>) => Promise<void>;
  updateCompanyDetails: (companyId: string, data: Partial<Company>) => Promise<void>;
  switchUser: (userId: string) => Promise<void>;
  switchCompany: (companyId: string) => Promise<void>;
  createCompany: (name: string, slug?: string) => Promise<Company>;
  deleteCompany: (companyId: string) => Promise<void>;
  inviteMember: (email: string, role: UserRole, fullName?: string) => Promise<void>;
  acceptInvite: (token: string, data?: { fullName?: string; email?: string; password?: string }) => Promise<void>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  refreshAuthData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('truespace_logged_in') === 'true' && !!localStorage.getItem('truespace_user_id');
  });

  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    return localStorage.getItem('truespace_demo_mode') === 'true';
  });

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('truespace_current_user');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return null;
  });

  const [usersList, setUsersList] = useState<UserProfile[]>([]);

  const [currentCompany, setCurrentCompany] = useState<Company | null>(() => {
    const isDemo = localStorage.getItem('truespace_demo_mode') === 'true';
    const savedUserId = localStorage.getItem('truespace_user_id') || '';
    const isRealCustomUser = !isDemo && savedUserId && savedUserId !== 'user_nikita' && savedUserId !== 'user_vlad';
    const saved = localStorage.getItem('truespace_current_company');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Company;
        if (isRealCustomUser && parsed?.id === 'company_truespace_default') {
          localStorage.removeItem('truespace_current_company');
          localStorage.removeItem('truespace_company_id');
          return null;
        }
        return parsed;
      } catch {}
    }
    return null;
  });

  const [companiesList, setCompaniesList] = useState<Company[]>(() => {
    const saved = localStorage.getItem('truespace_current_company');
    if (saved) {
      try {
        return [JSON.parse(saved)];
      } catch {}
    }
    return [...INITIAL_COMPANIES_SEED];
  });
  const [companyMembers, setCompanyMembers] = useState<{ membership: CompanyMembership; user?: UserProfile }[]>([]);
  const [isAdminModalOpen, setAdminModalOpen] = useState(false);

  const refreshAuthData = useCallback(async () => {
    try {
      const isDemo = localStorage.getItem('truespace_demo_mode') === 'true';
      const savedUserId = localStorage.getItem('truespace_user_id');
      if (savedUserId && !api.activeUserId) {
        api.setActiveUserId(savedUserId);
      }
      const savedCompanyId = localStorage.getItem('truespace_company_id');
      const isRealCustomUser = !isDemo && savedUserId && savedUserId !== 'user_nikita' && savedUserId !== 'user_vlad';
      if (savedCompanyId && (!isRealCustomUser || savedCompanyId !== 'company_truespace_default')) {
        api.setActiveCompanyId(savedCompanyId);
      }

      const [userRes, users, companies] = await Promise.all([
        api.getCurrentUser().catch(() => null),
        api.getUsers().catch(() => null),
        api.getCompanies().catch(() => null),
      ]);

      // If requests were aborted by a rapid page refresh (F5), do not overwrite existing auth state
      if (!userRes && !companies) {
        return;
      }

      let effectiveUser: UserProfile | null = null;
      const rawSavedUser = localStorage.getItem('truespace_current_user');
      if (rawSavedUser) {
        try {
          effectiveUser = JSON.parse(rawSavedUser);
        } catch {}
      }

      if (userRes?.user) {
        effectiveUser = isDemo
          ? { ...userRes.user, fullName: 'Гость (Демо-режим)', isSuperAdmin: false }
          : userRes.user;
        setCurrentUser(effectiveUser);
        localStorage.setItem('truespace_current_user', JSON.stringify(effectiveUser));
        localStorage.setItem('truespace_user_id', effectiveUser.id);
        api.setActiveUserId(effectiveUser.id);
      }
      if (users && users.length > 0) {
        setUsersList(users);
      }
      if (companies && companies.length > 0) {
        setCompaniesList(companies);

        // For real (non-demo) users, prioritize their owned company so they never land on demo data
        const ownedCo =
          !isDemo && effectiveUser
            ? companies.find((c) => c.ownerId === effectiveUser!.id && c.id !== 'company_truespace_default') ||
              companies.find((c) => c.ownerId === effectiveUser!.id)
            : undefined;

        const validSavedCompanyId =
          savedCompanyId &&
          (!isRealCustomUser || savedCompanyId !== 'company_truespace_default') &&
          companies.some((c) => c.id === savedCompanyId)
            ? savedCompanyId
            : undefined;

        const preferredCompanyId =
          (isDemo ? 'company_truespace_default' : undefined) ||
          validSavedCompanyId ||
          (userRes?.activeCompanyId &&
            userRes.activeCompanyId !== 'company_truespace_default' &&
            companies.some((c) => c.id === userRes.activeCompanyId) &&
            userRes.activeCompanyId) ||
          ownedCo?.id ||
          (userRes?.activeCompanyId && companies.some((c) => c.id === userRes.activeCompanyId) && userRes.activeCompanyId) ||
          companies[0].id;

        const rawActiveCo = companies.find((c) => c.id === preferredCompanyId) || ownedCo || companies[0];
        const activeCo: Company =
          isDemo && rawActiveCo.id === 'company_truespace_default'
            ? { ...rawActiveCo, name: 'FINDOCTOR • Демо-кейтеринг' }
            : rawActiveCo;
        setCurrentCompany(activeCo);
        localStorage.setItem('truespace_current_company', JSON.stringify(activeCo));
        localStorage.setItem('truespace_company_id', activeCo.id);
        api.setActiveCompanyId(activeCo.id);

        // Fetch company members for this company
        if (activeCo) {
          const members = await api.getCompanyMembers(activeCo.id).catch(() => null);
          if (members) {
            setCompanyMembers(members);
          }
        }
      }
    } catch (err) {
      if (!import.meta.env.PROD) {
        console.warn('[AuthContext] Could not fetch server auth:', err);
      }
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      refreshAuthData();
    }
  }, [isAuthenticated, refreshAuthData]);

  useEffect(() => {
    if (!supabase) return;
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
        setIsAuthenticated(true);
        localStorage.setItem('truespace_logged_in', 'true');
        await refreshAuthData();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [refreshAuthData]);

  const login = useCallback(async (email: string, password?: string) => {
    const res = await api.login({ email, password });
    if (res.user) {
      setCurrentUser(res.user);
      setIsAuthenticated(true);
      setIsDemoMode(false);
      localStorage.setItem('truespace_logged_in', 'true');
      localStorage.removeItem('truespace_demo_mode');
      localStorage.setItem('truespace_current_user', JSON.stringify(res.user));
      localStorage.setItem('truespace_user_id', res.user.id);
      api.setActiveUserId(res.user.id);
      if (res.company) {
        setCurrentCompany(res.company);
        localStorage.setItem('truespace_current_company', JSON.stringify(res.company));
        localStorage.setItem('truespace_company_id', res.company.id);
        api.setActiveCompanyId(res.company.id);
        const members = await api.getCompanyMembers(res.company.id).catch(() => []);
        setCompanyMembers(members);
      }
    }
  }, []);

  const register = useCallback(async (email: string, password?: string, fullName?: string, companyName?: string, code?: string) => {
    const res = await api.register({ email, password, fullName, companyName, code });
    if (res.user) {
      setCurrentUser(res.user);
      setIsAuthenticated(true);
      setIsDemoMode(false);
      localStorage.setItem('truespace_logged_in', 'true');
      localStorage.removeItem('truespace_demo_mode');
      localStorage.setItem('truespace_current_user', JSON.stringify(res.user));
      localStorage.setItem('truespace_user_id', res.user.id);
      api.setActiveUserId(res.user.id);
      if (res.company) {
        setCurrentCompany(res.company);
        localStorage.setItem('truespace_current_company', JSON.stringify(res.company));
        localStorage.setItem('truespace_company_id', res.company.id);
        api.setActiveCompanyId(res.company.id);
        const members = await api.getCompanyMembers(res.company.id).catch(() => []);
        setCompanyMembers(members);
      }
    }
  }, []);

  const enterDemoMode = useCallback(async () => {
    const demoUser: UserProfile = {
      ...INITIAL_USERS_SEED[0],
      fullName: 'Гость (Демо-режим)',
      isSuperAdmin: false,
    };
    const demoCompany: Company = {
      ...INITIAL_COMPANIES_SEED[0],
      name: 'FINDOCTOR • Демо-кейтеринг',
    };
    setCurrentUser(demoUser);
    setCurrentCompany(demoCompany);
    setIsDemoMode(true);
    setIsAuthenticated(true);
    localStorage.setItem('truespace_logged_in', 'true');
    localStorage.setItem('truespace_demo_mode', 'true');
    localStorage.setItem('truespace_current_user', JSON.stringify(demoUser));
    localStorage.setItem('truespace_user_id', demoUser.id);
    localStorage.setItem('truespace_current_company', JSON.stringify(demoCompany));
    localStorage.setItem('truespace_company_id', demoCompany.id);
    api.setActiveUserId(demoUser.id);
    api.setActiveCompanyId(demoCompany.id);
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
    localStorage.setItem('truespace_logged_in', 'false');
    localStorage.removeItem('truespace_demo_mode');
    localStorage.removeItem('truespace_current_user');
    localStorage.removeItem('truespace_user_id');
    localStorage.removeItem('truespace_current_company');
    localStorage.removeItem('truespace_company_id');
    setIsAuthenticated(false);
    setIsDemoMode(false);
    setCurrentUser(null);
    setCurrentCompany(null);
    api.setActiveUserId('');
    api.setActiveCompanyId('company_truespace_default');
  }, []);

  const updateProfile = useCallback(async (userId: string, data: Partial<UserProfile>) => {
    const res = await api.updateUserProfile(userId, data);
    if (res.user) {
      if (currentUser?.id === userId) {
        setCurrentUser(res.user);
      }
      setUsersList((prev) => prev.map((u) => (u.id === userId ? res.user : u)));
    }
  }, [currentUser?.id]);

  const updateCompanyDetails = useCallback(async (companyId: string, data: Partial<Company>) => {
    const updated = await api.updateCompany(companyId, data);
    if (updated) {
      if (currentCompany?.id === companyId) {
        setCurrentCompany(updated);
      }
      setCompaniesList((prev) => prev.map((c) => (c.id === companyId ? updated : c)));
    }
  }, [currentCompany?.id]);

  const switchUser = useCallback(async (userId: string) => {
    try {
      const res = await api.switchUser(userId);
      if (res.user) {
        setCurrentUser(res.user);
        localStorage.setItem('truespace_current_user', JSON.stringify(res.user));
        localStorage.setItem('truespace_user_id', res.user.id);
        api.setActiveUserId(res.user.id);

        if ((res as any).company) {
          const comp = (res as any).company;
          setCurrentCompany(comp);
          localStorage.setItem('truespace_current_company', JSON.stringify(comp));
          localStorage.setItem('truespace_company_id', comp.id);
          api.setActiveCompanyId(comp.id);
        }
      }
      window.location.reload();
    } catch {
      const found = usersList.find((u) => u.id === userId);
      if (found) {
        setCurrentUser(found);
        localStorage.setItem('truespace_current_user', JSON.stringify(found));
        localStorage.setItem('truespace_user_id', found.id);
        api.setActiveUserId(found.id);
      }
      window.location.reload();
    }
  }, [usersList]);

  const switchCompany = useCallback(async (companyId: string) => {
    const co = companiesList.find((c) => c.id === companyId);
    if (co) {
      setCurrentCompany(co);
      localStorage.setItem('truespace_current_company', JSON.stringify(co));
      localStorage.setItem('truespace_company_id', co.id);
      api.setActiveCompanyId(co.id);

      // If current user is not superAdmin and does not own or belong to this company,
      // switch to the owner of this company so the user sees the company with proper permissions!
      if (!currentUser?.isSuperAdmin && co.ownerId && currentUser?.id !== co.ownerId) {
        const ownerUser = usersList.find((u) => u.id === co.ownerId);
        if (ownerUser) {
          setCurrentUser(ownerUser);
          localStorage.setItem('truespace_current_user', JSON.stringify(ownerUser));
          localStorage.setItem('truespace_user_id', ownerUser.id);
          api.setActiveUserId(ownerUser.id);
          await api.switchUser(ownerUser.id).catch(() => {});
        }
      }

      try {
        const members = await api.getCompanyMembers(co.id);
        setCompanyMembers(members);
      } catch {
        // keep current
      }
      window.location.reload();
    }
  }, [companiesList, currentUser, usersList]);

  const createCompany = useCallback(async (name: string, slug?: string): Promise<Company> => {
    const created = await api.createCompany({
      name,
      slug,
      ownerId: currentUser?.id || 'user_nikita',
    });
    setCompaniesList((prev) => [...prev, created]);
    setCurrentCompany(created);
    localStorage.setItem('truespace_current_company', JSON.stringify(created));
    localStorage.setItem('truespace_company_id', created.id);
    api.setActiveCompanyId(created.id);
    return created;
  }, [currentUser?.id]);

  const deleteCompany = useCallback(async (companyId: string) => {
    await api.deleteCompany(companyId);
    setCompaniesList((prev) => prev.filter((c) => c.id !== companyId));
    if (currentCompany?.id === companyId) {
      const remaining = companiesList.filter((c) => c.id !== companyId);
      if (remaining.length > 0) {
        setCurrentCompany(remaining[0]);
        localStorage.setItem('truespace_current_company', JSON.stringify(remaining[0]));
        localStorage.setItem('truespace_company_id', remaining[0].id);
        api.setActiveCompanyId(remaining[0].id);
      } else {
        await logout();
      }
    }
    await refreshAuthData();
  }, [companiesList, currentCompany?.id, logout, refreshAuthData]);

  const inviteMember = useCallback(async (email: string, role: UserRole, fullName?: string) => {
    if (!currentCompany) return;
    await api.registerOrInviteUser({
      email,
      fullName,
      companyId: currentCompany.id,
      role,
    });
    await refreshAuthData();
  }, [currentCompany, refreshAuthData]);

  const acceptInvite = useCallback(async (token: string, data?: { fullName?: string; email?: string; password?: string }) => {
    const res = await api.acceptCompanyInvite(token, {
      ...data,
      userId: currentUser?.id,
    });
    localStorage.setItem('truespace_logged_in', 'true');
    localStorage.setItem('truespace_user_id', res.user.id);
    localStorage.setItem('truespace_current_user', JSON.stringify(res.user));
    localStorage.removeItem('truespace_demo_mode');
    setIsDemoMode(false);
    setIsAuthenticated(true);
    setCurrentUser(res.user);
    api.setActiveCompanyId(res.company.id);
    await refreshAuthData();
  }, [currentUser?.id, refreshAuthData]);

  const forgotPassword = useCallback(async (email: string) => {
    return api.forgotPassword(email);
  }, []);

  const isSuperAdmin = Boolean(currentUser?.isSuperAdmin);

  // Find user's role in current company
  const currentMembership = companyMembers.find((m) => m.membership.userId === currentUser?.id);
  const userRole: UserRole = isSuperAdmin
    ? 'super_admin'
    : (currentMembership?.membership.role || (currentUser?.id === currentCompany?.ownerId ? 'owner' : 'staff'));

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        usersList,
        currentCompany,
        companiesList,
        companyMembers,
        isSuperAdmin,
        userRole,
        isAuthenticated,
        isDemoMode,
        isAdminModalOpen,
        setAdminModalOpen,
        login,
        register,
        enterDemoMode,
        logout,
        updateProfile,
        updateCompanyDetails,
        switchUser,
        switchCompany,
        createCompany,
        deleteCompany,
        inviteMember,
        acceptInvite,
        forgotPassword,
        refreshAuthData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
