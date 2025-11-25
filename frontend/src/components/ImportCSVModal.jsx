import React, { useState } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';

const ImportCSVModal = ({ isOpen, onClose, onImport }) => {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [listName, setListName] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [errors, setErrors] = useState({});
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState(1); // 1: upload, 2: preview, 3: config

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        setErrors({ file: 'Por favor, selecione um arquivo CSV' });
        return;
      }

      setFile(selectedFile);
      setFileName(selectedFile.name);
      setListName(selectedFile.name.replace('.csv', ''));
      setErrors({});

      // Parse CSV
      parseCSV(selectedFile);
    }
  };

  const parseCSV = (file) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
          setErrors({ file: 'O arquivo CSV deve conter ao menos uma linha de dados' });
          return;
        }

        // Parse header
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

        // Parse rows
        const contacts = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',');
          const contact = {};

          headers.forEach((header, index) => {
            const value = values[index]?.trim() || '';

            // Map common column names
            if (header.includes('nome') || header === 'name') {
              contact.name = value;
            } else if (header.includes('email') || header === 'e-mail') {
              contact.email = value;
            } else if (header.includes('telefone') || header.includes('phone') || header.includes('celular')) {
              contact.phone = value;
            } else if (header.includes('linkedin') || header.includes('perfil')) {
              contact.linkedin_url = value;
            } else if (header.includes('empresa') || header.includes('company')) {
              contact.company = value;
            } else if (header.includes('cargo') || header.includes('position') || header.includes('title')) {
              contact.position = value;
            }
          });

          // Only add if has at least name
          if (contact.name) {
            contacts.push(contact);
          }
        }

        if (contacts.length === 0) {
          setErrors({ file: 'Nenhum contato válido encontrado no arquivo' });
          return;
        }

        setParsedData({ contacts, total: contacts.length });
        setStep(2);
      } catch (error) {
        console.error('Erro ao parsear CSV:', error);
        setErrors({ file: 'Erro ao processar arquivo CSV' });
      }
    };

    reader.onerror = () => {
      setErrors({ file: 'Erro ao ler arquivo' });
    };

    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!listName.trim()) {
      setErrors({ listName: 'Nome da lista é obrigatório' });
      return;
    }

    if (!parsedData || parsedData.contacts.length === 0) {
      setErrors({ submit: 'Nenhum contato para importar' });
      return;
    }

    setImporting(true);
    try {
      await onImport({
        listName: listName.trim(),
        fileName,
        contacts: parsedData.contacts
      });

      // Reset state
      handleClose();
    } catch (error) {
      console.error('Erro ao importar:', error);
      setErrors({ submit: error.message || 'Erro ao importar contatos' });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setFileName('');
    setListName('');
    setParsedData(null);
    setErrors({});
    setStep(1);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Upload className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Importar Contatos CSV</h2>
              <p className="text-sm text-gray-500 mt-1">
                Etapa {step} de 2: {step === 1 ? 'Upload do arquivo' : 'Revisar e confirmar'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div className="space-y-6">
              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <p className="font-medium mb-2">Formato esperado do CSV:</p>
                    <p>O arquivo deve conter as colunas: <strong>Nome, Email, Telefone, LinkedIn, Empresa, Cargo</strong></p>
                    <p className="mt-2">Exemplo:</p>
                    <code className="block mt-1 p-2 bg-white rounded text-xs">
                      Nome,Email,Telefone,LinkedIn,Empresa,Cargo<br />
                      João Silva,joao@empresa.com,11999999999,linkedin.com/in/joao,Tech Corp,CEO
                    </code>
                  </div>
                </div>
              </div>

              {/* Upload Area */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
                <div className="text-center">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Selecione um arquivo CSV
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Clique no botão abaixo ou arraste o arquivo para esta área
                  </p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 cursor-pointer transition-colors">
                    <Upload className="w-4 h-4" />
                    Selecionar Arquivo
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>

                  {fileName && (
                    <div className="mt-4 inline-flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                      <FileText className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-900">{fileName}</span>
                    </div>
                  )}

                  {errors.file && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-600">{errors.file}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 2 && parsedData && (
            <div className="space-y-6">
              {/* Success Message */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-900">
                      Arquivo processado com sucesso!
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                      {parsedData.total} contatos encontrados
                    </p>
                  </div>
                </div>
              </div>

              {/* List Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome da Lista *
                </label>
                <input
                  type="text"
                  value={listName}
                  onChange={(e) => {
                    setListName(e.target.value);
                    if (errors.listName) {
                      setErrors(prev => ({ ...prev, listName: null }));
                    }
                  }}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                    errors.listName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Ex: Leads Importados - Janeiro 2024"
                />
                {errors.listName && (
                  <p className="mt-1 text-sm text-red-600">{errors.listName}</p>
                )}
              </div>

              {/* Preview */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  Preview dos primeiros 5 contatos:
                </h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Telefone</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Empresa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {parsedData.contacts.slice(0, 5).map((contact, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-900">{contact.name}</td>
                          <td className="px-4 py-3 text-gray-600">{contact.email || '-'}</td>
                          <td className="px-4 py-3 text-gray-600">{contact.phone || '-'}</td>
                          <td className="px-4 py-3 text-gray-600">{contact.company || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedData.total > 5 && (
                  <p className="text-xs text-gray-500 mt-2">
                    ... e mais {parsedData.total - 5} contatos
                  </p>
                )}
              </div>

              {errors.submit && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{errors.submit}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={importing}
          >
            Cancelar
          </button>
          {step === 2 && (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={importing}
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleImport}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={importing}
              >
                {importing ? 'Importando...' : `Importar ${parsedData.total} Contatos`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportCSVModal;
