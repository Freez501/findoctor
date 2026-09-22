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
  register: (email: string, password?: string, fullName?: string, companyName?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (userId: string, data: Partial<UserProfile>) => Promise<void>;
  updateCompanyDetails: (companyId: string, data: Partial<Company>) => Promise<void>;
  switchUser: (userId: string) => Promise<void>;
  switchCompany: (companyId: string) => Promise<void>;
  createCompany: (name: string, slug?: string) => Promise<Company>;
  inviteMember: (email: string, role: UserRole, fullName?: string) => Promise<void>;
  refreshAuthData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('truespace_logged_in') !== 'false';
  });

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(INITIAL_USERS_SEED[0] as UserProfile);
  const [usersList, setUsersList] = useState<UserProfile[]>([...INITIAL_USERS_SEED]);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(INITIAL_COMPANIES_SEED[0] as Company);
  const [companiesList, setCompaniesList] = useState<Company[]>([...INITIAL_COMPANIES_SEED]);
  const [companyMembers, setCompanyMembers] = useState<{ membership: CompanyMembership; user?: UserProfile }[]>([]);
  const [isAdminModalOpen, setAdminModalOpen] = useState(false);

  const refreshAuthData = useCallback(async () => {
    try {
      const [userRes, users, companies] = await Promise.all([
        api.getCurrentUser().catch(() => null),
        api.getUsers().catch(() => [...INITIAL_USERS_SEED]),
        api.getCompanies().catch(() => [...INITIAL_COMPANIES_SEED]),
      ]);

      if (userRes?.user) {
        setCurrentUser(userRes.user);
      }
      if (users && users.length > 0) {
        setUsersList(users);
      }
      if (companies && companies.length > 0) {
        setCompaniesList(companies);
        const activeCo = companies.find((c) => c.id === currentCompany?.id) || companies[0];
        setCurrentCompany(activeCo);
        api.setActiveCompanyId(activeCo.id);

        // Fetch company members
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
      if (res.company) {
        setCurrentCompany(res.company);
        api.setActiveCompanyId(res.company.id);
      }
      await refreshAuthData();
    }
  }, [refreshAuthData]);

  const register = useCallback(async (email: string, password?: string, fullName?: string, companyName?: string) => {
    const res = await api.register({ email, password, fullName, companyName });
    if (res.user) {
      setCurrentUser(res.user);
      setIsAuthenticated(true);
      localStorage.setItem('truespace_logged_in', 'true');
      if (res.company) {
        setCurrentCompany(res.company);
        api.setActiveCompanyId(res.company.id);
      }
      await refreshAuthData();
    }
  }, [refreshAuthData]);

  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
    localStorage.setItem('truespace_logged_in', 'false');
    setIsAuthenticated(false);
    setCurrentUser(null);
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
      }
    } catch {
      const found = usersList.find((u) => u.id === userId);
      if (found) setCurrentUser(found);
    }
  }, [usersList]);

  const switchCompany = useCallback(async (companyId: string) => {
    const co = companiesList.find((c) => c.id === companyId);
    if (co) {
      setCurrentCompany(co);
      api.setActiveCompanyId(co.id);
      try {
        const members = await api.getCompanyMembers(co.id);
        setCompanyMembers(members);
      } catch {
        // keep current
      }
      window.location.reload();
    }
  }, [companiesList]);

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
        inviteMember,
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
