import React from 'react';

const Loader: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 text-center">
      <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-purple-500"></div>
      <p className="text-lg font-semibold text-gray-200">Analyzing Video</p>
      <p className="text-sm text-gray-400">
        This may take a few minutes for longer videos. <br /> Please don't close this window.
      </p>
    </div>
  );
};

export default Loader;
