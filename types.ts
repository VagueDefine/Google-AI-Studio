
export interface GithubConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}

export interface Repository {
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
  default_branch: string;
}

export interface Branch {
  name: string;
}

export interface MonitoredProject {
  id: string;
  localName: string;
  owner: string;
  repo: string;
  branch: string;
  lastSync: string;
  status: 'idle' | 'syncing' | 'error';
  fileCount: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  files?: Array<{
    name: string;
    type: string;
    data: string; // base64
  }>;
}
