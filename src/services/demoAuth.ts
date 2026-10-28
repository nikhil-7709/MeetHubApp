/**
 * Demo authentication — works 100% offline, no Firebase needed.
 * Stores accounts in AsyncStorage so they persist across restarts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCOUNTS_KEY = 'meethub:demo:accounts';
const SESSION_KEY = 'meethub:demo:session';

export interface DemoUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  isDemoUser: true;
}

interface StoredAccount {
  uid: string;
  email: string;
  displayName: string;
  password: string; // plain-text demo only
}

function seedDefaultAccounts(): StoredAccount[] {
  return [
    {
      uid: 'demo-nikhil',
      email: 'vipnikhilpatil7709@gmail.com',
      displayName: 'Nikhil Patil',
      password: 'password123',
    },
    {
      uid: 'demo-alex',
      email: 'alex@meethub.com',
      displayName: 'Alex Demo',
      password: 'password123',
    },
  ];
}

async function loadAccounts(): Promise<StoredAccount[]> {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
    if (!raw) {
      const seeded = seedDefaultAccounts();
      await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const accounts = JSON.parse(raw) as StoredAccount[];
    // Repair any corrupted account with Guest_ back to real registered name
    let changed = false;
    for (const a of accounts) {
      if (a.email.toLowerCase() === 'vipnikhilpatil7709@gmail.com' && (/^guest/i.test(a.displayName) || !a.displayName)) {
        a.displayName = 'Nikhil Patil';
        changed = true;
      }
    }
    if (changed) {
      await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    }
    return accounts;
  } catch {
    return seedDefaultAccounts();
  }
}

async function saveAccounts(accounts: StoredAccount[]) {
  await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function makeUid(): string {
  return `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function demoRegister(name: string, email: string, password: string): Promise<DemoUser> {
  const accounts = await loadAccounts();
  const exists = accounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
  if (exists) throw new Error('An account with this email already exists.');
  const account: StoredAccount = {
    uid: makeUid(),
    email: email.trim().toLowerCase(),
    displayName: name.trim(),
    password,
  };
  accounts.push(account);
  await saveAccounts(accounts);
  const user: DemoUser = { uid: account.uid, email: account.email, displayName: account.displayName, photoURL: null, isDemoUser: true };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
}

export async function demoLogin(email: string, password: string): Promise<DemoUser> {
  let accounts = await loadAccounts();
  const cleanEmail = email.trim().toLowerCase();
  let account = accounts.find((a) => a.email.toLowerCase() === cleanEmail);

  // In demo mode: auto-create account on-the-fly if not registered yet
  if (!account) {
    const autoName = cleanEmail.split('@')[0].replace(/[._-]/g, ' ') || 'Demo User';
    account = {
      uid: makeUid(),
      email: cleanEmail,
      displayName: autoName,
      password: password || 'password123',
    };
    accounts = [...accounts, account];
    await saveAccounts(accounts);
  } else if (password && account.password !== password) {
    // In local demo mode, update password automatically so the user is never locked out
    account.password = password;
    await saveAccounts(accounts);
  }

  const user: DemoUser = { uid: account.uid, email: account.email, displayName: account.displayName, photoURL: null, isDemoUser: true };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
}

export async function demoLogout() {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function loadDemoSession(): Promise<DemoUser | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) {
      // Auto-restore default registered account if no active session
      const seeded = seedDefaultAccounts()[0];
      const defaultUser: DemoUser = {
        uid: seeded.uid,
        email: seeded.email,
        displayName: seeded.displayName,
        photoURL: null,
        isDemoUser: true,
      };
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(defaultUser));
      return defaultUser;
    }
    const user = JSON.parse(raw) as DemoUser;
    // Auto-repair corrupted Guest_ name back to registered name
    if (user.email.toLowerCase() === 'vipnikhilpatil7709@gmail.com' && (/^guest/i.test(user.displayName) || !user.displayName)) {
      user.displayName = 'Nikhil Patil';
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(user));
    }
    return user;
  } catch {
    return null;
  }
}

export async function demoUpdateDisplayName(uid: string, displayName: string): Promise<DemoUser> {
  const accounts = await loadAccounts();
  const idx = accounts.findIndex((a) => a.uid === uid);
  if (idx !== -1) {
    accounts[idx].displayName = displayName.trim();
    await saveAccounts(accounts);
  }
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  const user: DemoUser = raw ? { ...(JSON.parse(raw) as DemoUser), displayName: displayName.trim() } : { uid, email: '', displayName: displayName.trim(), photoURL: null, isDemoUser: true };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
}
