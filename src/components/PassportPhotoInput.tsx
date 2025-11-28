import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { User, Trash2, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PassportPhotoInputProps {
  label?: string;
  value?: File | null; // The selected file
  onChange: (file: File | null) => void;
  disabled?: boolean;
  className?: string;
}

const PassportPhotoInput: React.FC<PassportPhotoInputProps> = ({
  label = "Passport Photo (Optional)",
  value,
  onChange,
  disabled = false,
  className,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (value) {
      const url = URL.createObjectURL(value);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url); // Clean up URL on unmount or value change
    } else {
      setPreviewUrl(null);
    }
  }, [value]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onChange(e.target.files[0]);
    } else {
      onChange(null);
    }
  };

  const handleRemovePhoto = () => {
    onChange(null);
    // Manually clear the file input
    const input = document.getElementById('passport-photo-input') as HTMLInputElement;
    if (input) input.value = '';
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor="passport-photo-input" className="flex items-center">
        <ImageIcon className="h-4 w-4 mr-2" /> {label}
      </Label>
      
      <div className="flex flex-col items-center space-y-3">
        {/* Photo Preview Area */}
        <div className="h-32 w-32 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center border border-dashed">
          {previewUrl ? (
            <img src={previewUrl} alt="Passport Preview" className="object-cover h-full w-full" />
          ) : (
            <User className="h-12 w-12 text-muted-foreground" />
          )}
        </div>

        {/* File Input and Remove Button */}
        <div className="flex w-full gap-2">
          <Input
            id="passport-photo-input"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={disabled}
            className="flex-grow h-9 text-sm"
          />
          {value && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleRemovePhoto}
              disabled={disabled}
              title="Remove Photo"
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Upload a clear passport-sized photo.
      </p>
    </div>
  );
};

export default PassportPhotoInput;