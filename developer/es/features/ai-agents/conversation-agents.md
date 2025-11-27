# Agentes de Conversación

Los Agentes de Conversación (también llamados Agentes LinkedIn) gestionan conversaciones en LinkedIn automáticamente, respondiendo mensajes usando perfiles de comportamiento configurados.

## Creando un Agente LinkedIn

Navega a **Agentes IA** → **Crear Agente** → selecciona **LinkedIn**.

El asistente tiene 6 pasos:

### Paso 1: Identidad

| Campo | Obligatorio | Descripción |
|-------|-------------|-------------|
| Avatar | No | Generado automáticamente, clic en actualizar para cambiar |
| Nombre | Sí | Nombre del agente (ej: "Agente de Ventas LinkedIn") |
| Descripción | No | Descripción del propósito del agente |
| Tipo de Agente | Sí | Selecciona "LinkedIn" |

### Paso 2: Productos y Servicios

| Campo | Obligatorio | Validación |
|-------|-------------|------------|
| Productos/Servicios | Sí | Mínimo 10 caracteres |

Describe lo que tu empresa ofrece. Esta información ayuda al agente a responder con precisión.

### Paso 3: Información del Negocio

Todos los campos son opcionales pero mejoran las respuestas del agente.

| Campo | Descripción |
|-------|-------------|
| Descripción de la Empresa | Visión general de la empresa |
| Propuesta de Valor | Tu propuesta de valor |
| Diferenciadores | Diferenciadores separados por coma |

### Paso 4: Perfil de Comportamiento

Selecciona un perfil que define cómo el agente se comunica:

| Perfil | Clave | Descripción |
|--------|-------|-------------|
| Consultivo | `consultivo` | Hace preguntas, entiende problemas antes de ofrecer soluciones |
| Directo | `directo` | Directo al punto, presentación rápida de valor |
| Educativo | `educativo` | Comparte insights y agrega valor antes de vender |
| Amigable | `amigavel` | Casual, enfoque en conexión personal |

### Paso 5: Reglas de Escalamiento

Configura cuándo el agente debe transferir a un humano.

| Campo | Tipo | Predeterminado |
|-------|------|----------------|
| Transferir en preguntas sobre precio | Checkbox | false |
| Transferir en preguntas técnicas específicas | Checkbox | false |
| Definir máximo de mensajes | Checkbox | false |
| Máximo de mensajes (si habilitado) | Número | 10 (rango: 1-50) |

### Paso 6: Configuración Final

| Campo | Obligatorio | Descripción |
|-------|-------------|-------------|
| Enfoque Inicial | Sí | Template del primer mensaje (textarea 4 líneas) |
| Tamaño de Respuestas | No | short, medium (predeterminado), long |
| Programar reuniones automáticamente | No | Checkbox de auto-programación |
| Enlace de Programación | Condicional | Obligatorio si auto-programación habilitado |

## Variables de Mensaje

Usa estas variables en el enfoque inicial:

| Variable | Descripción |
|----------|-------------|
| `{{nome}}` | Nombre del lead |
| `{{empresa}}` | Empresa |
| `{{cargo}}` | Cargo |
| `{{localizacao}}` | Ubicación |
| `{{industria}}` | Industria |
| `{{conexoes}}` | Número de conexiones |
| `{{resumo}}` | Resumen del perfil |

**Ejemplo:**
```
Hola {{nome}}, vi que eres {{cargo}} en {{empresa}}.

Trabajo con empresas del sector de {{industria}} ayudando
a automatizar la generación de leads. ¿Podemos conversar?
```

## Base de Conocimiento

Agrega elementos de conocimiento para mejorar las respuestas:

1. Abre la configuración del agente
2. Clic en **Base de Conocimiento**
3. Agrega elementos con pares de pregunta/respuesta

## Probando

1. Clic en **Probar** en la tarjeta del agente
2. Elige el tipo de prueba:
   - Probar Mensaje Inicial
   - Probar Respuesta
3. Revisa la salida y ajusta

## Opciones de Tamaño de Respuesta

| Valor | Etiqueta | Descripción |
|-------|----------|-------------|
| `short` | Cortas | 1-2 líneas |
| `medium` | Medias | 2-4 líneas |
| `long` | Largas | 4-6 líneas |
