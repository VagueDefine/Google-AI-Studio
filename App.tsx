import React, { useState, useEffect, useRef } from 'react';
import { GithubConfig, Repository, Branch, ChatMessage } from './types';
import { fetchUserRepositories, fetchRepositoryBranches, fetchRepositoryContents } from './services/github';
import { 
  Settings, 
  Github, 
  Send, 
  Paperclip, 
  Loader2, 
  AlertCircle, 
  CheckCircle2,
  X,
  FileText,
  ChevronDown,
  Sparkles,
  LogIn,
  Info,
  UploadCloud,
  FileCode,
  Folder,
  MessageSquare,
  FileJson,
  FileBox,
  Layout
} from 'lucide-react';

const App: React.FC = () => {
  // --- Configuration State ---
  const [config, setConfig] = useState<GithubConfig>(() => {
    const saved = localStorage.getItem('gh-nexus-config');
    return saved ? JSON.parse(saved) : { token: '', owner: '', repo: '', branch: '' };
  });
  
  const [showSettings, setShowSettings] = useState(!config.token);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);

  // --- Explorer State ---
  const [viewMode, setViewMode] = useState<'chat' | 'explorer'>('chat');
  const [repoContents, setRepoContents] = useState<any[]>([]);
  const [loadingContents, setLoadingContents] = useState(false);

  // --- Detection State ---
  const [detectedConfig, setDetectedConfig] = useState<Partial<GithubConfig> | null>(null);

  // --- Chat State ---
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; type: string; data: string }>>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Persistence & Effects ---
  useEffect(() => {
    localStorage.setItem('gh-nexus-config', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    if (config.token) handleFetchRepos();
  }, []);

  useEffect(() => {
    if (config.token && config.owner && config.repo) {
      handleFetchBranches();
      handleFetchContents();
    }
  }, [config.owner, config.repo, config.branch]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, viewMode]);

  const handleFetchRepos = async () => {
    if (!config.token) return;
    setLoadingRepos(true);
    try {
      const data = await fetchUserRepositories(config.token);
      setRepos(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleFetchBranches = async () => {
    setLoadingBranches(true);
    try {
      const data = await fetchRepositoryBranches(config.token, config.owner, config.repo);
      setBranches(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleFetchContents = async () => {
    if (!config.token || !config.repo) return;
    setLoadingContents(true);
    try {
      const data = await fetchRepositoryContents(config.token, config.owner, config.repo, config.branch);
      setRepoContents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingContents(false);
    }
  };

  const scanContentForConfig = (content: string, fileName: string) => {
    const results: Partial<GithubConfig> = {};
    const tokenMatch = content.match(/ghp_[a-zA-Z0-9]{36}/);
    if (tokenMatch) results.token = tokenMatch[0];

    const gitUrlPattern = /url\s*=\s*(?:https:\/\/github\.com\/|git@github\.com:)([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)(?:\.git)?/i;
    const gitMatch = content.match(gitUrlPattern);
    if (gitMatch) {
      results.owner = gitMatch[1];
      results.repo = gitMatch[2];
    }

    if (!results.repo) {
      const repoPattern = /(?:github\.com\/|repo:?\s*["']?)([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)/i;
      const repoMatch = content.match(repoPattern);
      if (repoMatch) {
        results.owner = repoMatch[1];
        results.repo = repoMatch[2];
      }
    }

    try {
      const json = JSON.parse(content);
      const tokenKeys = ['github_token', 'GITHUB_TOKEN', 'gh_token', 'token'];
      for (const key of tokenKeys) {
        if (json[key]) {
          results.token = json[key];
          break;
        }
      }
      const repoStr = json.repository?.url || json.repository || json.repo;
      if (typeof repoStr === 'string') {
        const parts = repoStr.replace('.git', '').split('/');
        if (parts.length >= 2) {
          results.repo = parts.pop();
          results.owner = parts.pop();
        }
      }
    } catch (e) {}

    if (Object.keys(results).length > 0) {
      setDetectedConfig(results);
    }
  };

  const applyDetectedConfig = () => {
    if (detectedConfig) {
      const newConfig = { ...config, ...detectedConfig };
      setConfig(newConfig);
      setDetectedConfig(null);
      setShowSettings(true);
      // Auto switch to explorer after connected
      if (newConfig.repo) setViewMode('explorer');
    }
  };

  const handleConfigUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      scanContentForConfig(text, file.name);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    (Array.from(files) as File[]).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setAttachedFiles(prev => [...prev, { name: file.name, type: file.type, data: base64 }]);
        if (file.type.includes('text') || file.name.includes('config') || file.name.endsWith('.env') || file.name.endsWith('.json')) {
            try {
              const textContent = atob(base64.split(',')[1]);
              scanContentForConfig(textContent, file.name);
            } catch (err) {}
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const sendMessage = async () => {
    if (!input.trim() && attachedFiles.length === 0) return;
    const userMsg: ChatMessage = {
      role: 'user',
      text: input,
      files: attachedFiles.length > 0 ? [...attachedFiles] : undefined
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachedFiles([]);
    setTimeout(() => {
      const systemReply: ChatMessage = {
        role: 'model',
        text: `已接收到信息。本地核心逻辑运行中...\n当前配置：${config.owner}/${config.repo || '(未选择)'}`
      };
      setMessages(prev => [...prev, systemReply]);
    }, 500);
  };

  const getFileIcon = (name: string, type: string) => {
    if (type === 'dir') return <Folder className="w-4 h-4 text-blue-500 fill-blue-500/10" />;
    if (name.endsWith('.md')) return <FileText className="w-4 h-4 text-emerald-500" />;
    if (name.endsWith('.json')) return <FileJson className="w-4 h-4 text-amber-500" />;
    if (name.endsWith('.ts') || name.endsWith('.tsx') || name.endsWith('.js')) return <FileCode className="w-4 h-4 text-blue-600" />;
    return <FileText className="w-4 h-4 text-zinc-400" />;
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 font-sans">
      {/* Smart Notification Banner */}
      {detectedConfig && (
        <div className="bg-blue-600 text-white p-2.5 px-4 flex items-center justify-between text-xs animate-in slide-in-from-top duration-300 z-50 shadow-xl border-b border-blue-500">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span className="font-medium">检测到工程配置 (TOKEN: {detectedConfig.token ? 'YES' : 'NO'}, REPO: {detectedConfig.repo || 'NO'})</span>
          </div>
          <div className="flex gap-2">
            <button onClick={applyDetectedConfig} className="bg-white text-blue-600 font-bold px-3 py-1 rounded-md shadow-sm hover:bg-blue-50 transition-colors">应用配置</button>
            <button onClick={() => setDetectedConfig(null)} className="px-3 py-1 hover:bg-white/10 rounded-md transition-colors">忽略</button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-600 rounded-lg text-white">
            <Github className="w-4 h-4" />
          </div>
          <h1 className="font-bold text-sm tracking-tight hidden sm:block">Git-AI Nexus</h1>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium border border-blue-100 dark:border-blue-900/30">
            {config.repo ? (
              <span className="truncate max-w-[120px] font-mono">{config.owner}/{config.repo}</span>
            ) : (
              '未连接仓库'
            )}
          </div>
        </div>

        {/* View Switcher Tab */}
        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
          <button 
            onClick={() => setViewMode('chat')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'chat' ? 'bg-white dark:bg-zinc-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            对话
          </button>
          <button 
            onClick={() => setViewMode('explorer')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'explorer' ? 'bg-white dark:bg-zinc-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            <Layout className="w-3.5 h-3.5" />
            浏览器
          </button>
        </div>

        <button 
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2 rounded-lg transition-all ${showSettings ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        {/* Settings Panel */}
        {showSettings && (
          <div className="absolute inset-0 z-20 bg-black/40 backdrop-blur-sm lg:relative lg:inset-auto lg:z-0 lg:bg-transparent lg:w-80 lg:shrink-0 lg:border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
            <div className="w-72 lg:w-full ml-auto h-full bg-white dark:bg-zinc-900 p-5 shadow-2xl lg:shadow-none flex flex-col gap-5 overflow-y-auto">
              <div className="flex justify-between items-center">
                <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">配置中心</h2>
                <button onClick={() => setShowSettings(false)} className="lg:hidden p-1 hover:bg-zinc-100 rounded text-zinc-400"><X className="w-5 h-5"/></button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-zinc-500 flex items-center gap-1">
                  <FileCode className="w-3 h-3" /> 导入工程配置
                </label>
                <div className="relative group">
                  <input type="file" onChange={handleConfigUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <div className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 group-hover:border-blue-500/50 group-hover:bg-blue-50/50 dark:group-hover:bg-blue-900/10 rounded-xl p-4 transition-all flex flex-col items-center text-center gap-2">
                    <UploadCloud className="w-6 h-6 text-zinc-400 group-hover:text-blue-500" />
                    <p className="text-[11px] text-zinc-500 group-hover:text-blue-600 font-medium">上传 .git/config 或 .env</p>
                  </div>
                </div>
              </div>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-zinc-100 dark:border-zinc-800"></div>
                <span className="flex-shrink mx-3 text-[9px] text-zinc-400 font-bold uppercase tracking-tighter">手动配置</span>
                <div className="flex-grow border-t border-zinc-100 dark:border-zinc-800"></div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">GitHub PAT (令牌)</label>
                  <div className="relative">
                    <input 
                      type="password"
                      className="w-full pl-3 pr-10 py-2.5 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none transition-all font-mono"
                      placeholder="ghp_..."
                      value={config.token}
                      onChange={(e) => setConfig({ ...config, token: e.target.value })}
                    />
                    <button onClick={handleFetchRepos} disabled={loadingRepos} className="absolute right-1.5 top-1.5 p-1 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors">
                      {loadingRepos ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">目标仓库</label>
                  <select 
                    className="w-full px-3 py-2.5 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 appearance-none cursor-pointer outline-none"
                    value={`${config.owner}/${config.repo}`}
                    onChange={(e) => {
                      const [owner, repo] = e.target.value.split('/');
                      if (owner && repo) setConfig({ ...config, owner, repo, branch: '' });
                    }}
                  >
                    <option value="/">选择仓库...</option>
                    {repos.map(r => <option key={r.full_name} value={r.full_name}>{r.full_name}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">工作分支</label>
                  <select 
                    className="w-full px-3 py-2.5 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none disabled:opacity-50"
                    value={config.branch}
                    disabled={!config.repo || loadingBranches}
                    onChange={(e) => setConfig({ ...config, branch: e.target.value })}
                  >
                    <option value="">默认 (Default)</option>
                    {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="mt-auto pt-4 space-y-3">
                <div className="flex items-center gap-2 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/50">
                  {config.token && config.repo ? (
                    <><CheckCircle2 className="w-4 h-4 text-green-500" /> <span className="text-[10px] text-green-600 font-bold uppercase">已连接: {config.repo}</span></>
                  ) : (
                    <><AlertCircle className="w-4 h-4 text-amber-500" /> <span className="text-[10px] text-amber-600 font-bold uppercase">等待配置</span></>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col bg-white dark:bg-zinc-950 overflow-hidden">
          
          {viewMode === 'chat' ? (
            /* Chat Interface */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-5 scroll-smooth">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-6 animate-in fade-in duration-700">
                    <div className="w-20 h-20 rounded-3xl bg-blue-50 dark:bg-blue-900/10 flex items-center justify-center text-blue-500 mb-6 shadow-inner">
                      <MessageSquare className="w-10 h-10" />
                    </div>
                    <h2 className="text-xl font-bold tracking-tight text-zinc-800 dark:text-zinc-200">欢迎使用 Git-AI Nexus</h2>
                    <p className="text-zinc-500 text-sm max-w-xs mt-3 leading-relaxed">
                      切换到“浏览器”视图查看仓库内容，或在此发送指令。
                    </p>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                      <div className={`max-w-[90%] rounded-2xl px-4 py-3 shadow-sm ${
                        msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-tl-none'
                      }`}>
                        {msg.files && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {msg.files.map((file, fidx) => (
                              <div key={fidx} className="flex items-center gap-2 px-2 py-1 bg-black/10 rounded-md text-[10px] font-medium">
                                <FileText className="w-3 h-3" />
                                <span className="truncate max-w-[100px] font-mono">{file.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-sans">
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-4 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 shadow-inner">
                {attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {attachedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2 pl-3 pr-2 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/30 rounded-xl">
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-300 truncate max-w-[120px] font-mono">{file.name}</span>
                        <button onClick={() => removeFile(idx)} className="p-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full text-blue-400">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-3 max-w-4xl mx-auto">
                  <div className="flex-1 relative bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-500/50 transition-all">
                    <textarea 
                      rows={Math.min(input.split('\n').length || 1, 5)}
                      placeholder="发送消息..."
                      className="w-full bg-transparent p-4 pr-12 text-sm resize-none focus:outline-none min-h-[52px] max-h-40"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                    />
                    <div className="absolute right-3 bottom-3">
                      <label className="p-2 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer text-zinc-500 block">
                        <input type="file" multiple className="hidden" onChange={handleFileChange} />
                        <Paperclip className="w-5 h-5" />
                      </label>
                    </div>
                  </div>
                  <button onClick={sendMessage} disabled={!input.trim() && attachedFiles.length === 0} className="p-4 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white shadow-lg active:scale-95 shrink-0">
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Explorer View */
            <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-2">
              <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/30">
                <div className="flex items-center gap-2">
                  <FileBox className="w-4 h-4 text-blue-500" />
                  <h3 className="text-sm font-bold tracking-tight">仓库文件浏览</h3>
                </div>
                {loadingContents && <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />}
              </div>
              <div className="flex-1 overflow-y-auto">
                {repoContents.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-12 text-center text-zinc-400">
                    {loadingContents ? (
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                        <p className="text-sm">正在拉取文件列表...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <Info className="w-10 h-10 opacity-30" />
                        <p className="text-sm">尚未连接仓库或仓库为空。<br/><span className="text-xs opacity-60">请在设置中配置有效分支。</span></p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {repoContents.map((file, i) => (
                      <div key={file.sha} className="flex items-center justify-between p-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors group">
                        <div className="flex items-center gap-3">
                          {getFileIcon(file.name, file.type)}
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200 group-hover:text-blue-600 transition-colors">{file.name}</span>
                            <span className="text-[10px] text-zinc-400 font-mono">{file.path}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {file.type === 'file' && <span className="text-[10px] text-zinc-400 font-mono">{formatSize(file.size)}</span>}
                          <a href={file.html_url} target="_blank" rel="noreferrer" className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 rounded-md transition-all">
                            <Github className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default App;
