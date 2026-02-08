
import React, { useState, useEffect, useRef } from 'react';
import { GithubConfig, Repository, Branch, ChatMessage } from './types';
import { fetchUserRepositories, fetchRepositoryBranches } from './services/github';
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
  ChevronDown
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

  // --- Chat State ---
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
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
    }
  }, [config.owner, config.repo]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    (Array.from(files) as File[]).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setAttachedFiles(prev => [...prev, { name: file.name, type: file.type, data: base64 }]);
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
    if (isTyping) return;

    const userMsg: ChatMessage = {
      role: 'user',
      text: input,
      files: attachedFiles.length > 0 ? [...attachedFiles] : undefined
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachedFiles([]);
    setIsTyping(true);

    try {
      const repoContext = config.repo ? `(Repository: ${config.owner}/${config.repo}, Branch: ${config.branch}) ` : "";
      const response = await generateAiResponse(messages, repoContext + userMsg.text, userMsg.files);
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: "❌ 无法连接到 AI。请检查网络或 API 配置。" }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 font-sans">
      {/* Header */}
      <header className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-600 rounded-lg text-white">
            <Github className="w-4 h-4" />
          </div>
          <h1 className="font-bold text-sm tracking-tight hidden sm:block">Git-AI Nexus</h1>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium border border-blue-100 dark:border-blue-900/30">
            {config.repo ? (
              <span className="truncate max-w-[120px]">{config.repo}@{config.branch || 'main'}</span>
            ) : (
              '未连接仓库'
            )}
          </div>
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
          <div className="absolute inset-0 z-20 bg-black/40 backdrop-blur-sm lg:relative lg:inset-auto lg:z-0 lg:bg-transparent lg:w-72 lg:shrink-0 lg:border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
            <div className="w-64 lg:w-full ml-auto h-full bg-white dark:bg-zinc-900 p-5 shadow-2xl lg:shadow-none flex flex-col gap-5">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">配置中心</h2>
                <button onClick={() => setShowSettings(false)} className="lg:hidden p-1 hover:bg-zinc-100 rounded"><X className="w-5 h-5"/></button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium opacity-70">GitHub Token</label>
                  <div className="relative">
                    <input 
                      type="password"
                      className="w-full pl-3 pr-10 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                      placeholder="ghp_..."
                      value={config.token}
                      onChange={(e) => setConfig({ ...config, token: e.target.value })}
                    />
                    <button 
                      onClick={handleFetchRepos}
                      disabled={loadingRepos}
                      className="absolute right-1 top-1 p-1 text-blue-500 hover:bg-blue-50 rounded"
                    >
                      {loadingRepos ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium opacity-70">选择仓库</label>
                  <select 
                    className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none appearance-none"
                    value={`${config.owner}/${config.repo}`}
                    onChange={(e) => {
                      const [owner, repo] = e.target.value.split('/');
                      setConfig({ ...config, owner, repo, branch: '' });
                    }}
                  >
                    <option value="/">请选择...</option>
                    {repos.map(r => (
                      <option key={r.full_name} value={r.full_name}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium opacity-70">选择分支</label>
                  <select 
                    className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none disabled:opacity-50"
                    value={config.branch}
                    disabled={!config.repo || loadingBranches}
                    onChange={(e) => setConfig({ ...config, branch: e.target.value })}
                  >
                    <option value="">默认分支...</option>
                    {branches.map(b => (
                      <option key={b.name} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                  {config.token && config.repo ? (
                    <><CheckCircle2 className="w-4 h-4 text-green-500" /> <span className="text-[10px] text-green-600 font-bold uppercase">已连接</span></>
                  ) : (
                    <><AlertCircle className="w-4 h-4 text-amber-500" /> <span className="text-[10px] text-amber-600 font-bold uppercase">配置不完整</span></>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chat Interface */}
        <div className="flex-1 flex flex-col bg-white dark:bg-zinc-950 overflow-hidden">
          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5 scroll-smooth">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-6 animate-in fade-in duration-700">
                <div className="w-20 h-20 rounded-3xl bg-blue-50 dark:bg-blue-900/10 flex items-center justify-center text-blue-500 mb-6 shadow-inner">
                  <Github className="w-10 h-10" />
                </div>
                <h2 className="text-xl font-bold tracking-tight">你好, Obsidian 用户!</h2>
                <p className="text-zinc-500 text-sm max-w-xs mt-3 leading-relaxed">
                  我已准备好分析您的 GitHub 项目。您可以询问代码逻辑，或上传文件让我为您解答。
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md mt-10">
                  {['解释当前项目结构', '帮我优化 README', '分析我上传的文件', '检查最近的提交记录'].map(t => (
                    <button 
                      key={t}
                      onClick={() => setInput(t)}
                      className="p-3 text-left text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-blue-500 hover:bg-white dark:hover:bg-zinc-800 transition-all shadow-sm"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                  <div className={`max-w-[90%] rounded-2xl px-4 py-3 shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-tr-none' 
                      : 'bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-tl-none'
                  }`}>
                    {msg.files && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {msg.files.map((file, fidx) => (
                          <div key={fidx} className="flex items-center gap-2 px-2 py-1 bg-black/10 rounded-md text-[10px] font-medium">
                            <FileText className="w-3 h-3" />
                            <span className="truncate max-w-[100px]">{file.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                      {msg.text}
                    </div>
                  </div>
                </div>
              ))
            )}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-3 shadow-sm">
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
                  </div>
                  <span className="text-xs font-medium text-zinc-400">Gemini 思考中...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 shadow-[0_-4px_12px_rgba(0,0,0,0.02)]">
            {/* File Previews */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {attachedFiles.map((file, idx) => (
                  <div key={idx} className="relative flex items-center gap-2 pl-3 pr-2 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/30 rounded-xl group transition-all hover:bg-blue-100">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300 truncate max-w-[120px]">{file.name}</span>
                    <button 
                      onClick={() => removeFile(idx)}
                      className="p-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full text-blue-400"
                    >
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
                  placeholder="输入消息或指令..."
                  className="w-full bg-transparent p-4 pr-12 text-sm resize-none focus:outline-none min-h-[52px] max-h-40"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <div className="absolute right-3 bottom-3">
                  <label className="p-2 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer transition-colors text-zinc-500 block">
                    <input type="file" multiple className="hidden" onChange={handleFileChange} />
                    <Paperclip className="w-5 h-5" />
                  </label>
                </div>
              </div>
              <button 
                onClick={sendMessage}
                disabled={isTyping || (!input.trim() && attachedFiles.length === 0)}
                className="p-4 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20 transition-all transform active:scale-95"
              >
                {isTyping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
