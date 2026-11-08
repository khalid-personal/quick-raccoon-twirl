import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, XCircle, Upload, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { UploadScanReport } from '@/lib/types';
import { scanDocumentFile } from '@/lib/document-screening';

interface PassportPhotoInputProps {
  value: File | null;
  onChange: (file: File | null) => void;
  onScanReport?: (report: UploadScanReport | null) => void;
  disabled?: boolean;
  initialImageUrl?: string; // For displaying existing images
}

const PassportPhotoInput: React.FC<PassportPhotoInputProps> = ({
  value,
  onChange,
  onScanReport,
  disabled = false,
  initialImageUrl,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(initialImageUrl);
  const [isScanning, setIsScanning] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [scanReport, setScanReport] = useState<UploadScanReport | null>(null);
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false);
  const previewFile = value ?? pendingFile;

  React.useEffect(() => {
    if (previewFile) {
      const url = URL.createObjectURL(previewFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (!initialImageUrl) {
      setPreviewUrl(undefined);
    }
  }, [previewFile, initialImageUrl]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast.error("File size exceeds 2MB limit.");
        onChange(null);
        onScanReport?.(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setPendingFile(file);
      setScanReport(null);
      setReviewAcknowledged(false);
      setIsScanning(true);
      try {
        const report = await scanDocumentFile(file);
        setScanReport(report);
        onScanReport?.(report);
        if (report.status === 'blocked') {
          toast.error(report.findings.join(' ') || 'This image was blocked by the security scan.');
          setPendingFile(null);
          onChange(null);
        } else if (report.status === 'clear') {
          onChange(file);
          toast.success('Profile image passed screening.');
        } else {
          toast.warning('Review the image scan findings before using this photo.');
        }
      } catch (error) {
        const report: UploadScanReport = { status: 'blocked', findings: [`The image could not be screened: ${error instanceof Error ? error.message : 'unknown error'}`], scanned_at: new Date().toISOString() };
        setScanReport(report);
        onScanReport?.(report);
        setPendingFile(null);
        onChange(null);
        toast.error(report.findings[0]);
      } finally {
        setIsScanning(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } else {
      setPendingFile(null);
      onChange(null);
      onScanReport?.(null);
    }
  };

  const handleRemoveImage = () => {
    setPendingFile(null);
    setScanReport(null);
    setReviewAcknowledged(false);
    onChange(null);
    onScanReport?.(null);
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
            disabled={disabled || isScanning}
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
        disabled={disabled || isScanning}
      />
      
      <Button 
        type="button" 
        variant="outline" 
        onClick={handleButtonClick} 
        disabled={disabled || isScanning}
        className="w-full"
      >
        {isScanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
        {value || pendingFile ? 'Change Photo' : 'Upload Photo'}
      </Button>
      {scanReport && <div className="w-full space-y-2 rounded-md border p-2 text-xs" role="status" aria-live="polite">
        <p className={scanReport.status === 'clear' ? 'text-emerald-700' : scanReport.status === 'review' ? 'text-amber-700' : 'text-destructive'}>
          {scanReport.status === 'clear' ? 'Image passed screening.' : scanReport.status === 'review' ? 'Image requires compliance review.' : 'Image upload blocked.'}
        </p>
        {scanReport.findings.map(finding => <p key={finding} className="text-muted-foreground">{finding}</p>)}
        {scanReport.status === 'review' && <div className="flex items-start gap-2 border-t pt-2">
          <Checkbox id="profile-photo-review" checked={reviewAcknowledged} onCheckedChange={checked => {
            const acknowledged = checked === true;
            setReviewAcknowledged(acknowledged);
            onChange(acknowledged ? pendingFile : null);
          }} disabled={disabled || isScanning} />
          <Label htmlFor="profile-photo-review" className="text-xs leading-relaxed">I reviewed the findings and want to submit this photo for compliance review.</Label>
        </div>}
      </div>}
      <p className="text-xs text-muted-foreground text-center">Max 2MB, JPG/PNG</p>
    </div>
  );
};

export default PassportPhotoInput;