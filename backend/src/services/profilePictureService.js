/**
 * Profile Picture Service
 *
 * Downloads profile pictures from temporary URLs (Unipile/LinkedIn)
 * and persists them to R2 storage for permanent access.
 */

const axios = require('axios');
const storageService = require('./storageService');
const { r2Config } = require('../config/r2');

const LOG_PREFIX = '[PROFILE-PIC]';

/**
 * Check if a URL is already an R2 URL (permanent storage)
 */
function isR2Url(url) {
  if (!url || !r2Config.publicUrl) return false;
  return url.startsWith(r2Config.publicUrl);
}

/**
 * Download an image from a URL and upload it to R2 storage
 * Returns the permanent R2 URL, or null if download/upload failed
 *
 * @param {string} imageUrl - The temporary URL to download from
 * @param {string} accountId - Account ID for storage path
 * @param {string} contactId - Contact ID for storage path
 * @returns {Promise<string|null>} The permanent R2 URL, or null on failure
 */
async function downloadAndStoreProfilePicture(imageUrl, accountId, contactId) {
  if (!imageUrl) return null;

  // Skip if already on R2
  if (isR2Url(imageUrl)) {
    return imageUrl;
  }

  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: { 'Accept': 'image/*' }
    });

    const buffer = Buffer.from(response.data);

    if (buffer.length === 0) {
      console.log(`${LOG_PREFIX} Empty image response for contact ${contactId}`);
      return null;
    }

    const contentType = response.headers['content-type'] || 'image/jpeg';
    const mimeToExt = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp'
    };
    const ext = mimeToExt[contentType] || '.jpg';

    const uploadResult = await storageService.uploadContactPicture(
      accountId,
      contactId,
      buffer,
      contentType,
      `profile${ext}`
    );

    console.log(`${LOG_PREFIX} Stored in R2 for contact ${contactId}: ${uploadResult.url}`);
    return uploadResult.url;
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to download/store picture for contact ${contactId}: ${error.message}`);
    return null;
  }
}

module.exports = {
  isR2Url,
  downloadAndStoreProfilePicture
};
