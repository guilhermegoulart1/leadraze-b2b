/**
 * Cloudflare R2 Configuration
 *
 * R2 is S3-compatible, so we use the AWS SDK with custom endpoint
 */

const { S3Client } = require('@aws-sdk/client-s3');

// Validate required environment variables
const requiredEnvVars = ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0 && process.env.NODE_ENV === 'production') {
  console.warn(`Warning: Missing R2 environment variables: ${missingVars.join(', ')}`);
}

// Create S3 client configured for Cloudflare R2
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT || 'https://placeholder.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

// Configuration object
const r2Config = {
  bucket: process.env.R2_BUCKET || 'getraze',
  publicUrl: process.env.R2_PUBLIC_URL || '', // Custom domain or R2.dev URL

  // File size limits (in bytes)
  limits: {
    profilePicture: 5 * 1024 * 1024,    // 5MB
    companyLogo: 2 * 1024 * 1024,        // 2MB
    signatureLogo: 1 * 1024 * 1024,      // 1MB
    emailAttachment: 25 * 1024 * 1024,   // 25MB
  },

  // Allowed MIME types
  allowedTypes: {
    images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    documents: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
    ],
    all: [] // Will be populated below
  },

  // Folder structure
  folders: {
    profiles: 'profiles',
    accounts: 'accounts',
    signatures: 'signatures',
    attachments: 'attachments',
    templates: 'templates',
    contacts: 'contacts', // Fotos de perfil de contatos (WhatsApp, Instagram, etc)
  },

  // Signed URL expiration (in seconds)
  signedUrlExpiration: {
    default: 3600,       // 1 hour
    download: 86400,     // 24 hours
    upload: 900,         // 15 minutes
  },
};

// Combine all allowed types
r2Config.allowedTypes.all = [
  ...r2Config.allowedTypes.images,
  ...r2Config.allowedTypes.documents,
];

module.exports = {
  r2Client,
  r2Config,
  R2_BUCKET: r2Config.bucket,
};
