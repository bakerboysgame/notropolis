import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// SecureStore doesn't work on web, so we fall back to localStorage
const isWeb = Platform.OS === 'web';

export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (isWeb) {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (isWeb) {
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },

  async removeItem(key: string): Promise<void> {
    if (isWeb) {
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

// Convenience methods for auth token
export const tokenStorage = {
  async getToken(): Promise<string | null> {
    return storage.getItem('auth_token');
  },

  async setToken(token: string): Promise<void> {
    return storage.setItem('auth_token', token);
  },

  async clearToken(): Promise<void> {
    return storage.removeItem('auth_token');
  },
};
