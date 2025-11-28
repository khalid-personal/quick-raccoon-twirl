import React, { useState } from 'react';
import { CandidateDetail } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Image, Upload, Loader2, User, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface CandidateImageManagerProps {
  candidate: CandidateDetail;
  refetch: () => void;
}

const CandidateImageManager: React.FC<CandidateImageManagerProps> = ({ candidate, refetch }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const currentImageUrl = candidate.profile_image_url;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleUpdateImage = async () => {
    if (!selectedFile) {
      toast.error("Please select a file to upload.");
      return;
    }

    setIsUpdating(true);
    try {
      // Simulate file upload by creating a temporary URL for the selected file
      // In a real app, this would upload to Supabase Storage and get a public URL.
      const mockPublicUrl = URL.createObjectURL(selectedFile); 

      await api.updateCandidateDetails(candidate.id, { profile_image_url: mockPublicUrl });
      toast.success(`Profile image "${selectedFile.name}" uploaded successfully.`);
      setSelectedFile(null);
      // Clear the file input manually
      const input = document.getElementById('image-upload-input') as HTMLInputElement;
      if (input) input.value = '';
      
      refetch();
    } catch (error) {
      toast.error(`Failed to update image: ${(error as Error).message}`);
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleRemoveImage = async () => {
    if (!window.confirm("Are you sure you want to remove the profile image?")) return;
    
    setIsUpdating(true);
    try {
      await api.updateCandidateDetails(candidate.id, { profile_image_url: undefined });
      toast.success("Profile image removed.");
      refetch();
    } catch (error) {
      toast.error(`Failed to remove image: ${(error as Error).message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center text-xl">
          <Image className="h-5 w-5 mr-2 text-primary" />
          Candidate Photo
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col flex-grow space-y-4">
        
        {/* Current Image Display */}
        <div className="flex justify-center items-center h-48 w-full bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border">
          {currentImageUrl ? (
            <img 
              src={currentImageUrl} 
              alt={`${candidate.first_name} profile`} 
              className="object-cover h-full w-full"
            />
          ) : (
            <div className="text-muted-foreground flex flex-col items-center">
              <User className="h-10 w-10 mb-2" />
              No Photo Uploaded
            </div>
          )}
        </div>

        {/* Upload Form */}
        <div className="space-y-2 flex-shrink-0">
          <Label htmlFor="image-upload-input">Upload New Photo</Label>
          <div className="flex space-x-2">
            <Input
              id="image-upload-input"
              type="file"
              accept="image/*" // Only allow image files
              onChange={handleFileChange}
              disabled={isUpdating}
              className="h-9 text-sm"
            />
            <Button 
              onClick={handleUpdateImage} 
              disabled={isUpdating || !selectedFile}
              size="icon"
              title="Upload Image"
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        
        {/* Remove Button */}
        {currentImageUrl && (
            <Button 
                onClick={handleRemoveImage} 
                disabled={isUpdating}
                variant="outline"
                className="w-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
                <Trash2 className="h-4 w-4 mr-2" /> Remove Photo
            </Button>
        )}
        
        <p className="text-xs text-muted-foreground mt-3 text-center">
            This is a mock file upload. In a real application, files would be securely stored.
        </p>
      </CardContent>
    </Card>
  );
};

export default CandidateImageManager;