# Atualizar a base do jogo

## Exportar da página original

1. Abra a página original com os dados atualizados, no navegador.
2. Pressione F12 e abra a aba Console.
3. Copie todo o conteúdo de `scripts/export-source-console.js`, cole no console e pressione Enter.
4. A página baixará `source-update.json`. Substitua o arquivo de mesmo nome na pasta `data` deste projeto.
5. No terminal, dentro da pasta Football, execute:

```powershell
pnpm data:update
```

O comando valida o JSON, guarda os arquivos anteriores em `data/.backups`, atualiza as fontes, recompila a aparência e reconstrói a base. A aparência dos jogadores das carreiras locais ativas também é atualizada com backup. Reinicie o jogo/servidor após a atualização para carregar a base nova. Se usar a versão compilada para produção, execute também `pnpm build` antes de reabrir.

Não é preciso editar outros arquivos JSON nem copiar o conteúdo do console manualmente. O script funciona com a estrutura da página original fornecida; se a página mudar de formato, pode ser necessário adaptar o exportador. Quando uma seção obrigatória não é encontrada, a exportação é interrompida em vez de gerar dados vazios.

## Arquivo que você atualiza

**`data/source-update.json`** é o arquivo único de entrada, dividido em:

| Seção                   | Conteúdo                                                                                                                        | Quando atualizar                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `jogadores`             | Elencos, nomes, posições, idades, nacionalidades, notas, valores, contratos, números, transferências e ajustes da base original | Após mudanças de elenco, janelas de transferências e revisões de atributos |
| `clubes`                | Clubes, grupos de origem, abreviações, cores, uniformes e demais campos disponíveis na definição original                       | Quando houver mudanças de clubes ou uniformes                              |
| `aparencia`             | Paletas e registros de pele, cabelo, barba e calvície por ID; penteado quando disponível                                        | Quando a fonte revisar as aparências                                       |
| `excluidos`             | IDs que a página marca para exclusão                                                                                            | Sempre junto da base, para não reintroduzir jogadores excluídos            |
| `version`, `exportedAt` | Versão do formato de exportação e data de extração                                                                              | Preenchidos automaticamente                                                |

Os grupos dentro de `jogadores` são preservados: incluem os ajustes de mercado, contrato, numeração e atributos utilizados pelo importador. Evite mudar IDs: eles ligam os registros à aparência e aos jogadores existentes.

## Arquivos gerados automaticamente

- `data/player-source.json`: fonte de jogadores e ajustes.
- `data/clubs-source.json`: fonte dos clubes.
- `data/player-exclusions.json`: exclusões.
- `packages/shared/src/config/player-looks.json`: aparência usada nos retratos e no 3D.
- `data/player-database.json`: base pronta para o jogo.
- `data/player-import-report.json`: resumo da importação, avisos e elencos incompletos.

As novas informações de elencos, transferências e atributos são usadas nas novas carreiras. Carreiras em andamento preservam seus próprios elencos, contratos, resultados e finanças; apenas a aparência é sincronizada. A atualização não reinicia a temporada.

As regras de competições definidas no projeto e os acessos/rebaixamentos de uma carreira não são substituídos por regras da página externa. Não há importação periódica de calendário ou partidas reais: o jogo gera suas competições pelas regras configuradas.

Para apenas verificar o JSON, sem alterar os arquivos:

```powershell
pnpm --filter @football/server exec tsx src/providers/prepare-source-update.ts --check
```
