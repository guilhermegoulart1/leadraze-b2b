import React, { useState, useRef, useEffect } from 'react';
import { AtSign } from 'lucide-react';
import api from '../services/api';

/**
 * Textarea com suporte a menções (@)
 * Detecta @ e mostra lista de usuários para mencionar
 */
const MentionTextarea = ({
  value,
  onChange,
  onMentionsChange,
  leadId,
  placeholder = 'Escreva um comentário... Use @ para mencionar',
  className = '',
  rows = 2,
  onKeyDown,
  ...props
}) => {
  const [showUserList, setShowUserList] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserIndex, setSelectedUserIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentions, setMentions] = useState([]); // Array of { id, name, position }
  const [lastCursorPos, setLastCursorPos] = useState(0);
  const textareaRef = useRef(null);
  const userListRef = useRef(null);

  // Detectar @ no texto
  useEffect(() => {
    const text = value || '';
    const cursorPos = lastCursorPos;

    // Encontrar @ antes do cursor
    const beforeCursor = text.substring(0, cursorPos);
    const lastAtIndex = beforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      // Verificar se há espaço ou quebra de linha antes do @
      const charBeforeAt = lastAtIndex > 0 ? beforeCursor[lastAtIndex - 1] : ' ';
      const isValidMention = lastAtIndex === 0 || /\s/.test(charBeforeAt);

      if (isValidMention) {
        // Extrair query após @
        const afterAt = beforeCursor.substring(lastAtIndex + 1);
        const spaceIndex = afterAt.indexOf(' ');
        const query = spaceIndex === -1 ? afterAt : afterAt.substring(0, spaceIndex);

        // Se o cursor está dentro da mention
        if (spaceIndex === -1 || cursorPos <= lastAtIndex + 1 + spaceIndex) {
          setUserSearchQuery(query);
          setShowUserList(true);
          setCursorPosition(lastAtIndex);
          return;
        }
      }
    }

    setShowUserList(false);
  }, [value, lastCursorPos]);

  // Buscar usuários
  useEffect(() => {
    if (!showUserList || !leadId) return;

    const searchUsers = async () => {
      try {
        setLoadingUsers(true);
        const response = await api.searchUsersForMentions(leadId, userSearchQuery);

        if (response.success) {
          setUsers(response.data.users);
          setSelectedUserIndex(0);
        }
      } catch (error) {
        console.error('Error searching users:', error);
        setUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [showUserList, userSearchQuery, leadId]);

  // Navegação por teclado na lista de usuários
  const handleKeyDown = (e) => {
    if (showUserList && users.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedUserIndex((prev) => (prev + 1) % users.length);
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedUserIndex((prev) => (prev - 1 + users.length) % users.length);
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        selectUser(users[selectedUserIndex]);
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setShowUserList(false);
        return;
      }
    }

    // Passar evento para parent
    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  // Selecionar usuário
  const selectUser = (user) => {
    if (!user) return;

    const text = value || '';
    const beforeMention = text.substring(0, cursorPosition);
    const afterMention = text.substring(textareaRef.current.selectionStart);

    // Substituir @query pelo @nome
    const newText = beforeMention + `@${user.name} ` + afterMention;

    // Atualizar mentions
    const newMention = {
      id: user.id,
      name: user.name,
      position: cursorPosition
    };

    const updatedMentions = [...mentions, newMention];
    setMentions(updatedMentions);

    // Notificar pai sobre mudanças
    onChange({ target: { value: newText } });

    if (onMentionsChange) {
      onMentionsChange(updatedMentions.map(m => m.id));
    }

    // Fechar lista
    setShowUserList(false);

    // Colocar cursor após a menção
    setTimeout(() => {
      const newCursorPos = cursorPosition + user.name.length + 2; // @ + nome + espaço
      textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      textareaRef.current.focus();
    }, 0);
  };

  // Scroll para item selecionado
  useEffect(() => {
    if (showUserList && userListRef.current) {
      const selectedElement = userListRef.current.children[selectedUserIndex];
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedUserIndex, showUserList]);

  // Track cursor position changes
  const handleTextareaChange = (e) => {
    onChange(e);
    setLastCursorPos(e.target.selectionStart);
  };

  const handleClick = (e) => {
    setLastCursorPos(e.target.selectionStart);
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleTextareaChange}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        rows={rows}
        {...props}
      />

      {/* Lista de usuários para mention */}
      {showUserList && (
        <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
          {loadingUsers ? (
            <div className="p-3 text-center text-sm text-gray-500">
              Buscando usuários...
            </div>
          ) : users.length === 0 ? (
            <div className="p-3 text-center text-sm text-gray-500">
              Nenhum usuário encontrado
            </div>
          ) : (
            <div ref={userListRef}>
              {users.map((user, index) => (
                <button
                  key={user.id}
                  onClick={() => selectUser(user)}
                  onMouseEnter={() => setSelectedUserIndex(index)}
                  className={`w-full flex items-center gap-3 p-2 text-left hover:bg-purple-50 transition-colors ${
                    index === selectedUserIndex ? 'bg-purple-50' : ''
                  }`}
                >
                  {/* Avatar */}
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white text-xs font-medium">
                      {user.name?.charAt(0) || '?'}
                    </div>
                  )}

                  {/* User info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {user.name}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {user.email}
                    </div>
                  </div>

                  {/* Role badge */}
                  {user.role && user.role !== 'user' && (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full capitalize">
                      {user.role}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Hint */}
          <div className="border-t border-gray-200 p-2 text-xs text-gray-400 flex items-center gap-2">
            <AtSign className="w-3 h-3" />
            <span>Use ↑↓ para navegar, Enter para selecionar</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MentionTextarea;
