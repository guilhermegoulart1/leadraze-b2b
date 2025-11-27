# Agentes de Activación

Los Agentes de Activación están diseñados para campañas de alcance por Email, WhatsApp y LinkedIn. Envían mensajes personalizados a tus listas de contactos y gestionan el engagement inicial.

## Visión General

Usa Agentes de Activación para:
- Lanzar campañas de alcance multicanal
- Enviar mensajes personalizados a escala
- Hacer seguimiento con leads automáticamente
- Mantener tono de comunicación consistente

## Canales Soportados

| Canal | Descripción | Mejor Para |
|-------|-------------|------------|
| **Email** | Alcance profesional por email | Comunicación B2B, alcance formal |
| **WhatsApp** | Mensajes directos | Respuestas rápidas, mercados informales |
| **LinkedIn** | Networking profesional | Ventas B2B, servicios profesionales |

## Creando un Agente de Activación

Navega a **Agentes de Activación** → **Crear Agente** para iniciar el asistente.

### Paso 1: Identidad del Agente

| Campo | Obligatorio | Descripción |
|-------|-------------|-------------|
| Nombre | Sí | Nombre del agente (ej: "Ana García - Ventas") |
| Descripción | No | Qué hace este agente |
| Avatar | Auto | Generado automáticamente, puede actualizarse |

### Paso 2: Tipo de Activación

Elige el canal de comunicación.

| Tipo | Descripción |
|------|-------------|
| Email | Enviar emails a través de cuentas conectadas |
| WhatsApp | Enviar mensajes por WhatsApp Business |
| LinkedIn | Enviar mensajes en LinkedIn |

::: warning
Solo puedes seleccionar un canal por agente. Crea múltiples agentes para campañas multicanal.
:::

### Paso 3: Personalidad y Tono

Configura cómo tu agente se comunica.

| Campo | Opciones | Descripción |
|-------|----------|-------------|
| Tono | Formal, Casual, Profesional, Amigable | Estilo de comunicación |
| Idioma | Portugués (BR), English (US), Español | Idioma de los mensajes |
| Personalidad | Texto libre | Descripción de la personalidad |

**Ejemplos de Tono:**

| Tono | Ejemplo de Apertura |
|------|---------------------|
| Formal | "Estimado Sr. García, espero que este mensaje lo encuentre bien." |
| Casual | "¡Hola Juan! Una pregunta rápida para ti." |
| Profesional | "Hola Juan, noté que tu empresa está creciendo rápidamente." |
| Amigable | "¡Hola Juan! ¡Espero que estés teniendo una gran semana!" |

### Paso 4: Mensajes

Define los mensajes que tu agente enviará.

| Campo | Obligatorio | Descripción |
|-------|-------------|-------------|
| Mensaje Inicial | Sí | Primer mensaje de alcance |
| Mensaje de Seguimiento | No | Mensaje enviado si no hay respuesta |
| Instrucciones Personalizadas | No | Instrucciones especiales para el agente |

**Ejemplo de Mensaje Inicial:**
```
Hola {{nome}}, ¿cómo estás?

Mi nombre es {{agente}} y trabajo en {{empresa}}.

Ayudamos a empresas como la tuya a aumentar leads calificados
en 3x a través de automatización con IA.

¿Podemos conversar sobre esto?
```

**Variables disponibles:** `{{nome}}`, `{{empresa}}`, `{{cargo}}`, `{{agente}}`

### Paso 5: Revisión

Revisa todas las configuraciones antes de crear:
- Identidad del agente (nombre, avatar)
- Canal seleccionado
- Estilo de comunicación
- Templates de mensajes

## Estadísticas del Agente

Sigue el desempeño en la tarjeta del agente:

| Métrica | Descripción |
|---------|-------------|
| Campañas | Número de campañas usando este agente |
| Activas | Campañas en ejecución |

## Gestionando Agentes

### Editar Agente
1. Clic en el ícono de edición en la tarjeta
2. Modifica las configuraciones
3. Guarda los cambios

### Desactivar Agente
1. Alterna el switch de activo a off
2. Agente no estará disponible para nuevas campañas

### Eliminar Agente
1. Clic en el ícono de eliminar
2. Confirma la eliminación

::: warning
No puedes eliminar agentes asignados a campañas activas. Pausa o completa las campañas primero.
:::

## Mejores Prácticas

### Escritura de Mensajes
- Mantén mensajes iniciales cortos (menos de 150 palabras)
- Enfócate en valor, no en funcionalidades
- Haz una pregunta clara
- Personaliza con variables

### Selección de Tono
- Combina con la voz de tu marca
- Considera tu audiencia
- Prueba diferentes tonos

### Estrategia de Seguimiento
- Espera 3-5 días antes del seguimiento
- Referencia el mensaje anterior
- Agrega nuevo valor o ángulo
- Limita a 2-3 seguimientos
