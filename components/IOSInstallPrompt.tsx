import React, { useState, useEffect } from 'react';
import { ArrowUpTrayIcon, XCircleIcon } from './icons';

const IOSInstallPrompt: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        // A funcionalidade "Adicionar à Tela de Início" só está disponível no Safari em iOS
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
        const hasDismissed = localStorage.getItem('iosInstallPromptDismissed') === 'true';

        // Mostra o prompt apenas no iOS, no Safari, no navegador, e se não foi dispensado antes
        if (isIOS && isSafari && !isInStandaloneMode && !hasDismissed) {
             // Usa um timeout para não ser muito intrusivo no carregamento da página
            const timer = setTimeout(() => {
                setIsVisible(true);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleDismiss = () => {
        localStorage.setItem('iosInstallPromptDismissed', 'true');
        setIsVisible(false);
    };

    if (!isVisible) {
        return null;
    }

    return (
        <div className="fixed bottom-24 sm:bottom-6 left-4 right-4 z-30 bg-gray-800 text-white p-4 rounded-xl shadow-lg animate-fade-in-up flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                 <ArrowUpTrayIcon className="w-10 h-10 flex-shrink-0 text-blue-400" />
                 <div>
                    <p className="font-bold">Instale o app no seu dispositivo</p>
                    <p className="text-sm">Toque no ícone <ArrowUpTrayIcon className="w-4 h-4 inline-block -mt-1" /> e depois em "Adicionar à Tela de Início".</p>
                 </div>
            </div>
            <button onClick={handleDismiss} aria-label="Fechar" className="p-1 self-start">
                <XCircleIcon className="w-6 h-6" />
            </button>
        </div>
    );
};

export default IOSInstallPrompt;