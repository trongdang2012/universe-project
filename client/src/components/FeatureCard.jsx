import React from 'react';

const FeatureCard = ({ title, subtitle, icon, colorClass, onClick, iconClass }) => {
  return (
    <div 
      onClick={onClick}
      className={`cursor-pointer w-full rounded-2xl p-5 mb-4 flex items-center justify-between transition-transform transform hover:-translate-y-1 shadow-md ${colorClass}`}
    >
      <div className="flex items-center gap-4">
        {/* Vòng tròn 3D bao quanh icon */}
        <div className={`w-14 h-14 rounded-full flex items-center justify-center text-3xl shadow-inner ${iconClass || 'bg-white/20'}`}>
          {icon}
        </div>
        <div>
          <h4 className="text-xl font-black text-white mb-1 leading-tight">{title}</h4>
          <p className="text-sm font-medium text-white/90 leading-snug">{subtitle}</p>
        </div>
      </div>
      <div className="text-white/70 text-2xl font-black">❯</div>
    </div>
  );
};

export default FeatureCard;
