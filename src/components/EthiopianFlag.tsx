import React from 'react';
import { Star } from 'lucide-react';

const EthiopianFlag: React.FC = () => {
  return (
    <div className="w-36 h-24 relative overflow-hidden rounded-md shadow-xl mx-auto mb-6 border border-gray-200 dark:border-gray-700">
      {/* Stripes */}
      <div className="absolute top-0 left-0 w-full h-1/3 bg-green-600"></div>
      <div className="absolute top-1/3 left-0 w-full h-1/3 bg-yellow-400"></div>
      <div className="absolute bottom-0 left-0 w-full h-1/3 bg-red-600"></div>

      {/* Emblem (Blue circle with yellow star) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center border-2 border-yellow-400">
          <Star className="h-8 w-8 text-yellow-400 fill-yellow-400" />
        </div>
      </div>
    </div>
  );
};

export default EthiopianFlag;