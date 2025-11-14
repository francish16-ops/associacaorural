import React from 'react';

const Button: React.FC<{ onClick?: () => void, children: React.ReactNode, className?: string, type?: 'button' | 'submit' | 'reset', variant?: 'primary' | 'secondary', disabled?: boolean }> = ({ onClick, children, className, type = 'button', variant = 'primary', disabled = false }) => {
    const baseClasses = 'w-full px-4 py-3 rounded-xl font-semibold shadow-sm transition-transform transform hover:scale-105 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 text-center';
    const variantClasses = {
        primary: 'bg-orange-500 hover:bg-orange-600 text-white',
        secondary: 'bg-stone-200 hover:bg-stone-300 text-stone-800'
    };
    return (
        <button type={type} onClick={onClick} disabled={disabled} className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
            {children}
        </button>
    );
};
export default Button;