import React, { useState, useRef } from 'react';
import { RefreshCw, Upload, User, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Unsplash professional portrait photo IDs for random selection (40+ options)
const UNSPLASH_PHOTO_IDS = [
  // Male professionals
  '1507003211169-0a1dd7228f2d',
  '1472099645785-5658abf4ff4e',
  '1519085360753-af0119f7cbe7',
  '1500648767791-00dcc994a43e',
  '1506794778202-cad84cf45f1d',
  '1560250097-0b93528c311a',
  '1507591064344-4c6ce005b128',
  '1552058544-f2738db43c87',
  '1531123897727-8f129e1688ce',
  '1508214751196-bcfd4ca60f91',
  '1539571696357-5a69c17a67c6',
  '1564564321837-a57b7070ac4f',
  '1568602471122-7832951cc4c5',
  '1590086782957-93c06ef21604',
  '1600180758890-6b94519a8ba6',
  '1566492031773-4f4e44671d66',
  '1633332755192-727a05c4013d',
  '1615109398623-88346a601842',
  // Female professionals
  '1573496359142-b8d87734a5a2',
  '1580489944761-15a19d654956',
  '1494790108377-be9c29b29330',
  '1438761681033-6461ffad8d80',
  '1534528741775-53994a69daeb',
  '1573497019940-1c28c88b4f3e',
  '1487412720507-e7ab37603c6f',
  '1544005313-94ddf0286df2',
  '1500917293891-ef795e70e1f6',
  '1573497161079-f3fd25cc6b90',
  '1589571894960-20bbe2828d0a',
  '1594824476967-48c8b964273f',
  '1598550874518-4f85f738e624',
  '1567532939604-b6b5b0db2604',
  '1595152772835-219674b2a8a6',
  '1607746882042-944635dfe10e',
  '1614204424926-196a80bf0be8',
  '1619895862022-09114b7c74b9',
  '1580894894513-541e068a3e2b',
  '1542909168-82c3e7fdca5c',
  '1605993439219-9d09d2020fa5',
  '1628157588553-5eeea00af15c'
];

const getRandomUnsplashUrl = (currentUrl = null) => {
  let availableIds = UNSPLASH_PHOTO_IDS;

  // Exclude current photo ID from options
  if (currentUrl && currentUrl.includes('unsplash.com')) {
    availableIds = UNSPLASH_PHOTO_IDS.filter(id => !currentUrl.includes(id));
  }

  // If somehow all IDs are excluded, use all of them
  if (availableIds.length === 0) {
    availableIds = UNSPLASH_PHOTO_IDS;
  }

  const randomId = availableIds[Math.floor(Math.random() * availableIds.length)];
  return `https://images.unsplash.com/photo-${randomId}?w=200&h=200&fit=crop&crop=face`;
};

const CustomizeAgentStep = ({
  candidate,
  agentName,
  onChangeName,
  avatarUrl,
  onChangeAvatar
}) => {
  const { t } = useTranslation('hire');
  const fileInputRef = useRef(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Current avatar URL (from candidate or custom)
  const currentAvatar = avatarUrl || candidate?.avatar;

  // Handle refresh avatar from Unsplash
  const handleRefreshAvatar = async () => {
    setIsRefreshing(true);
    setUploadError('');

    // Simulate small delay for UX feedback
    await new Promise(resolve => setTimeout(resolve, 300));

    const newUrl = getRandomUnsplashUrl(currentAvatar);
    onChangeAvatar(newUrl);
    setIsRefreshing(false);
  };

  // Handle file upload
  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError('');

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setUploadError(t('customize.errorNotImage', { defaultValue: 'Por favor, selecione uma imagem' }));
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setUploadError(t('customize.errorTooLarge', { defaultValue: 'A imagem deve ter no máximo 2MB' }));
      return;
    }

    // Convert to base64 data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      onChangeAvatar(e.target.result);
    };
    reader.onerror = () => {
      setUploadError(t('customize.errorReading', { defaultValue: 'Erro ao ler a imagem' }));
    };
    reader.readAsDataURL(file);
  };

  // Trigger file input click
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {t('customize.title', { defaultValue: 'Personalize seu vendedor' })}
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          {t('customize.subtitle', { defaultValue: 'Dê um nome e escolha a aparência do seu assistente' })}
        </p>
      </div>

      {/* Avatar Section */}
      <div className="flex flex-col items-center space-y-4">
        {/* Avatar Preview */}
        <div className="relative">
          <div
            className="w-32 h-32 rounded-full overflow-hidden ring-4 ring-purple-500/30 ring-offset-4 dark:ring-offset-gray-900"
            style={{ backgroundColor: candidate?.color || '#6366F1' }}
          >
            {currentAvatar ? (
              <img
                src={currentAvatar}
                alt={agentName || candidate?.name || 'Avatar'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-16 h-16 text-white/70" />
              </div>
            )}
          </div>
        </div>

        {/* Avatar Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleRefreshAvatar}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {t('customize.refreshAvatar', { defaultValue: 'Outra foto' })}
          </button>

          <button
            type="button"
            onClick={handleUploadClick}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            {t('customize.uploadAvatar', { defaultValue: 'Enviar imagem' })}
          </button>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Upload Error */}
        {uploadError && (
          <p className="text-sm text-red-500 dark:text-red-400">{uploadError}</p>
        )}
      </div>

      {/* Name Input */}
      <div className="max-w-md mx-auto space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('customize.nameLabel', { defaultValue: 'Nome do vendedor' })}
        </label>
        <input
          type="text"
          value={agentName}
          onChange={(e) => onChangeName(e.target.value)}
          placeholder={candidate?.name || 'Ex: Lucas, Marina, João...'}
          className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      </div>

      {/* Info Note */}
      <div className="max-w-lg mx-auto p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-purple-700 dark:text-purple-300">
            {t('customize.infoNote', {
              defaultValue: 'Essa imagem será usada apenas para sua identificação interna, os contatos receberão a foto de perfil normal de cada canal (LinkedIn, Whatsapp, etc).'
            })}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CustomizeAgentStep;
