
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
