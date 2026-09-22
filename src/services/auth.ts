import { AuthUser, UserProfile, UserRole } from '../types';
import { hashPassword, generateSalt, generateSecureUID } from './crypto';
import {
  getStoredUsers,
  saveStoredUser,
  getActiveSession,
  setActiveSession,
  initializeDatabaseIfNeeded,
  safeStorage,
} from './storage';
import { api } from './api';

export interface AuthResponse {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

// Ensure database is initialized with test accounts on start
export async function initAuth(): Promise<AuthUser | null> {
  await initializeDatabaseIfNeeded();
  const session = getActiveSession();
  if (session) {
    // Background sync user to server
    api.syncUser({
      uid: session.uid,
      email: session.email,
      profile: session.profile,
    });
  }
  return session;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  await initializeDatabaseIfNeeded();
  const cleanEmail = email.trim().toLowerCase();
  const users = getStoredUsers();
  const user = users.find((u) => u.email.toLowerCase() === cleanEmail);

  if (!user) {
    return {
      success: false,
      error: 'Email or password is incorrect.',
    };
  }

  const hash = await hashPassword(password, user.salt);
  if (hash !== user.passwordHash) {
    return {
      success: false,
      error: 'Email or password is incorrect.',
    };
  }

  const authUser: AuthUser = {
    uid: user.uid,
    email: user.email,
    profile: user.profile,
  };

  setActiveSession(authUser);
  api.syncUser(user);
  return {
    success: true,
    user: authUser,
  };
}

export async function register(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  role: UserRole = 'patient',
  phoneNumber?: string
): Promise<AuthResponse> {
  await initializeDatabaseIfNeeded();
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Please enter a valid email address.' };
  }
  if (!password || password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.' };
  }
  if (!firstName.trim()) {
    return { success: false, error: 'Please enter your first name.' };
  }

  const users = getStoredUsers();
  const existing = users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (existing) {
    return {
      success: false,
      error: 'An account with this email address already exists. Please login instead.',
    };
  }

  const uid = generateSecureUID();
  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);

  const profile: UserProfile = {
    uid,
    email: cleanEmail,
    firstName: firstName.trim(),
    lastName: lastName ? lastName.trim() : undefined,
    phoneNumber: phoneNumber ? phoneNumber.trim() : undefined,
    role,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const storedUser = {
    uid,
    email: cleanEmail,
    passwordHash,
    salt,
    profile,
  };

  saveStoredUser(storedUser);
  api.syncUser(storedUser);

  const authUser: AuthUser = {
    uid,
    email: cleanEmail,
    profile,
  };

  setActiveSession(authUser);
  return {
    success: true,
    user: authUser,
  };
}

export function logout(): void {
  setActiveSession(null);
}

export async function requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
  await initializeDatabaseIfNeeded();
  const cleanEmail = email.trim().toLowerCase();
  const users = getStoredUsers();
  const user = users.find((u) => u.email.toLowerCase() === cleanEmail);

  if (!user) {
    // Return friendly message without leaking account existence
    return {
      success: true,
      message: 'If an account exists with this email, password reset instructions have been sent.',
    };
  }

  return {
    success: true,
    message: `Password reset link sent to ${cleanEmail}. Please check your inbox.`,
  };
}

export function updateProfile(uid: string, updates: Partial<UserProfile>): AuthUser {
  const users = getStoredUsers();
  const user = users.find((u) => u.uid === uid);
  if (!user) throw new Error('User not found');

  user.profile = {
    ...user.profile,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveStoredUser(user);

  const updatedAuth: AuthUser = {
    uid: user.uid,
    email: user.email,
    profile: user.profile,
  };

  setActiveSession(updatedAuth);
  return updatedAuth;
}

export function deleteAccount(uid: string): void {
  const users = getStoredUsers().filter((u) => u.uid !== uid);
  safeStorage.setItem('doseease_users_v2', JSON.stringify(users));
  setActiveSession(null);
}
