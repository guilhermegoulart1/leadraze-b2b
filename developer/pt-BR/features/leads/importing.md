# Importando Leads

Importe leads de arquivos CSV para adicionar múltiplos contatos de uma vez.

## Processo de Importação

### Etapa 1: Upload do Arquivo

1. Navegue até **Leads** → **Importar**
2. Clique em **Selecionar Arquivo** ou arraste o CSV
3. Aguarde o upload completar

### Etapa 2: Mapeamento de Colunas

Mapeie as colunas do seu CSV para os campos do GetRaze:

| Campo GetRaze | Descrição |
|---------------|-----------|
| Nome | Nome completo |
| Primeiro Nome | Primeiro nome |
| Sobrenome | Sobrenome |
| Email | Endereço de email |
| Telefone | Número de telefone |
| Empresa | Nome da empresa |
| Cargo | Cargo/Título |
| LinkedIn | URL do perfil LinkedIn |
| Website | Site da empresa |

### Etapa 3: Revisão

1. Visualize os dados mapeados
2. Verifique se está correto
3. Identifique possíveis erros

### Etapa 4: Confirmação

1. Revise o resumo
2. Clique em **Importar**
3. Aguarde o processamento

## Formato do CSV

### Requisitos
- Formato UTF-8
- Primeira linha com cabeçalhos
- Campos separados por vírgula

### Exemplo
```csv
nome,email,telefone,empresa,cargo
João Silva,joao@empresa.com,11999999999,Empresa X,Diretor
Maria Santos,maria@empresa.com,11888888888,Empresa Y,Gerente
```

## Tratamento de Duplicatas

O sistema detecta duplicatas por:
- Email (principal)
- Telefone
- LinkedIn URL

Opções ao encontrar duplicatas:
- Pular duplicatas
- Atualizar existentes
- Criar novos mesmo assim

## Limites

| Limite | Valor |
|--------|-------|
| Tamanho máximo do arquivo | 10 MB |
| Leads por importação | 10.000 |
| Importações simultâneas | 1 |

## Solução de Problemas

### Arquivo não aceito
- Verifique formato CSV
- Confirme encoding UTF-8
- Verifique tamanho do arquivo

### Mapeamento incorreto
- Revise cabeçalhos do CSV
- Ajuste manualmente o mapeamento
- Use nomes de coluna padrão

### Importação lenta
- Arquivos grandes demoram mais
- Aguarde o processamento
- Não feche a página
