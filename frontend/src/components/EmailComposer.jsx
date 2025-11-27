/**
 * Email Composer Component
 *
 * TipTap-based rich text editor for composing email replies
 * with formatting toolbar and signature support
 */

import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import DOMPurify from 'dompurify';
import {
  Send,
  Loader,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image,
  Paperclip,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import api from '../services/api';

// Email Toolbar Component
const EmailToolbar = ({ editor, onAttachFile }) => {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  if (!editor) return null;

  const handleSetLink = () => {
    if (linkUrl) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    setShowLinkInput(false);
    setLinkUrl('');
  };

  return (
    <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 flex flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('bold') ? 'bg-gray-200 text-purple-600' : 'text-gray-600'}`}
        title="Negrito (Ctrl+B)"
      >
        <Bold className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('italic') ? 'bg-gray-200 text-purple-600' : 'text-gray-600'}`}
        title="Itálico (Ctrl+I)"
      >
        <Italic className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('bulletList') ? 'bg-gray-200 text-purple-600' : 'text-gray-600'}`}
        title="Lista"
      >
        <List className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('orderedList') ? 'bg-gray-200 text-purple-600' : 'text-gray-600'}`}
        title="Lista Numerada"
      >
        <ListOrdered className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      <div className="relative">
        <button
          type="button"
          onClick={() => setShowLinkInput(!showLinkInput)}
          className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('link') ? 'bg-gray-200 text-purple-600' : 'text-gray-600'}`}
          title="Inserir Link"
        >
          <LinkIcon className="w-4 h-4" />
        </button>
        {showLinkInput && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10 flex gap-2">
            <input
              type="url"
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="px-2 py-1 border border-gray-200 rounded text-sm w-48"
              onKeyDown={(e) => e.key === 'Enter' && handleSetLink()}
            />
            <button
              type="button"
              onClick={handleSetLink}
              className="px-2 py-1 bg-purple-600 text-white rounded text-sm"
            >
              OK
            </button>
          </div>
        )}
      </div>

      {onAttachFile && (
        <>
          <div className="w-px h-5 bg-gray-300 mx-1" />
          <button
            type="button"
            onClick={onAttachFile}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
            title="Anexar Arquivo"
          >
            <Paperclip className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
};

// Attachment Preview Component
const AttachmentPreview = ({ attachments, onRemove }) => {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="border-t border-gray-200 bg-gray-50 px-3 py-2">
      <p className="text-xs text-gray-500 mb-2">Anexos ({attachments.length})</p>
      <div className="flex flex-wrap gap-2">
        {attachments.map((attachment, index) => (
          <div
            key={index}
            className="flex items-center gap-2 bg-white border border-gray-200 rounded px-2 py-1"
          >
            <Paperclip className="w-3 h-3 text-gray-400" />
            <span className="text-sm text-gray-700 truncate max-w-[150px]">
              {attachment.name}
            </span>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="text-gray-400 hover:text-red-500"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// Main Email Composer Component
const EmailComposer = ({
  onSend,
  disabled = false,
  placeholder = 'Escreva seu email...',
  includeSignature = true,
  defaultSignature = null,
  subject = '',
  onSubjectChange = null
}) => {
  const [expanded, setExpanded] = useState(true);
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [signature, setSignature] = useState(defaultSignature);

  // Load default signature if not provided
  useEffect(() => {
    if (includeSignature && !defaultSignature) {
      loadDefaultSignature();
    }
  }, [includeSignature, defaultSignature]);

  const loadDefaultSignature = async () => {
    try {
      const response = await api.getEmailPreferences();
      if (response.preferences?.signature_id) {
        const sigResponse = await api.getEmailSignature(response.preferences.signature_id);
        if (sigResponse.signature) {
          setSignature(sigResponse.signature);
        }
      }
    } catch (err) {
      console.error('Error loading signature:', err);
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none p-3 min-h-[120px] focus:outline-none',
      },
    },
  });

  const handleSend = async () => {
    if (!editor || sending) return;

    const htmlContent = editor.getHTML();
    const textContent = editor.getText();

    if (!textContent.trim()) return;

    setSending(true);

    try {
      // Build full email content with signature
      let fullHtmlContent = htmlContent;
      let fullTextContent = textContent;

      if (includeSignature && signature) {
        const signatureHtml = signature.html_content || '';
        const signatureText = signature.text_content || '';

        fullHtmlContent = `${htmlContent}<br><br>${signatureHtml}`;
        fullTextContent = `${textContent}\n\n${signatureText}`;
      }

      await onSend({
        html_content: fullHtmlContent,
        text_content: fullTextContent,
        subject,
        attachments: attachments.length > 0 ? attachments : undefined
      });

      // Clear editor
      editor.commands.clearContent();
      setAttachments([]);
    } catch (err) {
      console.error('Error sending email:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAttachFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif';
    input.onchange = (e) => {
      const files = Array.from(e.target.files);
      setAttachments([...attachments, ...files]);
    };
    input.click();
  };

  const removeAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  if (!expanded) {
    return (
      <div className="bg-white border-t border-gray-200 p-3">
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ChevronUp className="w-4 h-4" />
          <span className="text-sm">Expandir editor</span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border-t border-gray-200" onKeyDown={handleKeyDown}>
      {/* Subject Line (optional) */}
      {onSubjectChange && (
        <div className="border-b border-gray-200 px-3 py-2">
          <input
            type="text"
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            placeholder="Assunto"
            className="w-full text-sm focus:outline-none"
            disabled={disabled}
          />
        </div>
      )}

      {/* Toolbar */}
      <EmailToolbar editor={editor} onAttachFile={handleAttachFile} />

      {/* Editor */}
      <div className="max-h-[300px] overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      {/* Signature Preview */}
      {includeSignature && signature && (
        <div className="border-t border-gray-100 px-3 py-2 bg-gray-50">
          <p className="text-xs text-gray-400 mb-1">Assinatura:</p>
          <div
            className="text-xs text-gray-500 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(signature.html_content || '') }}
          />
        </div>
      )}

      {/* Attachments */}
      <AttachmentPreview attachments={attachments} onRemove={removeAttachment} />

      {/* Actions */}
      <div className="border-t border-gray-200 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(false)}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
            title="Minimizar"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            Ctrl+Enter para enviar
          </span>
          <button
            onClick={handleSend}
            disabled={disabled || sending || !editor?.getText().trim()}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
          >
            {sending ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                <span>Enviando...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Enviar Email</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailComposer;
