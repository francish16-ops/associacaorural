import React from 'react';

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
    <input {...props} className={`w-full p-3 border border-stone-300 rounded-lg bg-stone-50 text-stone-900 placeholder:text-stone-500 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition 
                                 dark:bg-white/70 dark:border-white/30 dark:text-black dark:placeholder:text-stone-500 ${props.className}`} />
);
export default Input;