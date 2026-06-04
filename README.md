# OrçaFlow Studio AI

Plataforma de geração de orçamentos comerciais com IA.

## Como rodar localmente

### Pré-requisito
- Node.js 18+ instalado → https://nodejs.org

### Passos

```bash
# 1. Entrar na pasta
cd orcaflow-app

# 2. Instalar dependências
npm install

# 3. Rodar em desenvolvimento
npm run dev
```

Acesse: http://localhost:5173

### Build para produção

```bash
npm run build
npm run preview
```

## Deploy gratuito (recomendado)

### Vercel (mais fácil)
1. Crie conta em vercel.com
2. Arraste a pasta `orcaflow-app` para o dashboard
3. Clique Deploy → pronto, link público gerado

### Netlify
1. Crie conta em netlify.com
2. Arraste a pasta `dist/` (após `npm run build`) para o dashboard
3. Link público gerado automaticamente

### GitHub Pages
```bash
npm install --save-dev gh-pages
npm run build
npx gh-pages -d dist
```

## Chave de API

A plataforma usa a API da Anthropic para gerar os orçamentos.
O model utilizado é `claude-sonnet-4-20250514`.

Para uso em produção, configure a chave de API no backend.
Em desenvolvimento, a requisição é feita diretamente do browser.

## Estrutura

```
orcaflow-app/
├── src/
│   ├── main.jsx      # Entry point React
│   └── App.jsx       # Aplicação completa
├── index.html        # HTML base
├── vite.config.js    # Configuração Vite
└── package.json      # Dependências
```

## Banco de dados

Os dados das empresas são salvos no **localStorage** do navegador.
Use a função **Exportar Backup** para salvar um JSON com todas as empresas.
Use **Importar Backup** para restaurar em outro dispositivo.

---
Desenvolvido com OrçaFlow Studio AI
