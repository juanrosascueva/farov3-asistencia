import { useState, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../hooks/useAuth";

interface ImageUploaderProps {
  currentImageUrl?: string;
  onUploadComplete: (imageId: string, url: string, provider: "cloudinary" | "convex") => void;
  label?: string;
  aspectRatio?: "1:1" | "4:3";
  folder?: "profiles" | "teens";
}

export default function ImageUploader({
  currentImageUrl,
  onUploadComplete,
  label = "Foto de perfil",
  aspectRatio = "1:1",
  folder = "profiles",
}: ImageUploaderProps) {
  const { token } = useAuth();
  const generateUploadUrl = useMutation(api.images.generateUploadUrl);
  const generateCloudinarySignature = useMutation(api.images.generateCloudinarySignature);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resizeAndCompress = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          const maxDim = 400; // tamaño excelente para avatares

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("No se pudo obtener el contexto del canvas"));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error("Error al comprimir la imagen"));
              }
            },
            "image/jpeg",
            0.85 // 85% de calidad de compresión JPEG
          );
        };
        img.onerror = () => reject(new Error("Error al cargar la imagen"));
      };
      reader.onerror = () => reject(new Error("Error al leer el archivo"));
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    // Validación rápida de tipo
    if (!file.type.startsWith("image/")) {
      setError("Por favor selecciona un archivo de imagen válido.");
      return;
    }

    setUploading(true);
    try {
      // 1. Redimensionar y comprimir en el cliente
      const compressedBlob = await resizeAndCompress(file);
      const tempUrl = URL.createObjectURL(compressedBlob);
      setPreviewUrl(tempUrl);

      if (!token) throw new Error("No tienes una sesión activa");
      const signedUpload = await generateCloudinarySignature({ token, folder });

      const body = new FormData();
      body.append("file", compressedBlob, "image.jpg");
      body.append("api_key", signedUpload.apiKey);
      body.append("timestamp", String(signedUpload.timestamp));
      body.append("folder", signedUpload.folder);
      body.append("signature", signedUpload.signature);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${signedUpload.cloudName}/image/upload`, {
        method: "POST",
        body,
      });

      if (!response.ok) {
        throw new Error("Fallo al subir archivo a Cloudinary");
      }

      const result = await response.json();
      
      onUploadComplete(result.public_id, result.secure_url, "cloudinary");
      setPreviewUrl(result.secure_url);
    } catch (err: any) {
      console.error(err);
      if (err?.message?.includes("Cloudinary no está configurado")) {
        try {
          if (!token) throw new Error("No tienes una sesión activa");
          const compressedBlob = await resizeAndCompress(file);
          const uploadUrl = await generateUploadUrl({ token });
          const response = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": "image/jpeg" },
            body: compressedBlob,
          });
          if (!response.ok) throw new Error("Fallo al subir archivo al almacenamiento de Convex");
          const { storageId } = await response.json();
          const tempUrl = URL.createObjectURL(compressedBlob);
          setPreviewUrl(tempUrl);
          onUploadComplete(storageId, tempUrl, "convex");
        } catch (fallbackErr: any) {
          console.error(fallbackErr);
          setError(fallbackErr?.message || "Ocurrió un error al subir la imagen.");
        }
      } else {
        setError(err?.message || "Ocurrió un error al subir la imagen.");
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-bold text-ink/50 uppercase tracking-wide ml-1 self-start">
        {label}
      </span>
      
      <div 
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`relative cursor-pointer group flex flex-col items-center justify-center border-2 border-dashed border-ink/10 hover:border-primary-500/50 bg-card rounded-2xl overflow-hidden transition-all pressable ${
          aspectRatio === "1:1" ? "w-28 h-28" : "w-full aspect-[4/3] max-h-48"
        }`}
      >
        {previewUrl ? (
          <>
            <img 
              src={previewUrl} 
              alt="Previsualización" 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-ink/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Cambiar
              </span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center text-ink/30 group-hover:text-primary-600 transition-colors p-4 text-center">
            <svg className="w-8 h-8 mb-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Subir Foto
            </span>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-card/85 backdrop-blur-[1px] flex flex-col items-center justify-center gap-1.5 z-10">
            <svg className="animate-spin h-5 w-5 text-primary-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-micro font-bold text-primary-600 uppercase tracking-widest animate-pulse">
              Subiendo...
            </span>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-danger-600 font-medium mt-1">
          ⚠️ {error}
        </p>
      )}

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        className="hidden" 
      />
    </div>
  );
}
