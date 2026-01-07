// backend/src/services/businessHoursService.js
// Service para verificar horario de funcionamento do agente

/**
 * Mapeamento de dias da semana (JavaScript retorna 0=Domingo, 1=Segunda, etc.)
 */
const DAY_MAP = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat'
};

/**
 * Verifica se o momento atual esta dentro do horario de funcionamento
 * @param {Object} workingHours - Configuracao de horario de funcionamento
 * @param {boolean} workingHours.enabled - Se o horario esta habilitado
 * @param {string} workingHours.timezone - Timezone (ex: 'America/Sao_Paulo')
 * @param {string} workingHours.startTime - Horario de inicio (ex: '09:00')
 * @param {string} workingHours.endTime - Horario de fim (ex: '18:00')
 * @param {array} workingHours.days - Dias de funcionamento ['mon', 'tue', 'wed', 'thu', 'fri']
 * @returns {boolean} - True se esta dentro do horario
 */
function isWithinBusinessHours(workingHours) {
  // Se nao esta configurado ou desabilitado, considera sempre disponivel
  if (!workingHours || !workingHours.enabled) {
    return true;
  }

  try {
    const timezone = workingHours.timezone || 'America/Sao_Paulo';
    const now = new Date();

    // Converter para o timezone configurado
    const options = { timeZone: timezone };
    const localTimeString = now.toLocaleTimeString('en-GB', { ...options, hour12: false });
    const localDateString = now.toLocaleDateString('en-US', { ...options, weekday: 'short' });

    // Extrair hora e minuto
    const [hours, minutes] = localTimeString.split(':').map(Number);
    const currentMinutes = hours * 60 + minutes;

    // Obter dia da semana
    const dayOfWeek = now.toLocaleDateString('en-US', { ...options, weekday: 'long' }).toLowerCase();
    const dayCode = Object.entries(DAY_MAP).find(([_, v]) => {
      const dayNames = {
        'sun': 'sunday', 'mon': 'monday', 'tue': 'tuesday', 'wed': 'wednesday',
        'thu': 'thursday', 'fri': 'friday', 'sat': 'saturday'
      };
      return dayNames[v] === dayOfWeek;
    })?.[1];

    // Verificar se o dia esta nos dias de funcionamento
    const workingDays = workingHours.days || ['mon', 'tue', 'wed', 'thu', 'fri'];
    if (!workingDays.includes(dayCode)) {
      console.log(`[BusinessHours] Fora do horario: ${dayOfWeek} nao esta nos dias de funcionamento`);
      return false;
    }

    // Verificar horario
    const startTime = workingHours.startTime || '09:00';
    const endTime = workingHours.endTime || '18:00';

    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    const isWithinTime = currentMinutes >= startMinutes && currentMinutes <= endMinutes;

    if (!isWithinTime) {
      console.log(`[BusinessHours] Fora do horario: ${localTimeString} nao esta entre ${startTime} e ${endTime}`);
    }

    return isWithinTime;

  } catch (error) {
    console.error('[BusinessHours] Erro ao verificar horario:', error.message);
    // Em caso de erro, considera disponivel para nao bloquear
    return true;
  }
}

/**
 * Retorna a resposta apropriada para fora do horario
 * @param {Object} workingHours - Configuracao de horario de funcionamento
 * @returns {Object} - { isOutOfHours, action, message }
 */
function getOutOfHoursResponse(workingHours) {
  const action = workingHours?.outsideBehavior || 'queue';
  const message = workingHours?.awayMessage ||
    'Obrigado pelo contato! Estamos fora do horario de atendimento no momento. Responderemos assim que possivel!';

  return {
    isOutOfHours: true,
    action,
    message
  };
}

/**
 * Formata o horario de funcionamento para exibicao
 * @param {Object} workingHours - Configuracao de horario
 * @returns {string} - Texto formatado (ex: "Seg-Sex 09:00-18:00")
 */
function formatBusinessHours(workingHours) {
  if (!workingHours || !workingHours.enabled) {
    return 'Disponivel 24/7';
  }

  const dayLabels = {
    'mon': 'Seg', 'tue': 'Ter', 'wed': 'Qua',
    'thu': 'Qui', 'fri': 'Sex', 'sat': 'Sab', 'sun': 'Dom'
  };

  const days = workingHours.days || ['mon', 'tue', 'wed', 'thu', 'fri'];
  const sortedDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].filter(d => days.includes(d));

  // Tentar agrupar dias consecutivos
  let daysText = '';
  if (sortedDays.length === 5 && sortedDays.every((d, i) => d === ['mon', 'tue', 'wed', 'thu', 'fri'][i])) {
    daysText = 'Seg-Sex';
  } else if (sortedDays.length === 7) {
    daysText = 'Todos os dias';
  } else {
    daysText = sortedDays.map(d => dayLabels[d]).join(', ');
  }

  const startTime = workingHours.startTime || '09:00';
  const endTime = workingHours.endTime || '18:00';

  return `${daysText} ${startTime}-${endTime}`;
}

/**
 * Calcula o proximo horario de funcionamento
 * @param {Object} workingHours - Configuracao de horario
 * @returns {Date|null} - Proximo horario de abertura ou null
 */
function getNextBusinessHoursStart(workingHours) {
  if (!workingHours || !workingHours.enabled) {
    return null;
  }

  try {
    const timezone = workingHours.timezone || 'America/Sao_Paulo';
    const now = new Date();
    const workingDays = workingHours.days || ['mon', 'tue', 'wed', 'thu', 'fri'];
    const [startHour, startMin] = (workingHours.startTime || '09:00').split(':').map(Number);

    // Verificar os proximos 7 dias
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(now);
      checkDate.setDate(checkDate.getDate() + i);

      const dayOfWeek = checkDate.getDay();
      const dayCode = DAY_MAP[dayOfWeek];

      if (workingDays.includes(dayCode)) {
        // Se e hoje, verificar se ja passou o horario de inicio
        if (i === 0) {
          const localTimeString = now.toLocaleTimeString('en-GB', { timeZone: timezone, hour12: false });
          const [currentHour, currentMin] = localTimeString.split(':').map(Number);

          if (currentHour < startHour || (currentHour === startHour && currentMin < startMin)) {
            // Ainda nao chegou o horario de inicio de hoje
            const nextStart = new Date(checkDate);
            nextStart.setHours(startHour, startMin, 0, 0);
            return nextStart;
          }
        } else {
          // E um dia futuro
          const nextStart = new Date(checkDate);
          nextStart.setHours(startHour, startMin, 0, 0);
          return nextStart;
        }
      }
    }

    return null;
  } catch (error) {
    console.error('[BusinessHours] Erro ao calcular proximo horario:', error.message);
    return null;
  }
}

module.exports = {
  isWithinBusinessHours,
  getOutOfHoursResponse,
  formatBusinessHours,
  getNextBusinessHoursStart
};
