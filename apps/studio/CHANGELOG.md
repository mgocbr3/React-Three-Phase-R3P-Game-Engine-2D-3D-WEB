# Changelog - PixlPlayground

## [27/01/2026 - 12:16] - Correção Crítica: Coluna game_data não existe no Pixlland

### 🐛 Problema Crítico
**Erro:** Ao tentar atualizar/salvar projetos, o sistema retornava erro:
```
PGRST204: Could not find the 'game_data' column of 'projects' in the schema cache
```

**Causa:** O banco de dados do Pixlland remoto não tem uma coluna chamada `game_data`. O schema pode usar nomes diferentes como `data`, `payload`, ou `content`.

### ✅ Solução Implementada
Modificado `updateProject()` para detectar dinamicamente qual coluna usar para salvar dados do jogo:

**Arquivo:** `src/services/projectService.ts`
```typescript
const gameDataCol = firstExistingColumn(cols, ['game_data', 'data', 'payload', 'content']);
if (input.game_data !== undefined && gameDataCol) updateData[gameDataCol] = input.game_data;
```

Agora o sistema tenta encontrar a coluna na seguinte ordem:
1. `game_data` (schema local)
2. `data` (Pixlland comum)
3. `payload` (alternativa)
4. `content` (alternativa)

Se nenhuma coluna for encontrada, **não tenta salvar** (evita erro).

### 📝 Commits
- `aca989e` - fix: Detectar dinamicamente coluna game_data no Pixlland

---

## [27/01/2026] - Correções Críticas de Criação de Projetos

### 🐛 Problemas Corrigidos

#### 1. Erro 400 ao criar projetos - Colunas obrigatórias faltando
**Problema:** Ao criar um projeto no Pixlland/Supabase, o sistema retornava erro 400 com mensagem:
- `null value in column "logline" of relation "projects" violates not-null constraint`
- `null value in column "genre" of relation "projects" violates not-null constraint`

**Solução:** Adicionado suporte dinâmico para detectar e preencher colunas obrigatórias do schema do Pixlland:

**Arquivo:** `src/services/projectService.ts`
- Adicionada detecção da coluna `logline` (tagline, subtitle)
- Separada detecção de `category` e `genre` (eram tratadas como sinônimos)
- `logline` é preenchida com a descrição do projeto ou string vazia
- `genre` é preenchida com o valor de `category` ou 'other' como padrão

```typescript
const loglineCol = firstExistingColumn(cols, ['logline', 'tagline', 'subtitle']);
const categoryCol = firstExistingColumn(cols, ['category']);
const genreCol = firstExistingColumn(cols, ['genre']);

// No payload:
if (loglineCol) payload[loglineCol] = input.description ?? '';
if (categoryCol) payload[categoryCol] = input.category ?? null;
if (genreCol) payload[genreCol] = input.category ?? 'other';
```

#### 2. Projetos em branco criados vazios (sem objetos)
**Problema:** Ao criar um novo projeto sem template, ele vinha completamente vazio, sem os objetos básicos (câmera, player, chão, luz).

**Solução:** Modificado o hook `useCreateProject` para inicializar automaticamente o `game_data` com objetos do template 'blank':

**Arquivo:** `src/hooks/useProjects.ts`
- Adicionada função `getBlankTemplateObjects()` que cria os 4 objetos essenciais:
  - **Sun Light** - Luz solar direcional
  - **Main Camera** - Câmera em terceira pessoa
  - **Player** - Personagem jogável
  - **Chão** - Plano de ground 100x100
- O `game_data` agora é criado automaticamente se não for fornecido

```typescript
if (!input.game_data) {
  input.game_data = {
    objects: getBlankTemplateObjects(),
    currentTemplateId: input.template_id || 'blank',
    gameScript: '// Game Script\n// Escreva sua lógica aqui\n',
  };
}
```

### 📝 Arquivos Modificados
1. `src/services/projectService.ts` - Suporte para colunas obrigatórias Pixlland
2. `src/hooks/useProjects.ts` - Inicialização automática de projetos em branco

### ✅ Resultado
- ✅ Projetos agora são criados com sucesso no Pixlland
- ✅ Todos os campos obrigatórios são preenchidos automaticamente
- ✅ Projetos em branco vêm com objetos básicos (sun, camera, player, ground)
- ✅ Schema adaptativo funciona com diferentes configurações do Supabase

### 🔄 Como Funciona o Sistema Adaptativo
O sistema agora detecta dinamicamente as colunas disponíveis no banco via OpenAPI spec e mapeia automaticamente:
- `user_id` → owner_id, creator_id, profile_id, etc.
- `name` → title, project_name
- `description` → summary, about
- `logline` → tagline, subtitle
- `category` → genre (se não houver coluna `category` separada)

Isso permite que o mesmo código funcione com diferentes schemas do Supabase/Pixlland.

---

## Commits
- `300221b` - fix: Adicionar suporte para colunas obrigatórias do Pixlland (logline, genre) e inicializar projetos em branco com objetos padrão
