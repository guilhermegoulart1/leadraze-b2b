# Importando Leads

Importa leads de archivos CSV para agregar múltiples contactos a la vez.

## Proceso de Importación

### Paso 1: Subir Archivo

1. Navega a **Leads** → **Importar**
2. Clic en **Seleccionar Archivo** o arrastra el CSV
3. Espera a que el upload complete

### Paso 2: Mapeo de Columnas

Mapea las columnas de tu CSV a los campos de GetRaze:

| Campo GetRaze | Descripción |
|---------------|-------------|
| Nombre | Nombre completo |
| Primer Nombre | Primer nombre |
| Apellido | Apellido |
| Email | Dirección de email |
| Teléfono | Número de teléfono |
| Empresa | Nombre de la empresa |
| Cargo | Cargo/Título |
| LinkedIn | URL del perfil LinkedIn |
| Website | Sitio de la empresa |

### Paso 3: Revisión

1. Visualiza los datos mapeados
2. Verifica si está correcto
3. Identifica posibles errores

### Paso 4: Confirmación

1. Revisa el resumen
2. Clic en **Importar**
3. Espera el procesamiento

## Formato del CSV

### Requisitos
- Formato UTF-8
- Primera línea con encabezados
- Campos separados por coma

### Ejemplo
```csv
nombre,email,telefono,empresa,cargo
Juan García,juan@empresa.com,11999999999,Empresa X,Director
María López,maria@empresa.com,11888888888,Empresa Y,Gerente
```

## Manejo de Duplicados

El sistema detecta duplicados por:
- Email (principal)
- Teléfono
- LinkedIn URL

Opciones al encontrar duplicados:
- Omitir duplicados
- Actualizar existentes
- Crear nuevos de todas formas

## Límites

| Límite | Valor |
|--------|-------|
| Tamaño máximo del archivo | 10 MB |
| Leads por importación | 10,000 |
| Importaciones simultáneas | 1 |

## Solución de Problemas

### Archivo no aceptado
- Verifica formato CSV
- Confirma encoding UTF-8
- Verifica tamaño del archivo

### Mapeo incorrecto
- Revisa encabezados del CSV
- Ajusta manualmente el mapeo
- Usa nombres de columna estándar

### Importación lenta
- Archivos grandes demoran más
- Espera el procesamiento
- No cierres la página
