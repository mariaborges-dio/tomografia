# DIO - MVP Tomografia CBCT

Protótipo navegável estático para demonstração do fluxo de Tomografia CBCT.

## Executar localmente

Como o protótipo usa módulos locais, abra a pasta com um servidor HTTP simples em vez de abrir o HTML diretamente pelo `file://`.

Exemplo:

```bash
python3 -m http.server 8000
```

Depois acesse `http://localhost:8000`.

## Deploy no Vercel

O projeto é estático. Importe o repositório no Vercel e mantenha as configurações padrão, sem build command.

## Estrutura

- `index.html` - aplicação principal
- `support.js` - runtime de suporte do protótipo
- `dio-3d.js` - visualização 3D
- `assets/clean` - panorâmica, arco, MPR e cortes preparados
- `assets/mpr` - imagens auxiliares do MPR/planejamento
- `assets/alinhamento` - imagens usadas nos estados de orientação
- `assets/3d` - assets auxiliares da visualização 3D

> Conteúdo clínico e achados exibidos no MVP são demonstrativos.
