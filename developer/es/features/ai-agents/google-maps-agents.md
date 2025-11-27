# Agentes Google Maps

Los Agentes Google Maps recolectan leads de empresas de Google Maps automáticamente. Ejecutan diariamente, encontrando nuevos prospectos según tus criterios y agregándolos a tu CRM.

## Visión General

Usa Agentes Google Maps para:
- Encontrar negocios locales en áreas específicas
- Recolectar información de contacto automáticamente
- Filtrar leads por métricas de calidad
- Disparar activación por Email o WhatsApp

## Cómo Funciona

```
Configurar Búsqueda → Ejecución Diaria → Recolección de Leads → Inserción en CRM → Activación
```

1. **Configurar**: Define ubicación, tipo de negocio y filtros
2. **Ejecutar**: El agente corre diariamente en el horario definido
3. **Recolectar**: Obtiene datos (nombre, teléfono, email, reseñas)
4. **Insertar**: Agrega leads calificados a tu CRM
5. **Activar**: Opcionalmente dispara campañas Email/WhatsApp

## Creando un Agente Google Maps

Navega a **Google Maps** → **Crear Campaña**.

### Paso 1: Nombre de la Configuración

| Campo | Obligatorio | Descripción |
|-------|-------------|-------------|
| Nombre | Sí | Nombre descriptivo (ej: "Gimnasios en Madrid") |

### Paso 2: Selección de Ubicación

Define dónde buscar empresas.

**Formas de definir ubicación:**
- **Buscar**: Escribe una ciudad o dirección
- **Enlace de Google Maps**: Pega un enlace de Google Maps
- **Clic en el Mapa**: Clic directamente en el mapa interactivo
- **Ajustar Radio**: Arrastra el círculo para cambiar el área de búsqueda

| Campo | Descripción |
|-------|-------------|
| Ubicación | Ciudad, dirección o enlace de Google Maps |
| Coordenadas | Rellenadas automáticamente de la búsqueda |
| Radio | Radio de búsqueda en kilómetros |

### Paso 3: Nicho del Negocio

Define qué tipos de empresas encontrar.

| Campo | Obligatorio | Descripción |
|-------|-------------|-------------|
| Categoría | Uno obligatorio | Categoría predefinida de negocio |
| Especificación | Uno obligatorio | Descripción personalizada del tipo de negocio |

::: info
Debes llenar al menos uno: Categoría O Especificación
:::

**Ejemplo de Especificación:**
```
nutricionistas, entrenadores personales, gimnasios crossfit
```

### Paso 4: Filtros de Calificación

Filtra resultados para obtener leads de mayor calidad.

| Filtro | Opciones | Descripción |
|--------|----------|-------------|
| Calificación Mínima | 3.0 - 4.5 estrellas | Solo empresas con esta calificación o superior |
| Mínimo de Reseñas | 10, 20, 50, 100+ | Solo empresas con reseñas suficientes |
| Requerir Teléfono | Sí/No | Debe tener teléfono listado |
| Requerir Email | Sí/No | Debe tener email listado |

::: warning
Filtros más estrictos = menos leads pero de mayor calidad. Equilibra según tu mercado.
:::

### Paso 5: Activación de Leads

Configura qué pasa con los leads recolectados.

**Integración CRM (Siempre Activa)**
- Todos los leads se agregan automáticamente a tu CRM
- Detección de duplicados previene re-agregar contactos existentes

**Activación por Email (Opcional)**

| Campo | Descripción |
|-------|-------------|
| Activar por Email | Toggle para activar |
| Agente de Email | Selecciona un Agente de Activación (tipo Email) |

**Activación por WhatsApp (Opcional)**

| Campo | Descripción |
|-------|-------------|
| Activar por WhatsApp | Toggle para activar |
| Agente de WhatsApp | Selecciona un Agente de Activación (tipo WhatsApp) |

## Datos Recolectados de los Leads

Cada lead incluye:

| Campo | Descripción |
|-------|-------------|
| Nombre de la Empresa | Nombre del negocio |
| Teléfono | Número de teléfono (si disponible) |
| Email | Dirección de email (si disponible) |
| Dirección | Dirección completa |
| Website | Sitio de la empresa |
| Calificación | Calificación de Google (1-5 estrellas) |
| Número de Reseñas | Cantidad de reseñas |
| Categoría | Categoría del negocio |
| Enlace Google Maps | Enlace directo al listing |

## Estado del Agente

| Estado | Descripción |
|--------|-------------|
| Activo | Ejecutando diariamente según programación |
| Pausado | Temporalmente detenido |
| Completado | Terminó todos los resultados disponibles |
| Falló | Ocurrió un error, necesita atención |

## Gestionando Agentes

### Ver Estadísticas
Clic en la tarjeta del agente para ver:
- Total de leads encontrados
- Leads insertados en CRM
- Leads omitidos (duplicados)
- Activaciones Email/WhatsApp pendientes

### Pausar Agente
1. Clic en el botón pausar
2. El agente detiene la ejecución diaria
3. Puede reanudarse en cualquier momento

### Eliminar Agente
1. Clic en el botón eliminar
2. Confirma la eliminación
3. Los leads recolectados permanecen en el CRM

## Mejores Prácticas

### Selección de Ubicación
- Comienza con áreas específicas
- Usa radio razonable (5-20 km)
- Evita agentes superpuestos

### Filtros de Calidad
- Requiere teléfono para llamadas en frío
- Requiere email para campañas de email
- Calificaciones más altas = mejores empresas

### Estrategia de Activación
- No actives todos los canales a la vez
- Prueba un canal primero
- Personaliza los mensajes de activación
