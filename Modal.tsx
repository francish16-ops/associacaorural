import React from 'react';
import { XCircleIcon } from './components/icons';

const Modal: React.FC<{ title: string, onClose: () => void, children: React.ReactNode }> = ({ title, onClose, children }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-auto max-h-[90vh] flex flex-col border border-stone-200 text-stone-800
                        dark:bg-black/40 dark:backdrop-blur-lg dark:border-white/20 dark:text-white">
            <div className="p-4 border-b border-stone-200 flex justify-between items-center sticky top-0 bg-white/95 z-10 rounded-t-lg
                            dark:bg-black/40 dark:backdrop-blur-lg dark:border-white/20">
                <h2 className="text-xl font-bold">{title}</h2>
                <button onClick={onClose} className="text-stone-500 hover:text-stone-800 dark:text-stone-300 dark:hover:text-white">
                    <XCircleIcon className="w-8 h-8"/>
                </button>
            </div>
            <div className="p-6 overflow-y-auto">{children}</div>
        </div>
    </div>
);
export default Modal;