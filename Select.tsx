import React from 'react';

const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
    <select {...props} className={`w-full p-3 border border-stone-300 rounded-lg bg-stone-50 text-stone-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition 
                                  dark:bg-white/70 dark:border-white/30 dark:text-black ${props.className}`}>
        {props.children}
    </select>
);
export default Select;