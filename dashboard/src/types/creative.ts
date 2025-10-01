export type CreativeStatus = 'active' | 'inactive' | 'processing' | 'failed';

export interface Creative {
  id: string;
  campaign_id: string;
  name: string;
  video_url: string;
  duration: number;
  file_size: number | null;
  width: number | null;
  height: number | null;
  format: string;
  status: CreativeStatus;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface UploadCreativeDto {
  name: string;
  video: File;
}
