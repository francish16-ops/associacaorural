import React from 'react';

const Card: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className }) => {
    const defaultStyles = !className?.includes('bg-')
        ? 'bg-white text-stone-900 dark:bg-black/30 dark:text-white'
        : '';
    
    return (
        <div className={`${defaultStyles} rounded-xl shadow-lg border border-stone-200 p-4 sm:p-6 dark:backdrop-blur-lg dark:border-white/20 ${className || ''}`}>
            {children}
        </div>
    );
};
export default Card;
