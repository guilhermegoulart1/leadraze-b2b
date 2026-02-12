/**
 * Onboarding checklist task definitions.
 * These are the standard tasks for every client onboarding.
 * All tasks are shown; admin unchecks what doesn't apply.
 */

const ONBOARDING_STAGES = [
  {
    stage: 1,
    key: 'kickoff',
    title_pt: 'Kickoff',
    title_en: 'Kickoff',
    title_es: 'Kickoff',
    description_pt: 'Reunião inicial + formulário de coleta',
    description_en: 'Initial meeting + intake form',
    description_es: 'Reunión inicial + formulario de recolección',
    tasks: [
      { key: 'kickoff_apresentacao', title_pt: 'Apresentação da plataforma e do processo', title_en: 'Platform and process presentation', title_es: 'Presentación de la plataforma y del proceso' },
      { key: 'kickoff_objetivo_agente', title_pt: 'Definir objetivo do agente (prospecção, atendimento, suporte, etc.)', title_en: 'Define agent objective (prospecting, support, etc.)', title_es: 'Definir objetivo del agente (prospección, soporte, etc.)' },
      { key: 'kickoff_info_empresa', title_pt: 'Coletar informações sobre a empresa', title_en: 'Collect company information', title_es: 'Recopilar información de la empresa' },
      { key: 'kickoff_produto_servico', title_pt: 'Entender produto/serviço e proposta de valor', title_en: 'Understand product/service and value proposition', title_es: 'Entender producto/servicio y propuesta de valor' },
      { key: 'kickoff_tom_voz', title_pt: 'Mapear tom de voz e estilo de comunicação', title_en: 'Map tone of voice and communication style', title_es: 'Mapear tono de voz y estilo de comunicación' },
      { key: 'kickoff_objecoes', title_pt: 'Levantar objeções mais comuns', title_en: 'Identify common objections', title_es: 'Identificar objeciones comunes' },
      { key: 'kickoff_materiais', title_pt: 'Coletar materiais existentes (pitch, scripts, cases)', title_en: 'Collect existing materials (pitch, scripts, cases)', title_es: 'Recopilar materiales existentes (pitch, scripts, casos)' },
      { key: 'kickoff_metas', title_pt: 'Definir metas e expectativas', title_en: 'Define goals and expectations', title_es: 'Definir metas y expectativas' },
      { key: 'kickoff_canais', title_pt: 'Definir canais (LinkedIn, WhatsApp, etc.)', title_en: 'Define channels (LinkedIn, WhatsApp, etc.)', title_es: 'Definir canales (LinkedIn, WhatsApp, etc.)' },
      { key: 'kickoff_token_onboarding', title_pt: 'Enviar token de onboarding para o cliente', title_en: 'Send onboarding token to client', title_es: 'Enviar token de onboarding al cliente' },
      { key: 'kickoff_cliente_conectou', title_pt: 'Cliente conectou seus canais', title_en: 'Client connected their channels', title_es: 'Cliente conectó sus canales' },
      { key: 'kickoff_validar_canais', title_pt: 'Validar que os canais foram conectados corretamente', title_en: 'Validate channels connected correctly', title_es: 'Validar que los canales se conectaron correctamente' },
      { key: 'kickoff_icp', title_pt: 'Definir ICP (Ideal Customer Profile)', title_en: 'Define ICP (Ideal Customer Profile)', title_es: 'Definir ICP (Perfil de Cliente Ideal)' },
      { key: 'kickoff_estrategia_conexao', title_pt: 'Definir estratégia de conexão (silent/with-intro/icebreaker)', title_en: 'Define connection strategy (silent/with-intro/icebreaker)', title_es: 'Definir estrategia de conexión (silent/with-intro/icebreaker)' },
      { key: 'kickoff_tipos_solicitacao', title_pt: 'Mapear tipos de solicitação mais comuns', title_en: 'Map most common request types', title_es: 'Mapear tipos de solicitud más comunes' },
      { key: 'kickoff_regras_escalonamento', title_pt: 'Definir regras de escalonamento (handoff para humano)', title_en: 'Define escalation rules (human handoff)', title_es: 'Definir reglas de escalamiento (handoff a humano)' },
    ]
  },
  {
    stage: 2,
    key: 'configuracao',
    title_pt: 'Configuração',
    title_en: 'Configuration',
    title_es: 'Configuración',
    description_pt: 'Construção dos agentes e fluxos',
    description_en: 'Building agents and flows',
    description_es: 'Construcción de agentes y flujos',
    tasks: [
      { key: 'config_criar_agente', title_pt: 'Criar agente com persona/identidade', title_en: 'Create agent with persona/identity', title_es: 'Crear agente con persona/identidad' },
      { key: 'config_tom_voz', title_pt: 'Configurar tom de voz e estilo de comunicação', title_en: 'Configure tone of voice and communication style', title_es: 'Configurar tono de voz y estilo de comunicación' },
      { key: 'config_base_conhecimento', title_pt: 'Montar base de conhecimento (produto, empresa, processos)', title_en: 'Build knowledge base (product, company, processes)', title_es: 'Construir base de conocimiento (producto, empresa, procesos)' },
      { key: 'config_faq', title_pt: 'Criar FAQ com perguntas e respostas frequentes', title_en: 'Create FAQ with common questions and answers', title_es: 'Crear FAQ con preguntas y respuestas frecuentes' },
      { key: 'config_objecoes', title_pt: 'Configurar tratamento de objeções', title_en: 'Configure objection handling', title_es: 'Configurar tratamiento de objeciones' },
      { key: 'config_regras_handoff', title_pt: 'Definir regras de handoff (quando transfere para humano)', title_en: 'Define handoff rules (when to transfer to human)', title_es: 'Definir reglas de handoff (cuándo transferir a humano)' },
      { key: 'config_connection_strategy', title_pt: 'Definir connection_strategy do agente', title_en: 'Define agent connection_strategy', title_es: 'Definir connection_strategy del agente' },
      { key: 'config_mensagens_convite', title_pt: 'Criar mensagens de convite/abertura', title_en: 'Create invite/opening messages', title_es: 'Crear mensajes de invitación/apertura' },
      { key: 'config_sequencia_followup', title_pt: 'Criar sequência de follow-up', title_en: 'Create follow-up sequence', title_es: 'Crear secuencia de follow-up' },
      { key: 'config_workflow_qualificacao', title_pt: 'Configurar workflow de qualificação', title_en: 'Configure qualification workflow', title_es: 'Configurar workflow de calificación' },
      { key: 'config_segmentacao', title_pt: 'Definir segmentação / filtros de busca', title_en: 'Define segmentation / search filters', title_es: 'Definir segmentación / filtros de búsqueda' },
      { key: 'config_categorizacao', title_pt: 'Configurar categorização de solicitações', title_en: 'Configure request categorization', title_es: 'Configurar categorización de solicitudes' },
      { key: 'config_fluxos_resposta', title_pt: 'Definir fluxos de resposta por tipo de demanda', title_en: 'Define response flows by request type', title_es: 'Definir flujos de respuesta por tipo de demanda' },
      { key: 'config_respostas_auto', title_pt: 'Configurar respostas automáticas para casos simples', title_en: 'Configure automatic responses for simple cases', title_es: 'Configurar respuestas automáticas para casos simples' },
      { key: 'config_horarios', title_pt: 'Configurar horários de operação e delays', title_en: 'Configure operation hours and delays', title_es: 'Configurar horarios de operación y delays' },
      { key: 'config_templates', title_pt: 'Configurar templates de mensagens', title_en: 'Configure message templates', title_es: 'Configurar plantillas de mensajes' },
    ]
  },
  {
    stage: 3,
    key: 'testes',
    title_pt: 'Testes Internos',
    title_en: 'Internal Testing',
    title_es: 'Pruebas Internas',
    description_pt: 'Simulação de todos os cenários',
    description_en: 'Simulation of all scenarios',
    description_es: 'Simulación de todos los escenarios',
    tasks: [
      { key: 'teste_lead_frio', title_pt: 'Simular lead frio / desinteresse', title_en: 'Simulate cold lead / disinterest', title_es: 'Simular lead frío / desinterés' },
      { key: 'teste_lead_quente', title_pt: 'Simular lead quente / engajado', title_en: 'Simulate warm lead / engaged', title_es: 'Simular lead caliente / comprometido' },
      { key: 'teste_objecao_preco', title_pt: 'Simular objeções de preço', title_en: 'Simulate price objections', title_es: 'Simular objeciones de precio' },
      { key: 'teste_objecao_timing', title_pt: 'Simular objeções de timing', title_en: 'Simulate timing objections', title_es: 'Simular objeciones de timing' },
      { key: 'teste_objecao_concorrencia', title_pt: 'Simular objeções de concorrência', title_en: 'Simulate competitor objections', title_es: 'Simular objeciones de competencia' },
      { key: 'teste_perguntas_tecnicas', title_pt: 'Simular perguntas técnicas sobre o produto', title_en: 'Simulate technical product questions', title_es: 'Simular preguntas técnicas del producto' },
      { key: 'teste_off_topic', title_pt: 'Simular conversa off-topic / irrelevante', title_en: 'Simulate off-topic / irrelevant conversation', title_es: 'Simular conversación fuera de tema / irrelevante' },
      { key: 'teste_handoff', title_pt: 'Testar handoff para humano', title_en: 'Test human handoff', title_es: 'Probar handoff a humano' },
      { key: 'teste_solicitacao_simples', title_pt: 'Simular solicitação simples (resposta automática)', title_en: 'Simulate simple request (automatic response)', title_es: 'Simular solicitud simple (respuesta automática)' },
      { key: 'teste_caso_complexo', title_pt: 'Simular caso complexo (escalonamento)', title_en: 'Simulate complex case (escalation)', title_es: 'Simular caso complejo (escalamiento)' },
      { key: 'teste_fluxo_completo', title_pt: 'Testar fluxo completo ponta a ponta', title_en: 'Test full end-to-end flow', title_es: 'Probar flujo completo de punta a punta' },
      { key: 'teste_tom_voz', title_pt: 'Revisar tom de voz em todas as respostas', title_en: 'Review tone of voice in all responses', title_es: 'Revisar tono de voz en todas las respuestas' },
      { key: 'teste_hallucination', title_pt: 'Verificar que o agente não inventa informações', title_en: 'Verify agent does not hallucinate', title_es: 'Verificar que el agente no inventa información' },
      { key: 'teste_ajustes', title_pt: 'Ajustar prompts/respostas com base nos resultados', title_en: 'Adjust prompts/responses based on results', title_es: 'Ajustar prompts/respuestas basado en resultados' },
    ]
  },
  {
    stage: 4,
    key: 'revisao',
    title_pt: 'Revisão Conjunta',
    title_en: 'Joint Review',
    title_es: 'Revisión Conjunta',
    description_pt: 'Demonstração ao cliente e coleta de feedback',
    description_en: 'Client demonstration and feedback collection',
    description_es: 'Demostración al cliente y recolección de feedback',
    tasks: [
      { key: 'revisao_demo', title_pt: 'Apresentar o agente funcionando ao vivo', title_en: 'Present live agent demo', title_es: 'Presentar el agente funcionando en vivo' },
      { key: 'revisao_fluxo_completo', title_pt: 'Mostrar fluxo completo do agente configurado', title_en: 'Show complete configured agent flow', title_es: 'Mostrar flujo completo del agente configurado' },
      { key: 'revisao_cenarios', title_pt: 'Demonstrar tratamento de cenários difíceis', title_en: 'Demonstrate difficult scenario handling', title_es: 'Demostrar tratamiento de escenarios difíciles' },
      { key: 'revisao_dashboard', title_pt: 'Mostrar dashboard e métricas disponíveis', title_en: 'Show dashboard and available metrics', title_es: 'Mostrar dashboard y métricas disponibles' },
      { key: 'revisao_feedback', title_pt: 'Coletar feedback sobre tom, fluxo e respostas', title_en: 'Collect feedback on tone, flow and responses', title_es: 'Recopilar feedback sobre tono, flujo y respuestas' },
      { key: 'revisao_documentar_ajustes', title_pt: 'Documentar e priorizar ajustes solicitados', title_en: 'Document and prioritize requested changes', title_es: 'Documentar y priorizar ajustes solicitados' },
    ]
  },
  {
    stage: 5,
    key: 'ajustes',
    title_pt: 'Ajustes Finais',
    title_en: 'Final Adjustments',
    title_es: 'Ajustes Finales',
    description_pt: 'Aplicar feedback e re-testar',
    description_en: 'Apply feedback and re-test',
    description_es: 'Aplicar feedback y re-testear',
    tasks: [
      { key: 'ajustes_tom_voz', title_pt: 'Aplicar ajustes de tom de voz', title_en: 'Apply tone of voice adjustments', title_es: 'Aplicar ajustes de tono de voz' },
      { key: 'ajustes_respostas', title_pt: 'Corrigir/adicionar respostas identificadas na revisão', title_en: 'Fix/add responses identified in review', title_es: 'Corregir/agregar respuestas identificadas en revisión' },
      { key: 'ajustes_base_conhecimento', title_pt: 'Atualizar base de conhecimento', title_en: 'Update knowledge base', title_es: 'Actualizar base de conocimiento' },
      { key: 'ajustes_qualificacao', title_pt: 'Refinar regras de qualificação/escalonamento', title_en: 'Refine qualification/escalation rules', title_es: 'Refinar reglas de calificación/escalamiento' },
      { key: 'ajustes_mensagens', title_pt: 'Ajustar mensagens/templates', title_en: 'Adjust messages/templates', title_es: 'Ajustar mensajes/plantillas' },
      { key: 'ajustes_reteste', title_pt: 'Re-testar cenários que tiveram alterações', title_en: 'Re-test changed scenarios', title_es: 'Re-testear escenarios que tuvieron cambios' },
      { key: 'ajustes_teste_final', title_pt: 'Teste final ponta a ponta', title_en: 'Final end-to-end test', title_es: 'Prueba final de punta a punta' },
    ]
  },
  {
    stage: 6,
    key: 'golive',
    title_pt: 'Go-Live',
    title_en: 'Go-Live',
    title_es: 'Go-Live',
    description_pt: 'Ativação em produção + treinamento',
    description_en: 'Production activation + training',
    description_es: 'Activación en producción + entrenamiento',
    tasks: [
      { key: 'golive_ativar', title_pt: 'Ativar agente/campanhas em produção', title_en: 'Activate agent/campaigns in production', title_es: 'Activar agente/campañas en producción' },
      { key: 'golive_rampup', title_pt: 'Iniciar com volume conservador (ramp-up gradual)', title_en: 'Start with conservative volume (gradual ramp-up)', title_es: 'Iniciar con volumen conservador (ramp-up gradual)' },
      { key: 'golive_verificar_filas', title_pt: 'Verificar que os fluxos estão processando corretamente', title_en: 'Verify flows are processing correctly', title_es: 'Verificar que los flujos están procesando correctamente' },
      { key: 'golive_treinar_dashboard', title_pt: 'Treinar cliente no dashboard de métricas', title_en: 'Train client on metrics dashboard', title_es: 'Entrenar cliente en dashboard de métricas' },
      { key: 'golive_treinar_monitoramento', title_pt: 'Ensinar como monitorar conversas', title_en: 'Teach how to monitor conversations', title_es: 'Enseñar cómo monitorear conversaciones' },
      { key: 'golive_treinar_pausar', title_pt: 'Explicar como pausar/retomar operações', title_en: 'Explain how to pause/resume operations', title_es: 'Explicar cómo pausar/reanudar operaciones' },
      { key: 'golive_treinar_handoff', title_pt: 'Mostrar como funciona o handoff de leads/tickets', title_en: 'Show how lead/ticket handoff works', title_es: 'Mostrar cómo funciona el handoff de leads/tickets' },
      { key: 'golive_boas_praticas', title_pt: 'Orientar sobre boas práticas do canal', title_en: 'Guide on channel best practices', title_es: 'Orientar sobre buenas prácticas del canal' },
      { key: 'golive_documentacao', title_pt: 'Entregar documentação do agente (persona, regras, fluxos)', title_en: 'Deliver agent documentation (persona, rules, flows)', title_es: 'Entregar documentación del agente (persona, reglas, flujos)' },
      { key: 'golive_guia_rapido', title_pt: 'Entregar guia rápido de uso', title_en: 'Deliver quick start guide', title_es: 'Entregar guía rápida de uso' },
      { key: 'golive_suporte', title_pt: 'Definir ponto de contato para suporte', title_en: 'Define support point of contact', title_es: 'Definir punto de contacto para soporte' },
      { key: 'golive_checkin', title_pt: 'Agendar check-in de acompanhamento (1 semana)', title_en: 'Schedule follow-up check-in (1 week)', title_es: 'Agendar check-in de seguimiento (1 semana)' },
    ]
  }
];

// Flat list of all task keys for validation
const ALL_TASK_KEYS = ONBOARDING_STAGES.flatMap(stage =>
  stage.tasks.map(task => task.key)
);

const TOTAL_TASKS = ALL_TASK_KEYS.length;

module.exports = { ONBOARDING_STAGES, ALL_TASK_KEYS, TOTAL_TASKS };
