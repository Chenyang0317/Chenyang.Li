/**
 * Platform Storage SDK
 * 
 * 统一的存储接口，自动适配运行环境：
 * - 部署在平台上：使用平台 Storage API（数据跟随用户）
 * - ai studio中开发：使用 localStorage（数据存在浏览器）
 */

import { supabase } from './supabase';

/** 用户信息 */
export interface UserInfo {
  id: string
  name?: string
}

/**
 * 检测是否运行在平台上（通过 Cookie）
 * 可独立使用，无需初始化 Storage
 */
export function checkIsOnPlatform(): boolean {
  return document.cookie.includes('X-Platform=1')
}

class PlatformStorage {
  private _isOnPlatform: boolean | null = null
  private _user: UserInfo | null = null
  private readonly localPrefix: string
  private initPromise: Promise<void> | null = null

  constructor() {
    this.localPrefix = '__ps__:'
    
    // Listen for auth changes to reset the initialization state
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        this.initPromise = null;
        this._isOnPlatform = null;
        this._user = null;
      }
    });
  }

  /** 初始化（检测运行环境） */
  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise
    this.initPromise = this._detect()
    return this.initPromise
  }

  private async _detect(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    
    if (user) {
      this._isOnPlatform = false; // Supabase is not the AI Studio platform storage
      this._user = { id: user.id, name: user.user_metadata?.name || user.email };
      return;
    }

    if (!checkIsOnPlatform()) {
      this._isOnPlatform = false
      this._user = { id: 'local-user', name: '本地用户' }
      return
    }

    try {
      const res = await fetch('/api/storage/user', { credentials: 'include' })
      
      if (res.ok) {
        const text = await res.text();
        try {
          this._user = JSON.parse(text);
          this._isOnPlatform = true;
        } catch (e) {
          console.warn("[storage.init] Invalid user JSON:", text.slice(0, 50));
          this._isOnPlatform = false;
          this._user = { id: 'local-user', name: '本地用户' };
        }
      } else if (res.status === 401) {
        this._isOnPlatform = true
        this._user = null
      } else {
        this._isOnPlatform = false
        this._user = { id: 'local-user', name: '本地用户' }
      }
    } catch {
      this._isOnPlatform = false
      this._user = { id: 'local-user', name: '本地用户' }
    }
  }

  private async ensureInit(): Promise<void> {
    if (this._isOnPlatform === null) {
      await this.init()
    }
  }

  /** 获取加上用户隔离前缀的key */
  private _getScopedKey(key: string): string {
    const isLocalUser = !this._user || this._user.id === 'local-user';
    const scope = isLocalUser ? '' : `${this._user.id}:`;
    return this.localPrefix + scope + key;
  }

  /** 是否运行在平台上 */
  async isOnPlatform(): Promise<boolean> {
    await this.ensureInit()
    return this._isOnPlatform!
  }

  /** 获取当前用户 */
  async getUser(): Promise<UserInfo | null> {
    await this.ensureInit()
    return this._user
  }

  /** 获取数据 */
  async get<T = unknown>(key: string): Promise<T | null> {
    await this.ensureInit()

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    
    // Attempt to load from Supabase if logged in (if user_data table exists)
    if (user && key !== 'tikhub_api_key' && key !== 'atypica_api_key' && key !== 'bocha_api_key' && key !== 'feishu_webhook_url') {
      const { data, error } = await supabase
        .from('user_data')
        .select('value')
        .eq('user_id', user.id)
        .eq('key', key)
        .single();
      
      console.log(`[storage.get] Supabase fetch for ${key}:`, { data, error, userId: user.id });
      if (data && !error) return data.value as T;
      // If error, it might be table doesn't exist, we silently fall back to localStorage
    }

    if (!this._isOnPlatform || key === 'tikhub_api_key' || key === 'atypica_api_key' || key === 'bocha_api_key' || key === 'feishu_webhook_url') {
      // Find scoped key
      const scopedKey = this._getScopedKey(key);
      const data = localStorage.getItem(scopedKey);
      if (data) {
        try {
           return JSON.parse(data);
        } catch (e) {
           console.error(`Failed to parse scoped local storage data for key ${key}:`, e);
        }
      }
      
      // Fallback to legacy global key to migrate old data if it exists
      const oldData = localStorage.getItem(this.localPrefix + key);
      if (oldData) {
        try {
          const parsed = JSON.parse(oldData);
          // Save it to the scoped key to migrate it
          localStorage.setItem(scopedKey, oldData);
          return parsed;
        } catch (e) {
             console.error(`Failed to parse legacy local storage data for key ${key}:`, e);
        }
      }
      return null;
    }

    try {
      const res = await fetch(`/api/storage?key=${encodeURIComponent(key)}`, {
        credentials: 'include'
      })
      if (!res.ok) return null
      
      const text = await res.text();
      try {
          return JSON.parse(text).value;
      } catch (e) {
          console.warn(`[storage.get] Invalid JSON from platform API for key ${key}:`, text.slice(0, 50));
          return null;
      }
    } catch {
      return null
    }
  }

  /** 存储数据 */
  async set<T = unknown>(key: string, value: T): Promise<boolean> {
    await this.ensureInit()

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    let cloudSuccess = false;

    if (user && key !== 'tikhub_api_key' && key !== 'atypica_api_key' && key !== 'bocha_api_key' && key !== 'feishu_webhook_url') {
      const { error } = await supabase
        .from('user_data')
        .upsert(
          { user_id: user.id, key, value },
          { onConflict: 'user_id,key' }
        );
      if (!error) cloudSuccess = true;
      else console.error("Supabase upsert error:", error);
    }

    if (!this._isOnPlatform || key === 'tikhub_api_key' || key === 'atypica_api_key' || key === 'bocha_api_key' || key === 'feishu_webhook_url') {
      try {
        const scopedKey = this._getScopedKey(key);
        localStorage.setItem(scopedKey, JSON.stringify(value))
        return true
      } catch {
        return cloudSuccess
      }
    }

    try {
      const res = await fetch('/api/storage', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      })
      return res.ok || cloudSuccess
    } catch {
      return cloudSuccess
    }
  }

  /** 删除数据 */
  async delete(key: string): Promise<boolean> {
    await this.ensureInit()
    
    let dbSuccess = false;
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    
    if (user) {
      const { error } = await supabase
        .from('user_data')
        .delete()
        .eq('user_id', user.id)
        .eq('key', key);
      dbSuccess = !error;
    }

    if (!this._isOnPlatform || key === 'tikhub_api_key' || key === 'atypica_api_key' || key === 'bocha_api_key' || key === 'feishu_webhook_url') {
      const scopedKey = this._getScopedKey(key);
      localStorage.removeItem(scopedKey);
      // also remove global key just in case
      localStorage.removeItem(this.localPrefix + key);
      return true
    }

    try {
      const res = await fetch(`/api/storage?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      return res.ok || dbSuccess
    } catch {
      return dbSuccess
    }
  }

  /** 检查键是否存在 */
  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null
  }

  /** 获取所有键名 */
  async keys(prefix?: string): Promise<string[]> {
    await this.ensureInit()

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    
    let dbKeys: string[] = [];
    if (user) {
      let query = supabase.from('user_data').select('key').eq('user_id', user.id);
      if (prefix) {
        query = query.like('key', `${prefix}%`);
      }
      const { data, error } = await query;
      if (data && !error) {
        dbKeys = data.map(d => d.key);
      }
    }

    if (!this._isOnPlatform) {
      const result: string[] = [...dbKeys];
      
      const isLocalUser = !this._user || this._user.id === 'local-user';
      const scope = isLocalUser ? '' : `${this._user.id}:`;
      const searchPrefix = this.localPrefix + scope + (prefix ?? '');
      
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k?.startsWith(searchPrefix)) {
          const actualKey = k.slice(this.localPrefix.length + scope.length);
          if (!result.includes(actualKey)) {
            result.push(actualKey);
          }
        }
      }
      return result
    }

    try {
      const url = prefix 
        ? `/api/storage/keys?prefix=${encodeURIComponent(prefix)}`
        : '/api/storage/keys'
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) return dbKeys
      const text = await res.text();
      let apiKeys: string[] = [];
      try {
        apiKeys = JSON.parse(text).keys ?? [];
      } catch (e) {
        console.warn('[storage.keys] Invalid JSON from platform API:', text.slice(0, 50));
      }
      const combined = new Set([...dbKeys, ...apiKeys]);
      return Array.from(combined);
    } catch {
      return dbKeys
    }
  }

  /** 清除所有数据（仅本地模式） */
  async clear(): Promise<boolean> {
    await this.ensureInit()

    if (this._isOnPlatform) return false

    const isLocalUser = !this._user || this._user.id === 'local-user';
    const scope = isLocalUser ? '' : `${this._user.id}:`;
    const searchPrefix = this.localPrefix + scope;

    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(searchPrefix)) {
        keysToRemove.push(k)
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k))
    return true
  }
}

export const storage = new PlatformStorage()
