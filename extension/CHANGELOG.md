# GetRaze Extension - Changelog

## v1.3.0
- Internacionalizacao (i18n) com suporte a 3 idiomas: Portugues (pt-BR), Ingles (en), Espanhol (es)
- Usa chrome.i18n API nativa do Chrome para traducao automatica
- Correcao do texto do botao: "Adicionar na GetRaze" (antes "Adicionar ao GetRaze")
- Todas as strings da extensao agora sao traduzidas (popup, LinkedIn, Instagram)

## v1.2.0
- Botao do Instagram reposicionado para abaixo da foto de perfil
- Correcao do endpoint de adicao de contatos LinkedIn (profile_url + linkedin_profile_id)
- Correcao da CHECK constraint no banco ao criar contatos sem email/telefone

## v1.1.0
- Extracao de dados enriquecidos do Instagram (bio, seguidores, seguindo, posts, URL externa)
- Extracao de contatos (emails, telefones, websites) de bios do Instagram e LinkedIn
- Extracao do campo "Sobre" do LinkedIn
- Botao "Adicionar ao GetRaze" no LinkedIn corrigido (posicionamento inline com Connect/Message)
- Suporte a Instagram para adicionar perfis a agentes
- Versao exibida no popup da extensao
- Logs de debug para erros de adicao de contatos

## v1.0.0
- Lancamento inicial
- Botao "Adicionar ao GetRaze" em perfis do LinkedIn
- Dropdown com listagem de campanhas
- Adicao de contatos a campanhas LinkedIn via extensao
- Popup para configuracao de API Key
- Suporte a Instagram para adicionar perfis a agentes
