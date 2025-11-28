import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, XCircle, Upload, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PassportPhotoInputProps {
  value: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  initialImageUrl?: string; // For displaying existing images
}

const PassportPhotoInput: React.FC<PassportPhotoInputProps> = ({
  value,
  onChange,
  disabled = false,
  initialImageUrl,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(initialImageUrl);
  const [isUploading, setIsUploading] = useState(false); // Simulate upload state

  React.useEffect(() => {
    if (value) {
      const url = URL.createObjectURL(value);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (!initialImageUrl) {
      setPreviewUrl(undefined);
    }
  }, [value, initialImageUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast.error("File size exceeds 2MB limit.");
        onChange(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      onChange(file);
    } else {
      onChange(null);
    }
  };

  const handleRemoveImage = () => {
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setPreviewUrl(undefined);
  };

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="flex flex-col items-center space-y-3 w-full max-w-[200px]">
      <div className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
        {previewUrl ? (
          <img src={previewUrl} alt="Passport" className="w-full h-full object-cover" />
        ) : (
          <Camera className="h-10 w-10 text-gray-400" />
        )}
        {(value || initialImageUrl) && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-0 right-0 h-6 w-6 rounded-full bg-red-500 text-white hover:bg-red-600"
            onClick={handleRemoveImage}
            disabled={disabled || isUploading}
          >
            <XCircle className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
        disabled={disabled || isUploading}
      />
      
      <Button 
        type="button" 
        variant="outline" 
        onClick={handleButtonClick} 
        disabled={disabled || isUploading}
        className="w-full"
      >
        {isUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
        {value ? 'Change Photo' : 'Upload Photo'}
      </Button>
      <p className="text-xs text-muted-foreground text-center">Max 2MB, JPG/PNG</p>
    </div>
  );
};

export default PassportPhotoInput;