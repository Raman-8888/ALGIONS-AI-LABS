import React from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, ArrowLeft } from 'lucide-react';

export const NotFound404: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <div className="p-4 bg-indigo-500/10 rounded-2xl text-indigo-400 mb-4 border border-indigo-500/20">
        <HelpCircle className="w-12 h-12" />
      </div>
      <h1 className="text-3xl font-extrabold text-white tracking-tight">404 - Page Not Found</h1>
      <p className="text-slate-400 mt-2 max-w-md">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium text-sm transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Home</span>
      </Link>
    </div>
  );
};

