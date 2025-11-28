import React from 'react';
import { Star } from 'lucide-react';

const EthiopianFlag: React.FC = () => {
  return (
    <div className="w-24 h-16 relative overflow-hidden rounded-md shadow-lg mx-auto mb-4">
      {/* Stripes */}
      <div className="absolute top-0 left-0 w-full h-1/3 bg-green-600"></div>
      <div className="absolute top-1/3 left-0 w-full h-1/3 bg-yellow-400"></div>
      <div className="absolute bottom-0 left-0 w-full h-1/3 bg-red-600"></div>

      {/* Emblem (Blue circle with yellow star) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-10 h-10 bg-blue-700 rounded-full flex items-center justify-center border-2 border-yellow-400">
          <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
        </div>
      </div>
    </div>
  );
};

export default EthiopianFlag;