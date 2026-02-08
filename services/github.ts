<<<<<<< HEAD

import { Repository, Branch, GitCommit } from '../types';

const GITHUB_API_URL = 'https://api.github.com';

/**
 * Encodes a URL component but preserves slashes for path-like strings if needed.
 * Here we encode each segment individually.
 */
const encodePathSegments = (path: string): string => {
  return path
    .split('/')
    .filter(segment => {
      const s = segment.trim();
      // GitHub API rejects path components that are empty, '.', or '..'
      return s.length > 0 && s !== '.' && s !== '..';
    })
    .map(segment => encodeURIComponent(segment))
    .join('/');
};

export const fetchUserRepositories = async (token: string): Promise<Repository[]> => {
  const response = await fetch(`${GITHUB_API_URL}/user/repos?per_page=100&sort=updated`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!response.ok) throw new Error('Failed to fetch repositories. Check your token.');
  return response.json();
};

export const checkRepository = async (token: string, owner: string, repo: string): Promise<boolean> => {
  const response = await fetch(`${GITHUB_API_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  return response.ok;
};

export const fetchRepositoryBranches = async (token: string, owner: string, repo: string): Promise<Branch[]> => {
  const response = await fetch(`${GITHUB_API_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!response.ok) throw new Error('Failed to fetch branches.');
  return response.json();
};

export const createBranch = async (
  token: string,
  owner: string,
  repo: string,
  newBranchName: string,
  sourceSha: string
): Promise<any> => {
  const response = await fetch(`${GITHUB_API_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ref: `refs/heads/${newBranchName}`,
      sha: sourceSha
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create new branch');
  }
  return response.json();
};

export const fetchRepositoryCommits = async (
  token: string,
  owner: string,
  repo: string,
  branch: string
): Promise<GitCommit[]> => {
  const response = await fetch(
    `${GITHUB_API_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?sha=${encodeURIComponent(branch)}&per_page=30`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );
  if (!response.ok) throw new Error('Failed to fetch commit history.');
  return response.json();
};

/**
 * Fetches the contents of a repository at a specific path and branch.
 */
export const fetchRepositoryContent = async (
  token: string,
  owner: string,
  repo: string,
  branch: string,
  path: string = ''
): Promise<any> => {
  const encodedPath = encodePathSegments(path);
  const url = `${GITHUB_API_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch contents' }));
    throw new Error(error.message || 'Failed to fetch repository contents');
  }
  return response.json();
};

export const pushFileContent = async (
  token: string,
  owner: string,
  repo: string,
  branch: string,
  path: string,
  contentBase64: string,
  message: string = 'Auto-sync from Git-AI Nexus'
): Promise<any> => {
  const encodedPath = encodePathSegments(path);
  const encodedOwner = encodeURIComponent(owner);
  const encodedRepo = encodeURIComponent(repo);
  const encodedBranch = encodeURIComponent(branch);

  if (!encodedPath) return;

  const getUrl = `${GITHUB_API_URL}/repos/${encodedOwner}/${encodedRepo}/contents/${encodedPath}?ref=${encodedBranch}`;
  let sha: string | undefined;
  
  try {
    const getRes = await fetch(getUrl, {
      headers: { 
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      }
    });
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
    }
  } catch (e) {}

  const putUrl = `${GITHUB_API_URL}/repos/${encodedOwner}/${encodedRepo}/contents/${encodedPath}`;
  const response = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      content: contentBase64,
      branch,
      sha
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || '推送文件失败');
  }
  return response.json();
};
=======

import { Repository, Branch } from '../types';

const GITHUB_API_URL = 'https://api.github.com';

export const fetchUserRepositories = async (token: string): Promise<Repository[]> => {
  const response = await fetch(`${GITHUB_API_URL}/user/repos?per_page=100&sort=updated`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!response.ok) throw new Error('Failed to fetch repositories. Check your token.');
  return response.json();
};

export const checkRepository = async (token: string, owner: string, repo: string): Promise<boolean> => {
  const response = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  return response.ok;
};

export const fetchRepositoryBranches = async (token: string, owner: string, repo: string): Promise<Branch[]> => {
  const response = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/branches`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!response.ok) throw new Error('Failed to fetch branches.');
  return response.json();
};

export const pushFileContent = async (
  token: string,
  owner: string,
  repo: string,
  branch: string,
  path: string,
  contentBase64: string,
  message: string = 'Auto-sync from Git-AI Nexus'
): Promise<any> => {
  // 关键修复：确保路径中的特殊字符（空格、中文、横杠）被正确编码
  const encodedPath = path.split('/').map(segment => encodeURIComponent(segment)).join('/');
  
  // 1. 获取当前文件 SHA（如果存在）
  const getUrl = `${GITHUB_API_URL}/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;
  let sha: string | undefined;
  
  try {
    const getRes = await fetch(getUrl, {
      headers: { 
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      }
    });
    
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
    } else if (getRes.status === 403) {
      const errorData = await getRes.json().catch(() => ({}));
      if (errorData.message?.includes('Resource not accessible')) {
        throw new Error('403_PERMISSION_DENIED');
      }
    }
    // 404 表示文件不存在，sha 保持为 undefined，这是正确的
  } catch (e: any) {
    if (e.message === '403_PERMISSION_DENIED') {
      throw new Error('权限冲突: 您的 Token 无法读取该仓库的内容。请确保 Token 拥有 "repo" 作用域 (Classic) 或 "Contents: Read & Write" 权限 (Fine-grained)。');
    }
  }

  // 2. 推送文件内容
  const putUrl = `${GITHUB_API_URL}/repos/${owner}/${repo}/contents/${encodedPath}`;
  const response = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      content: contentBase64,
      branch,
      sha
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('GitHub API Put Error:', error);
    
    if (response.status === 404) {
      throw new Error(`未找到仓库或分支: "${owner}/${repo}" (${branch})。请检查路径或 Token 是否有权查看该私有仓库。`);
    }
    if (response.status === 403 || response.status === 401) {
      if (error.message?.includes('Resource not accessible') || response.status === 403) {
        throw new Error('403_WRITE_DENIED');
      }
    }
    if (response.status === 409) {
      throw new Error(`同步冲突: 文件 "${path}" 的版本号已过期。请尝试手动刷新。`);
    }
    throw new Error(error.message || '推送文件失败');
  }
  return response.json();
};
>>>>>>> c200e9cf6f32689b7631b8949ad109b1a2e56e8b
