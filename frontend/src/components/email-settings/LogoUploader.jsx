/**
 * Logo Uploader Component
 *
 * Handles upload of company logo to R2 storage
 */

import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Trash2, Image, Loader2, AlertCircle } from 'lucide-react';

const LogoUploader = ({ currentLogo, onUpload, onDelete }) => {
  const { t } = useTranslation('emailSettings');
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(currentLogo);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      setError(t('logo.invalidType', 'Tipo de arquivo inválido. Use PNG, JPG, GIF, WebP ou SVG.'));
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError(t('logo.tooLarge', 'Arquivo muito grande. Máximo 5MB.'));
      return;
    }

    setError(null);
    setUploading(true);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);

    try {
      const url = await onUpload(file);
      setPreview(url);
    } catch (err) {
      setError(err.message || t('logo.uploadFailed', 'Erro ao fazer upload do logo'));
      setPreview(currentLogo); // Revert to previous
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async () => {
    if (!confirm(t('logo.confirmDelete', 'Tem certeza que deseja remover o logo?'))) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await onDelete();
      setPreview(null);
    } catch (err) {
      setError(err.message || t('logo.deleteFailed', 'Erro ao remover logo'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Preview Area */}
      <div className="flex items-start gap-6">
        {/* Logo Preview */}
        <div className="relative">
          <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden">
            {preview ? (
              <img
                src={preview}
                alt="Company Logo"
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div className="text-center text-gray-400">
                <Image className="w-10 h-10 mx-auto mb-2" />
                <span className="text-xs">{t('logo.noLogo', 'Sem logo')}</span>
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex-1 space-y-3">
          {/* Upload Button */}
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {preview
                ? t('logo.change', 'Alterar Logo')
                : t('logo.upload', 'Fazer Upload')
              }
            </button>
          </div>

          {/* Delete Button */}
          {preview && !uploading && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {t('logo.remove', 'Remover Logo')}
            </button>
          )}

          {/* Info */}
          <div className="text-xs text-gray-500 space-y-1">
            <p>{t('logo.formats', 'Formatos: PNG, JPG, GIF, WebP, SVG')}</p>
            <p>{t('logo.maxSize', 'Tamanho máximo: 5MB')}</p>
            <p>{t('logo.recommendation', 'Recomendado: 200x200px ou maior')}</p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}
    </div>
  );
};

export default LogoUploader;
