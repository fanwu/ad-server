const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class S3Service {
    constructor() {
        // Use LocalStack for development, AWS S3 for production
        const isProduction = process.env.NODE_ENV === 'production';

        this.bucketName = process.env.S3_BUCKET_NAME || 'ctv-ad-server-creatives';


        this.s3Client = new S3Client({
            region: process.env.AWS_REGION || 'us-east-1',
            endpoint: isProduction ? undefined : process.env.S3_ENDPOINT || 'http://localhost:4566',
            forcePathStyle: !isProduction, // Required for LocalStack
            credentials: isProduction ? undefined : {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test'
            }
        });
    }

    /**
     * Upload a video file to S3
     */
    async uploadVideo(file, campaignId, metadata = {}) {
        try {
            // Generate unique key for the video
            const fileExtension = file.originalname.split('.').pop();
            const key = `campaigns/${campaignId}/creatives/${uuidv4()}.${fileExtension}`;

            const uploadParams = {
                Bucket: this.bucketName,
                Key: key,
                Body: file.buffer,
                ContentType: file.mimetype,
                Metadata: {
                    campaignId: campaignId.toString(),
                    originalName: file.originalname,
                    uploadedAt: new Date().toISOString(),
                    ...metadata
                }
            };

            // Add cache control for CDN
            if (process.env.NODE_ENV === 'production') {
                uploadParams.CacheControl = 'max-age=31536000'; // 1 year
            }

            const command = new PutObjectCommand(uploadParams);
            await this.s3Client.send(command);

            // Generate the URL
            const url = await this.getVideoUrl(key);

            logger.info('Video uploaded to S3', {
                key,
                size: file.size,
                campaignId
            });

            return {
                key,
                url,
                size: file.size
            };
        } catch (error) {
            logger.error('Error uploading video to S3', {
                error: error.message,
                campaignId
            });
            throw error;
        }
    }

    /**
     * Get a signed URL for video access
     */
    async getSignedUrl(key, expiresIn = 3600) {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: key
            });

            const url = await getSignedUrl(this.s3Client, command, { expiresIn });
            return url;
        } catch (error) {
            logger.error('Error generating signed URL', {
                error: error.message,
                key
            });
            throw error;
        }
    }

    /**
     * Get video URL (public or signed based on configuration)
     */
    async getVideoUrl(key) {
        const isProduction = process.env.NODE_ENV === 'production';

        if (isProduction && process.env.CLOUDFRONT_URL) {
            // Use CloudFront URL in production
            return `${process.env.CLOUDFRONT_URL}/${key}`;
        } else if (isProduction) {
            // Use S3 public URL if bucket is public
            return `https://${this.bucketName}.s3.amazonaws.com/${key}`;
        } else {
            // Use LocalStack URL for development
            return `http://localhost:4566/${this.bucketName}/${key}`;
        }
    }

    /**
     * Delete a video from S3
     */
    async deleteVideo(key) {
        try {
            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key
            });

            await this.s3Client.send(command);

            logger.info('Video deleted from S3', { key });
            return true;
        } catch (error) {
            logger.error('Error deleting video from S3', {
                error: error.message,
                key
            });
            throw error;
        }
    }

    /**
     * Extract S3 key from URL
     */
    extractKeyFromUrl(url) {
        try {
            // Handle different URL formats
            if (url.includes('cloudfront.net')) {
                // CloudFront URL
                const parts = url.split('cloudfront.net/');
                return parts[1];
            } else if (url.includes('.s3.amazonaws.com')) {
                // S3 URL
                const parts = url.split('.s3.amazonaws.com/');
                return parts[1];
            } else if (url.includes('localhost:4566')) {
                // LocalStack URL
                const parts = url.split(`${this.bucketName}/`);
                return parts[1];
            } else {
                // Assume it's already a key
                return url;
            }
        } catch (error) {
            logger.error('Error extracting key from URL', {
                error: error.message,
                url
            });
            return url;
        }
    }

    /**
     * Validate video file
     */
    validateVideoFile(file) {
        const errors = [];

        // Check file type
        const allowedMimeTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
            errors.push('Invalid file type. Only MP4, MOV, and AVI files are allowed.');
        }

        // Check file size (max 500MB for MVP)
        const maxSize = 500 * 1024 * 1024; // 500MB in bytes
        if (file.size > maxSize) {
            errors.push('File size exceeds 500MB limit.');
        }

        // Check file extension
        const allowedExtensions = ['mp4', 'mov', 'avi'];
        const fileExtension = file.originalname.split('.').pop().toLowerCase();
        if (!allowedExtensions.includes(fileExtension)) {
            errors.push('Invalid file extension.');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Generate upload presigned URL (for direct browser uploads)
     */
    async generateUploadUrl(campaignId, fileName, contentType) {
        try {
            const key = `campaigns/${campaignId}/creatives/${uuidv4()}_${fileName}`;

            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                ContentType: contentType
            });

            const url = await getSignedUrl(this.s3Client, command, {
                expiresIn: 3600 // 1 hour
            });

            return {
                uploadUrl: url,
                key,
                expiresIn: 3600
            };
        } catch (error) {
            logger.error('Error generating upload URL', {
                error: error.message,
                campaignId,
                fileName
            });
            throw error;
        }
    }
}

module.exports = new S3Service();