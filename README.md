# Tomografia DIO - MVP

Pacote limpo para deploy estatico no Vercel.

## Estrutura
- `index.html`: prototipo navegavel principal.
- `support.js`: runtime necessario para o prototipo.
- `assets/`: imagens clinicas usadas pelo MVP.
- `vercel.json`: configuracao simples para deploy estatico.

## Observacoes
- Nao ha etapa de build.
- O prototipo carrega React/Babel via unpkg e a fonte IBM Plex Sans via Google Fonts no navegador.
- Para ajustes rapidos do MVP, edite `index.html` e mantenha os caminhos relativos de `assets/`.
- Para handoff de desenvolvimento, recomenda-se migrar esta prova de conceito para a stack real do produto em vez de evoluir indefinidamente o HTML gerado.
