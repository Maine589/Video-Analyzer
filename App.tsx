import React, { useState, useRef, useCallback, useEffect } from 'react';
import { startAnalysisAndChat } from './services/geminiService';
import Loader from './components/Loader';
import { UploadIcon, VideoIcon, SparklesIcon, SendIcon } from './components/icons';
import type { Chat } from '@google/genai';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

// AnalysisDisplay component defined within App.tsx to keep file count low
const AnalysisDisplay: React.FC<{ analysisText: string }> = ({ analysisText }) => {
  if (!analysisText) return null;

  const sections = analysisText.split(/(?=###\s)/);

  return (
    <div className="bg-gray-800/50 p-6 rounded-lg ring-1 ring-white/10 text-gray-300 space-y-6">
      {sections.map((section, index) => {
        if (!section.trim()) return null;
        const lines = section.trim().split('\n');
        const title = lines.shift() || '';

        return (
          <div key={index}>
            {title.startsWith('###') && (
              <h3 className="text-xl font-bold text-purple-400 border-b border-gray-600 pb-2 mb-4">
                {title.replace('###', '').trim()}
              </h3>
            )}
            <div className="space-y-2 text-sm md:text-base">
              {lines.map((line, lineIndex) => {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith('- **')) {
                  const match = trimmedLine.match(/- \*\*(.*?):\*\*/);
                  const restOfLine = trimmedLine.replace(/- \*\*(.*?):\*\*/, '').trim();
                  return (
                    <div key={lineIndex} className="mt-3">
                      <p className="font-semibold text-gray-100">
                        {match ? match[1] : ''}
                      </p>
                      {restOfLine && <p className="pl-4 text-gray-400">{restOfLine}</p>}
                    </div>
                  );
                }
                if (trimmedLine.startsWith('-')) {
                  return (
                    <div key={lineIndex} className="flex items-start pl-4">
                      <span className="mr-2 mt-1 text-purple-400 text-xl leading-none">•</span>
                      <span>{trimmedLine.substring(1).trim()}</span>
                    </div>
                  );
                }
                return <p key={lineIndex}>{line}</p>;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ChatInterface: React.FC<{
  chatHistory: ChatMessage[];
  isChatLoading: boolean;
  onSendMessage: (message: string) => void;
}> = ({ chatHistory, isChatLoading, onSendMessage }) => {
  const [message, setMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isChatLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isChatLoading) {
      onSendMessage(message);
      setMessage('');
    }
  };

  return (
    <div className="mt-6 flex flex-col h-[400px] bg-gray-900/50 rounded-lg p-4">
       <h3 className="text-xl font-semibold text-gray-100 mb-4 text-center">3. Ask a Follow-up</h3>
      <div className="flex-grow overflow-y-auto pr-2 space-y-4">
        {chatHistory.map((chat, index) => (
          <div key={index} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-2xl ${
                chat.role === 'user' ? 'bg-purple-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'
              }`}
            >
              {chat.text}
            </div>
          </div>
        ))}
        {isChatLoading && (
           <div className="flex justify-start">
             <div className="bg-gray-700 text-gray-200 rounded-2xl rounded-bl-none px-4 py-2">
                <div className="flex items-center justify-center">
                    <span className="animate-pulse">●</span>
                    <span className="animate-pulse delay-150">●</span>
                    <span className="animate-pulse delay-300">●</span>
                </div>
            </div>
           </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask a question about the video..."
          disabled={isChatLoading}
          className="flex-grow bg-gray-700 border border-gray-600 rounded-full py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
          aria-label="Chat input"
        />
        <button
          type="submit"
          disabled={isChatLoading || !message.trim()}
          className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900/50 disabled:cursor-not-allowed text-white font-bold p-3 rounded-full transition-all duration-300 transform hover:scale-110 shadow-lg"
          aria-label="Send message"
        >
          <SendIcon />
        </button>
      </form>
    </div>
  );
};


const App: React.FC = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File | null) => {
    if (file) {
      if (file.type !== 'video/mp4') {
        setError('Please upload a valid MP4 file.');
        return;
      }
      resetState();
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoPreviewUrl(url);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0] || null);
  };

  const handleAnalyzeClick = async () => {
    if (!videoFile) {
      setError('Please select a video file first.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setAnalysis(null);
    setChatSession(null);
    setChatHistory([]);
    try {
      const result = await startAnalysisAndChat(videoFile);
      setAnalysis(result.analysis);
      setChatSession(result.chatSession);
      // We don't add the initial analysis to history, chat starts empty for the user
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!chatSession) return;
    setIsChatLoading(true);
    setChatHistory(prev => [...prev, { role: 'user', text: message }]);
    try {
      const response = await chatSession.sendMessage({ message });
      setChatHistory(prev => [...prev, { role: 'model', text: response.text }]);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to get a response.';
      setChatHistory(prev => [...prev, { role: 'model', text: `Error: ${errorMessage}` }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleDragEvents = (e: React.DragEvent<HTMLDivElement>, isOver: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(isOver);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    handleDragEvents(e, false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };
  
  const triggerFileSelect = () => fileInputRef.current?.click();

  const resetState = () => {
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
    setVideoFile(null);
    setVideoPreviewUrl(null);
    setAnalysis(null);
    setError(null);
    setIsLoading(false);
    setChatSession(null);
    setChatHistory([]);
    setIsChatLoading(false);
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-500 to-cyan-400 text-transparent bg-clip-text">
            Gemini Video Analyzer
          </h1>
          <p className="text-gray-400 mt-2 text-lg">
            Unlock insights from your videos with the power of AI.
          </p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="flex flex-col space-y-6">
            <div className="bg-gray-800 p-6 rounded-xl shadow-lg h-full flex flex-col">
              <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-semibold text-gray-100">1. Upload Video</h2>
                  {videoFile && (
                    <button onClick={resetState} className="text-sm text-cyan-400 hover:text-cyan-300">
                      Start Over
                    </button>
                  )}
              </div>
              {!videoFile ? (
                 <div
                 onDragEnter={(e) => handleDragEvents(e, true)}
                 onDragOver={(e) => handleDragEvents(e, true)}
                 onDragLeave={(e) => handleDragEvents(e, false)}
                 onDrop={handleDrop}
                 onClick={triggerFileSelect}
                 className={`flex-grow flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer transition-colors ${isDragging ? 'border-purple-500 bg-gray-700/50' : 'border-gray-600 hover:border-purple-500 hover:bg-gray-700/30'}`}
               >
                 <UploadIcon />
                 <p className="mt-2 text-center">
                   {isDragging ? 'Drop it like it\'s hot!' : 'Drag & drop an MP4 file here, or click to select'}
                 </p>
                 <p className="text-xs text-gray-500 mt-1">Max file size: 1GB</p>
                 <input
                   ref={fileInputRef}
                   type="file"
                   accept="video/mp4"
                   onChange={handleFileChange}
                   className="hidden"
                 />
               </div>
              ) : (
                <div className="flex flex-col items-center space-y-4">
                  <video src={videoPreviewUrl ?? ''} controls className="w-full max-h-96 rounded-lg bg-black" />
                  <p className="text-gray-400 break-all text-center">{videoFile.name}</p>
                </div>
              )}
            </div>
            {videoFile && (
              <button
                onClick={handleAnalyzeClick}
                disabled={isLoading}
                className="w-full flex items-center justify-center bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900/50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                <SparklesIcon/>
                {isLoading ? 'Analyzing...' : 'Analyze Video'}
              </button>
            )}
          </div>

          <div className="bg-gray-800 p-6 rounded-xl shadow-lg flex flex-col">
            <h2 className="text-2xl font-semibold text-gray-100 mb-4">2. AI Analysis</h2>
            <div className="flex-grow flex flex-col">
              {isLoading && <div className="flex-grow flex items-center justify-center"><Loader /></div>}
              {error && <div className="flex-grow flex items-center justify-center"><p className="text-red-400 text-center">{error}</p></div>}
              
              {!isLoading && !error && !analysis && (
                <div className="flex-grow flex items-center justify-center text-center text-gray-500 bg-gray-900/50 rounded-lg">
                    <div>
                        <VideoIcon />
                        <p>Your video analysis will appear here.</p>
                    </div>
                </div>
              )}
              
              {analysis && (
                <div className="flex-grow flex flex-col">
                  <AnalysisDisplay analysisText={analysis} />
                  {chatSession && (
                    <ChatInterface 
                      chatHistory={chatHistory} 
                      isChatLoading={isChatLoading} 
                      onSendMessage={handleSendMessage} 
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
