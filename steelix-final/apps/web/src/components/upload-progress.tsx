import { Progress } from '@/components/ui/progress';

interface UploadProgressProps {
  progress: number;
  fileName: string;
}

export function UploadProgress({ progress, fileName }: UploadProgressProps) {
  return (
    <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
      <div className="flex justify-between items-center text-sm">
        <span className="truncate flex-1 mr-2">{fileName}</span>
        <span className="text-muted-foreground">{progress}%</span>
      </div>
      <Progress value={progress} className="h-2" />
      <div className="text-xs text-muted-foreground">
        {progress < 25 && "Preparing upload..."}
        {progress >= 25 && progress < 50 && "Processing file..."}
        {progress >= 50 && progress < 100 && "Uploading to storage..."}
        {progress === 100 && "Upload complete!"}
      </div>
    </div>
  );
}
