import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

const Button = ({
    children,
    variant = 'primary',
    className,
    onClick,
    disabled = false,
    ...props
}) => {
    const variants = {
        primary: 'bg-park-sage text-white hover:bg-opacity-90 active:scale-95 shadow-md border-2 border-transparent',
        secondary: 'bg-park-navy text-white hover:bg-opacity-90 active:scale-95 shadow-md border-2 border-transparent',
        outline: 'bg-white text-park-navy border-2 border-park-navy hover:bg-gray-50 active:scale-95 shadow-sm',
        danger: 'bg-red-600 text-white hover:bg-red-700 active:scale-95 shadow-md', // Use sparingly
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={cn(
                'inline-flex items-center justify-center px-8 py-4 text-xl font-bold rounded-xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-offset-2 ring-park-sage disabled:opacity-50 disabled:cursor-not-allowed',
                variants[variant],
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
};

export default Button;
