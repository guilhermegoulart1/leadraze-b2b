import { MessageCircle, Linkedin, Instagram, Send, Mail } from 'lucide-react';

export const getChannelInfo = (providerType) => {
  const channels = {
    WHATSAPP: { icon: MessageCircle, color: 'bg-green-500', label: 'WhatsApp' },
    LINKEDIN: { icon: Linkedin, color: 'bg-blue-600', label: 'LinkedIn' },
    INSTAGRAM: { icon: Instagram, color: 'bg-pink-500', label: 'Instagram' },
    TELEGRAM: { icon: Send, color: 'bg-sky-500', label: 'Telegram' },
    MAIL: { icon: Mail, color: 'bg-gray-500', label: 'Email' },
    GOOGLE: { icon: Mail, color: 'bg-red-500', label: 'Gmail' },
    OUTLOOK: { icon: Mail, color: 'bg-blue-500', label: 'Outlook' },
  };
  return channels[providerType] || null;
};
