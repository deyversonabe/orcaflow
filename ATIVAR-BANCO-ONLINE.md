# Ativar o banco online

O endereço Supabase encontrado no projeto antigo não está mais ativo. Para concluir a ativação:

1. Entre em https://supabase.com/dashboard.
2. Crie um projeto chamado `orcaflow`.
3. Abra **SQL Editor → New query**.
4. Cole e execute todo o conteúdo de `supabase/schema.sql`.
5. Abra **Project Settings → API**.
6. Copie:
   - **Project URL**
   - Chave pública **Publishable key** ou **anon key**
7. Substitua em `.env.local`:

```env
VITE_SUPABASE_URL=Project URL
VITE_SUPABASE_ANON_KEY=chave pública
```

8. Na Vercel, cadastre as mesmas variáveis.
9. Faça um novo deploy.
10. Na tela do OrçaFlow, clique em **Criar conta** e cadastre seu e-mail.

No primeiro acesso, os dados existentes no navegador serão enviados automaticamente para essa conta. Depois, os mesmos dados aparecerão ao entrar com a conta em qualquer dispositivo.

## Importante

- Use somente a chave pública `anon`/`publishable` no frontend.
- Nunca coloque a `service_role` em variáveis `VITE_`.
- Faça um backup JSON antes do primeiro login.
