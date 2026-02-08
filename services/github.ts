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
