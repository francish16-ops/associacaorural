import React, { useRef, useState, useEffect, useCallback } from 'react';
import { XCircleIcon, CameraIcon } from './icons';

interface CameraModalProps {
  onClose: () => void;
  onCapture: (imageDataUrl: string) => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({ onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Não foi possível acessar a câmera. Verifique as permissões.");
      onClose();
    }
  }, [onClose]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);
  
  useEffect(() => {
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setCapturedImage(dataUrl);
        stopCamera();
      }
    }
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      onClose();
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-auto">
        <div className="p-4 border-b relative">
            <h2 className="text-xl font-bold text-center">Tirar Foto do Horímetro</h2>
            <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-gray-800">
                <XCircleIcon className="w-8 h-8"/>
            </button>
        </div>

        <div className="p-4">
          {capturedImage ? (
            <img src={capturedImage} alt="Captured" className="w-full h-auto rounded-md" />
          ) : (
            <video ref={videoRef} autoPlay playsInline className="w-full h-auto rounded-md bg-gray-900"></video>
          )}
          <canvas ref={canvasRef} className="hidden"></canvas>
        </div>

        <div className="p-4 bg-gray-50 rounded-b-lg flex justify-around">
          {capturedImage ? (
            <>
              <button onClick={handleRetake} className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold shadow-md hover:bg-gray-700 transition-colors">
                Tirar Outra
              </button>
              <button onClick={handleConfirm} className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold shadow-md hover:bg-green-700 transition-colors">
                Confirmar
              </button>
            </>
          ) : (
            <button onClick={handleCapture} className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold shadow-md hover:bg-blue-700 transition-colors flex items-center gap-2">
              <CameraIcon /> Capturar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};