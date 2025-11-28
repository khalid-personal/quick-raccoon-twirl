import React, { useState } from 'react';
import { CandidateDetail } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Image, Upload, Loader2, User } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface CandidateImageManagerProps {
  candidate: CandidateDetail;
  refetch: () => void;
}

const CandidateImageManager: React.FC<CandidateImageManagerProps> = ({ candidate, refetch }) => {
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const currentImageUrl = candidate.profile_image_url;

  const handleUpdateImage = async () => {
    const url = newImageUrl.trim();
    if (!url) {
      toast.error("Please enter a valid image URL.");
      return;
    }

    setIsUpdating(true);
    try {
      // Mock API call to update the profile image URL
      await api.updateCandidateDetails(candidate.id, { profile_image_url: url });
      toast.success("Profile image updated successfully.");
      setNewImageUrl('');
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

        {/* Update Form */}
        <div className="space-y-2 flex-shrink-0">
          <Label htmlFor="image-url">Image URL (Mock Upload)</Label>
          <div className="flex space-x-2">
            <Input
              id="image-url"
              placeholder="Paste image URL here"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              disabled={isUpdating}
            />
            <Button 
              onClick={handleUpdateImage} 
              disabled={isUpdating || !newImageUrl.trim()}
              size="icon"
              title="Update Image"
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
                Remove Photo
            </Button>
        )}
        
        <p className="text-xs text-muted-foreground text-center pt-2">
            In a real application, this would handle secure file uploads to storage.
        </p>
      </CardContent>
    </Card>
  );
};

export default CandidateImageManager;