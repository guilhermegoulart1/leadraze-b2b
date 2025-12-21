import React from 'react';
import { Target, Headphones, ArrowRight, Linkedin, MessageCircle, Mail, Phone, Globe } from 'lucide-react';

const AgentTypeSelector = ({ onSelect }) => {
  const types = [
    {
      id: 'prospeccao',
      title: 'Prospeccao',
      subtitle: 'Agentes Outbound',
      description: 'Va atras dos seus clientes de forma proativa. Ideal para SDRs e vendedores que precisam iniciar conversas.',
      icon: Target,
      gradient: 'from-blue-500 to-indigo-600',
      bgLight: 'bg-blue-50 dark:bg-blue-900/20',
      borderHover: 'hover:border-blue-400 dark:hover:border-blue-500',
      features: [
        'Envio de convites no LinkedIn',
        'Mensagens de abertura personalizadas',
        'Follow-up automatico',
        'Qualificacao de leads'
      ],
      channels: [
        { icon: Linkedin, label: 'LinkedIn', available: true },
        { icon: Mail, label: 'Email', available: true },
        { icon: MessageCircle, label: 'WhatsApp', available: true }
      ]
    },
    {
      id: 'atendimento',
      title: 'Atendimento',
      subtitle: 'Agentes Inbound',
      description: 'Receba e atenda seus clientes de forma inteligente. Ideal para suporte, vendas receptivas e FAQ.',
      icon: Headphones,
      gradient: 'from-green-500 to-emerald-600',
      bgLight: 'bg-green-50 dark:bg-green-900/20',
      borderHover: 'hover:border-green-400 dark:hover:border-green-500',
      features: [
        'Atendimento 24/7',
        'Respostas inteligentes',
        'Escalacao para humanos',
        'Integracao com CRM'
      ],
      channels: [
        { icon: MessageCircle, label: 'WhatsApp', available: true },
        { icon: Globe, label: 'Website', available: true },
        { icon: Phone, label: 'Telefone', available: false }
      ]
    }
  ];

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Qual tipo de AI Employee voce quer criar?
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-lg mx-auto">
          Escolha o tipo de agente baseado no seu objetivo. Voce podera personalizar tudo depois.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
        {types.map((type) => {
          const Icon = type.icon;

          return (
            <button
              key={type.id}
              onClick={() => onSelect(type.id)}
              className={`text-left p-4 bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 ${type.borderHover} transition-all duration-200 group hover:shadow-lg`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-lg bg-gradient-to-br ${type.gradient}`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 group-hover:translate-x-1 transition-all" />
              </div>

              {/* Title */}
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-0.5">
                {type.title}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {type.subtitle}
              </p>

              {/* Description */}
              <p className="text-gray-600 dark:text-gray-300 mb-3 text-xs leading-relaxed">
                {type.description}
              </p>

              {/* Features */}
              <div className="space-y-1.5 mb-3">
                {type.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <div className={`w-1 h-1 rounded-full bg-gradient-to-r ${type.gradient}`} />
                    {feature}
                  </div>
                ))}
              </div>

              {/* Channels */}
              <div className={`p-2.5 rounded-lg ${type.bgLight}`}>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Canais disponiveis
                </p>
                <div className="flex items-center gap-2.5 flex-wrap">
                  {type.channels.map((channel, idx) => {
                    const ChannelIcon = channel.icon;
                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-1 text-xs ${
                          channel.available
                            ? 'text-gray-700 dark:text-gray-300'
                            : 'text-gray-400 dark:text-gray-500'
                        }`}
                      >
                        <ChannelIcon className="w-3.5 h-3.5" />
                        <span>{channel.label}</span>
                        {!channel.available && (
                          <span className="text-[10px] bg-gray-200 dark:bg-gray-700 px-1 rounded">
                            Em breve
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AgentTypeSelector;
