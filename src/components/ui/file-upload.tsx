import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File | null) => void;
  onUrlChange: (url: string) => void;
  currentUrl?: string;
  label?: string;
  accept?: string;
  maxSize?: number; // in MB
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  onUrlChange,
  currentUrl,
  label = "Upload Image",
  accept = "image/*",
  maxSize = 5 // 5MB default
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl || null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFile = (file: File) => {
    setError(null);

    // Check file type - accept both images and videos
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const isVideoByExtension = fileExtension === 'mp4' || fileExtension === 'mov' || fileExtension === 'webm';
    
    if (!isImage && !isVideo && !isVideoByExtension) {
      setError('Please select an image or video file (JPG, PNG, MP4, MOV)');
      return;
    }

    // Check file size
    if (file.size > maxSize * 1024 * 1024) {
      setError(`File size must be less than ${maxSize}MB`);
      return;
    }

    setUploadedFile(file);
    onFileSelect(file);

    // Create preview - for images use FileReader, for videos use object URL
    if (isImage) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setPreviewUrl(result);
      };
      reader.readAsDataURL(file);
    } else {
      // For videos, create object URL for preview
      const videoUrl = URL.createObjectURL(file);
      setPreviewUrl(videoUrl);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    onUrlChange(url);
    setPreviewUrl(url || null);
    setUploadedFile(null);
    setError(null);
  };

  const removeFile = () => {
    // Clean up object URL if it was created for video preview
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setUploadedFile(null);
    setPreviewUrl(null);
    onFileSelect(null);
    onUrlChange('');
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <Label>{label}</Label>
      
      {/* URL Input */}
      <div className="space-y-2">
        <Label htmlFor="image-url" className="text-sm text-muted-foreground">
          Or enter image URL:
        </Label>
        <Input
          id="image-url"
          type="url"
          placeholder="https://example.com/image.jpg"
          value={currentUrl || ''}
          onChange={handleUrlChange}
          className="w-full"
        />
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or</span>
        </div>
      </div>

      {/* File Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
          dragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        <div className="space-y-2">
          <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">
              Drop a file here, or click to select
            </p>
            <p className="text-xs text-muted-foreground">
              {accept.includes('video') 
                ? `Images (PNG, JPG) or Videos (MP4, MOV) up to ${maxSize}MB`
                : `PNG, JPG, GIF up to ${maxSize}MB`}
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {/* Preview */}
      {previewUrl && (
        <div className="relative">
          <div className="relative w-full h-32 rounded-lg overflow-hidden border">
            {uploadedFile && (uploadedFile.type.startsWith('video/') || 
                            uploadedFile.name.toLowerCase().endsWith('.mp4') || 
                            uploadedFile.name.toLowerCase().endsWith('.mov') ||
                            uploadedFile.name.toLowerCase().endsWith('.webm')) ? (
              <video
                src={previewUrl}
                className="w-full h-full object-cover"
                muted
                playsInline
                loop
                preload="metadata"
              />
            ) : (
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            )}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute top-1 right-1"
              onClick={removeFile}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          {uploadedFile && (
            <p className="text-xs text-muted-foreground mt-1">
              File: {uploadedFile.name} ({(uploadedFile.size / 1024 / 1024).toFixed(2)}MB)
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default FileUpload; 