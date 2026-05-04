import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';

const getCroppedImg = async (imageSrc, pixelCrop) => {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => resolve(img);
    img.onerror = (error) => reject(error);
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // Set dimensions to double for retina displays, otherwise blurry
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject('Canvas is empty');
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      1
    );
  });
};

const ImageCropperModal = ({ imageSrc, onCancel, onCropDone, aspectRatio = 1, onError }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleDone = async () => {
    try {
      if (!croppedAreaPixels) return;
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      onCropDone(croppedBlob);
    } catch (e) {
      console.error(e);
      if (onError) onError('Lỗi cắt ảnh! Vui lòng thử lại.');
    }
  };


  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[80vh] min-h-[500px]">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-bold text-lg text-black">Chỉnh sửa ảnh</h3>
          <button onClick={onCancel} className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 font-bold text-black flex items-center justify-center">✕</button>
        </div>

        {/* Cropper Area */}
        <div className="flex-1 relative bg-gray-900 w-full">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
            cropShape={aspectRatio === 1 ? 'round' : 'rect'}
            showGrid={false}
          />
        </div>

        {/* Controls */}
        <div className="p-4 bg-white flex flex-col gap-4 border-t">
          <div className="flex items-center gap-4">
           <span className="text-gray-500 font-bold text-sm">Thu nhỏ</span>
             <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                aria-labelledby="Zoom"
                onChange={(e) => setZoom(e.target.value)}
                className="flex-1 accent-rose-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
             />
           <span className="text-gray-500 font-bold text-sm">Phóng to</span>
          </div>
          <div className="flex gap-3 mt-2">
            <button onClick={onCancel} className="flex-1 py-3 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition">Hủy</button>
            <button onClick={handleDone} className="flex-1 py-3 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 transition shadow-md">Xong</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropperModal;
