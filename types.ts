<<<<<<< HEAD

export interface GithubConfig {
  token: string;
  owner: string;
  username: string;
}

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  html_url: string;
  description: string;
  updated_at: string;
}

export interface Branch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
}

export interface GitCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      date: string;
    };
    message: string;
  };
  author: {
    avatar_url: string;
    login: string;
  } | null;
}

export interface MonitoredFolder {
  id: string;
  name: string;
  handle?: FileSystemDirectoryHandle;
  files?: File[];
  owner: string;
  repo: string;
  branch: string;
  status: 'active' | 'syncing' | 'error' | 'permission-required';
  lastSync: string;
  lastSyncTimestamp?: number;
  syncInterval: number;
}

export interface SyncLog {
  id: string;
  folderName: string;
  fileName: string;
  branch: string;
  time: string;
  type: 'push' | 'detect' | 'manual';
  status: 'success' | 'fail';
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  files?: Array<{ name: string; type: string; data: string }>;
}
=======

export interface GithubConfig {
  token: string;
  owner: string;
  username: string;
}

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  html_url: string;
  description: string;
  updated_at: string;
}

export interface Branch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
}

export interface MonitoredFolder {
  id: string;
  name: string;
  handle?: FileSystemDirectoryHandle; // Optional for modern browsers
  files?: File[]; // Fallback for restricted environments (iframes)
  owner: string;
  repo: string;
  branch: string;
  status: 'active' | 'syncing' | 'error' | 'permission-required';
  lastSync: string;
  lastSyncTimestamp?: number; // 用于逻辑判断的时间戳
  syncInterval: number; // 同步间隔（分钟），0 表示关闭自动同步
}

export interface SyncLog {
  id: string;
  folderName: string;
  fileName: string;
  time: string;
  type: 'push' | 'detect';
  status: 'success' | 'fail';
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  files?: Array<{ name: string; type: string; data: string }>;
}
>>>>>>> c200e9cf6f32689b7631b8949ad109b1a2e56e8b
