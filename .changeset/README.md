# Changesets

O número de versão deste repositório é cortado aqui e em nenhum outro lugar. Versão
escrita à mão num `package.json` diverge da tag; tag sem entrada de changelog é uma
âncora que ninguém consegue ler seis meses depois.

```bash
npx changeset          # descreve a mudança e escolhe o bump
npm run version        # aplica o bump, escreve o CHANGELOG e propaga o número
```

## Que bump escolher

| Mudança | Bump |
|---|---|
| Quebra quem consome — rota removida, formato de resposta alterado, env var nova obrigatória, migration destrutiva | **major** |
| Funcionalidade, tela, campo, endpoint novo | **minor** |
| Correção, texto, dependência, refactor sem efeito observável | **patch** |

## Quando o número sobe

No mesmo PR que muda o contrato, à mão. Desde 26/11/2026 não há workflow de release
(SCRUM-697: o GitHub é só repositório; o Verify do `aranis-api-pipeline`, na AWS,
confere o contrato a cada push na `main`).

1. `npx changeset` descreve a mudança e escolhe o bump.
2. `npm run version` aplica o bump acumulado, escreve o `CHANGELOG.md` e roda
   `scripts/sync-version.mjs`, que leva o número para os quatro lugares que o
   declaram: `package.json`, `openapi.yaml` (`info.version`, o que quem integra lê),
   `sdk/typescript/package.json` e `VERSION`.
3. Commit dos arquivos alterados no mesmo PR.

Tag `vX.Y.Z` deixou de ser automática. Se precisar de uma, crie depois do merge:
`git tag vX.Y.Z <commit do merge> && git push origin vX.Y.Z`.

PR que não muda o contrato não precisa de changeset nem de bump.
