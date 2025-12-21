// frontend/src/components/aiemployees/WorkflowBuilder/nodes/TriggerNode.jsx
// Trigger node - start of the workflow with delete capability

import React, { memo, useState } from 'react';
import { Handle, Position } from 'reactflow';
import {
  Zap, MessageSquare, UserCheck, UserX, Eye, Heart,
  Mail, Clock, Send, UserPlus, Image, MousePointer,
  List, Globe, LogOut, Reply, XCircle, Trash2, Copy, X, AlertTriangle
} from 'lucide-react';

// All event icons by channel
const eventIcons = {
  // LinkedIn
  invite_sent: Send,
  invite_accepted: UserCheck,
  invite_ignored: UserX,
  message_received: MessageSquare,
  profile_viewed: Eye,
  post_engagement: Heart,
  inmail_received: Mail,
  no_response: Clock,
  // WhatsApp
  first_contact: UserPlus,
  media_received: Image,
  button_clicked: MousePointer,
  list_selected: List,
  // Email
  email_sent: Send,
  email_opened: Eye,
  email_clicked: MousePointer,
  email_replied: Reply,
  email_bounced: XCircle,
  // WebChat
  chat_started: MessageSquare,
  page_visited: Globe,
  time_on_page: Clock,
  exit_intent: LogOut,
  // Generic
  custom: Zap
};

// All event labels
const eventLabels = {
  // LinkedIn
  invite_sent: 'Convite Enviado',
  invite_accepted: 'Convite Aceito',
  invite_ignored: 'Convite Ignorado',
  message_received: 'Mensagem Recebida',
  profile_viewed: 'Perfil Visualizado',
  post_engagement: 'Engajou no Post',
  inmail_received: 'InMail Recebido',
  no_response: 'Sem Resposta',
  // WhatsApp
  first_contact: 'Primeiro Contato',
  media_received: 'Midia Recebida',
  button_clicked: 'Botao Clicado',
  list_selected: 'Lista Selecionada',
  // Email
  email_sent: 'Email Enviado',
  email_opened: 'Email Aberto',
  email_clicked: 'Link Clicado',
  email_replied: 'Email Respondido',
  email_bounced: 'Email Rejeitado',
  // WebChat
  chat_started: 'Chat Iniciado',
  page_visited: 'Pagina Visitada',
  time_on_page: 'Tempo na Pagina',
  exit_intent: 'Intencao de Saida',
  // Generic
  custom: 'Evento Customizado'
};

// Delete confirmation modal
const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, nodeName }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm mx-4 z-10">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Excluir Trigger
          </h3>
        </div>

        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Tem certeza que deseja excluir <span className="font-medium text-gray-900 dark:text-white">"{nodeName}"</span>?
          Esta acao ira remover todas as conexoes associadas.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
};

const TriggerNode = ({ id, data, selected }) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const Icon = eventIcons[data.event] || Zap;

  const handleDelete = (e) => {
    e.stopPropagation();
    setShowDeleteModal(true);
  };

  const handleClone = (e) => {
    e.stopPropagation();
    if (data.onClone) {
      data.onClone(id);
    }
  };

  const confirmDelete = () => {
    if (data.onDelete) {
      data.onDelete(id);
    }
    setShowDeleteModal(false);
  };

  return (
    <>
      <div
        className={`
          w-[260px] rounded-xl shadow-lg border-2 overflow-hidden relative group
          ${selected
            ? 'border-green-500 shadow-green-500/20 shadow-xl'
            : 'border-green-400/50 hover:border-green-400'}
          transition-all duration-200
        `}
      >
        {/* Action buttons - appears on hover */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
          <button
            onClick={handleClone}
            className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300 dark:hover:border-purple-600 transition-all"
            title="Clonar trigger"
          >
            <Copy className="w-4 h-4 text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-600 transition-all"
            title="Excluir trigger"
          >
            <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400" />
          </button>
        </div>

        {/* Header with name */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-3 flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <Icon className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-white text-base tracking-wide">
            {data.label || 'Trigger'}
          </span>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 p-4">
          {/* Event type */}
          <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
            {eventLabels[data.event] || 'Evento'}
          </p>

          {/* LinkedIn invite specific options */}
          {data.event === 'invite_sent' && data.withNote && (
            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 p-2 rounded line-clamp-2">
              "{data.inviteNote || '...'}"
            </div>
          )}
        </div>

        {/* Output handle - right side */}
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="!w-4 !h-4 !bg-green-500 !border-2 !border-white"
        />
      </div>

      {/* Delete confirmation modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        nodeName={data.label || eventLabels[data.event] || 'Trigger'}
      />
    </>
  );
};

export default memo(TriggerNode);
