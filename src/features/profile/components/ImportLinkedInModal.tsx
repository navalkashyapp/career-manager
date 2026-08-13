import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Linkedin, Loader2, Upload, FileJson } from 'lucide-react';
import { importLinkedInDataToFirestore } from '../../../services/linkedinImportService';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';

interface ImportLinkedInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: string) => Promise<void>;
}

export default function ImportLinkedInModal({ isOpen, onClose, onImport }: ImportLinkedInModalProps) {
  const [data, setData] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async () => {
    if (!data.trim()) return;
    setIsImporting(true);
    setError(null);
    try {
      // Try to parse as JSON first (from LinkedIn data export)
      try {
        const json = JSON.parse(data);
        await importLinkedInDataToFirestore(json);
        onClose();
        return;
      } catch (e) {
        // Fall back to AI parse if it's not valid JSON
        await onImport(data);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to import LinkedIn data');
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === 'string') {
        setData(result);
      }
    };
    reader.onerror = () => {
      setError("Failed to read the file");
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-[#1E293B] rounded-2xl w-full max-w-2xl overflow-hidden shadow-xl border border-slate-200 dark:border-[#334155] flex flex-col max-h-[90vh]"
        >
          <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-[#334155]">
            <div className="flex items-center space-x-3 text-slate-900 dark:text-white">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Linkedin size={24} />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Import LinkedIn Profile</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Paste your profile data to auto-fill</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onClose} 
            >
              <X size={20} />
            </Button>
          </div>

          <div className="p-6 flex-1 overflow-y-auto">
            {error && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg text-sm">
                {error}
              </div>
            )}
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Upload your LinkedIn data export (Profile.json) or paste raw text/JSON below.
                </p>
                <input 
                  type="file" 
                  accept=".json" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                />
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 border-transparent hover:border-transparent"
                >
                  <FileJson size={14} className="mr-1.5" />
                  Upload JSON
                </Button>
              </div>
              <Textarea
                value={data}
                onChange={(e) => setData(e.target.value)}
                placeholder="Paste raw text here..."
                className="w-full h-64 bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155] rounded-xl p-4 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
              />
            </div>
          </div>

          <div className="p-6 border-t border-slate-200 dark:border-[#334155] bg-slate-50 dark:bg-[#0F172A] flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={isImporting || !data.trim()}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {isImporting ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Parsing...
                </>
              ) : (
                <>
                  <Upload size={16} className="mr-2" />
                  Parse Profile
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
