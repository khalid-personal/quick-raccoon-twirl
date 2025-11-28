import React from 'react';
import { Star } from 'lucide-react';

const EthiopianFlag: React.FC = () => {
  return (
    <div className="w-48 h-32 relative overflow-hidden rounded-md shadow-xl mx-auto mb-6 border border-gray-200 dark:border-gray-700">
      {/* Stripes */}
      <div className="absolute top-0 left-0 w-full h-1/3 bg-green-600"></div>
      <div className="absolute top-1/3 left-0 w-full h-1/3 bg-yellow-400"></div>
      <div className="absolute bottom-0 left-0 w-full h-1/3 bg-red-600"></div>

      {/* Emblem (Light Blue circle with gold star and simplified rays) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center border-2 border-yellow-400 relative">
          
          {/* Simplified Rays Simulation: A rotated yellow square to create a starburst effect */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 bg-yellow-400 transform rotate-45 opacity-70"></div>
          </div>
          
          {/* Central Star (Pentagram) */}
          <Star className="h-10 w-10 text-yellow-400 fill-yellow-400 relative z-10" />
        </div>
      </div>
    </div>
  );
};

export default EthiopianFlag;