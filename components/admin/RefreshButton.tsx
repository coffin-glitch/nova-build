"use client";

import { useState } from "react";

export default function RefreshButton() {
  const [clickCount, setClickCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = () => {
    setClickCount(prev => prev + 1);
    setIsLoading(true);
    
    // Simulate refresh action
    setTimeout(() => {
      setIsLoading(false);
      console.log("Refresh button clicked from client component!");
    }, 1000);
  };

  return (
    <div className="bg-slate-700 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-3">Client Component Test - Step 3</h3>
      <button
        onClick={handleClick}
        disabled={isLoading}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg text-sm font-medium transition-colors"
      >
        {isLoading ? "Refreshing..." : "Refresh Data"}
      </button>
      <p className="text-gray-300 mt-2 text-sm">
        Button clicked: <span className="text-blue-400 font-bold">{clickCount}</span> times
      </p>
      <p className="text-green-400 text-sm mt-1">✅ Client component working!</p>
    </div>
  );
}
