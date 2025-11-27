# Agentes Website

Los Agentes Website alimentan el widget de chat en el sitio web de tu empresa. Gestionan consultas de visitantes, califican leads y brindan soporte 24/7.

## Visión General

Los Agentes Website proporcionan:
- Soporte de chat en tiempo real en tu sitio
- Respuestas con IA usando tu base de conocimiento
- Captura y calificación de leads
- Escalamiento a agentes humanos cuando es necesario

## Agentes Preconfigurados

GetRaze incluye dos agentes de website preconfigurados:

### Agente de Ventas
- **Propósito**: Gestionar consultas de ventas de visitantes
- **Clave**: `sales`
- **Mensaje Predeterminado**: "¡Hola! Estoy aquí para ayudarte a conocer nuestros productos y servicios."

### Agente de Soporte
- **Propósito**: Proporcionar soporte técnico y responder preguntas
- **Clave**: `support`
- **Mensaje Predeterminado**: "¡Hola! Estoy aquí para ayudar con cualquier duda técnica."

## Configuración del Agente

### Configuraciones Básicas

| Campo | Descripción |
|-------|-------------|
| Nombre | Nombre mostrado en el widget de chat |
| Avatar URL | Foto de perfil del agente |
| Mensaje de Bienvenida | Primer mensaje cuando el chat abre |
| Personalidad | Cómo el agente debe comportarse |
| System Prompt | Instrucciones de IA (avanzado) |

### Configuraciones de Comunicación

| Campo | Opciones | Descripción |
|-------|----------|-------------|
| Tono | Professional, Friendly, Casual, Formal | Estilo de comunicación |
| Tamaño de Respuesta | Short, Medium, Long | Qué tan detalladas deben ser las respuestas |
| Idioma | en, pt-br, es | Idioma principal |

## Base de Conocimiento

La base de conocimiento entrena a tu agente para responder preguntas con precisión.

### Tipos de Conocimiento

| Tipo | Descripción | Uso |
|------|-------------|-----|
| FAQ | Preguntas y respuestas comunes | Dudas frecuentes |
| Product | Detalles y especificaciones | Información de productos |
| Feature | Funcionalidades | Recursos del sistema |
| Pricing | Planes y opciones de precio | Información comercial |
| Policy | Políticas de la empresa | Términos y condiciones |

### Agregando Elementos de Conocimiento

1. Navega a **Agentes Website** → **Base de Conocimiento**
2. Clic en **Agregar Conocimiento**
3. Completa los campos:

| Campo | Obligatorio | Descripción |
|-------|-------------|-------------|
| Tipo | Sí | Categoría del conocimiento |
| Pregunta | Para FAQ | La pregunta siendo respondida |
| Respuesta | Para FAQ | La respuesta a proporcionar |
| Contenido | Para otros | Contenido general |
| Categoría | No | Clasificación del tema |
| Agente | No | Compartido o específico (Sales/Support) |

## Sesiones de Chat

### Viendo Conversaciones

Navega a **Agentes Website** → **Conversaciones** para ver:
- Sesiones de chat activas y pasadas
- Historial de mensajes
- Estado de escalamiento

### Filtros de Conversaciones

| Filtro | Opciones |
|--------|----------|
| Agente | Todos, Sales, Support |
| Estado | Todos, Escalados, No Escalados |

### Escalamiento

Cuando la IA no puede responder:
1. La sesión se marca como "Escalada"
2. Notificación enviada al equipo
3. Agente humano puede asumir
4. Formulario de contacto puede mostrarse

## Estadísticas

Sigue el desempeño de tus agentes:

| Métrica | Descripción |
|---------|-------------|
| Total de Conversaciones | Número de sesiones de chat |
| Total de Mensajes | Mensajes intercambiados |
| Escaladas | Conversaciones escaladas a humanos |
| Promedio de Mensajes | Mensajes promedio por conversación |

### Estadísticas por Agente

Visualiza métricas separadas para cada agente (Sales/Support):
- Conversaciones
- Mensajes
- Escalamientos
- Longitud promedio

## Gestionando Agentes

### Editar Configuraciones
1. Ve a **Agentes Website**
2. Clic en la tarjeta del agente
3. Modifica las configuraciones
4. Guarda los cambios

### Alternar Estado del Agente
1. Encuentra el agente en la lista
2. Alterna el switch de activo
3. Agentes inactivos no responderán a los chats

## Mejores Prácticas

### Para Agente de Ventas
- Enfócate en la propuesta de valor
- Haz preguntas de calificación
- Ofrece demos/reuniones
- Captura información de contacto

### Para Agente de Soporte
- Proporciona soluciones paso a paso
- Enlaza a documentación
- Escala problemas complejos
- Da seguimiento a la resolución

### Consejos Generales
- Mantén respuestas concisas
- Usa lenguaje claro
- Proporciona próximos pasos
- Siempre ofrece opción humana
