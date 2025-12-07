/**
 * Storage Service for Cloudflare R2
 *
 * Handles file uploads, downloads, and URL generation for R2 storage
 */

const {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { r2Client, r2Config, R2_BUCKET } = require('../config/r2');
const crypto = require('crypto');
const path = require('path');

class StorageService {
  constructor() {
    this.client = r2Client;
    this.bucket = R2_BUCKET;
    this.config = r2Config;
  }

  /**
   * Generate a unique filename with original extension
   */
  generateUniqueFilename(originalFilename) {
    const ext = path.extname(originalFilename).toLowerCase();
    const uniqueId = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    return `${timestamp}-${uniqueId}${ext}`;
  }

  /**
   * Validate file type against allowed types
   */
  validateFileType(mimeType, allowedTypes = this.config.allowedTypes.all) {
    return allowedTypes.includes(mimeType);
  }

  /**
   * Validate file size against limit
   */
  validateFileSize(size, maxSize) {
    return size <= maxSize;
  }

  /**
   * Upload a file to R2
   * @param {Buffer|ReadableStream} fileData - File content
   * @param {string} key - Storage key (path in bucket)
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result with URL
   */
  async uploadFile(fileData, key, options = {}) {
    const {
      contentType = 'application/octet-stream',
      metadata = {},
      cacheControl = 'max-age=31536000', // 1 year for static assets
    } = options;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: fileData,
      ContentType: contentType,
      Metadata: metadata,
      CacheControl: cacheControl,
    });

    await this.client.send(command);

    // Return the public URL if configured, otherwise the key
    const url = this.config.publicUrl
      ? `${this.config.publicUrl}/${key}`
      : key;

    return {
      key,
      url,
      contentType,
      metadata,
    };
  }

  /**
   * Upload profile picture
   * @param {string} userId - User ID
   * @param {Buffer} fileData - Image data
   * @param {string} mimeType - Image MIME type
   * @param {string} originalFilename - Original filename
   */
  async uploadProfilePicture(userId, fileData, mimeType, originalFilename) {
    // Validate type
    if (!this.validateFileType(mimeType, this.config.allowedTypes.images)) {
      throw new Error('Invalid file type. Only images are allowed.');
    }

    // Validate size
    if (!this.validateFileSize(fileData.length, this.config.limits.profilePicture)) {
      throw new Error(`File too large. Maximum size is ${this.config.limits.profilePicture / 1024 / 1024}MB`);
    }

    const ext = path.extname(originalFilename).toLowerCase() || '.jpg';
    const key = `${this.config.folders.profiles}/${userId}/avatar${ext}`;

    return this.uploadFile(fileData, key, {
      contentType: mimeType,
      metadata: {
        userId,
        type: 'profile-picture',
        uploadedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Upload company logo
   * @param {string} accountId - Account ID
   * @param {Buffer} fileData - Image data
   * @param {string} mimeType - Image MIME type
   * @param {string} originalFilename - Original filename
   */
  async uploadCompanyLogo(accountId, fileData, mimeType, originalFilename) {
    // Validate type
    if (!this.validateFileType(mimeType, this.config.allowedTypes.images)) {
      throw new Error('Invalid file type. Only images are allowed.');
    }

    // Validate size
    if (!this.validateFileSize(fileData.length, this.config.limits.companyLogo)) {
      throw new Error(`File too large. Maximum size is ${this.config.limits.companyLogo / 1024 / 1024}MB`);
    }

    const ext = path.extname(originalFilename).toLowerCase() || '.png';
    const key = `${this.config.folders.accounts}/${accountId}/logo${ext}`;

    return this.uploadFile(fileData, key, {
      contentType: mimeType,
      metadata: {
        accountId,
        type: 'company-logo',
        uploadedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Upload signature photo (user photo for email signature)
   * @param {string} accountId - Account ID
   * @param {string} identifier - Unique identifier (can be temp ID before signature is saved)
   * @param {Buffer} fileData - Image data
   * @param {string} mimeType - Image MIME type
   * @param {string} originalFilename - Original filename
   */
  async uploadSignaturePhoto(accountId, identifier, fileData, mimeType, originalFilename) {
    // Validate type
    if (!this.validateFileType(mimeType, this.config.allowedTypes.images)) {
      throw new Error('Invalid file type. Only images are allowed.');
    }

    // Validate size (2MB max for signature photos)
    if (!this.validateFileSize(fileData.length, 2 * 1024 * 1024)) {
      throw new Error('File too large. Maximum size is 2MB');
    }

    const uniqueFilename = this.generateUniqueFilename(originalFilename);
    const key = `${this.config.folders.signatures}/${accountId}/photos/${uniqueFilename}`;

    return this.uploadFile(fileData, key, {
      contentType: mimeType,
      metadata: {
        accountId,
        identifier,
        type: 'signature-photo',
        uploadedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Upload signature logo
   * @param {string} signatureId - Signature ID
   * @param {Buffer} fileData - Image data
   * @param {string} mimeType - Image MIME type
   * @param {string} originalFilename - Original filename
   */
  async uploadSignatureLogo(signatureId, fileData, mimeType, originalFilename) {
    // Validate type
    if (!this.validateFileType(mimeType, this.config.allowedTypes.images)) {
      throw new Error('Invalid file type. Only images are allowed.');
    }

    // Validate size
    if (!this.validateFileSize(fileData.length, this.config.limits.signatureLogo)) {
      throw new Error(`File too large. Maximum size is ${this.config.limits.signatureLogo / 1024 / 1024}MB`);
    }

    const ext = path.extname(originalFilename).toLowerCase() || '.png';
    const key = `${this.config.folders.signatures}/${signatureId}/logo${ext}`;

    return this.uploadFile(fileData, key, {
      contentType: mimeType,
      metadata: {
        signatureId,
        type: 'signature-logo',
        uploadedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Upload email attachment
   * @param {string} conversationId - Conversation ID
   * @param {Buffer} fileData - File data
   * @param {string} mimeType - File MIME type
   * @param {string} originalFilename - Original filename
   */
  async uploadEmailAttachment(conversationId, fileData, mimeType, originalFilename) {
    // Validate type
    if (!this.validateFileType(mimeType, this.config.allowedTypes.all)) {
      throw new Error('Invalid file type.');
    }

    // Validate size
    if (!this.validateFileSize(fileData.length, this.config.limits.emailAttachment)) {
      throw new Error(`File too large. Maximum size is ${this.config.limits.emailAttachment / 1024 / 1024}MB`);
    }

    const uniqueFilename = this.generateUniqueFilename(originalFilename);
    const key = `${this.config.folders.attachments}/${conversationId}/${uniqueFilename}`;

    const result = await this.uploadFile(fileData, key, {
      contentType: mimeType,
      metadata: {
        conversationId,
        originalFilename,
        type: 'email-attachment',
        uploadedAt: new Date().toISOString(),
      },
    });

    return {
      ...result,
      originalFilename,
      size: fileData.length,
    };
  }

  /**
   * Upload contact profile picture (from WhatsApp, Instagram, etc via Unipile)
   * @param {string} accountId - Account ID
   * @param {string} contactId - Contact ID
   * @param {Buffer} fileData - Image data
   * @param {string} mimeType - Image MIME type
   * @param {string} originalFilename - Original filename (optional)
   */
  async uploadContactPicture(accountId, contactId, fileData, mimeType, originalFilename = 'profile.jpg') {
    // Validate type
    if (!this.validateFileType(mimeType, this.config.allowedTypes.images)) {
      throw new Error('Invalid file type. Only images are allowed.');
    }

    // Validate size (5MB max for contact pictures)
    if (!this.validateFileSize(fileData.length, this.config.limits.profilePicture)) {
      throw new Error(`File too large. Maximum size is ${this.config.limits.profilePicture / 1024 / 1024}MB`);
    }

    const ext = path.extname(originalFilename).toLowerCase() || '.jpg';
    const key = `${this.config.folders.contacts}/${accountId}/${contactId}${ext}`;

    return this.uploadFile(fileData, key, {
      contentType: mimeType,
      metadata: {
        accountId,
        contactId,
        type: 'contact-picture',
        uploadedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Upload template image
   * @param {string} accountId - Account ID
   * @param {string} templateId - Template ID
   * @param {Buffer} fileData - Image data
   * @param {string} mimeType - Image MIME type
   * @param {string} originalFilename - Original filename
   */
  async uploadTemplateImage(accountId, templateId, fileData, mimeType, originalFilename) {
    // Validate type
    if (!this.validateFileType(mimeType, this.config.allowedTypes.images)) {
      throw new Error('Invalid file type. Only images are allowed.');
    }

    const uniqueFilename = this.generateUniqueFilename(originalFilename);
    const key = `${this.config.folders.templates}/${accountId}/${templateId}/images/${uniqueFilename}`;

    return this.uploadFile(fileData, key, {
      contentType: mimeType,
      metadata: {
        accountId,
        templateId,
        type: 'template-image',
        uploadedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Get a signed URL for downloading/viewing a file
   * @param {string} key - Storage key
   * @param {number} expiresIn - Expiration in seconds
   * @returns {Promise<string>} Signed URL
   */
  async getSignedUrl(key, expiresIn = this.config.signedUrlExpiration.default) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  /**
   * Get file directly from R2
   * @param {string} key - Storage key
   * @returns {Promise<Object>} Object with Body stream and metadata
   */
  async getFile(key) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    try {
      const response = await this.client.send(command);
      return {
        Body: response.Body,
        ContentType: response.ContentType,
        ContentLength: response.ContentLength,
        Metadata: response.Metadata,
      };
    } catch (error) {
      if (error.name === 'NoSuchKey' || error.name === 'NotFound') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get a signed URL for uploading a file
   * @param {string} key - Storage key
   * @param {string} contentType - Expected content type
   * @param {number} expiresIn - Expiration in seconds
   * @returns {Promise<string>} Signed upload URL
   */
  async getSignedUploadUrl(key, contentType, expiresIn = this.config.signedUrlExpiration.upload) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  /**
   * Get file metadata
   * @param {string} key - Storage key
   * @returns {Promise<Object>} File metadata
   */
  async getFileMetadata(key) {
    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    try {
      const response = await this.client.send(command);
      return {
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        lastModified: response.LastModified,
        metadata: response.Metadata,
      };
    } catch (error) {
      if (error.name === 'NotFound') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete a file from R2
   * @param {string} key - Storage key
   */
  async deleteFile(key) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
    return { deleted: true, key };
  }

  /**
   * Delete profile picture
   * @param {string} userId - User ID
   */
  async deleteProfilePicture(userId) {
    // Try common extensions
    const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    for (const ext of extensions) {
      const key = `${this.config.folders.profiles}/${userId}/avatar${ext}`;
      try {
        const metadata = await this.getFileMetadata(key);
        if (metadata) {
          return this.deleteFile(key);
        }
      } catch (error) {
        // Continue to next extension
      }
    }
    return { deleted: false, reason: 'File not found' };
  }

  /**
   * Delete company logo
   * @param {string} accountId - Account ID
   */
  async deleteCompanyLogo(accountId) {
    const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
    for (const ext of extensions) {
      const key = `${this.config.folders.accounts}/${accountId}/logo${ext}`;
      try {
        const metadata = await this.getFileMetadata(key);
        if (metadata) {
          return this.deleteFile(key);
        }
      } catch (error) {
        // Continue to next extension
      }
    }
    return { deleted: false, reason: 'File not found' };
  }

  /**
   * Delete signature logo
   * @param {string} signatureId - Signature ID
   */
  async deleteSignatureLogo(signatureId) {
    const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    for (const ext of extensions) {
      const key = `${this.config.folders.signatures}/${signatureId}/logo${ext}`;
      try {
        const metadata = await this.getFileMetadata(key);
        if (metadata) {
          return this.deleteFile(key);
        }
      } catch (error) {
        // Continue to next extension
      }
    }
    return { deleted: false, reason: 'File not found' };
  }

  /**
   * Get public URL for a file
   * @param {string} key - Storage key
   * @returns {string} Public URL
   */
  getPublicUrl(key) {
    if (!this.config.publicUrl) {
      throw new Error('R2_PUBLIC_URL is not configured');
    }
    return `${this.config.publicUrl}/${key}`;
  }

  /**
   * Convert base64 to buffer
   * @param {string} base64String - Base64 encoded string (with or without data URI prefix)
   * @returns {Object} { buffer, mimeType }
   */
  base64ToBuffer(base64String) {
    // Check if it's a data URI
    const matches = base64String.match(/^data:([^;]+);base64,(.+)$/);

    if (matches) {
      return {
        buffer: Buffer.from(matches[2], 'base64'),
        mimeType: matches[1],
      };
    }

    // Plain base64
    return {
      buffer: Buffer.from(base64String, 'base64'),
      mimeType: 'application/octet-stream',
    };
  }
}

// Export singleton instance
module.exports = new StorageService();
