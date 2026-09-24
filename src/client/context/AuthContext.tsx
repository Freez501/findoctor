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

export interface AuthContextType {
  currentUser: UserProfile | null;
  usersList: UserProfile[];
  currentCompany: Company | null;
  companiesList: Company[];
  companyMembers: { membership: CompanyMembership; user?: UserProfile }[];
  isSuperAdmin: boolean;
  userRole: UserRole;
  isAuthenticated: boolean;
  isAdminModalOpen: boolean;
  setAdminModalOpen: (open: boolean) => void;
  login: (email: string, password?: string) => Promise<void>;
  register: (email: string, password?: string, fullName?: string, companyName?: string, code?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (userId: string, data: Partial<UserProfile>) => Promise<void>;
  updateCompanyDetails: (companyId: string, data: Partial<Company>) => Promise<void>;
  switchUser: (userId: string) => Promise<void>;
  switchCompany: (companyId: string) => Promise<void>;
  createCompany: (name: string, slug?: string) => Promise<Company>;
  deleteCompany: (companyId: string) => Promise<void>;
  inviteMember: (email: string, role: UserRole, fullName?: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  refreshAuthData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('truespace_logged_in') === 'true' && !!localStorage.getItem('truespace_user_id');
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
    const saved = localStorage.getItem('truespace_current_company');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return null;
  });

  const [companiesList, setCompaniesList] = useState<Company[]>([...INITIAL_COMPANIES_SEED]);
  const [companyMembers, setCompanyMembers] = useState<{ membership: CompanyMembership; user?: UserProfile }[]>([]);
  const [isAdminModalOpen, setAdminModalOpen] = useState(false);

  const refreshAuthData = useCallback(async () => {
    try {
      const savedUserId = localStorage.getItem('truespace_user_id');
      if (savedUserId && !api.activeUserId) {
        api.setActiveUserId(savedUserId);
      }
      const savedCompanyId = localStorage.getItem('truespace_company_id');
      if (savedCompanyId && !api.activeCompanyId) {
        api.setActiveCompanyId(savedCompanyId);
      }

      const [userRes, users, companies] = await Promise.all([
        api.getCurrentUser().catch(() => null),
        api.getUsers().catch(() => [...INITIAL_USERS_SEED]),
        api.getCompanies().catch(() => [...INITIAL_COMPANIES_SEED]),
      ]);

      if (userRes?.user) {
        setCurrentUser(userRes.user);
        localStorage.setItem('truespace_current_user', JSON.stringify(userRes.user));
        localStorage.setItem('truespace_user_id', userRes.user.id);
        api.setActiveUserId(userRes.user.id);
      }
      if (users && users.length > 0) {
        setUsersList(users);
      }
      if (companies && companies.length > 0) {
        setCompaniesList(companies);
        const preferredCompanyId =
          (userRes?.activeCompanyId && companies.some((c) => c.id === userRes.activeCompanyId) && userRes.activeCompanyId) ||
          (savedCompanyId && companies.some((c) => c.id === savedCompanyId) && savedCompanyId) ||
          currentCompany?.id ||
          companies[0].id;

        const activeCo = companies.find((c) => c.id === preferredCompanyId) || companies[0];
        setCurrentCompany(activeCo);
        localStorage.setItem('truespace_current_company', JSON.stringify(activeCo));
        localStorage.setItem('truespace_company_id', activeCo.id);
        api.setActiveCompanyId(activeCo.id);

        // Fetch company members for this company
        if (activeCo) {
          const members = await api.getCompanyMembers(activeCo.id).catch(() => []);
          setCompanyMembers(members);
        }
      }
    } catch (err) {
      console.warn('[AuthContext] Could not fetch server auth, operating in local offline mode:', err);
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshAuthData();
    }
  }, [isAuthenticated, refreshAuthData]);

  const login = useCallback(async (email: string, password?: string) => {
    const res = await api.login({ email, password });
    if (res.user) {
      setCurrentUser(res.user);
      setIsAuthenticated(true);
      localStorage.setItem('truespace_logged_in', 'true');
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
      localStorage.setItem('truespace_logged_in', 'true');
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

  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
    localStorage.setItem('truespace_logged_in', 'false');
    localStorage.removeItem('truespace_current_user');
    localStorage.removeItem('truespace_user_id');
    localStorage.removeItem('truespace_current_company');
    localStorage.removeItem('truespace_company_id');
    setIsAuthenticated(false);
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
        isAdminModalOpen,
        setAdminModalOpen,
        login,
        register,
        logout,
        updateProfile,
        updateCompanyDetails,
        switchUser,
        switchCompany,
        createCompany,
        deleteCompany,
        inviteMember,
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
