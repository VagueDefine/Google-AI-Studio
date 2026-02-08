
import React, { useState, useEffect, useRef } from 'react';
import { GithubConfig, Repository, Branch, ChatMessage } from './types';
import { fetchUserRepositories, fetchRepositoryBranches, fetchRepositoryContents } from './services/github';
import { generateAiResponse } from './services/gemini';
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
  LogOut,
  Info,
  UploadCloud,
  FileCode,
  Folder,
  MessageSquare,
  FileJson,
  Layout,
  ArrowRight,
  Search,
  ChevronUp,
  Key,
  Database
} from 'lucide-react';

const App: React.FC = () => {
  // --- Configuration State ---
  const [config, setConfig] = useState<GithubConfig>(() => {
    const saved = localStorage.getItem('gh-nexus-config');
    return saved ? JSON.parse(saved) : { token: '', owner: '', repo: '', branch: '' };
  });
  
  const [showSettings, setShowSettings] = useState(false);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);

  // --- Explorer State ---
  const [viewMode, setViewMode] = useState<'chat' | 'explorer'>('explorer');
  const [repoContents, setRepoContents] = useState<any[]>([]);
  const [loadingContents, setLoadingContents] = useState(false);

  // --- Detection State ---
  const [detectedConfig, setDetectedConfig] = useState<Partial<GithubConfig> | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // --- Chat State ---
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; type: string; data: string }>>([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Login Status ---
  const isConfigured = !!(config.token && config.repo);

  // --- Persistence & Effects ---
  useEffect(() => {
    localStorage.setItem('gh-nexus-config', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    if (config.token) handleFetchRepos();
  }, [config.token]);

  useEffect(() => {
    if (config.token && config.owner && config.repo) {
      handleFetchBranches();
      handleFetchContents();
    }
  }, [config.owner, config.repo, config.branch]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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
      setDetectedConfig(prev => ({ ...prev, ...results }));
    }
  };

  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setIsScanning(true);

    const fileArray = Array.from(files);
    let processed = 0;
    
    fileArray.forEach(file => {
      const path = (file as any).webkitRelativePath || file.name;
      if (path.endsWith('.git/config') || path.endsWith('.env') || path.endsWith('.env.local') || path.endsWith('package.json')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          scanContentForConfig(text, file.name);
          processed++;
          if (processed === fileArray.length) setIsScanning(false);
        };
        reader.readAsText(file);
      } else {
        processed++;
        if (processed === fileArray.length) setIsScanning(false);
      }
    });
    e.target.value = '';
  };

  const applyDetectedConfig = () => {
    if (detectedConfig) {
      const newConfig = { ...config, ...detectedConfig };
      setConfig(newConfig as GithubConfig);
      setDetectedConfig(null);
    }
  };

  const handleLogout = () => {
    const reset = { token: '', owner: '', repo: '', branch: '' };
    setConfig(reset);
    setRepoContents([]);
    setMessages([]);
    localStorage.removeItem('gh-nexus-config');
  };

  const sendMessage = async () => {
    if (!input.trim() && attachedFiles.length === 0) return;
    if (isTyping) return;

    const userMsg: ChatMessage = {
      role: 'user',
      text: input,
      files: attachedFiles.length > 0 ? [...attachedFiles] : undefined
    };
    
    const history = [...messages];
    const currentInput = input;
    const currentFiles = attachedFiles.length > 0 ? [...attachedFiles] : undefined;

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachedFiles([]);
    setIsTyping(true);

    try {
      const response = await generateAiResponse(history, currentInput, currentFiles);
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'model', text: "发生错误，请重试。" }]);
    } finally {
      setIsTyping(false);
    }
  };

  const getFileIcon = (name: string, type: string) => {
    if (type === 'dir' || name === '.git') return <Folder className="w-4 h-4 text-amber-400 fill-amber-400/20" />;
    if (name.endsWith('.md')) return <FileText className="w-4 h-4 text-zinc-500" />;
    if (name.endsWith('.json')) return <FileJson className="w-4 h-4 text-zinc-500" />;
    if (name.endsWith('.tsx') || name.endsWith('.ts')) return <FileCode className="w-4 h-4 text-zinc-500" />;
    if (name.endsWith('.html')) return <Layout className="w-4 h-4 text-blue-500" />;
    return <FileText className="w-4 h-4 text-zinc-400" />;
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const getFileTypeName = (name: string, type: string) => {
    if (type === 'dir') return '文件夹';
    if (name === '.gitignore') return 'Git Ignore 源文件';
    if (name.endsWith('.tsx')) return 'TSX 文件';
    if (name.endsWith('.ts')) return 'TS 文件';
    if (name.endsWith('.md')) return 'Markdown 源文件';
    if (name.endsWith('.json')) return 'JSON 文件';
    if (name.endsWith('.html')) return 'HTML 文件';
    if (name.startsWith('.env')) return 'LOCAL 文件';
    return '文件';
  };

  const LoginPortal = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#f0f0f0] dark:bg-zinc-950 overflow-y-auto">
      <div className="w-full max-w-lg animate-in fade-in zoom-in duration-500">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
          <div className="p-10 text-center bg-zinc-50 dark:bg-zinc-800/20 border-b border-zinc-100 dark:border-zinc-800">
            <div className="w-16 h-16 bg-zinc-900 dark:bg-zinc-100 rounded-2xl flex items-center justify-center text-white dark:text-zinc-900 mx-auto mb-6 shadow-lg">
              <Github className="w-9 h-9" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100 tracking-tight">Git-AI 协同工作站</h1>
            <p className="text-zinc-400 text-sm mt-3 px-4 leading-relaxed font-medium">Obsidian 专属代码智能助手</p>
          </div>

          <div className="p-10 space-y-8">
            {/* Folder Upload Entry */}
            {!detectedConfig ? (
              <div className="relative group">
                <input 
                  type="file" 
                  {...({ webkitdirectory: "", directory: "" } as any)} 
                  onChange={handleFolderUpload} 
                  className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer" 
                  disabled={isScanning}
                />
                <div className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-10 flex flex-col items-center gap-4 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800/50 group-hover:border-zinc-900 dark:group-hover:border-zinc-100 transition-all">
                  <div className="w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                     {isScanning ? <Loader2 className="w-7 h-7 animate-spin text-zinc-400" /> : <UploadCloud className="w-7 h-7 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100" />}
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-zinc-800 dark:text-zinc-200">{isScanning ? '正在扫描项目...' : '选择项目根目录'}</p>
                    <p className="text-xs text-zinc-400 mt-1.5 font-medium">将识别包含 .git 的文件夹</p>
                  </div>
                </div>
              </div>
            ) : (
              /* Scanning Results Display */
              <div className="animate-in slide-in-from-bottom-4 duration-500">
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-700 space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-700">
                     <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                       <CheckCircle2 className="w-5 h-5 text-green-600" />
                     </div>
                     <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 uppercase tracking-widest">扫描到配置信息</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800">
                       <div className="flex items-center gap-3">
                         <Database className="w-4 h-4 text-zinc-400" />
                         <span className="text-xs font-bold text-zinc-500 uppercase tracking-tighter">仓库名称</span>
                       </div>
                       <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-[180px]">{detectedConfig.repo || '未检测到'}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800">
                       <div className="flex items-center gap-3">
                         <Info className="w-4 h-4 text-zinc-400" />
                         <span className="text-xs font-bold text-zinc-500 uppercase tracking-tighter">所有者</span>
                       </div>
                       <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{detectedConfig.owner || '未检测到'}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800">
                       <div className="flex items-center gap-3">
                         <Key className="w-4 h-4 text-zinc-400" />
                         <span className="text-xs font-bold text-zinc-500 uppercase tracking-tighter">API 令牌</span>
                       </div>
                       <div className="flex items-center gap-1.5">
                         {detectedConfig.token ? (
                           <span className="text-[10px] px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded-full font-bold">已识别 (PAT)</span>
                         ) : (
                           <span className="text-[10px] px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-full font-bold">未找到</span>
                         )}
                       </div>
                    </div>
                  </div>

                  {!detectedConfig.token && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-xl">
                      <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">⚠️ 未从 .env 等文件中检测到 Token，请在下方手动输入以启用完整功能。</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button 
                      onClick={applyDetectedConfig}
                      className="flex-1 py-3.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-bold text-sm shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      应用此配置
                    </button>
                    <button 
                      onClick={() => setDetectedConfig(null)}
                      className="px-6 py-3.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl font-bold text-sm hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-all"
                    >
                      重置
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="relative flex items-center">
              <div className="flex-grow border-t border-zinc-100 dark:border-zinc-800"></div>
              <span className="flex-shrink mx-4 text-[10px] text-zinc-300 font-bold uppercase tracking-widest">或手动配置</span>
              <div className="flex-grow border-t border-zinc-100 dark:border-zinc-800"></div>
            </div>

            <div className="space-y-4">
               <div className="relative">
                  <input 
                    type="password"
                    placeholder="GitHub Personal Access Token"
                    className="w-full pl-4 pr-12 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-4 focus:ring-zinc-900/5 dark:focus:ring-white/5 focus:border-zinc-900 transition-all"
                    value={config.token}
                    onChange={(e) => setConfig({ ...config, token: e.target.value })}
                  />
                  <button onClick={handleFetchRepos} className="absolute right-2 top-2 p-2.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
                    {loadingRepos ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                  </button>
               </div>
               
               {config.token && repos.length > 0 && (
                 <select 
                   className="w-full px-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm outline-none animate-in slide-in-from-top-2 focus:border-zinc-900"
                   value={`${config.owner}/${config.repo}`}
                   onChange={(e) => {
                     const [owner, repo] = e.target.value.split('/');
                     if (owner && repo) setConfig({ ...config, owner, repo });
                   }}
                 >
                   <option value="/">请选择目标仓库...</option>
                   {repos.map(r => <option key={r.full_name} value={r.full_name}>{r.full_name}</option>)}
                 </select>
               )}
            </div>
          </div>
        </div>
        <p className="text-[10px] text-center text-zinc-400 mt-10 font-mono tracking-[0.2em] uppercase opacity-50">
          Built for Obsidian • Local Engine v1.7.5
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 font-sans select-none">
      {!isConfigured ? (
        <LoginPortal />
      ) : (
        <>
          {/* Workspace Header */}
          <header className="flex items-center justify-between p-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-900 z-10">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded">
                <Github className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-xs font-bold tracking-tight">{config.repo}</h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-zinc-400 font-medium font-mono uppercase">Branch: {config.branch || 'main'}</span>
                  <ChevronDown className="w-3 h-3 text-zinc-300" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg">
              <button 
                onClick={() => setViewMode('explorer')}
                className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all flex items-center gap-2 ${viewMode === 'explorer' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'}`}
              >
                <Layout className="w-3.5 h-3.5" /> 资源管理器
              </button>
              <button 
                onClick={() => setViewMode('chat')}
                className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all flex items-center gap-2 ${viewMode === 'chat' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'}`}
              >
                <MessageSquare className="w-3.5 h-3.5" /> AI 对话
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative group hidden sm:block">
                 <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                 <input type="text" placeholder="搜索文件..." className="pl-8 pr-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg text-[11px] w-40 outline-none" />
              </div>
              <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400"><Settings className="w-5 h-5"/></button>
              <button onClick={handleLogout} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg text-zinc-400 hover:text-red-500"><LogOut className="w-5 h-5"/></button>
            </div>
          </header>

          <main className="flex-1 flex overflow-hidden">
             <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-zinc-950">
               {viewMode === 'explorer' ? (
                 <div className="flex-1 flex flex-col overflow-hidden">
                   <table className="w-full text-left border-collapse table-fixed">
                     <thead>
                       <tr className="border-b border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-400 font-normal bg-zinc-50/50 dark:bg-zinc-900/50">
                         <th className="px-6 py-2.5 font-normal w-[45%] group cursor-pointer hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 transition-colors">
                           <div className="flex items-center justify-between pr-4">
                             名称 <ChevronUp className="w-3 h-3 text-zinc-300" />
                           </div>
                         </th>
                         <th className="px-4 py-2.5 font-normal w-[20%] border-l border-zinc-100 dark:border-zinc-800">修改日期</th>
                         <th className="px-4 py-2.5 font-normal w-[20%] border-l border-zinc-100 dark:border-zinc-800">类型</th>
                         <th className="px-4 py-2.5 font-normal w-[15%] border-l border-zinc-100 dark:border-zinc-800">大小</th>
                       </tr>
                     </thead>
                   </table>
                   <div className="flex-1 overflow-y-auto">
                     {loadingContents ? (
                       <div className="h-full flex items-center justify-center">
                         <Loader2 className="w-8 h-8 animate-spin text-zinc-200" />
                       </div>
                     ) : (
                       <table className="w-full text-left border-collapse table-fixed">
                         <tbody>
                           {repoContents.map((file) => (
                             <tr key={file.sha} className="group hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors border-b border-zinc-50 dark:border-zinc-900/50 cursor-default">
                               <td className="px-6 py-1.5 w-[45%] truncate text-xs">
                                 <div className="flex items-center gap-3">
                                   {getFileIcon(file.name, file.type)}
                                   <span className="text-zinc-700 dark:text-zinc-200 font-medium">{file.name}</span>
                                 </div>
                               </td>
                               <td className="px-4 py-1.5 w-[20%] text-[11px] text-zinc-400 truncate font-mono">2026/2/8 18:41</td>
                               <td className="px-4 py-1.5 w-[20%] text-[11px] text-zinc-400 truncate font-medium">{getFileTypeName(file.name, file.type)}</td>
                               <td className="px-4 py-1.5 w-[15%] text-[11px] text-zinc-400 text-right pr-8 font-mono">{file.type === 'file' ? formatSize(file.size) : ''}</td>
                             </tr>
                           ))}
                         </tbody>
                       </table>
                     )}
                   </div>
                   <div className="p-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex justify-between items-center px-6">
                      <p className="text-[10px] text-zinc-400 uppercase tracking-tighter font-bold">{repoContents.length} 个项目</p>
                      <div className="flex items-center gap-3">
                         <a href={`https://github.com/${config.owner}/${config.repo}`} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline font-bold">在 GitHub 中打开</a>
                      </div>
                   </div>
                 </div>
               ) : (
                 <div className="flex-1 flex flex-col overflow-hidden p-6">
                    <div className="flex-1 overflow-y-auto space-y-6">
                      {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto opacity-30">
                          <div className="p-5 bg-zinc-100 dark:bg-zinc-800 rounded-3xl mb-4">
                            <MessageSquare className="w-10 h-10" />
                          </div>
                          <p className="text-xs font-bold uppercase tracking-widest">开始基于项目代码进行对话分析</p>
                        </div>
                      )}
                      {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                           <div className={`max-w-[85%] px-5 py-3 rounded-2xl text-xs leading-relaxed ${msg.role === 'user' ? 'bg-zinc-900 text-white shadow-xl' : 'bg-zinc-100 dark:bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-700'}`}>
                             {msg.text}
                           </div>
                        </div>
                      ))}
                      {isTyping && (
                        <div className="flex justify-start">
                          <div className="bg-zinc-100 dark:bg-zinc-800 px-5 py-3 rounded-2xl shadow-sm">
                            <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                    <div className="mt-6 flex items-center gap-3">
                       <input 
                         className="flex-1 bg-zinc-100 dark:bg-zinc-800 border-none rounded-2xl px-5 py-4 text-sm outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700 transition-all"
                         placeholder="输入消息或指令..."
                         value={input}
                         onChange={(e) => setInput(e.target.value)}
                         onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                         disabled={isTyping}
                       />
                       <button 
                         onClick={sendMessage} 
                         disabled={isTyping || (!input.trim() && attachedFiles.length === 0)}
                         className="p-4 bg-zinc-900 dark:bg-white dark:text-black text-white rounded-2xl shadow-xl active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all"
                       >
                         <Send className="w-5 h-5"/>
                       </button>
                    </div>
                 </div>
               )}
             </div>
          </main>
        </>
      )}
    </div>
  );
};

export default App;
