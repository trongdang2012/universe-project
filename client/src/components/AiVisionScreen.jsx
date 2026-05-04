import React, { useState } from 'react';

const AiVisionScreen = ({ onBack, selectedImage, setSelectedImage, imagePreview, setImagePreview, isOcrLoading, ocrOutput, setOcrOutput, handleScanImage }) => {
  return (
    <div className="min-h-screen bg-[#E91E63] -mx-4 -my-4 md:-mx-6 md:-mt-6 p-4 md:p-6 pb-20 md:pb-20 text-white font-sans sm:rounded-t-3xl">
      <button onClick={onBack} className="flex items-center gap-2 text-white font-bold mb-6 hover:scale-105 transition bg-black/10 px-4 py-2 rounded-full w-fit backdrop-blur-sm">
        <span className="text-xl">❮</span> Quay lại
      </button>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-3xl shadow-inner backdrop-blur-sm">🤖</div>
        <h3 className="text-2xl font-black drop-shadow-sm">The Lazy Scholar</h3>
      </div>
      <p className="text-pink-50 text-[15px] mb-6 font-medium">Chụp ảnh bài giảng, AI sẽ đọc chữ và tóm tắt giúp bạn.</p>
      
      <div className="bg-white/10 p-5 md:p-8 rounded-3xl border border-white/20 shadow-sm backdrop-blur-md">
        <label className="w-full bg-white text-[#E91E63] font-black py-4 rounded-2xl flex items-center justify-center gap-3 cursor-pointer hover:scale-[1.02] transition mb-4 text-[16px] shadow-xl shadow-pink-900/20">
          <span className="text-2xl">📷</span> Bật Camera / Chọn Ảnh 
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e)=>{
            setSelectedImage(e.target.files[0]); 
            setImagePreview(URL.createObjectURL(e.target.files[0])); 
            setOcrOutput("");
          }} />
        </label>
        {imagePreview && <div className="bg-black/20 p-2 rounded-2xl border border-white/10 mb-4 shadow-inner"><img src={imagePreview} className="h-48 md:h-64 w-full object-contain rounded-xl" alt="preview"/></div>}
        {selectedImage && <button onClick={handleScanImage} disabled={isOcrLoading} className="w-full bg-[#ec407a] hover:bg-[#d81b60] text-white font-black py-4 rounded-2xl text-[16px] transition shadow-md border border-white/20 disabled:opacity-50 flex items-center justify-center gap-2">
          {isOcrLoading ? <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>Đang phân tích...</> : "✨ Trích xuất & Tóm tắt"}
        </button>}
      </div>
      {ocrOutput && <div className="mt-6 p-6 bg-white text-gray-800 rounded-3xl text-[15px] whitespace-pre-wrap font-mono shadow-2xl border border-pink-100 leading-relaxed max-h-[400px] overflow-y-auto custom-scrollbar">{ocrOutput}</div>}
    </div>
  );
};

export default AiVisionScreen;
