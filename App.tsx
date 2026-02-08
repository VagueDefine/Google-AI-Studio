<<<<<<< HEAD

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GithubConfig, MonitoredFolder, SyncLog, ChatMessage, Branch, GitCommit } from './types';
import { fetchUserRepositories, pushFileContent, checkRepository, fetchRepositoryBranches, fetchRepositoryCommits, createBranch, fetchRepositoryContent } from './services/github';
import { generateAiResponse } from './services/gemini';
import { 
  Github, 
  Home, 
  FolderSearch, 
  Activity, 
  MessageSquare, 
  Plus, 
  RefreshCw, 
  ChevronRight, 
  LogOut,
  Send,
  Loader2,
  Lock,
  FileText,
  Upload,
  X,
  Edit2,
  ShieldAlert,
  Terminal,
  GitBranch,
  Key,
  Timer,
  History,
  User,
  File as FileIcon,
  Image as ImageIcon,
  PlusCircle,
  Folder,
  ChevronLeft,
  Save,
  PenTool,
  FilePlus,
  ArrowRight
} from 'lucide-react';

const App: React.FC = () => {
  const folderInputRef = useRef<HTMLInputElement>(null);
  
  // --- Auth State ---
  const [auth, setAuth] = useState<GithubConfig | null>(() => {
    const saved = localStorage.getItem('gh-nexus-auth');
    return saved ? JSON.parse(saved) : null;
  });
  const [tokenInput, setTokenInput] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // --- App State ---
  const [activeTab, setActiveTab] = useState<'home' | 'folders' | 'activity' | 'chat'>('home');
  const [folders, setFolders] = useState<MonitoredFolder[]>(() => {
    const saved = localStorage.getItem('gh-nexus-folders');
    return saved ? JSON.parse(saved) : [];
  });
  
  const foldersRef = useRef<MonitoredFolder[]>(folders);
  useEffect(() => {
    foldersRef.current = folders;
    localStorage.setItem('gh-nexus-folders', JSON.stringify(folders));
  }, [folders]);

  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const isScanningRef = useRef(false);

  // --- Modal State ---
  const [pendingFolder, setPendingFolder] = useState<{
    name: string;
    handle?: FileSystemDirectoryHandle;
    files?: File[];
    owner: string;
    repo: string;
    branch: string;
    isCreatingNewBranch: boolean;
    availableBranches: Branch[];
    isLoadingBranches: boolean;
  } | null>(null);
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // --- Manual File Edit State ---
  const [isEditingFile, setIsEditingFile] = useState(false);
  const [editFileConfig, setEditFileConfig] = useState({
    folderId: '',
    fileName: '',
    content: '',
    isNew: true
  });
  const [isSavingFile, setIsSavingFile] = useState(false);

  // --- Commit History State ---
  const [historyFolder, setHistoryFolder] = useState<MonitoredFolder | null>(null);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // --- File Browser State ---
  const [browserFolder, setBrowserFolder] = useState<MonitoredFolder | null>(null);
  const [browserPath, setBrowserPath] = useState<string>('');
  const [browserContents, setBrowserContents] = useState<any[]>([]);
  const [isLoadingBrowser, setIsLoadingBrowser] = useState(false);
  const [viewingFile, setViewingFile] = useState<{ name: string; content: string; type: string; path: string } | null>(null);

  // --- AI State ---
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const stringToBase64 = (str: string): string => {
    return btoa(unescape(encodeURIComponent(str)));
  };

  const verifyPermission = async (handle: FileSystemDirectoryHandle, withRequest: boolean = false) => {
    try {
      const options = { mode: 'read' as const };
      // @ts-ignore
      let currentStatus = await handle.queryPermission(options);
      if (currentStatus === 'prompt' && withRequest) {
        // @ts-ignore
        currentStatus = await handle.requestPermission(options);
      }
      return currentStatus === 'granted';
    } catch (e) {
      return false;
    }
  };

  const handleLogin = async () => {
    if (!tokenInput) return;
    setIsLoggingIn(true);
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${tokenInput}` }
      });
      if (!response.ok) throw new Error('登录失败');
      const userData = await response.json();
      const newAuth = {
        token: tokenInput,
        owner: userData.login,
        username: userData.name || userData.login
      };
      setAuth(newAuth);
      localStorage.setItem('gh-nexus-auth', JSON.stringify(newAuth));
    } catch (err: any) {
      alert(`登录失败: ${err.message}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    if (confirm('确定要退出当前账户并清除 Token 吗？')) {
      setAuth(null);
      localStorage.removeItem('gh-nexus-auth');
      setFolders([]);
    }
  };

  const refreshBranches = async (owner: string, repo: string) => {
    if (!auth || !pendingFolder) return;
    setPendingFolder(prev => prev ? { ...prev, isLoadingBranches: true } : null);
    try {
      const branches = await fetchRepositoryBranches(auth.token, owner, repo);
      setPendingFolder(prev => prev ? { 
        ...prev, 
        availableBranches: branches, 
        branch: branches.some(b => b.name === 'main') ? 'main' : (branches[0]?.name || 'main'),
        isLoadingBranches: false 
      } : null);
    } catch (e) {
      setPendingFolder(prev => prev ? { ...prev, isLoadingBranches: false, availableBranches: [] } : null);
    }
  };

  const updateFolderInterval = (id: string, interval: number) => {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, syncInterval: interval } : f));
  };

  const syncFile = async (folder: MonitoredFolder, file: File, relativePath: string) => {
    if (!auth) return;
    let base64Content = '';
    try {
      const buffer = await file.arrayBuffer();
      base64Content = arrayBufferToBase64(buffer);
    } catch (e: any) {
      throw e; 
    }
    try {
      await pushFileContent(auth.token, folder.owner, folder.repo, folder.branch, relativePath, base64Content);
      setLogs(prev => [{
        id: Math.random().toString(36).substr(2, 9),
        folderName: folder.name,
        fileName: relativePath,
        branch: folder.branch,
        time: new Date().toLocaleTimeString(),
        type: 'push' as const,
        status: 'success' as const
      }, ...prev].slice(0, 50));
    } catch (err: any) {
      setLogs(prev => [{
        id: Math.random().toString(36).substr(2, 9),
        folderName: folder.name,
        fileName: relativePath,
        branch: folder.branch,
        time: new Date().toLocaleTimeString(),
        type: 'push' as const,
        status: 'fail' as const
      }, ...prev].slice(0, 50));
      throw err;
    }
  };

  const handleManualSave = async () => {
    const folder = folders.find(f => f.id === editFileConfig.folderId);
    if (!auth || !folder || !editFileConfig.fileName.trim()) return;

    setIsSavingFile(true);
    try {
      const base64 = stringToBase64(editFileConfig.content);
      await pushFileContent(
        auth.token,
        folder.owner,
        folder.repo,
        folder.branch,
        editFileConfig.fileName,
        base64,
        `Nexus Manual ${editFileConfig.isNew ? 'Create' : 'Edit'}: ${new Date().toLocaleString()}`
      );

      setLogs(prev => [{
        id: Math.random().toString(36).substr(2, 9),
        folderName: folder.name,
        fileName: editFileConfig.fileName,
        branch: folder.branch,
        time: new Date().toLocaleTimeString(),
        type: 'manual' as const,
        status: 'success' as const
      }, ...prev].slice(0, 50));

      setIsEditingFile(false);
      setEditFileConfig({ folderId: '', fileName: '', content: '', isNew: true });
      alert('保存成功！推送到分支: ' + folder.branch);
    } catch (err: any) {
      alert(`保存失败: ${err.message}`);
    } finally {
      setIsSavingFile(false);
    }
  };

  const syncSingleFolder = useCallback(async (folderId: string, isUserTriggered: boolean = false) => {
    const folder = foldersRef.current.find(f => f.id === folderId);
    if (!folder || !auth) return;
    try {
      setFolders(prev => prev.map(f => f.id === folderId ? { ...f, status: 'syncing' } : f));
      if (folder.handle) {
        const hasPermission = await verifyPermission(folder.handle, isUserTriggered);
        if (!hasPermission) {
          setFolders(prev => prev.map(f => f.id === folderId ? { ...f, status: 'permission-required' } : f));
          return;
        }
        const traverseDirectory = async (directoryHandle: FileSystemDirectoryHandle, currentPath: string = '') => {
          // @ts-ignore
          for await (const entry of directoryHandle.values()) {
            const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
            const name = entry.name.toLowerCase();
            if (name === '.git' || name === 'node_modules' || name === '.ds_store' || name === 'desktop.ini' || name === 'thumbs.db') continue;
            if (entry.kind === 'file') {
              const file = await (entry as FileSystemFileHandle).getFile();
              await syncFile(folder, file, entryPath);
            } else if (entry.kind === 'directory') {
              await traverseDirectory(entry as FileSystemDirectoryHandle, entryPath);
            }
          }
        };
        await traverseDirectory(folder.handle);
      } else if (folder.files) {
        for (const file of folder.files) {
          const fullPath = (file as any).webkitRelativePath || file.name;
          const parts = fullPath.split('/');
          const isIgnored = parts.some(part => {
            const p = part.toLowerCase();
            return p === '.git' || p === 'node_modules' || p === '.ds_store' || p === 'desktop.ini';
          });
          if (isIgnored) continue;
          if (parts.length > 1) {
            const relativePath = parts.slice(1).join('/');
            await syncFile(folder, file, relativePath);
          }
        }
      }
      setFolders(prev => prev.map(f => f.id === folderId ? { ...f, status: 'active', lastSync: new Date().toLocaleTimeString(), lastSyncTimestamp: Date.now() } : f));
    } catch (err: any) {
      setFolders(prev => prev.map(f => f.id === folderId ? { ...f, status: 'error' } : f));
    }
  }, [auth]);

  const scanAndSync = useCallback(async (force: boolean = false) => {
    if (foldersRef.current.length === 0 || isScanningRef.current || !auth) return;
    isScanningRef.current = true;
    setIsScanning(true);
    const now = Date.now();
    for (const folder of foldersRef.current) {
      const shouldSync = force || (folder.syncInterval > 0 && (!folder.lastSyncTimestamp || (now - folder.lastSyncTimestamp >= folder.syncInterval * 60 * 1000)));
      if (shouldSync && (folder.status === 'active' || folder.status === 'error' || folder.status === 'permission-required')) {
        await syncSingleFolder(folder.id, force);
      }
    }
    isScanningRef.current = false;
    setIsScanning(false);
  }, [auth, syncSingleFolder]);

  const openHistory = async (folder: MonitoredFolder) => {
    if (!auth) return;
    setHistoryFolder(folder);
    setIsLoadingHistory(true);
    setCommits([]);
    try {
      const history = await fetchRepositoryCommits(auth.token, folder.owner, folder.repo, folder.branch);
      setCommits(history);
    } catch (e: any) {
      alert('无法获取提交历史: ' + e.message);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const openBrowser = async (folder: MonitoredFolder, path: string = '') => {
    if (!auth) return;
    setBrowserFolder(folder);
    setBrowserPath(path);
    setIsLoadingBrowser(true);
    setViewingFile(null);
    try {
      const contents = await fetchRepositoryContent(auth.token, folder.owner, folder.repo, folder.branch, path);
      setBrowserContents(Array.isArray(contents) ? contents : [contents]);
    } catch (e: any) {
      alert('无法获取仓库内容: ' + e.message);
    } finally {
      setIsLoadingBrowser(false);
    }
  };

  const handleFileClick = async (item: any) => {
    if (!auth || !browserFolder) return;
    if (item.type === 'dir') {
      openBrowser(browserFolder, item.path);
    } else {
      setIsLoadingBrowser(true);
      try {
        const fileData = await fetchRepositoryContent(auth.token, browserFolder.owner, browserFolder.repo, browserFolder.branch, item.path);
        const decodedContent = decodeURIComponent(escape(atob(fileData.content.replace(/\n/g, ''))));
        setViewingFile({ name: item.name, content: decodedContent, type: item.name.split('.').pop() || 'text', path: item.path });
      } catch (e: any) {
        alert('无法读取文件内容: ' + e.message);
      } finally {
        setIsLoadingBrowser(false);
      }
    }
  };

  const triggerFolderPicker = () => {
    if (window.self === window.top && 'showDirectoryPicker' in window) {
      addFolderWithPicker();
    } else {
      folderInputRef.current?.click();
    }
  };

  const addFolderWithPicker = async () => {
    try {
      // @ts-ignore
      const handle = await window.showDirectoryPicker();
      await prepareFolder(handle.name, handle, undefined);
    } catch (err: any) {
      if (err.name === 'SecurityError') folderInputRef.current?.click();
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    const folderName = (fileArray[0] as any).webkitRelativePath?.split('/')[0] || "New Project";
    await prepareFolder(folderName, undefined, fileArray);
    e.target.value = '';
  };

  const prepareFolder = async (name: string, handle?: FileSystemDirectoryHandle, files?: File[]) => {
    if (!auth) return;
    let repoInfo = { owner: auth.owner, repo: name, branch: 'main' };
    const extractGitInfo = (text: string) => {
      const match = text.match(/url\s*=\s*(?:https:\/\/github\.com\/|git@github\.com:)([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)/i);
      if (match) {
        let owner = match[1];
        let repo = match[2];
        if (repo.endsWith('.git')) repo = repo.slice(0, -4);
        return { owner, repo };
      }
      return null;
    };
    if (files) {
      const gitConfigFile = files.find(f => (f as any).webkitRelativePath?.endsWith('.git/config'));
      if (gitConfigFile) {
        const text = await gitConfigFile.text();
        const info = extractGitInfo(text);
        if (info) { repoInfo.owner = info.owner; repoInfo.repo = info.repo; }
      }
    } else if (handle) {
      try {
        const gitFolder = await handle.getDirectoryHandle('.git');
        const configFile = await gitFolder.getFileHandle('config');
        const file = await configFile.getFile();
        const text = await file.text();
        const info = extractGitInfo(text);
        if (info) { repoInfo.owner = info.owner; repoInfo.repo = info.repo; }
      } catch (e) {}
    }
    setPendingFolder({
      name, handle, files,
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      branch: repoInfo.branch,
      isCreatingNewBranch: false,
      availableBranches: [],
      isLoadingBranches: true
    });
    try {
      const branches = await fetchRepositoryBranches(auth.token, repoInfo.owner, repoInfo.repo);
      setPendingFolder(prev => prev ? { 
        ...prev, 
        availableBranches: branches, 
        branch: branches.some(b => b.name === 'main') ? 'main' : (branches[0]?.name || 'main'),
        isLoadingBranches: false 
      } : null);
    } catch (e) {
      setPendingFolder(prev => prev ? { ...prev, isLoadingBranches: false } : null);
    }
  };

  const confirmPendingFolder = async () => {
    if (!auth || !pendingFolder) return;
    setIsConfirming(true);
    try {
      const exists = await checkRepository(auth.token, pendingFolder.owner, pendingFolder.repo);
      if (!exists) throw new Error('Repository not found');

      let finalBranch = pendingFolder.branch;
      if (pendingFolder.isCreatingNewBranch) {
        const sourceBranch = pendingFolder.availableBranches.find(b => b.name !== pendingFolder.branch) || pendingFolder.availableBranches[0];
        if (!sourceBranch) throw new Error('No source branch found to create new branch from');
        await createBranch(auth.token, pendingFolder.owner, pendingFolder.repo, pendingFolder.branch, sourceBranch.commit.sha);
        finalBranch = pendingFolder.branch;
      }

      const newFolder: MonitoredFolder = {
        id: Math.random().toString(36).substr(2, 9),
        name: pendingFolder.name,
        handle: pendingFolder.handle,
        files: pendingFolder.files,
        owner: pendingFolder.owner,
        repo: pendingFolder.repo,
        branch: finalBranch,
        status: 'active',
        lastSync: '从未同步',
        syncInterval: 5 
      };
      setFolders(prev => [...prev, newFolder]);
      setPendingFolder(null);
    } catch (err: any) {
      alert(`确认失败: ${err.message}`);
    } finally {
      setIsConfirming(false);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => scanAndSync(false), 30000);
    return () => clearInterval(timer);
  }, [scanAndSync]);

  const handleChat = async () => {
    if (!chatInput.trim() || isTyping) return;
    const userMsg = { role: 'user' as const, text: chatInput };
    setMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsTyping(true);
    try {
      const response = await generateAiResponse(messages, chatInput);
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'model', text: 'AI 连接失败' }]);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const getStatusDisplay = (status: MonitoredFolder['status']) => {
    switch (status) {
      case 'syncing': return { text: '正在扫描文件...', color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' };
      case 'active': return { text: '实时监控中', color: 'text-green-500 bg-green-50 dark:bg-green-900/20' };
      case 'error': return { text: '配置错误', color: 'text-red-500 bg-red-50 dark:bg-red-900/20' };
      case 'permission-required': return { text: '授权已失效', color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20' };
      default: return { text: '待同步', color: 'text-zinc-500 bg-zinc-50 dark:bg-zinc-800' };
    }
  };

  if (!auth) {
    return (
      <div className="h-screen bg-[#24292f] flex flex-col items-center justify-center p-8 text-white">
        <div className="w-full max-w-sm space-y-10 animate-in fade-in zoom-in">
          <div className="text-center space-y-4">
            <Github className="w-20 h-20 mx-auto" />
            <h1 className="text-3xl font-bold tracking-tight">GitHub Nexus</h1>
            <p className="text-zinc-400 text-sm">连接本地项目，自动同步云端</p>
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input type="password" placeholder="GitHub Personal Access Token" className="w-full pl-12 pr-4 py-4 bg-zinc-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={tokenInput} onChange={e => setTokenInput(e.target.value)} />
              </div>
              <button onClick={handleLogin} disabled={isLoggingIn} className="w-full py-4 bg-white text-black rounded-2xl font-bold hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2">
                {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : '登录 GitHub 账号'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#f6f8fa] dark:bg-zinc-950 flex flex-col overflow-hidden pb-20 no-select">
      <input type="file" ref={folderInputRef} style={{ display: 'none' }} {...({ webkitdirectory: "", directory: "" } as any)} onChange={handleFileInputChange} />

      {/* Manual File Edit Modal */}
      {isEditingFile && (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex flex-col animate-in fade-in">
           <div className="bg-white dark:bg-zinc-900 flex-1 mt-10 mx-4 mb-24 rounded-[2.5rem] p-6 flex flex-col gap-6 overflow-hidden border border-white/10 shadow-2xl">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-xl flex items-center justify-center">
                    {editFileConfig.isNew ? <FilePlus className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
                  </div>
                  <h3 className="text-lg font-black uppercase tracking-tight">{editFileConfig.isNew ? '创建新想法' : '编辑文件'}</h3>
                </div>
                <button onClick={() => setIsEditingFile(false)} className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-zinc-400 ml-2">目标分支</label>
                  {editFileConfig.isNew ? (
                    <select 
                      className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none border border-transparent"
                      value={editFileConfig.folderId}
                      onChange={e => setEditFileConfig({...editFileConfig, folderId: e.target.value})}
                    >
                      <option value="" disabled>选择分支...</option>
                      {folders.map(f => (
                        <option key={f.id} value={f.id}>{f.name} ({f.branch})</option>
                      ))}
                    </select>
                  ) : (
                    <div className="w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl px-4 py-3 text-xs font-bold text-zinc-500">
                      项目: {folders.find(f => f.id === editFileConfig.folderId)?.name} | 分支: {folders.find(f => f.id === editFileConfig.folderId)?.branch}
                    </div>
                  )}
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-zinc-400 ml-2">文件名称 (含路径)</label>
                  <input 
                    className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none border border-transparent disabled:opacity-50" 
                    placeholder="例如: notes/daily.md"
                    value={editFileConfig.fileName}
                    disabled={!editFileConfig.isNew}
                    onChange={e => setEditFileConfig({...editFileConfig, fileName: e.target.value})}
                  />
                </div>

                <div className="flex-1 flex flex-col space-y-1 overflow-hidden">
                  <label className="text-[10px] font-black uppercase text-zinc-400 ml-2">文本内容</label>
                  <textarea 
                    className="flex-1 w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl px-5 py-4 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none border border-transparent resize-none leading-relaxed"
                    placeholder="输入或编辑内容..."
                    value={editFileConfig.content}
                    onChange={e => setEditFileConfig({...editFileConfig, content: e.target.value})}
                  />
                </div>
              </div>

              <button 
                onClick={handleManualSave}
                disabled={isSavingFile || !editFileConfig.folderId || !editFileConfig.fileName}
                className="w-full py-5 bg-blue-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all disabled:opacity-50"
              >
                {isSavingFile ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                同步到分支
              </button>
           </div>
        </div>
      )}

      {/* History Modal */}
      {historyFolder && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex flex-col animate-in slide-in-from-bottom">
           <div className="bg-white dark:bg-zinc-900 flex-1 mt-20 rounded-t-[3rem] p-6 flex flex-col gap-6 overflow-hidden">
             <div className="flex justify-between items-center px-2">
               <div><h3 className="text-lg font-black">{historyFolder.name}</h3><p className="text-[10px] text-zinc-400 uppercase tracking-widest">Git 提交历史 ({historyFolder.branch})</p></div>
               <button onClick={() => setHistoryFolder(null)} className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl"><X className="w-5 h-5" /></button>
             </div>
             <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 px-1 pb-10">
                {isLoadingHistory ? (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-400 gap-4"><Loader2 className="w-8 h-8 animate-spin" /><p className="text-xs font-bold">正在拉取历史记录...</p></div>
                ) : commits.length === 0 ? (
                  <div className="text-center py-20 text-zinc-400 text-xs">暂无历史提交记录</div>
                ) : commits.map(commit => (
                  <div key={commit.sha} className="bg-zinc-50 dark:bg-zinc-800/50 p-5 rounded-[2rem] border border-zinc-100 dark:border-zinc-800/50 flex flex-col gap-3">
                     <div className="flex items-start gap-3">
                        {commit.author?.avatar_url ? <img src={commit.author.avatar_url} className="w-8 h-8 rounded-full border border-white" alt="avatar" /> : <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center"><User className="w-4 h-4 text-zinc-500" /></div>}
                        <div className="flex-1 min-w-0"><p className="text-xs font-black truncate">{commit.commit.author.name}</p><p className="text-[9px] text-zinc-400 uppercase tracking-tight">{new Date(commit.commit.author.date).toLocaleString()}</p></div>
                        <div className="bg-white dark:bg-zinc-900 px-2 py-1 rounded-lg border border-zinc-100 dark:border-zinc-800 shadow-sm"><span className="text-[9px] font-mono text-zinc-400">{commit.sha.substring(0, 7)}</span></div>
                     </div>
                     <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300 font-medium whitespace-pre-wrap">{commit.commit.message}</p>
                  </div>
                ))}
             </div>
           </div>
        </div>
      )}

      {/* Browser Modal */}
      {browserFolder && (
        <div className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-md flex flex-col animate-in slide-in-from-bottom">
           <div className="bg-white dark:bg-zinc-900 flex-1 mt-20 rounded-t-[3rem] p-6 flex flex-col gap-6 overflow-hidden">
              <div className="flex justify-between items-center px-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-black truncate">{browserFolder.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <button 
                      onClick={() => {
                        if (browserPath.includes('/')) {
                          const parts = browserPath.split('/');
                          parts.pop();
                          openBrowser(browserFolder, parts.join('/'));
                        } else if (browserPath) {
                          openBrowser(browserFolder, '');
                        }
                      }}
                      disabled={!browserPath}
                      className="p-1 bg-zinc-100 dark:bg-zinc-800 rounded disabled:opacity-30"
                    >
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest truncate">/{browserPath || 'root'}</p>
                  </div>
                </div>
                <button onClick={() => setBrowserFolder(null)} className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl shrink-0"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar px-1 pb-10 space-y-1">
                {isLoadingBrowser ? (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-400 gap-4"><Loader2 className="w-8 h-8 animate-spin" /><p className="text-xs font-bold">读取中...</p></div>
                ) : viewingFile ? (
                  <div className="animate-in fade-in zoom-in-95 space-y-4">
                    <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-800 p-4 rounded-2xl border">
                      <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-blue-500" /><span className="text-xs font-bold">{viewingFile.name}</span></div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setEditFileConfig({
                              folderId: browserFolder.id,
                              fileName: viewingFile.path,
                              content: viewingFile.content,
                              isNew: false
                            });
                            setIsEditingFile(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase"
                        >
                          <Edit2 className="w-3 h-3" /> 编辑
                        </button>
                        <button onClick={() => setViewingFile(null)} className="text-[10px] font-black uppercase text-zinc-400 p-1.5">关闭</button>
                      </div>
                    </div>
                    <div className="bg-[#1e1e1e] text-zinc-300 p-6 rounded-[2rem] overflow-x-auto border border-zinc-800 shadow-inner">
                       <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed">{viewingFile.content}</pre>
                    </div>
                  </div>
                ) : browserContents.length === 0 ? (
                  <div className="text-center py-20 text-zinc-400 text-xs">空文件夹</div>
                ) : browserContents.map(item => (
                  <button 
                    key={item.sha} 
                    onClick={() => handleFileClick(item)}
                    className="w-full flex items-center gap-4 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors rounded-2xl group border border-transparent hover:border-zinc-100 dark:hover:border-zinc-700"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-active:scale-90 ${item.type === 'dir' ? 'bg-blue-50 text-blue-500' : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800'}`}>
                      {item.type === 'dir' ? <Folder className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-xs font-bold truncate">{item.name}</p>
                      <p className="text-[9px] text-zinc-400 uppercase tracking-tighter mt-0.5">{item.type === 'dir' ? 'Folder' : `${(item.size / 1024).toFixed(1)} KB`}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-blue-500" />
                  </button>
                ))}
              </div>
           </div>
        </div>
      )}

      {pendingFolder && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 w-full max-sm:w-full rounded-[2.5rem] p-8 space-y-6 my-auto max-w-sm">
            <h3 className="text-lg font-black uppercase text-center">确认仓库配置</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-zinc-400 ml-2">仓库所有者</label>
                <input className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={pendingFolder.owner} onChange={e => { const o = e.target.value; setPendingFolder({...pendingFolder, owner: o}); refreshBranches(o, pendingFolder.repo); }} placeholder="Owner" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-zinc-400 ml-2">仓库名称</label>
                <input className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={pendingFolder.repo} onChange={e => { const r = e.target.value; setPendingFolder({...pendingFolder, repo: r}); refreshBranches(pendingFolder.owner, r); }} placeholder="Repo" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center ml-2">
                  <label className="text-[10px] font-black uppercase text-zinc-400">{pendingFolder.isCreatingNewBranch ? '新建分支名' : '目标分支'}</label>
                  <button 
                    onClick={() => setPendingFolder({...pendingFolder, isCreatingNewBranch: !pendingFolder.isCreatingNewBranch, branch: pendingFolder.isCreatingNewBranch ? (pendingFolder.availableBranches[0]?.name || 'main') : ''})}
                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border transition-colors ${pendingFolder.isCreatingNewBranch ? 'bg-blue-600 text-white border-blue-600' : 'bg-zinc-100 text-zinc-500 border-zinc-200'}`}
                  >
                    {pendingFolder.isCreatingNewBranch ? '返回列表' : '新建分支'}
                  </button>
                </div>
                {pendingFolder.isCreatingNewBranch ? (
                  <input className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={pendingFolder.branch} onChange={e => setPendingFolder({...pendingFolder, branch: e.target.value})} placeholder="输入新分支名" autoFocus />
                ) : (
                  <select className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={pendingFolder.branch} onChange={e => setPendingFolder({...pendingFolder, branch: e.target.value})}>
                    {pendingFolder.isLoadingBranches ? <option>加载中...</option> : pendingFolder.availableBranches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                  </select>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPendingFolder(null)} className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl font-bold">取消</button>
              <button onClick={confirmPendingFolder} disabled={isConfirming || !pendingFolder.branch} className="flex-[1.5] py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2">{isConfirming ? <Loader2 className="w-5 h-5 animate-spin" /> : '确认添加'}</button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white dark:bg-zinc-900 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center z-10 shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#24292f] dark:bg-white rounded-lg flex items-center justify-center">
            <Github className="w-5 h-5 text-white dark:text-black" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm block leading-none">{auth.username}</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[9px] text-zinc-400 font-black uppercase tracking-widest">Active Token</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={triggerFolderPicker} className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg active:scale-90 transition-all"><Plus className="w-5 h-5" /></button>
          <button onClick={handleLogout} className="p-2.5 text-zinc-400 hover:text-red-500 transition-colors"><LogOut className="w-5 h-5"/></button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === 'home' && (
          <div className="p-4 space-y-6 animate-in slide-in-from-bottom-4">
            <section className="bg-gradient-to-br from-[#24292f] to-zinc-800 rounded-[2.5rem] p-6 text-white shadow-xl relative overflow-hidden">
               <div className="relative z-10">
                 <h3 className="text-[10px] font-black uppercase opacity-60 mb-3 tracking-widest">同步面板</h3>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
                      <p className="text-3xl font-black">{folders.length}</p>
                      <p className="text-[9px] font-bold uppercase opacity-60 mt-1">项目节点</p>
                    </div>
                    <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
                      <p className="text-3xl font-black">{logs.filter(l => l.status === 'success').length}</p>
                      <p className="text-[9px] font-bold uppercase opacity-60 mt-1">传输流水</p>
                    </div>
                 </div>
               </div>
               <div className="absolute top-0 right-0 p-4 opacity-10"><Github className="w-24 h-24" /></div>
            </section>
            
            <section className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">实时文件流水</h3>
                <span className="text-[8px] bg-blue-50 text-blue-500 dark:bg-blue-900/30 px-2 py-0.5 rounded-full font-black uppercase">监测中</span>
              </div>
              <div className="space-y-2">
                {logs.length === 0 ? (
                  <div className="text-center py-10 text-zinc-400 text-xs bg-white dark:bg-zinc-900 rounded-[2rem] border border-dashed border-zinc-200 dark:border-zinc-800">等待第一条同步记录...</div>
                ) : logs.map(log => {
                  const isImage = log.fileName.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
                  return (
                    <div key={log.id} className="bg-white dark:bg-zinc-900 p-4 rounded-[1.5rem] flex items-center gap-4 border border-zinc-100 dark:border-zinc-800 group active:scale-[0.98] transition-all">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${log.status === 'success' ? 'bg-blue-50 text-blue-500' : 'bg-red-50 text-red-500'}`}>
                        {isImage ? <ImageIcon className="w-5 h-5" /> : <FileIcon className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{log.fileName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[9px] text-zinc-400 uppercase font-black truncate max-w-[80px]">{log.folderName}</p>
                          <ArrowRight className="w-2 h-2 text-zinc-300" />
                          <p className="text-[9px] text-blue-500 font-black uppercase tracking-tighter"><GitBranch className="w-2.5 h-2.5 inline mr-1" />{log.branch}</p>
                        </div>
                      </div>
                      <p className="text-[9px] text-zinc-300 font-black uppercase whitespace-nowrap">{log.time}</p>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'folders' && (
          <div className="p-4 space-y-4 animate-in slide-in-from-right">
             <div className="flex justify-between items-center px-1">
               <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">托管项目列表</h3>
               <button onClick={() => scanAndSync(true)} disabled={isScanning} className="flex items-center gap-1.5 text-xs text-blue-600 font-bold active:scale-95 transition-all">
                 <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} /> 立即扫描
               </button>
             </div>
             {folders.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-10 text-center border border-dashed border-zinc-200 dark:border-zinc-800">
                  <FolderSearch className="w-12 h-12 mx-auto text-zinc-200 mb-4" />
                  <p className="text-sm text-zinc-500 font-bold">连接您的文件夹</p>
                  <p className="text-[10px] text-zinc-400 mt-2">点击右上角 + 号开启自动化同步</p>
                </div>
             ) : folders.map(folder => {
               const statusDisplay = getStatusDisplay(folder.status);
               return (
                 <div key={folder.id} className={`bg-white dark:bg-zinc-900 p-5 rounded-[2.5rem] border flex flex-col gap-4 shadow-sm transition-colors ${folder.status === 'error' ? 'border-red-200' : 'border-zinc-100 dark:border-zinc-800'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${folder.status === 'syncing' ? 'bg-blue-50 text-blue-600' : 'bg-zinc-50 dark:bg-zinc-800'}`}>
                          {folder.status === 'syncing' ? <RefreshCw className="w-6 h-6 animate-spin" /> : <FolderSearch className="w-6 h-6" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-black truncate">{folder.name}</h4>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded-lg font-black">{folder.owner}/{folder.repo}</span>
                            <span className="text-[9px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 px-1.5 py-0.5 rounded-lg font-black uppercase"><GitBranch className="w-2.5 h-2.5 inline mr-1" />{folder.branch}</span>
                          </div>
                        </div>
                      </div>
                      <button onClick={() => setFolders(prev => prev.filter(f => f.id !== folder.id))} className="p-2 text-zinc-300 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 items-center bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded-2xl">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-black text-zinc-400 uppercase"><Timer className="w-3 h-3" /> 同步频率</div>
                        <select className="bg-transparent text-xs font-bold focus:outline-none cursor-pointer" value={folder.syncInterval} onChange={(e) => updateFolderInterval(folder.id, parseInt(e.target.value))}>
                          <option value={0}>手动</option>
                          <option value={1}>1 分钟</option>
                          <option value={5}>5 分钟</option>
                          <option value={15}>15 分钟</option>
                        </select>
                      </div>
                      <div className="text-right flex flex-col gap-1">
                        <span className={`text-[10px] font-black uppercase inline-block`}>状态</span>
                        <span className={`text-[10px] font-bold ${statusDisplay.color.split(' ')[0]}`}>{statusDisplay.text}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 pt-2 border-t border-zinc-50 dark:border-zinc-800/50">
                      <div className="flex justify-between items-center px-1"><span className="text-[9px] text-zinc-400 font-medium italic">上次同步: {folder.lastSync}</span></div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => openBrowser(folder)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-[9px] font-black uppercase tracking-widest text-blue-600 active:scale-95 transition-all"><Folder className="w-3 h-3" /> 浏览</button>
                        <button onClick={() => openHistory(folder)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl text-[9px] font-black uppercase tracking-widest text-zinc-500 active:scale-95 transition-all"><History className="w-3 h-3" /> 历史</button>
                        <button onClick={() => syncSingleFolder(folder.id, true)} disabled={folder.status === 'syncing'} className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all">
                          {folder.status === 'syncing' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} 立即全量上传
                        </button>
                      </div>
                    </div>
                 </div>
               );
             })}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="p-4 space-y-4 animate-in slide-in-from-right">
             <div className="bg-gradient-to-r from-indigo-600 to-blue-700 p-8 rounded-[3rem] text-white shadow-xl space-y-4">
                <div className="space-y-1">
                  <h3 className="text-xl font-black">协同实验室</h3>
                  <p className="text-[10px] font-medium opacity-80 uppercase tracking-widest">即时写入分支</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      setIsEditingFile(true);
                      setEditFileConfig({ folderId: folders[0]?.id || '', fileName: '', content: '', isNew: true });
                    }}
                    className="flex-1 bg-white text-blue-600 px-4 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-lg active:scale-90 transition-all flex items-center justify-center gap-2"
                  >
                    <PenTool className="w-4 h-4" /> 创建想法
                  </button>
                </div>
             </div>

             <div className="bg-white dark:bg-zinc-900 rounded-[3rem] overflow-hidden border border-zinc-100 dark:border-zinc-800 shadow-sm">
                <div className="p-6 border-b border-zinc-50 dark:border-zinc-800 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-500" />
                    <h3 className="text-xs font-black text-zinc-500 uppercase">协同流水</h3>
                  </div>
                  <span className="text-[9px] text-zinc-300 font-bold uppercase">分支感知日志</span>
                </div>
                <div className="divide-y divide-zinc-50 dark:divide-zinc-800 max-h-[55vh] overflow-y-auto custom-scrollbar">
                   {logs.length === 0 ? (
                    <div className="p-20 text-center text-zinc-300 text-[10px] uppercase font-bold tracking-widest">暂无记录</div>
                   ) : logs.map(log => (
                     <div key={log.id} className="p-6 flex items-start gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <div className={`w-12 h-12 rounded-[1.2rem] flex items-center justify-center shrink-0 ${log.status === 'success' ? (log.type === 'manual' ? 'bg-indigo-50 text-indigo-500' : 'bg-blue-50 text-blue-500') : 'bg-red-50 text-red-500'}`}>
                          {log.type === 'manual' ? <Save className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <p className="text-xs font-black">{log.status === 'success' ? (log.type === 'manual' ? '手动创建成功' : '同步成功') : '操作失败'}</p>
                            <span className="text-[9px] bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded-lg text-blue-600 font-black uppercase tracking-tighter">
                              <GitBranch className="w-2 h-2 inline mr-1" />{log.branch}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-500 mt-1 truncate font-medium">文件: {log.fileName}</p>
                          <div className="flex items-center gap-2 mt-2">
                             <span className="text-[8px] bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-400 font-black uppercase">{log.folderName}</span>
                             <span className="text-[8px] text-zinc-300 uppercase font-black">{log.time}</span>
                          </div>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="flex flex-col h-full bg-white dark:bg-zinc-950">
            <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-30">
                    <MessageSquare className="w-16 h-16" />
                    <p className="text-sm font-black uppercase tracking-widest">Git-AI 协同助手</p>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-5 py-3 rounded-2xl text-[13px] shadow-sm leading-relaxed ${msg.role === 'user' ? 'bg-[#24292f] text-white rounded-br-sm' : 'bg-zinc-100 dark:bg-zinc-900 rounded-bl-sm'}`}>{msg.text}</div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-zinc-100 dark:bg-zinc-900 px-5 py-3 rounded-2xl flex gap-1">
                      <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" />
                      <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce delay-100" />
                      <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce delay-200" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
            </div>
            <div className="p-4 bg-white dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900 p-2 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                   <input className="flex-1 bg-transparent px-4 py-2 outline-none text-sm" placeholder="Ask Nexus..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChat()} />
                   <button onClick={handleChat} disabled={!chatInput.trim() || isTyping} className="w-12 h-12 bg-[#24292f] dark:bg-blue-600 text-white rounded-xl flex items-center justify-center active:scale-90 transition-all disabled:opacity-30">
                     <Send className="w-5 h-5" />
                   </button>
                </div>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl border-t border-zinc-100 dark:border-zinc-800 flex justify-around items-center pt-3 pb-8 px-2 z-[60] shadow-2xl shrink-0">
        <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${activeTab === 'home' ? 'text-blue-600' : 'text-zinc-400'}`}>
          <Home className="w-5 h-5" />
          <span className="text-[9px] font-black uppercase">概览</span>
        </button>
        <button onClick={() => setActiveTab('folders')} className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${activeTab === 'folders' ? 'text-blue-600' : 'text-zinc-400'}`}>
          <FolderSearch className="w-5 h-5" />
          <span className="text-[9px] font-black uppercase">项目</span>
        </button>
        <button onClick={() => setActiveTab('activity')} className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${activeTab === 'activity' ? 'text-blue-600' : 'text-zinc-400'}`}>
          <Activity className="w-5 h-5" />
          <span className="text-[9px] font-black uppercase">协同</span>
        </button>
        <button onClick={() => setActiveTab('chat')} className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${activeTab === 'chat' ? 'text-blue-600' : 'text-zinc-400'}`}>
          <MessageSquare className="w-5 h-5" />
          <span className="text-[9px] font-black uppercase">助手</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
=======

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GithubConfig, MonitoredFolder, SyncLog, ChatMessage, Branch } from './types';
import { fetchUserRepositories, pushFileContent, checkRepository, fetchRepositoryBranches } from './services/github';
import { generateAiResponse } from './services/gemini';
import { 
  Github, 
  Home, 
  FolderSearch, 
  Activity, 
  MessageSquare, 
  Plus, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  LogOut,
  Clock,
  Send,
  Loader2,
  Lock,
  FileText,
  Upload,
  X,
  Edit2,
  Check,
  ExternalLink,
  Info,
  ShieldAlert,
  Terminal,
  GitBranch,
  Layers,
  Key,
  Timer
} from 'lucide-react';

const App: React.FC = () => {
  const folderInputRef = useRef<HTMLInputElement>(null);
  
  // --- Auth State ---
  const [auth, setAuth] = useState<GithubConfig | null>(() => {
    const saved = localStorage.getItem('gh-nexus-auth');
    return saved ? JSON.parse(saved) : null;
  });
  const [tokenInput, setTokenInput] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // --- App State ---
  const [activeTab, setActiveTab] = useState<'home' | 'folders' | 'activity' | 'chat'>('home');
  const [folders, setFolders] = useState<MonitoredFolder[]>(() => {
    const saved = localStorage.getItem('gh-nexus-folders');
    return saved ? JSON.parse(saved) : [];
  });
  
  const foldersRef = useRef<MonitoredFolder[]>(folders);
  useEffect(() => {
    foldersRef.current = folders;
    localStorage.setItem('gh-nexus-folders', JSON.stringify(folders));
  }, [folders]);

  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const isScanningRef = useRef(false);

  // --- Modal State ---
  const [pendingFolder, setPendingFolder] = useState<{
    name: string;
    handle?: FileSystemDirectoryHandle;
    files?: File[];
    owner: string;
    repo: string;
    branch: string;
    availableBranches: Branch[];
    isLoadingBranches: boolean;
  } | null>(null);
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);

  // --- AI State ---
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Permission Helper ---
  const verifyPermission = async (handle: FileSystemDirectoryHandle, withRequest: boolean = false) => {
    try {
      // @ts-ignore
      const options = { mode: 'read' };
      // @ts-ignore
      let currentStatus = await handle.queryPermission(options);
      
      if (currentStatus === 'prompt' && withRequest) {
        // @ts-ignore
        currentStatus = await handle.requestPermission(options);
      }
      
      return currentStatus === 'granted';
    } catch (e) {
      console.error('Permission check failed:', e);
      return false;
    }
  };

  const handleLogin = async () => {
    if (!tokenInput) return;
    setIsLoggingIn(true);
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${tokenInput}` }
      });
      if (!response.ok) throw new Error('登录失败');
      const userData = await response.json();
      const newAuth = {
        token: tokenInput,
        owner: userData.login,
        username: userData.name || userData.login
      };
      setAuth(newAuth);
      localStorage.setItem('gh-nexus-auth', JSON.stringify(newAuth));
    } catch (err: any) {
      alert(`登录失败: ${err.message}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setAuth(null);
    localStorage.removeItem('gh-nexus-auth');
    setFolders([]);
  };

  const refreshBranches = async (owner: string, repo: string) => {
    if (!auth || !pendingFolder) return;
    setPendingFolder(prev => prev ? { ...prev, isLoadingBranches: true } : null);
    try {
      const branches = await fetchRepositoryBranches(auth.token, owner, repo);
      setPendingFolder(prev => prev ? { 
        ...prev, 
        availableBranches: branches, 
        branch: branches.some(b => b.name === 'main') ? 'main' : (branches[0]?.name || 'main'),
        isLoadingBranches: false 
      } : null);
    } catch (e) {
      setPendingFolder(prev => prev ? { ...prev, isLoadingBranches: false } : null);
    }
  };

  const syncFile = async (folder: MonitoredFolder, file: File, relativePath: string) => {
    if (!auth) return;
    
    let content = '';
    try {
      content = await file.text();
    } catch (e: any) {
      const errorMsg = e.message || '';
      if (e.name === 'NotReadableError' || errorMsg.includes('permission') || errorMsg.includes('could not be read')) {
        const error = new Error('READ_PERMISSION_LOST');
        (error as any).fileName = relativePath;
        throw error;
      }
      throw e; 
    }

    const base64Content = btoa(unescape(encodeURIComponent(content)));

    try {
      await pushFileContent(
        auth.token,
        folder.owner,
        folder.repo,
        folder.branch,
        relativePath,
        base64Content,
        `Nexus Auto-Sync: ${new Date().toLocaleString()}`
      );

      setLogs(prev => [{
        id: Math.random().toString(36).substr(2, 9),
        folderName: folder.name,
        fileName: relativePath,
        time: new Date().toLocaleTimeString(),
        type: 'push' as const,
        status: 'success' as const
      }, ...prev].slice(0, 30));
    } catch (err: any) {
      setLogs(prev => [{
        id: Math.random().toString(36).substr(2, 9),
        folderName: folder.name,
        fileName: relativePath,
        time: new Date().toLocaleTimeString(),
        type: 'push' as const,
        status: 'fail' as const
      }, ...prev].slice(0, 30));
      if (err.message === '403_WRITE_DENIED') setShowPermissionGuide(true);
      throw err;
    }
  };

  const syncSingleFolder = useCallback(async (folderId: string, isUserTriggered: boolean = false) => {
    const folder = foldersRef.current.find(f => f.id === folderId);
    if (!folder || !auth) return;

    try {
      setFolders(prev => prev.map(f => f.id === folderId ? { ...f, status: 'syncing' } : f));

      if (folder.handle) {
        const hasPermission = await verifyPermission(folder.handle, isUserTriggered);
        if (!hasPermission) {
          setFolders(prev => prev.map(f => f.id === folderId ? { ...f, status: 'permission-required' } : f));
          return;
        }

        const traverseDirectory = async (directoryHandle: FileSystemDirectoryHandle, currentPath: string = '') => {
          // @ts-ignore
          for await (const entry of directoryHandle.values()) {
            const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
            if (entry.name.startsWith('.') && entry.kind === 'directory') continue;

            if (entry.kind === 'file') {
              if (entry.name.endsWith('.md') || entry.name.endsWith('.txt')) {
                const file = await (entry as FileSystemFileHandle).getFile();
                await syncFile(folder, file, entryPath);
              }
            } else if (entry.kind === 'directory') {
              await traverseDirectory(entry as FileSystemDirectoryHandle, entryPath);
            }
          }
        };

        await traverseDirectory(folder.handle);
      } else if (folder.files) {
        for (const file of folder.files) {
          const parts = (file as any).webkitRelativePath?.split('/') || [];
          if (parts.length > 1) {
            const relativePath = parts.slice(1).join('/');
            if (relativePath.endsWith('.md') || relativePath.endsWith('.txt')) {
              await syncFile(folder, file, relativePath);
            }
          }
        }
      }

      setFolders(prev => prev.map(f => f.id === folderId ? { 
        ...f, 
        status: 'active', 
        lastSync: new Date().toLocaleTimeString(),
        lastSyncTimestamp: Date.now()
      } : f));
    } catch (err: any) {
      console.error('Folder sync failed:', err);
      const isPermissionLost = err.message === 'READ_PERMISSION_LOST' || err.name === 'SecurityError';
      setFolders(prev => prev.map(f => f.id === folderId ? { 
        ...f, 
        status: isPermissionLost ? 'permission-required' : 'error' 
      } : f));
    }
  }, [auth]);

  const scanAndSync = useCallback(async (force: boolean = false) => {
    if (foldersRef.current.length === 0 || isScanningRef.current || !auth) return;
    
    isScanningRef.current = true;
    setIsScanning(true);
    
    const now = Date.now();
    for (const folder of foldersRef.current) {
      // 关键修复：如果是手动触发 (force)，则忽略同步周期的检查
      const shouldSync = force || (
        folder.syncInterval > 0 && 
        (!folder.lastSyncTimestamp || (now - folder.lastSyncTimestamp >= folder.syncInterval * 60 * 1000))
      );

      if (shouldSync && (folder.status === 'active' || folder.status === 'error' || folder.status === 'permission-required')) {
        await syncSingleFolder(folder.id, force);
      }
    }
    
    isScanningRef.current = false;
    setIsScanning(false);
  }, [auth, syncSingleFolder]);

  const updateFolderInterval = (id: string, interval: number) => {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, syncInterval: interval } : f));
  };

  const triggerFolderPicker = () => {
    if (window.self === window.top && 'showDirectoryPicker' in window) {
      addFolderWithPicker();
    } else {
      folderInputRef.current?.click();
    }
  };

  const addFolderWithPicker = async () => {
    try {
      // @ts-ignore
      const handle = await window.showDirectoryPicker();
      await prepareFolder(handle.name, handle, undefined);
    } catch (err: any) {
      if (err.name === 'SecurityError') folderInputRef.current?.click();
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    const folderName = (fileArray[0] as any).webkitRelativePath?.split('/')[0] || "New Project";
    await prepareFolder(folderName, undefined, fileArray);
    e.target.value = '';
  };

  const prepareFolder = async (name: string, handle?: FileSystemDirectoryHandle, files?: File[]) => {
    if (!auth) return;
    let repoInfo = { owner: auth.owner, repo: name, branch: 'main' };
    const extractGitInfo = (text: string) => {
      const match = text.match(/url\s*=\s*(?:https:\/\/github\.com\/|git@github\.com:)([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)/i);
      if (match) {
        let owner = match[1];
        let repo = match[2];
        if (repo.endsWith('.git')) repo = repo.slice(0, -4);
        return { owner, repo };
      }
      return null;
    };

    if (files) {
      const gitConfigFile = files.find(f => (f as any).webkitRelativePath?.endsWith('.git/config'));
      if (gitConfigFile) {
        const text = await gitConfigFile.text();
        const info = extractGitInfo(text);
        if (info) { repoInfo.owner = info.owner; repoInfo.repo = info.repo; }
      }
    } else if (handle) {
      try {
        const gitFolder = await handle.getDirectoryHandle('.git');
        const configFile = await gitFolder.getFileHandle('config');
        const file = await configFile.getFile();
        const text = await file.text();
        const info = extractGitInfo(text);
        if (info) { repoInfo.owner = info.owner; repoInfo.repo = info.repo; }
      } catch (e) {}
    }

    setPendingFolder({
      name, handle, files,
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      branch: repoInfo.branch,
      availableBranches: [],
      isLoadingBranches: true
    });

    try {
      const branches = await fetchRepositoryBranches(auth.token, repoInfo.owner, repoInfo.repo);
      setPendingFolder(prev => prev ? { 
        ...prev, 
        availableBranches: branches, 
        branch: branches.some(b => b.name === 'main') ? 'main' : (branches[0]?.name || 'main'),
        isLoadingBranches: false 
      } : null);
    } catch (e) {
      setPendingFolder(prev => prev ? { ...prev, isLoadingBranches: false } : null);
    }
  };

  const confirmPendingFolder = async () => {
    if (!auth || !pendingFolder) return;
    const exists = await checkRepository(auth.token, pendingFolder.owner, pendingFolder.repo);
    const newFolder: MonitoredFolder = {
      id: Math.random().toString(36).substr(2, 9),
      name: pendingFolder.name,
      handle: pendingFolder.handle,
      files: pendingFolder.files,
      owner: pendingFolder.owner,
      repo: pendingFolder.repo,
      branch: pendingFolder.branch,
      status: exists ? 'active' : 'error',
      lastSync: '从未同步',
      syncInterval: 5 
    };
    setFolders(prev => [...prev, newFolder]);
    setPendingFolder(null);
  };

  useEffect(() => {
    const timer = setInterval(() => scanAndSync(false), 30000);
    return () => clearInterval(timer);
  }, [scanAndSync]);

  const handleChat = async () => {
    if (!chatInput.trim() || isTyping) return;
    const userMsg = { role: 'user' as const, text: chatInput };
    setMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsTyping(true);
    try {
      const response = await generateAiResponse(messages, chatInput);
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'model', text: 'AI 连接失败' }]);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getStatusDisplay = (status: MonitoredFolder['status']) => {
    switch (status) {
      case 'syncing': return { text: '正在同步...', color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' };
      case 'active': return { text: '已连接', color: 'text-green-500 bg-green-50 dark:bg-green-900/20' };
      case 'error': return { text: '配置错误', color: 'text-red-500 bg-red-50 dark:bg-red-900/20' };
      case 'permission-required': return { text: '授权已失效', color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20' };
      default: return { text: '待同步', color: 'text-zinc-500 bg-zinc-50 dark:bg-zinc-800' };
    }
  };

  if (!auth) {
    return (
      <div className="h-screen bg-[#24292f] flex flex-col items-center justify-center p-8 text-white">
        <div className="w-full max-w-sm space-y-10 animate-in fade-in zoom-in">
          <div className="text-center space-y-4">
            <Github className="w-20 h-20 mx-auto" />
            <h1 className="text-3xl font-bold tracking-tight">GitHub Nexus</h1>
            <p className="text-zinc-400 text-sm">连接本地项目，自动同步云端</p>
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input 
                  type="password"
                  placeholder="GitHub Personal Access Token"
                  className="w-full pl-12 pr-4 py-4 bg-zinc-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                />
              </div>
              <button onClick={handleLogin} disabled={isLoggingIn} className="w-full py-4 bg-white text-black rounded-2xl font-bold hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2">
                {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : '登录 GitHub 账号'}
              </button>
            </div>
            
            <div className="bg-zinc-800/50 p-5 rounded-3xl border border-zinc-700/50 space-y-3 shadow-inner">
              <div className="flex items-center gap-2 text-zinc-300 font-black text-[10px] uppercase tracking-widest">
                <ShieldAlert className="w-3 h-3 text-yellow-500" />
                重要权限设置
              </div>
              <ul className="text-[11px] text-zinc-400 space-y-3 leading-relaxed">
                <li className="flex items-start gap-2">
                  <div className="mt-1 w-1 h-1 bg-blue-500 rounded-full shrink-0" />
                  <span><strong>Fine-grained Token:</strong> 将 <strong>Contents</strong> 权限设置为 <span className="text-zinc-200 bg-zinc-700 px-1 rounded">Read and Write</span>。</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="mt-1 w-1 h-1 bg-blue-500 rounded-full shrink-0" />
                  <span><strong>Classic Token:</strong> 勾选 <span className="text-zinc-200 bg-zinc-700 px-1 rounded">repo</span> 权限。</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#f6f8fa] dark:bg-zinc-950 flex flex-col overflow-hidden pb-20 no-select">
      <input type="file" ref={folderInputRef} style={{ display: 'none' }} {...({ webkitdirectory: "", directory: "" } as any)} onChange={handleFileInputChange} />

      {showPermissionGuide && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[2.5rem] p-8 space-y-6">
             <div className="text-center space-y-3">
                <ShieldAlert className="w-12 h-12 text-red-600 mx-auto" />
                <h3 className="text-lg font-black text-red-600">Token 权限不足</h3>
                <p className="text-xs text-zinc-500">您的 Token 缺少写入权限。请前往 GitHub 设置并开启 Contents: Read & Write。</p>
             </div>
             <button onClick={() => setShowPermissionGuide(false)} className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl font-bold">了解</button>
          </div>
        </div>
      )}

      {pendingFolder && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[2.5rem] p-8 space-y-6 my-auto">
            <h3 className="text-lg font-black uppercase text-center">确认仓库信息</h3>
            <div className="space-y-4">
              <input className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl px-4 py-3 text-sm" value={pendingFolder.owner} onChange={e => { const o = e.target.value; setPendingFolder({...pendingFolder, owner: o}); refreshBranches(o, pendingFolder.repo); }} placeholder="Owner" />
              <input className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl px-4 py-3 text-sm" value={pendingFolder.repo} onChange={e => { const r = e.target.value; setPendingFolder({...pendingFolder, repo: r}); refreshBranches(pendingFolder.owner, r); }} placeholder="Repo" />
              <select className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl px-4 py-3 text-sm" value={pendingFolder.branch} onChange={e => setPendingFolder({...pendingFolder, branch: e.target.value})}>
                {pendingFolder.isLoadingBranches ? <option>加载中...</option> : pendingFolder.availableBranches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPendingFolder(null)} className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl font-bold">取消</button>
              <button onClick={confirmPendingFolder} className="flex-[1.5] py-4 bg-blue-600 text-white rounded-2xl font-bold">确认</button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white dark:bg-zinc-900 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#24292f] dark:bg-white rounded-lg flex items-center justify-center">
            <Github className="w-5 h-5 text-white dark:text-black" />
          </div>
          <div><span className="font-bold text-sm block leading-none">{auth.username}</span><span className="text-[10px] text-zinc-400">Git-AI Nexus</span></div>
        </div>
        <div className="flex gap-2">
          <button onClick={triggerFolderPicker} className="p-2 bg-blue-600 text-white rounded-xl shadow-lg active:scale-90 transition-all"><Plus className="w-5 h-5" /></button>
          <button onClick={handleLogout} className="p-2 text-zinc-400 hover:text-red-500 transition-colors"><LogOut className="w-5 h-5"/></button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === 'home' && (
          <div className="p-4 space-y-6 animate-in slide-in-from-bottom-4">
            <section className="bg-gradient-to-br from-[#24292f] to-zinc-800 rounded-[2rem] p-6 text-white shadow-xl">
               <h3 className="text-[10px] font-black uppercase opacity-60 mb-2">同步工作台</h3>
               <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/10 rounded-2xl p-4">
                    <p className="text-3xl font-black">{folders.length}</p>
                    <p className="text-[9px] font-bold uppercase opacity-60">监控项目</p>
                  </div>
                  <div className="bg-white/10 rounded-2xl p-4">
                    <p className="text-3xl font-black">{logs.filter(l => l.status === 'success').length}</p>
                    <p className="text-[9px] font-bold uppercase opacity-60">上传成功</p>
                  </div>
               </div>
            </section>
            <section className="space-y-4">
              <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest px-1">最近活动</h3>
              <div className="space-y-2">
                {logs.length === 0 ? (
                  <div className="text-center py-10 text-zinc-400 text-xs">暂无活动记录</div>
                ) : logs.map(log => (
                  <div key={log.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl flex items-center gap-4 border border-zinc-100 dark:border-zinc-800">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${log.status === 'success' ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'}`}><CheckCircle2 className="w-4 h-4" /></div>
                    <div className="flex-1 min-w-0"><p className="text-xs font-bold truncate">{log.fileName}</p><p className="text-[9px] text-zinc-400 uppercase mt-0.5">{log.folderName} • {log.time}</p></div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'folders' && (
          <div className="p-4 space-y-4 animate-in slide-in-from-right">
             <div className="flex justify-between items-center px-1">
               <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">托管项目列表</h3>
               <button onClick={() => scanAndSync(true)} disabled={isScanning} className="flex items-center gap-1.5 text-xs text-blue-600 font-bold active:scale-95 transition-all disabled:opacity-50">
                 <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} /> 刷新监控
               </button>
             </div>
             {folders.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-10 text-center border border-dashed border-zinc-200 dark:border-zinc-800">
                  <FolderSearch className="w-12 h-12 mx-auto text-zinc-200 mb-4" />
                  <p className="text-sm text-zinc-500">点击右上角 + 号添加文件夹</p>
                </div>
             ) : folders.map(folder => {
               const statusDisplay = getStatusDisplay(folder.status);
               return (
                 <div key={folder.id} className={`bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border flex flex-col gap-4 shadow-sm transition-colors ${folder.status === 'error' ? 'border-red-200' : folder.status === 'permission-required' ? 'border-yellow-200' : 'border-zinc-100 dark:border-zinc-800'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${folder.status === 'syncing' ? 'bg-blue-50 text-blue-600' : 'bg-zinc-50 dark:bg-zinc-800'}`}>
                          {folder.status === 'syncing' ? <RefreshCw className="w-6 h-6 animate-spin" /> : <FolderSearch className="w-6 h-6" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-black truncate">{folder.name}</h4>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded-lg font-black">{folder.owner}/{folder.repo}</span>
                            <span className="text-[9px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 px-1.5 py-0.5 rounded-lg font-black uppercase"><GitBranch className="w-2.5 h-2.5 inline mr-1" />{folder.branch}</span>
                          </div>
                        </div>
                      </div>
                      <button onClick={() => setFolders(prev => prev.filter(f => f.id !== folder.id))} className="p-2 text-zinc-300 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 items-center bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded-2xl">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-black text-zinc-400 uppercase">
                          <Timer className="w-3 h-3" /> 同步周期
                        </div>
                        <select 
                          className="bg-transparent text-xs font-bold focus:outline-none cursor-pointer"
                          value={folder.syncInterval}
                          onChange={(e) => updateFolderInterval(folder.id, parseInt(e.target.value))}
                        >
                          <option value={0}>仅手动同步</option>
                          <option value={1}>每 1 分钟</option>
                          <option value={5}>每 5 分钟</option>
                          <option value={15}>每 15 分钟</option>
                          <option value={30}>每 30 分钟</option>
                          <option value={60}>每 1 小时</option>
                        </select>
                      </div>
                      <div className="text-right flex flex-col gap-1">
                        <span className={`text-[10px] font-black uppercase inline-block`}>状态</span>
                        <span className={`text-[10px] font-bold ${statusDisplay.color.split(' ')[0]}`}>{statusDisplay.text}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 pt-2 border-t border-zinc-50 dark:border-zinc-800/50">
                      <div className="flex justify-between items-center px-1">
                         <span className="text-[9px] text-zinc-400 font-medium italic">上次同步: {folder.lastSync}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <a href={`https://github.com/${folder.owner}/${folder.repo}/actions`} target="_blank" className="flex items-center justify-center gap-1.5 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:bg-zinc-100 transition-colors"><Terminal className="w-3 h-3" /> 部署监控</a>
                        {folder.status === 'permission-required' ? (
                          <button onClick={() => syncSingleFolder(folder.id, true)} className="flex items-center justify-center gap-1.5 py-2.5 bg-yellow-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all">
                            <Key className="w-3 h-3" /> 授权访问
                          </button>
                        ) : (
                          <button onClick={() => syncSingleFolder(folder.id, true)} disabled={folder.status === 'syncing'} className="flex items-center justify-center gap-1.5 py-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-[9px] font-black uppercase tracking-widest text-blue-600 active:scale-95 transition-all">
                            {folder.status === 'syncing' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} 手动同步
                          </button>
                        )}
                      </div>
                    </div>
                 </div>
               );
             })}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="p-4 animate-in slide-in-from-right">
             <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] overflow-hidden border border-zinc-100 shadow-sm">
                <div className="p-5 border-b border-zinc-50 flex justify-between items-center"><h3 className="text-xs font-black text-zinc-500 uppercase">同步流水</h3><Activity className="w-4 h-4 text-zinc-300" /></div>
                <div className="divide-y divide-zinc-50 dark:divide-zinc-800 max-h-[60vh] overflow-y-auto">
                   {logs.length === 0 ? <div className="p-10 text-center text-zinc-400 text-xs">暂无流水数据</div> : logs.map(log => (
                     <div key={log.id} className="p-5 flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${log.status === 'success' ? 'bg-blue-50 text-blue-500' : 'bg-red-50 text-red-500'}`}><Upload className="w-5 h-5" /></div>
                        <div className="flex-1 min-w-0"><p className="text-[12px] font-black">{log.status === 'success' ? '上传成功' : '上传失败'}</p><p className="text-[10px] text-zinc-500 mt-1 truncate">{log.fileName}</p></div>
                     </div>
                   ))}
                </div>
             </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="flex flex-col h-full bg-white dark:bg-zinc-950">
             <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                    <MessageSquare className="w-12 h-12" />
                    <p className="text-sm font-bold">随时提问，AI 助手将基于仓库内容回答</p>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-5 py-3 rounded-2xl text-[13px] ${msg.role === 'user' ? 'bg-zinc-900 text-white' : 'bg-zinc-50 dark:bg-zinc-900'}`}>{msg.text}</div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-zinc-50 dark:bg-zinc-900 px-5 py-3 rounded-2xl flex gap-1">
                      <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" />
                      <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce delay-100" />
                      <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce delay-200" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
             </div>
             <div className="p-4 border-t border-zinc-100 bg-white dark:bg-zinc-900">
                <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-full border">
                   <input className="flex-1 bg-transparent px-4 outline-none text-[13px]" placeholder="Ask me anything..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChat()} />
                   <button onClick={handleChat} disabled={!chatInput.trim() || isTyping} className="w-10 h-10 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center"><Send className="w-4 h-4" /></button>
                </div>
             </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border-t flex justify-around items-center pt-3 pb-8 px-2 z-50">
        <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1.5 ${activeTab === 'home' ? 'text-blue-600' : 'text-zinc-400'}`}><Home className="w-5 h-5" /><span className="text-[9px] font-black uppercase">概览</span></button>
        <button onClick={() => setActiveTab('folders')} className={`flex flex-col items-center gap-1.5 ${activeTab === 'folders' ? 'text-blue-600' : 'text-zinc-400'}`}><FolderSearch className="w-5 h-5" /><span className="text-[9px] font-black uppercase">项目</span></button>
        <button onClick={() => setActiveTab('activity')} className={`flex flex-col items-center gap-1.5 ${activeTab === 'activity' ? 'text-blue-600' : 'text-zinc-400'}`}><Activity className="w-5 h-5" /><span className="text-[9px] font-black uppercase">流水</span></button>
        <button onClick={() => setActiveTab('chat')} className={`flex flex-col items-center gap-1.5 ${activeTab === 'chat' ? 'text-blue-600' : 'text-zinc-400'}`}><MessageSquare className="w-5 h-5" /><span className="text-[9px] font-black uppercase">AI助手</span></button>
      </nav>
    </div>
  );
};

export default App;
>>>>>>> c200e9cf6f32689b7631b8949ad109b1a2e56e8b
