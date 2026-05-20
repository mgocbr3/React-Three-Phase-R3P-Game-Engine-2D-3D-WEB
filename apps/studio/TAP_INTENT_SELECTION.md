# Sistema de Seleção por Tap Intent

## Problema Original

Ao clicar nas setas do TransformGizmo (vermelho, azul, verde) para arrastar objetos, o sistema interpretava o clique como uma tentativa de seleção, fazendo com que:
- A seleção mudasse para o objeto de fundo (ground ou outro objeto)
- O usuário não conseguisse arrastar o gizmo corretamente
- A experiência fosse frustrante em dispositivos touch e desktop

## Solução Implementada

### Hook `useTapIntent`

Localização: `src/components/canvas/hooks/useTapIntent.ts`

O hook implementa um sistema de **"Seleção Atrasada + Cancelamento por Movimento"**:

```
┌─────────────────┐
│  pointerdown    │
│  (início)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Agenda seleção  │
│ em 100ms        │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐  ┌───────────┐
│ Moveu │  │ Não moveu │
│ >4px  │  │           │
└───┬───┘  └─────┬─────┘
    │            │
    ▼            ▼
┌─────────┐  ┌──────────┐
│ CANCELA │  │ SELECIONA│
│ seleção │  │ objeto   │
└─────────┘  └──────────┘
```

### Lógica Principal

1. **No `pointerdown`**: Agenda a seleção para executar após 100ms de delay
2. **No `pointermove`**: Se o ponteiro mover mais de 4px, cancela a seleção pendente (é um drag)
3. **No `pointerup`**: Se ainda houver seleção pendente (não cancelada), executa imediatamente

### Código do Hook

```typescript
export function useTapIntent({ onTap, delayMs = 100 }) {
  const pendingRef = useRef(null);

  const cancel = useCallback(() => {
    if (pendingRef.current) {
      clearTimeout(pendingRef.current.timeoutId);
      pendingRef.current.cancelled = true;
      pendingRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback((e) => {
    cancel();
    
    const timeoutId = setTimeout(() => {
      if (pendingRef.current && !pendingRef.current.cancelled) {
        onTap(pendingRef.current.event);
        pendingRef.current = null;
      }
    }, delayMs);

    pendingRef.current = {
      timeoutId,
      event: e,
      startX: e.nativeEvent.clientX,
      startY: e.nativeEvent.clientY,
      cancelled: false,
    };
  }, [onTap, delayMs, cancel]);

  const onPointerMove = useCallback((e) => {
    const pending = pendingRef.current;
    if (!pending || pending.cancelled) return;

    const dx = e.nativeEvent.clientX - pending.startX;
    const dy = e.nativeEvent.clientY - pending.startY;

    // Threshold de 4px
    if (dx * dx + dy * dy > 16) {
      cancel();
    }
  }, [cancel]);

  const onPointerUp = useCallback((e) => {
    const pending = pendingRef.current;
    if (!pending || pending.cancelled) return;

    clearTimeout(pending.timeoutId);
    onTap(pending.event);
    pendingRef.current = null;
  }, [onTap]);

  return { onPointerDown, onPointerMove, onPointerUp, cancel };
}
```

## Integração no EditableObject

O hook é utilizado em `src/components/canvas/EditableObject.tsx`:

```typescript
const tapSelect = useTapIntent({
  onTap: handleSelect,
  delayMs: 100,
});

// Aplicado em todos os meshes interativos:
<mesh
  onPointerDown={tapSelect.onPointerDown}
  onPointerMove={tapSelect.onPointerMove}
  onPointerUp={tapSelect.onPointerUp}
>
```

## Parâmetros Configuráveis

| Parâmetro | Valor | Descrição |
|-----------|-------|-----------|
| `delayMs` | 100ms | Tempo de espera antes de confirmar seleção |
| `threshold` | 4px | Distância máxima de movimento permitida para considerar como "tap" |

## Por que Funciona

1. **TransformGizmo inicia drag imediatamente**: Quando o usuário clica em uma seta do gizmo, o movimento começa instantaneamente
2. **Movimento cancela seleção**: Os 4px de movimento durante o drag cancelam qualquer seleção pendente
3. **Tap puro funciona**: Cliques rápidos sem movimento ainda selecionam objetos normalmente
4. **Touch compatível**: O sistema usa PointerEvents, funcionando em mouse, touch e trackpad

## Arquivos Relacionados

- `src/components/canvas/hooks/useTapIntent.ts` - Hook principal
- `src/components/canvas/EditableObject.tsx` - Componente que usa o hook
- `src/components/canvas/TransformGizmo.tsx` - Gizmo de transformação
- `src/hooks/use-touch-device.ts` - Detecção de dispositivos touch

## Compatibilidade

✅ Desktop (mouse)  
✅ iPad (touch)  
✅ Laptops híbridos (touch + trackpad)  
✅ Dispositivos Android  

## Data da Implementação

**25 de Janeiro de 2026**

---

*Este sistema resolve o conflito entre seleção de objetos e manipulação de gizmos, proporcionando uma experiência fluida em todos os dispositivos.*
