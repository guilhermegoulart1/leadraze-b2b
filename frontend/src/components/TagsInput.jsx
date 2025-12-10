// frontend/src/components/TagsInput.jsx
import React, { useState } from 'react';
import { X } from 'lucide-react';

const TagsInput = ({ tags = [], onChange, placeholder = "Digite e pressione vírgula ou Enter..." }) => {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e) => {
    // Adicionar tag ao pressionar vírgula ou Enter
    if (e.key === ',' || e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
    // Remover última tag ao pressionar Backspace com input vazio
    else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const addTag = () => {
    const trimmedValue = inputValue.trim().replace(/,+$/, ''); // Remove vírgulas do final

    if (trimmedValue && !tags.includes(trimmedValue)) {
      onChange([...tags, trimmedValue]);
      setInputValue('');
    }
  };

  const removeTag = (indexToRemove) => {
    onChange(tags.filter((_, index) => index !== indexToRemove));
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');

    // Dividir por vírgula e adicionar múltiplas tags
    const newTags = pastedText
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag && !tags.includes(tag));

    if (newTags.length > 0) {
      onChange([...tags, ...newTags]);
      setInputValue('');
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-2 p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-transparent min-h-[42px] bg-white dark:bg-gray-700">
        {tags.map((tag, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 rounded-full text-sm font-medium"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="hover:bg-purple-200 dark:hover:bg-purple-800/50 rounded-full p-0.5 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={addTag}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] outline-none bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
        />
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        Digite e pressione <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">vírgula</kbd> ou <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300">Enter</kbd> para adicionar
      </p>
    </div>
  );
};

export default TagsInput;
