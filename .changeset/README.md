# Changesets

O número de versão deste repositório é cortado aqui e em nenhum outro lugar. Versão
escrita à mão num `package.json` diverge da tag; tag sem entrada de changelog é uma
âncora que ninguém consegue ler seis meses depois.

```bash
npx changeset          # descreve a mudança e escolhe o bump
npx changeset version  # aplica o bump e escreve o CHANGELOG (o CI faz isso por você)
```

## Que bump escolher

| Mudança | Bump |
|---|---|
| Quebra quem consome — rota removida, formato de resposta alterado, env var nova obrigatória, migration destrutiva | **major** |
| Funcionalidade, tela, campo, endpoint novo | **minor** |
| Correção, texto, dependência, refactor sem efeito observável | **patch** |

## Quando o número sobe

Não sobe no merge para `staging`. Sobe quando `main` recebe o merge: o workflow
`.github/workflows/release.yml` abre um PR **"Version Packages"** com o bump acumulado
dos changesets pendentes e, quando esse PR entra, a tag `vX.Y.Z` é criada.

Push em `main` sem changeset pendente não faz nada — o workflow existir não significa
que todo merge vira release.
