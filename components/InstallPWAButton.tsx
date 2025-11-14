import React from 'react';
import { DownloadIcon } from './icons';

interface InstallPWAButtonProps {
  onInstall: () => void;
}

const InstallPWAButton: React.FC<InstallPWAButtonProps> = ({ onInstall }) => {
  return (
    <button
      onClick={onInstall}
      className="fixed bottom-24 sm:bottom-6 right-6 z-30 bg-cyan-600 text-white p-4 rounded-full shadow-lg hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-transform transform hover:scale-110 animate-fade-in-up"
      aria-label="Instalar aplicativo"
      title="Instalar aplicativo"
    >
      <DownloadIcon className="h-6 w-6" />
    </button>
  );
};

export default InstallPWAButton;