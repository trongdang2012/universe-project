import React, { useState } from 'react';

const AiSolveScreen = ({ onBack }) => {
  const [isSolving, setIsSolving] = useState(false);
  const [solution, setSolution] = useState(null);

  const handleSolve = () => {
    setIsSolving(true);
    setTimeout(() => {
      setSolution(`**Đề bài:** Giải phương trình bậc 2: x² - 5x + 6 = 0\n\n**Bước 1:** Tính Δ\nΔ = b² - 4ac = (-5)² - 4(1)(6) = 25 - 24 = 1\n\n**Bước 2:** Biện luận\nVì Δ > 0, phương trình có 2 nghiệm phân biệt:\nx1 = (5 + 1)/2 = 3\nx2 = (5 - 1)/2 = 2\n\n**Đáp số:** Phương trình có 2 nghiệm x = 3, x = 2.`);
      setIsSolving(false);
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-[#4CAF50] -mx-4 -my-4 md:-mx-6 md:-mt-6 p-4 md:p-6 pb-20 md:pb-20 text-white font-sans sm:rounded-t-3xl">
      <button onClick={onBack} className="flex items-center gap-2 text-white font-bold mb-6 hover:scale-105 transition bg-black/10 px-4 py-2 rounded-full w-fit backdrop-blur-sm">
        <span className="text-xl">❮</span> Quay lại
      </button>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl shadow-inner backdrop-blur-sm">🧮</div>
        <h3 className="text-2xl font-black drop-shadow-sm">AI Giải Bài Tập</h3>
      </div>
      <p className="text-emerald-50 text-[15px] mb-6 font-medium">Nhận diện và giải toán, lý, hóa chi tiết từng bước.</p>
      
      {isSolving ? (
        <div className="text-center py-10 bg-white/10 rounded-3xl border border-white/20 shadow-sm backdrop-blur-md">
           <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-3"></div>
           <p className="font-bold">Đang suy nghĩ mưu hèn kế bẩn để giải...</p>
        </div>
      ) : !solution ? (
        <div className="bg-white/10 p-8 rounded-3xl border border-white/20 text-center shadow-sm backdrop-blur-md">
          <div className="text-6xl mb-4 drop-shadow-sm text-emerald-100">📸</div>
          <p className="font-bold mb-6 text-white text-[16px]">Chụp một bức ảnh, mọi bế tắc được khai thông!</p>
           <button onClick={handleSolve} className="bg-white text-[#4CAF50] px-6 py-4 rounded-full font-black text-[16px] hover:scale-105 transition shadow-xl shadow-green-500/30 flex items-center gap-2 mx-auto justify-center w-full sm:w-auto">
             <span className="text-xl">📷</span> Bật Camera Giải Bài
           </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white/20 p-4 rounded-3xl border border-white/30 backdrop-blur-sm shadow-sm">
            <img src="https://via.placeholder.com/300x100.png?text=Hinh+Anh+Bai+Toan+Gia+Lap" alt="problem" className="w-full h-24 object-cover rounded-xl opacity-90 mix-blend-screen" />
          </div>
          <div className="bg-white text-gray-800 p-6 rounded-3xl shadow-lg font-mono text-[14px] leading-relaxed whitespace-pre-wrap border border-emerald-100">
             {solution}
          </div>
          <button onClick={() => setSolution(null)} className="w-full bg-emerald-800/40 hover:bg-emerald-800/60 text-white py-4 rounded-3xl font-bold flex justify-center items-center gap-2 transition shadow-md border border-white/10 backdrop-blur-sm">
            <span className="text-xl">↻</span> Giải bài khác
          </button>
        </div>
      )}
    </div>
  );
};

export default AiSolveScreen;
