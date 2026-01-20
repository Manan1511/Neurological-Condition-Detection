import React from 'react';

const Card = ({ children, title, className, ...props }) => {
    return (
        <div
            className={`bg-white rounded-2xl shadow-lg border border-gray-100 p-8 ${className}`}
            {...props}
        >
            {title && (
                <h2 className="text-2xl font-bold text-park-navy mb-6 border-b border-gray-100 pb-4">
                    {title}
                </h2>
            )}
            {children}
        </div>
    );
};

export default Card;
