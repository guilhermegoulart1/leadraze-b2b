import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Loader, CheckCircle, ArrowRight } from 'lucide-react';

// Questions based on agent type and niche
const INTERVIEW_QUESTIONS = {
  prospeccao: {
    default: [
      { id: 'company_name', question: 'Qual o nome da sua empresa?', type: 'text', required: true },
      { id: 'product_service', question: 'O que voce vende? Descreva seu produto ou servico principal.', type: 'textarea', required: true },
      { id: 'target_audience', question: 'Quem e seu cliente ideal? (cargo, tamanho de empresa, setor)', type: 'textarea', required: true },
      { id: 'main_pain', question: 'Qual o principal problema que seu produto resolve?', type: 'textarea', required: true },
      { id: 'differentials', question: 'Quais seus principais diferenciais em relacao aos concorrentes?', type: 'textarea', required: false },
      { id: 'avg_ticket', question: 'Qual o ticket medio da sua solucao? (pode ser aproximado)', type: 'text', required: false },
      { id: 'conversion_goal', question: 'Qual o objetivo principal? (agendar call, enviar proposta, fazer demo)', type: 'select', options: ['Agendar reuniao', 'Enviar proposta', 'Fazer demonstracao', 'Qualificar lead', 'Outro'], required: true }
    ]
  },
  atendimento: {
    default: [
      { id: 'company_name', question: 'Qual o nome da sua empresa/negocio?', type: 'text', required: true },
      { id: 'services', question: 'Quais servicos voces oferecem? Liste os principais.', type: 'textarea', required: true },
      { id: 'operating_hours', question: 'Qual o horario de funcionamento?', type: 'text', required: true },
      { id: 'address', question: 'Qual o endereco? (se aplicavel)', type: 'text', required: false },
      { id: 'accepts_scheduling', question: 'Voces trabalham com agendamento?', type: 'select', options: ['Sim, agendamento obrigatorio', 'Sim, mas aceita encaixe', 'Nao, ordem de chegada', 'Depende do servico'], required: true },
      { id: 'payment_methods', question: 'Quais formas de pagamento aceitam?', type: 'multiselect', options: ['Dinheiro', 'Pix', 'Cartao de credito', 'Cartao de debito', 'Boleto', 'Convenio'], required: true },
      { id: 'common_questions', question: 'Quais as duvidas mais frequentes dos clientes?', type: 'textarea', required: false },
      { id: 'escalation_scenarios', question: 'Em quais situacoes o atendimento deve ser transferido para um humano?', type: 'textarea', required: true }
    ],
    'clinica-veterinaria': [
      { id: 'clinic_name', question: 'Qual o nome da clinica veterinaria?', type: 'text', required: true },
      { id: 'services', question: 'Quais servicos voces oferecem? (consultas, cirurgias, vacinas, banho e tosa, etc)', type: 'multiselect', options: ['Consultas', 'Cirurgias', 'Vacinas', 'Banho e tosa', 'Pet shop', 'Hotel para pets', 'Emergencias 24h', 'Exames laboratoriais', 'Raio-X/Ultrassom'], required: true },
      { id: 'species', question: 'Quais especies voces atendem?', type: 'multiselect', options: ['Caes', 'Gatos', 'Aves', 'Roedores', 'Repteis', 'Peixes', 'Animais silvestres'], required: true },
      { id: 'emergency_24h', question: 'Voces atendem emergencias 24h?', type: 'select', options: ['Sim, 24 horas', 'Sim, em horario estendido', 'Nao, apenas horario comercial'], required: true },
      { id: 'has_petshop', question: 'A clinica tem pet shop?', type: 'select', options: ['Sim', 'Nao'], required: true },
      { id: 'operating_hours', question: 'Qual o horario de funcionamento normal?', type: 'text', required: true },
      { id: 'address', question: 'Qual o endereco da clinica?', type: 'text', required: true },
      { id: 'accepts_insurance', question: 'Voces aceitam plano de saude pet?', type: 'select', options: ['Sim', 'Nao', 'Alguns planos'], required: true },
      { id: 'avg_consultation_price', question: 'Qual o valor medio de uma consulta?', type: 'text', required: false },
      { id: 'differentials', question: 'Quais os diferenciais da clinica?', type: 'textarea', required: false }
    ]
  }
};

const SmartInterview = ({ agentType, template, onComplete }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);

  // Get questions based on type and template
  const getQuestions = () => {
    const typeQuestions = INTERVIEW_QUESTIONS[agentType] || {};
    const templateId = template?.id || 'default';
    return typeQuestions[templateId] || typeQuestions.default || [];
  };

  const questions = getQuestions();
  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex) / questions.length) * 100;

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Add initial greeting
  useEffect(() => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages([{
        type: 'bot',
        content: `Ola! Vou te fazer algumas perguntas para configurar seu AI Employee da melhor forma. Vamos la?`
      }]);
      setIsTyping(false);

      // Add first question
      setTimeout(() => {
        if (currentQuestion) {
          setMessages(prev => [...prev, {
            type: 'bot',
            content: currentQuestion.question,
            questionType: currentQuestion.type,
            options: currentQuestion.options
          }]);
        }
      }, 500);
    }, 1000);
  }, []);

  const handleSendAnswer = () => {
    if (!currentQuestion) return;

    let answerValue = currentAnswer;

    // Handle multiselect
    if (currentQuestion.type === 'multiselect') {
      if (selectedOptions.length === 0) return;
      answerValue = selectedOptions;
    } else if (currentQuestion.type === 'select') {
      if (!currentAnswer) return;
    } else {
      if (!currentAnswer.trim()) return;
    }

    // Add user message
    const displayAnswer = Array.isArray(answerValue) ? answerValue.join(', ') : answerValue;
    setMessages(prev => [...prev, { type: 'user', content: displayAnswer }]);

    // Save answer
    const newAnswers = { ...answers, [currentQuestion.id]: answerValue };
    setAnswers(newAnswers);

    // Clear current answer
    setCurrentAnswer('');
    setSelectedOptions([]);

    // Move to next question or complete
    if (currentQuestionIndex < questions.length - 1) {
      setIsTyping(true);
      setTimeout(() => {
        const nextQuestion = questions[currentQuestionIndex + 1];
        setMessages(prev => [...prev, {
          type: 'bot',
          content: nextQuestion.question,
          questionType: nextQuestion.type,
          options: nextQuestion.options
        }]);
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setIsTyping(false);
      }, 800);
    } else {
      // Interview complete
      setIsTyping(true);
      setTimeout(() => {
        setMessages(prev => [...prev, {
          type: 'bot',
          content: 'Perfeito! Coletei todas as informacoes necessarias. Vou preparar seu AI Employee com base nas suas respostas.',
          isComplete: true
        }]);
        setCurrentQuestionIndex(questions.length);
        setIsTyping(false);
      }, 800);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendAnswer();
    }
  };

  const toggleOption = (option) => {
    setSelectedOptions(prev =>
      prev.includes(option)
        ? prev.filter(o => o !== option)
        : [...prev, option]
    );
  };

  const isComplete = currentQuestionIndex >= questions.length;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
          <span>Configurando seu AI Employee</span>
          <span>{Math.round(progress)}% concluido</span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Chat container */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Messages area */}
        <div className="h-[400px] overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex items-start gap-3 ${
                message.type === 'user' ? 'flex-row-reverse' : ''
              }`}
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                message.type === 'user'
                  ? 'bg-purple-100 dark:bg-purple-900/30'
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}>
                {message.type === 'user' ? (
                  <User className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                ) : (
                  <Bot className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                )}
              </div>

              <div className={`max-w-[80%] ${message.type === 'user' ? 'text-right' : ''}`}>
                <div className={`inline-block px-4 py-2 rounded-2xl ${
                  message.type === 'user'
                    ? 'bg-purple-600 text-white rounded-tr-none'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-tl-none'
                }`}>
                  {message.content}
                </div>

                {/* Options for select/multiselect */}
                {message.options && message.type === 'bot' && !isComplete && index === messages.length - 1 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.options.map((option) => (
                      <button
                        key={option}
                        onClick={() => {
                          if (message.questionType === 'multiselect') {
                            toggleOption(option);
                          } else {
                            setCurrentAnswer(option);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                          message.questionType === 'multiselect'
                            ? selectedOptions.includes(option)
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            : currentAnswer === option
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}

                {/* Complete indicator */}
                {message.isComplete && (
                  <div className="mt-3 flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Entrevista concluida!</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <Bot className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl rounded-tl-none px-4 py-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        {!isComplete && currentQuestion && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            {currentQuestion.type === 'textarea' ? (
              <div className="flex gap-3">
                <textarea
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Digite sua resposta..."
                  rows={3}
                  className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl focus:ring-2 focus:ring-purple-500 resize-none dark:text-white"
                />
                <button
                  onClick={handleSendAnswer}
                  disabled={!currentAnswer.trim()}
                  className="self-end p-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            ) : currentQuestion.type === 'select' || currentQuestion.type === 'multiselect' ? (
              <button
                onClick={handleSendAnswer}
                disabled={currentQuestion.type === 'multiselect' ? selectedOptions.length === 0 : !currentAnswer}
                className="w-full py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Confirmar selecao
              </button>
            ) : (
              <div className="flex gap-3">
                <input
                  type="text"
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Digite sua resposta..."
                  className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl focus:ring-2 focus:ring-purple-500 dark:text-white"
                />
                <button
                  onClick={handleSendAnswer}
                  disabled={!currentAnswer.trim()}
                  className="p-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Complete actions */}
        {isComplete && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <button
              onClick={() => onComplete(answers)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all font-medium"
            >
              Continuar para o Workflow
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartInterview;
