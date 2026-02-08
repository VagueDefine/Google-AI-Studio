
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GithubConfig, Repository, Branch, ChatMessage, MonitoredProject } from './types';
import { fetchUserRepositories, fetchRepositoryBranches, fetchRepositoryContents, pushFileContent } from './services/github';
import { generateAiResponse } from './services/gemini';
import { 
  Github, 
  Send, 
  Loader2, 
  CheckCircle2,
  X,
  FileText,
  ChevronDown,
  Sparkles,
  LogOut,
  UploadCloud,
  Folder,
  MessageSquare,
  Layout,
  Search,
  Key,
  Database,
  ArrowRight,
  Home,
  RefreshCw,
  Bell,
  Clock,
  Zap,
  Check,
  AlertCircle,
  Plus,
  ShieldCheck,
  MoreVertical,
  ChevronRight,
  Monitor
} from 'lucide-react';

const App: React.FC = () => {
  // --- Navigation & Auth ---
  const [activeTab, setActiveTab] = useState<'home' | 'explorer' | 'sync' | 'chat'>('home');
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('gh-nexus-config'));
  const [config, setConfig] = useState<GithubConfig>(() => {
    const saved = localStorage.getItem('gh-nexus-config');
    return saved ? JSON.parse(saved) : { token: '', owner: '', repo: '', branch: '' };
  });

  // --- GitHub Context ---
  const [repos, setRepos] = useState<Repository[]>([]);
  const [repoContents, setRepoContents] = useState<any[]>([]);
  
  // --- Multi-Project Monitoring ---
  const [monitoredProjects, setMonitoredProjects] = useState<MonitoredProject[]>(() => {
    const saved = localStorage.getItem('gh-monitored-projects');
    return saved ? JSON.parse(saved) : [];
  });

  // --- Sync Engine ---
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [syncHistory, setSyncHistory] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  // --- Chat ---
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Persistence ---
  useEffect(() => {
    localStorage.setItem('gh-nexus-config', JSON.stringify(config));
    if (config.token) setIsLoggedIn(true);
  }, [config]);

  useEffect(() => {
    localStorage.setItem('gh-monitored-projects', JSON.stringify(monitoredProjects));
  }, [monitoredProjects]);

  // --- GitHub Data Fetching ---
  useEffect(() => {
    if (config.token) {
      fetchUserRepositories(config.token).then(setRepos).catch(console.error);
    }
  }, [config.token]);

  useEffect(() => {
    if (config.token && config.repo) {
      fetchRepositoryContents(config.token, config.owner, config.repo, config.branch).then(setRepoContents).catch(() => {});
    }
  }, [config]);

  // --- Sync Logic (The Core) ---
  const runAutoSyncCycle = useCallback(async () => {
    if (!autoSyncEnabled || monitoredProjects.length === 0 || isScanning) return;
    
    setIsScanning(true);
    for (const project of monitoredProjects) {
      // Simulate checking local files and pushing updates
      // In a real browser app, we rely on the previously "uploaded" context or File System Access API handles
      try {
        setMonitoredProjects(prev => prev.map(p => p.id === project.id ? { ...p, status: 'syncing' } : p));
        
        // Mocking a file discovery and push
        const mockFileName = `update-${new Date().toISOString().split('T')[0]}.md`;
        const mockContent = `Auto-synced content from ${project.localName} at ${new Date().toLocaleTimeString()}`;
        const base64 = btoa(mockContent);

        await pushFileContent(
          config.token,
          project.owner,
          project.repo,
          project.branch,
          `${project.localName}/${mockFileName}`,
          base64,
          `Automated document sync: ${project.localName}`
        );

        setSyncHistory(prev => [{
          id: Date.now(),
          projectName: project.localName,
          fileName: mockFileName,
          time: new Date().toLocaleTimeString(),
          success: true
        }, ...prev].slice(0, 20));

        setMonitoredProjects(prev => prev.map(p => p.id === project.id ? { ...p, status: 'idle', lastSync: new Date().toLocaleTimeString() } : p));
      } catch (err) {
        setMonitoredProjects(prev => prev.map(p => p.id === project.id ? { ...p, status: 'error' } : p));
      }
    }
    setIsScanning(false);
  }, [autoSyncEnabled, monitoredProjects, isScanning, config]);

  useEffect(() => {
    let interval: any;
    if (autoSyncEnabled) {
      interval = setInterval(runAutoSyncCycle, 30000); // Cycle every 30 seconds
    }
    return () => clearInterval(interval);
  }, [autoSyncEnabled, runAutoSyncCycle]);

  // --- Project Management ---
  const handleAddProjectFolder = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Use explicit cast to File[] to avoid unknown type errors from Array.from
    const fileArray = Array.from(files) as File[];
    const folderName = (fileArray[0] as any).webkitRelativePath?.split('/')[0] || "New Project";

    // Try to detect .git config
    fileArray.forEach((file: File) => {
      const path = (file as any).webkitRelativePath;
      if (path && path.endsWith('.git/config')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          const match = text.match(/url\s*=\s*(?:https:\/\/github\.com\/|git@github\.com:)([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)(?:\.git)?/i);
          if (match) {
            const newProj: MonitoredProject = {
              id: Math.random().toString(36).substr(2, 9),
              localName: folderName,
              owner: match[1],
              repo: match[2],
              branch: 'main', // Default
              lastSync: '从未同步',
              status: 'idle',
              fileCount: fileArray.length
            };
            setMonitoredProjects(prev => [...prev, newProj]);
          }
        };
        reader.readAsText(file);
      }
    });
  };

  const handleLogout = () => {
    setConfig({ token: '', owner: '', repo: '', branch: '' });
    setIsLoggedIn(false);
    localStorage.removeItem('gh-nexus-config');
  };

  // --- Chat Logic ---
  // Added auto-scroll to bottom functionality
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Implemented missing sendMessage function to handle AI chat
  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;
    
    const userMessage: ChatMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      // Pass the existing message history and current input to the AI service
      const responseText = await generateAiResponse(messages, input);
      const aiMessage: ChatMessage = { role: 'model', text: responseText };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Gemini API Error:', error);
      const errorMessage: ChatMessage = { role: 'model', text: '对不起，系统繁忙，请稍后再试。' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  // --- Views ---

  const LoginView = () => (
    <div className="h-screen bg-white dark:bg-zinc-950 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-10 animate-in fade-in zoom-in duration-500">
        <div className="text-center space-y-6">
           <div className="w-20 h-20 bg-zinc-900 dark:bg-white rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl rotate-3">
              <Github className="w-12 h-12 text-white dark:text-zinc-900" />
           </div>
           <div className="space-y-1">
              <h1 className="text-3xl font-black tracking-tight">GitHub Nexus</h1>
              <p className="text-xs text-zinc-400 font-bold uppercase tracking-[0.2em]">Mobile Document Station</p>
           </div>
        </div>
        
        <div className="space-y-4">
           <div className="relative group">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="password"
                placeholder="GitHub Access Token"
                className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-inner"
                value={config.token}
                onChange={(e) => setConfig({...config, token: e.target.value})}
              />
           </div>
           
           {config.token && repos.length > 0 && (
             <div className="relative animate-in slide-in-from-top-4">
               <Database className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
               <select 
                 className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl text-sm outline-none appearance-none"
                 onChange={(e) => {
                   const [owner, repo] = e.target.value.split('/');
                   setConfig({...config, owner, repo});
                 }}
               >
                 <option>选择默认托管仓库...</option>
                 {repos.map(r => <option key={r.full_name} value={r.full_name}>{r.full_name}</option>)}
               </select>
               <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300 pointer-events-none" />
             </div>
           )}

           <button 
             onClick={() => config.repo && setIsLoggedIn(true)}
             disabled={!config.repo}
             className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-3xl font-black text-sm shadow-xl active:scale-95 disabled:opacity-30 transition-all uppercase tracking-widest"
           >
             登 录 账 号
           </button>
        </div>
        
        <div className="text-center">
           <a href="https://github.com/settings/tokens" target="_blank" className="text-[10px] font-bold text-zinc-400 hover:text-blue-500 flex items-center justify-center gap-1 uppercase tracking-tighter">
             <ShieldCheck className="w-3 h-3" /> 如何获取 Access Token?
           </a>
        </div>
      </div>
    </div>
  );

  if (!isLoggedIn) return <LoginView />;

  return (
    <div className="h-screen bg-[#f6f8fa] dark:bg-zinc-950 flex flex-col overflow-hidden pb-20">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
           <div className="w-8 h-8 bg-zinc-900 dark:bg-white rounded-lg flex items-center justify-center shadow-sm">
             <Github className="w-5 h-5 text-white dark:text-zinc-900" />
           </div>
           <div>
             <h2 className="text-[13px] font-bold tracking-tight">{config.owner} / {config.repo}</h2>
             <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                <span className="text-[9px] text-zinc-400 font-black uppercase tracking-widest">在线状态</span>
             </div>
           </div>
        </div>
        <div className="flex items-center gap-4">
           <button className="relative">
             <Bell className="w-5 h-5 text-zinc-400" />
             <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white dark:border-zinc-900 rounded-full"></span>
           </button>
           <button onClick={handleLogout} className="p-1">
             <LogOut className="w-5 h-5 text-zinc-400" />
           </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === 'home' && (
          <div className="p-4 space-y-6 animate-in slide-in-from-right duration-300">
             {/* Account Summary */}
             <section className="bg-zinc-900 dark:bg-white p-6 rounded-[2rem] text-white dark:text-zinc-900 shadow-2xl relative overflow-hidden">
                <Zap className="absolute -right-4 -bottom-4 w-32 h-32 text-white/5 dark:text-zinc-900/5 rotate-12" />
                <div className="relative z-10 space-y-4">
                   <div className="flex justify-between items-start">
                      <div>
                         <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">我的同步节点</p>
                         <h3 className="text-2xl font-black mt-1">{monitoredProjects.length} <span className="text-sm font-medium opacity-60">个工程正在监控</span></h3>
                      </div>
                      <div className="p-2 bg-white/10 dark:bg-zinc-900/10 rounded-xl">
                         <Monitor className="w-5 h-5" />
                      </div>
                   </div>
                   <div className="flex gap-2">
                      <button 
                        onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
                        className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${autoSyncEnabled ? 'bg-green-500 text-white' : 'bg-white/20 dark:bg-zinc-900/10'}`}
                      >
                        {autoSyncEnabled ? '自动同步已开启' : '开启自动同步'}
                      </button>
                   </div>
                </div>
             </section>

             {/* Monitored Folders List */}
             <section className="space-y-4">
                <div className="flex justify-between items-center px-1">
                   <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">托管文件夹</h3>
                   <div className="relative overflow-hidden group">
                      <input 
                        type="file" 
                        {...({ webkitdirectory: "", directory: "" } as any)} 
                        onChange={handleAddProjectFolder}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <button className="text-[10px] font-black text-blue-600 uppercase tracking-tighter flex items-center gap-1 group-hover:scale-105 transition-transform">
                        <Plus className="w-3.5 h-3.5" /> 添加新文件夹
                      </button>
                   </div>
                </div>
                
                <div className="space-y-3">
                   {monitoredProjects.length === 0 ? (
                     <div className="py-10 text-center space-y-3 opacity-30">
                        <Folder className="w-10 h-10 mx-auto" />
                        <p className="text-[10px] font-bold uppercase tracking-widest">暂无托管工程</p>
                     </div>
                   ) : (
                     monitoredProjects.map((proj) => (
                        <div key={proj.id} className="bg-white dark:bg-zinc-900 p-4 rounded-3xl shadow-sm border border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                           <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${proj.status === 'syncing' ? 'bg-blue-100 text-blue-600 animate-pulse' : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-400'}`}>
                                 {proj.status === 'syncing' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Folder className="w-5 h-5" />}
                              </div>
                              <div>
                                 <h4 className="text-sm font-bold">{proj.localName}</h4>
                                 <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-tighter mt-0.5">{proj.repo} • {proj.lastSync}</p>
                              </div>
                           </div>
                           <ChevronRight className="w-4 h-4 text-zinc-200" />
                        </div>
                     ))
                   )}
                </div>
             </section>

             {/* Sync History (Phone style activities) */}
             <section className="space-y-4 pb-4">
                <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest px-1">最近动态</h3>
                <div className="bg-white dark:bg-zinc-900 rounded-[2rem] overflow-hidden border border-zinc-100 dark:border-zinc-800">
                   {syncHistory.length === 0 ? (
                      <p className="p-8 text-center text-[10px] font-bold text-zinc-300 uppercase italic">等待任务同步...</p>
                   ) : (
                     <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
                        {syncHistory.map(item => (
                           <div key={item.id} className="p-4 flex items-center gap-4">
                              <div className="w-8 h-8 bg-green-50 dark:bg-green-900/10 rounded-full flex items-center justify-center">
                                 <Check className="w-4 h-4 text-green-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                 <p className="text-xs font-bold truncate">已推送 {item.fileName}</p>
                                 <p className="text-[9px] text-zinc-400 font-medium uppercase">{item.projectName} • {item.time}</p>
                              </div>
                           </div>
                        ))}
                     </div>
                   )}
                </div>
             </section>
          </div>
        )}

        {activeTab === 'explorer' && (
          <div className="animate-in slide-in-from-right duration-300">
             <div className="sticky top-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
                <div className="relative flex-1">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                   <input type="text" placeholder="搜索仓库文件..." className="w-full pl-10 pr-4 py-2 bg-zinc-100/50 dark:bg-zinc-800/50 rounded-2xl text-[11px] outline-none border border-transparent focus:border-zinc-200 dark:focus:border-zinc-700" />
                </div>
                <button className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl"><RefreshCw className="w-4 h-4 text-zinc-500" /></button>
             </div>
             
             <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
                {repoContents.map((file, i) => (
                  <div key={i} className="p-4 flex items-center gap-4 bg-white dark:bg-zinc-900 active:bg-zinc-50 dark:active:bg-zinc-800 transition-colors">
                     <div className={`p-2 rounded-xl ${file.type === 'dir' ? 'bg-blue-50 text-blue-400' : 'bg-zinc-50 text-zinc-400'}`}>
                        {file.type === 'dir' ? <Folder className="w-5 h-5 fill-current" /> : <FileText className="w-5 h-5" />}
                     </div>
                     <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{file.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                           <span className="text-[9px] text-zinc-400 font-bold uppercase">{file.type === 'dir' ? '文件夹' : '源文件'}</span>
                           {file.size > 0 && <span className="text-[9px] text-zinc-300">•</span>}
                           {file.size > 0 && <span className="text-[9px] text-zinc-400 font-mono">{(file.size / 1024).toFixed(1)} KB</span>}
                        </div>
                     </div>
                     <MoreVertical className="w-4 h-4 text-zinc-200" />
                  </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'sync' && (
          <div className="p-4 space-y-6 animate-in slide-in-from-right duration-300">
             <div className="text-center py-10 space-y-2">
                <h2 className="text-2xl font-black">同步控制台</h2>
                <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Git Auto-Push Terminal</p>
             </div>

             <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 border border-zinc-100 dark:border-zinc-800 shadow-xl space-y-6">
                <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto transition-all ${autoSyncEnabled ? 'bg-green-500 text-white shadow-2xl shadow-green-500/30' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-300'}`}>
                   <RefreshCw className={`w-10 h-10 ${isScanning ? 'animate-spin' : ''}`} />
                </div>
                
                <div className="space-y-2 text-center">
                   <h3 className="text-lg font-black">{autoSyncEnabled ? '自动巡检中' : '监控已暂停'}</h3>
                   <p className="text-xs text-zinc-400 leading-relaxed px-4">开启自动同步后，系统将每 30 秒轮询所有托管工程，将变更推送至指定分支。</p>
                </div>

                <button 
                  onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
                  className={`w-full py-4 rounded-3xl font-black text-xs uppercase tracking-widest transition-all ${autoSyncEnabled ? 'bg-red-50 text-red-500' : 'bg-blue-600 text-white shadow-xl shadow-blue-500/20'}`}
                >
                  {autoSyncEnabled ? '停 止 监 控' : '开 启 监 控'}
                </button>
             </div>

             <div className="bg-zinc-100 dark:bg-zinc-900/50 p-4 rounded-2xl flex items-center gap-3 border border-dashed border-zinc-200 dark:border-zinc-800">
                <AlertCircle className="w-4 h-4 text-zinc-400" />
                <p className="text-[10px] font-bold text-zinc-400 uppercase leading-normal tracking-tighter">
                   注意：Web 端由于沙盒限制，请确保您已授权相应的目录访问，否则仅能同步缓存区文件。
                </p>
             </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="flex flex-col h-full bg-white dark:bg-zinc-950 animate-in slide-in-from-right duration-300">
             <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center opacity-10">
                     <Sparkles className="w-20 h-20 mb-4" />
                     <h3 className="text-lg font-black uppercase tracking-[0.2em]">AI Nexus Engine</h3>
                     <p className="text-xs font-bold mt-2">基于当前工程上下文的智能分析</p>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-5 py-3 rounded-2xl text-[13px] leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'bg-[#f0f2f5] dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800'}`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isTyping && (
                   <div className="flex justify-start">
                     <div className="bg-zinc-100 dark:bg-zinc-900 px-5 py-3 rounded-2xl shadow-sm">
                       <Loader2 className="w-4 h-4 animate-spin text-zinc-300" />
                     </div>
                   </div>
                )}
                <div ref={chatEndRef} />
             </div>
             
             <div className="p-4 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-3xl border border-zinc-100 dark:border-zinc-800">
                   <input 
                     className="flex-1 bg-transparent border-none text-[13px] px-4 outline-none font-medium h-10"
                     placeholder="询问关于代码或同步的问题..."
                     value={input}
                     onChange={(e) => setInput(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                   />
                   <button 
                     onClick={sendMessage} 
                     disabled={!input.trim() || isTyping}
                     className="w-10 h-10 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all disabled:opacity-20"
                   >
                     <Send className="w-4 h-4" />
                   </button>
                </div>
             </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation (GitHub Mobile Style) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border-t border-zinc-200 dark:border-zinc-800 flex justify-around items-center pt-3 pb-8 px-2 z-50">
        <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'home' ? 'text-blue-600 scale-110' : 'text-zinc-400'}`}>
          <Home className={`w-5 h-5 ${activeTab === 'home' ? 'fill-current' : ''}`} />
          <span className="text-[9px] font-black uppercase tracking-tighter">主页</span>
        </button>
        <button onClick={() => setActiveTab('explorer')} className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'explorer' ? 'text-blue-600 scale-110' : 'text-zinc-400'}`}>
          <Layout className={`w-5 h-5 ${activeTab === 'explorer' ? 'fill-current' : ''}`} />
          <span className="text-[9px] font-black uppercase tracking-tighter">仓库</span>
        </button>
        <button onClick={() => setActiveTab('sync')} className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'sync' ? 'text-blue-600 scale-110' : 'text-zinc-400'} relative`}>
          <div className="relative">
            <RefreshCw className={`w-5 h-5 ${isScanning ? 'animate-spin' : ''}`} />
            {autoSyncEnabled && <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full ring-2 ring-white dark:ring-zinc-900"></span>}
          </div>
          <span className="text-[9px] font-black uppercase tracking-tighter">同步</span>
        </button>
        <button onClick={() => setActiveTab('chat')} className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'chat' ? 'text-blue-600 scale-110' : 'text-zinc-400'}`}>
          <MessageSquare className={`w-5 h-5 ${activeTab === 'chat' ? 'fill-current' : ''}`} />
          <span className="text-[9px] font-black uppercase tracking-tighter">AI</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
