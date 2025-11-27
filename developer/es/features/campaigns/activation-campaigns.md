# Campañas de Activación

Las Campañas de Activación envían mensajes de primer contacto vía Email, WhatsApp o LinkedIn usando Agentes de Activación configurados.

## Visión General

Usa Campañas de Activación para:
- Alcance masivo por email
- Mensajes WhatsApp personalizados
- Enfoque LinkedIn directo
- Seguimientos automáticos

## Creando una Campaña

1. Navega a **Campañas** → **Crear**
2. Selecciona **Activación**
3. Configura la campaña

### Configuraciones Básicas

| Campo | Obligatorio | Descripción |
|-------|-------------|-------------|
| Nombre | Sí | Nombre de la campaña |
| Lista de Leads | Sí | Audiencia objetivo |
| Canal | Sí | Email, WhatsApp o LinkedIn |
| Agente | Sí | Agente de Activación correspondiente |

### Configuraciones de Envío

| Campo | Descripción |
|-------|-------------|
| Límite Diario | Máximo de envíos por día |
| Horario de Envío | Cuándo enviar mensajes |
| Intervalo | Tiempo entre envíos |

## Canales de Activación

### Email
- Usa cuentas de email conectadas
- Seguimiento de apertura
- Personalización completa

### WhatsApp
- Vía WhatsApp Business conectado
- Mensajes instantáneos
- Alta tasa de lectura

### LinkedIn
- Mensajes directos
- Solicitudes de conexión
- Integración con conversaciones

## Flujo de la Campaña

```
Lead → Mensaje Inicial → Espera Respuesta → Seguimiento (opcional) → Calificación
```

## Métricas

| Métrica | Descripción |
|---------|-------------|
| Enviados | Total de mensajes enviados |
| Entregados | Mensajes entregados con éxito |
| Abiertos | Emails abiertos (solo email) |
| Respondidos | Respuestas recibidas |
| Calificados | Leads calificados |

## Gestionando Campañas

### Monitorear
- Sigue métricas en tiempo real
- Verifica entregas
- Analiza respuestas

### Ajustar
- Modifica límites
- Cambia horarios
- Actualiza mensajes (solo nuevos)

### Pausar/Reanudar
- Pausa para ajustes
- Reanuda cuando esté listo

## Mejores Prácticas

### Segmentación
- Separa leads por perfil
- Personaliza por segmento
- Prueba diferentes enfoques

### Mensajes
- Sé directo y claro
- Ofrece valor
- Incluye call-to-action

### Timing
- Respeta horario comercial
- Evita exceso de mensajes
- Espaciamiento adecuado

## Integración con Google Maps

Leads recolectados por Agentes Google Maps pueden ser automáticamente activados:

1. Configura Agente Google Maps
2. Habilita activación Email/WhatsApp
3. Leads nuevos reciben mensajes automáticamente

## Solución de Problemas

### Mensajes no se envían
1. Verifica canal conectado
2. Confirma límite no alcanzado
3. Verifica agente activo

### Baja entregabilidad (Email)
1. Verifica reputación del dominio
2. Revisa contenido de los mensajes
3. Calienta la cuenta gradualmente

### Cuenta bloqueada (WhatsApp)
1. Pausa campañas
2. Espera liberación
3. Reduce volumen
