import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const Forbidden403: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <div className="p-4 bg-rose-500/10 rounded-2xl text-rose-400 mb-4 border border-rose-500/20">
        <ShieldAlert className="w-12 h-12" />
      </div>
      <h1 className="text-3xl font-extrabold text-white tracking-tight">403 - Access Forbidden</h1>
      <p className="text-slate-400 mt-2 max-w-md">
        You do not have the required permissions to view this resource. Please contact an administrator or sign in with an elevated account.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg font-medium text-sm transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Home</span>
      </Link>
    </div>
  );
};

