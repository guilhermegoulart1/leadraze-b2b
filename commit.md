##### COMANDOS #####
# git add .
# git commit -m "Release v8.6.1"
# git push origin main
# git tag -a "v8.6.1" -F release-notes.md
# git push origin --tags
# git push origin "v8.6.1"
# gh release create v8.6.1 --title "Versão Release v8.6.1" --notes-file release-notes.md

## LIMPAR REDIS

## node redislimpeza.js 2

<!-- 1. 👁️ Prévia (recomendado primeiro):
node redis-reset.js 1
Mostra o que seria deletado SEM fazer alterações
2. 🧹 Limpeza seletiva:
node redis-reset.js 2
Remove apenas mensagens/filas, mantém configurações
3. 🚨 Reset completo:
node redis-reset.js 3
APAGA TUDO (aguarda 5 segundos para cancelar) -->


# 1.0.0: Primeira versão estável do projeto

# 1.1.0: Adiciona um novo recurso (ex: integração com Chatwoot)

# 1.1.1: Corrige um bug

# 2.0.0: Refatoração geral que muda comportamento de funções, APIs, etc

# 3.0.0: Redis, Integração com Chatwoot, Transferências via functions, design login


###################################

# Comando pra dar o pg_restore

#na pasta c:/dump

#"C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" -d "postgresql:LINKDOPOSTGRES" --clean --if-exists --verbose postgres.dump