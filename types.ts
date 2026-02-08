
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
