# Marginália

Estante pessoal de livros: notas de meia em meia estrela, resenhas, fila de "quero ler", leitor de EPUB e PDF, páginas por minuto e metas do ano.

## Como usar

Clone o repositório e abra o `index.html` no navegador. Não precisa instalar nada, mas o leitor de EPUB e PDF precisa de internet para carregar as bibliotecas na primeira vez. Instalar o app e abrir sem internet só funciona pelo site ou por um servidor local, não abrindo o arquivo direto.

```bash
git clone https://github.com/vksantos77/marginalia.git
```

Se o navegador reclamar de abrir o arquivo direto, sirva a pasta:

```bash
python -m http.server 8000
```

Depois acesse http://localhost:8000.

## Instalar no celular ou no PC

Abra https://vksantos77.github.io/marginalia/ e instale:

- **Android ou PC (Chrome/Edge):** menu do navegador > **Instalar app**.
- **iPhone (Safari):** botão de compartilhar > **Adicionar à Tela de Início**.

Instalado, o app abre sem internet, inclusive o leitor. Só a busca de livros precisa de conexão. Cada publicação na `main` chega sozinha na próxima vez que o app abrir com internet.

No iPhone, o app instalado não enxerga os dados do Safari. Use **Baixar cópia** no Safari e **Importar cópia** no app, e adicione de novo os arquivos dos livros.

## Onde ficam os dados

Fora do claude.ai, a estante e os arquivos dos livros ficam só no navegador daquele computador. Nada sincroniza entre aparelhos e o mural de amigos não funciona.

Para levar a estante para outro computador, use **Números > Baixar cópia** em um e **Importar cópia** no outro.

## Busca de dados dos livros

Vem desligada. Ative a Open Library, que é gratuita, em **Ajustes**.
