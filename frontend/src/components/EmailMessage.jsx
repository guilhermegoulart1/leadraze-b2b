/**
 * Email Message Component
 *
 * Renders email messages with proper HTML formatting,
 * subject line, and email-specific styling
 */

import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import { Mail, User, Bot, ChevronDown, ChevronUp, Paperclip, ExternalLink } from 'lucide-react';

const EmailMessage = ({
  message,
  isOutgoing,
  senderName,
  senderType, // 'user', 'ai', 'lead'
  timestamp
}) => {
  const [expanded, setExpanded] = useState(true);

  // Parse email content - could be HTML or plain text
  const content = message.html_content || message.content || message.text || '';
  const subject = message.subject || message.metadata?.subject;
  const attachments = message.attachments || message.metadata?.attachments || [];

  // Sanitize HTML content
  const sanitizedHtml = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
      'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'style', 'class', 'target', 'rel'],
    ADD_ATTR: ['target', 'rel'],
  });

  // Check if content is HTML or plain text
  const isHtml = content.includes('<') && content.includes('>');

  // Get sender icon
  const SenderIcon = senderType === 'user' ? User : senderType === 'ai' ? Bot : Mail;

  // Format timestamp
  const formatTime = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-2xl w-full ${isOutgoing ? 'ml-12' : 'mr-12'}`}>
        {/* Email Card */}
        <div
          className={`rounded-lg border overflow-hidden ${
            isOutgoing
              ? 'bg-purple-50 border-purple-200'
              : 'bg-white border-gray-200'
          }`}
        >
          {/* Header */}
          <div
            className={`flex items-center justify-between px-4 py-2 cursor-pointer ${
              isOutgoing ? 'bg-purple-100' : 'bg-gray-50'
            }`}
            onClick={() => setExpanded(!expanded)}
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  isOutgoing
                    ? 'bg-purple-600 text-white'
                    : senderType === 'ai'
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 text-white'
                }`}
              >
                <SenderIcon className="w-4 h-4" />
              </div>
              <div>
                <p className={`text-sm font-medium ${isOutgoing ? 'text-purple-900' : 'text-gray-900'}`}>
                  {senderName || (isOutgoing ? 'Você' : 'Lead')}
                </p>
                {subject && (
                  <p className={`text-xs ${isOutgoing ? 'text-purple-700' : 'text-gray-600'}`}>
                    {subject}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${isOutgoing ? 'text-purple-600' : 'text-gray-500'}`}>
                {formatTime(timestamp)}
              </span>
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>

          {/* Content */}
          {expanded && (
            <div className="px-4 py-3">
              {isHtml ? (
                <div
                  className="prose prose-sm max-w-none text-gray-800"
                  dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                  style={{
                    fontSize: '14px',
                    lineHeight: '1.6'
                  }}
                />
              ) : (
                <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">
                  {content}
                </pre>
              )}

              {/* Attachments */}
              {attachments.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                    <Paperclip className="w-3 h-3" />
                    {attachments.length} anexo{attachments.length > 1 ? 's' : ''}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((attachment, index) => (
                      <a
                        key={index}
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 rounded px-3 py-1.5 text-sm text-gray-700 transition-colors"
                      >
                        <Paperclip className="w-3 h-3" />
                        <span className="truncate max-w-[150px]">
                          {attachment.filename || attachment.name || `Anexo ${index + 1}`}
                        </span>
                        <ExternalLink className="w-3 h-3 text-gray-400" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailMessage;
