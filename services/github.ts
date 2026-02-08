
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

export const fetchRepositoryContents = async (token: string, owner: string, repo: string, branch: string = '', path: string = ''): Promise<any[]> => {
  const url = `${GITHUB_API_URL}/repos/${owner}/${repo}/contents/${path}${branch ? `?ref=${branch}` : ''}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!response.ok) return [];
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
  // First, we need to get the current file SHA if it exists (to update)
  const getUrl = `${GITHUB_API_URL}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
  let sha: string | undefined;
  
  try {
    const getRes = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
    }
  } catch (e) {
    // File likely doesn't exist, which is fine for a new create
  }

  const putUrl = `${GITHUB_API_URL}/repos/${owner}/${repo}/contents/${path}`;
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
    throw new Error(error.message || 'Failed to push file');
  }
  return response.json();
};
