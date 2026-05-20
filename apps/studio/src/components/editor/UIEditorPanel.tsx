import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore, FontFamily, BackgroundType, MenuButton } from '@/stores/uiStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, GripVertical, Eye } from 'lucide-react';
import { toast } from 'sonner';

const FONTS: FontFamily[] = ['Roboto', 'Inter', 'Orbitron', 'Press Start 2P', 'Bangers', 'Permanent Marker', 'Righteous'];

const BACKGROUND_TYPES: { value: BackgroundType; label: string }[] = [
  { value: 'color', label: 'Cor Sólida' },
  { value: 'gradient', label: 'Gradiente' },
  { value: 'image', label: 'Imagem' },
  { value: 'animated', label: 'Animado' },
  { value: '3d-scene', label: 'Cena 3D' },
];

const TEMPLATE_OPTIONS = [
  { value: 'adventure', label: 'Adventure' },
  { value: 'fps-horror', label: 'Horror' },
  { value: 'rpg-topdown', label: 'RPG Topdown' },
  { value: 'platformer-2d', label: 'Plataforma 2D' },
  { value: 'racing', label: 'Corrida' },
  { value: 'social-hub', label: 'Social Hub' },
];

const ANIMATED_TYPES = [
  { value: 'particles', label: 'Partículas' },
  { value: 'stars', label: 'Estrelas' },
  { value: 'waves', label: 'Ondas' },
  { value: 'none', label: 'Nenhum' },
];

export const UIEditorPanel = () => {
  const navigate = useNavigate();
  const { config, updateConfig, updateButton, addButton, removeButton, resetToDefaults } = useUIStore();
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleAddButton = () => {
    const newButton: MenuButton = {
      id: `btn-${Date.now()}`,
      label: 'Novo Botão',
      action: 'custom' as const,
      customAction: '',
      visible: true,
      enabled: true,
      order: config.buttons.length,
    };
    addButton(newButton);
    toast.success('Botão adicionado!');
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-gray-900 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Editor de UI</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/menu-preview')}
          >
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              resetToDefaults();
              toast.success('UI resetada para padrão');
            }}
          >
            Resetar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="background">Fundo</TabsTrigger>
          <TabsTrigger value="buttons">Botões</TabsTrigger>
          <TabsTrigger value="colors">Cores</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações Gerais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Título</Label>
                <Input
                  value={config.title}
                  onChange={(e) => updateConfig({ title: e.target.value })}
                  placeholder="Título do jogo"
                />
              </div>

              <div>
                <Label>Subtítulo</Label>
                <Input
                  value={config.subtitle}
                  onChange={(e) => updateConfig({ subtitle: e.target.value })}
                  placeholder="Subtítulo opcional"
                />
              </div>

              <div>
                <Label>Fonte</Label>
                <Select
                  value={config.fontFamily}
                  onValueChange={(value) => updateConfig({ fontFamily: value as FontFamily })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONTS.map((font) => (
                      <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                        {font}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Tamanho do Título: {config.titleSize}px</Label>
                <Slider
                  value={[config.titleSize]}
                  onValueChange={([value]) => updateConfig({ titleSize: value })}
                  min={32}
                  max={128}
                  step={4}
                />
              </div>

              <div>
                <Label>Tamanho dos Botões: {config.buttonSize}px</Label>
                <Slider
                  value={[config.buttonSize]}
                  onValueChange={([value]) => updateConfig({ buttonSize: value })}
                  min={12}
                  max={32}
                  step={2}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Background Settings */}
        <TabsContent value="background" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Fundo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Tipo de Fundo</Label>
                <Select
                  value={config.backgroundType}
                  onValueChange={(value) => updateConfig({ backgroundType: value as BackgroundType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BACKGROUND_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {config.backgroundType === 'color' && (
                <div>
                  <Label>Cor de Fundo</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={config.backgroundColor}
                      onChange={(e) => updateConfig({ backgroundColor: e.target.value })}
                      className="w-20"
                    />
                    <Input
                      value={config.backgroundColor}
                      onChange={(e) => updateConfig({ backgroundColor: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {config.backgroundType === 'gradient' && (
                <>
                  <div>
                    <Label>Cor Inicial</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={config.gradientStart}
                        onChange={(e) => updateConfig({ gradientStart: e.target.value })}
                        className="w-20"
                      />
                      <Input
                        value={config.gradientStart}
                        onChange={(e) => updateConfig({ gradientStart: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Cor Final</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={config.gradientEnd}
                        onChange={(e) => updateConfig({ gradientEnd: e.target.value })}
                        className="w-20"
                      />
                      <Input
                        value={config.gradientEnd}
                        onChange={(e) => updateConfig({ gradientEnd: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}

              {config.backgroundType === 'image' && (
                <div>
                  <Label>URL da Imagem</Label>
                  <Input
                    value={config.backgroundImage}
                    onChange={(e) => updateConfig({ backgroundImage: e.target.value })}
                    placeholder="https://exemplo.com/imagem.jpg"
                  />
                </div>
              )}

              {config.backgroundType === 'animated' && (
                <div>
                  <Label>Tipo de Animação</Label>
                  <Select
                    value={config.animatedBackground}
                    onValueChange={(value: any) => updateConfig({ animatedBackground: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ANIMATED_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {config.backgroundType === '3d-scene' && (
                <>
                  <div className="flex items-center justify-between">
                    <Label>Usar Cena 3D</Label>
                    <Switch
                      checked={config.use3DScene}
                      onCheckedChange={(checked) => updateConfig({ use3DScene: checked })}
                    />
                  </div>

                  {config.use3DScene && (
                    <>
                      <div>
                        <Label>Opacidade da Cena: {config.sceneOpacity.toFixed(2)}</Label>
                        <Slider
                          value={[config.sceneOpacity]}
                          onValueChange={([value]) => updateConfig({ sceneOpacity: value })}
                          min={0}
                          max={1}
                          step={0.05}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label>Template da Cena 3D</Label>
                          <Switch
                            checked={config.menuUseProjectTemplate}
                            onCheckedChange={(checked) => updateConfig({ menuUseProjectTemplate: checked })}
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {config.menuUseProjectTemplate
                            ? 'Usando o cenário atual do projeto (ignora seleção abaixo)'
                            : 'Selecione um template específico para o menu'}
                        </p>
                        <Select
                          value={config.menuTemplateId}
                          onValueChange={(value) => updateConfig({ menuTemplateId: value as any })}
                          disabled={config.menuUseProjectTemplate}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TEMPLATE_OPTIONS.map((tpl) => (
                              <SelectItem key={tpl.value} value={tpl.value}>
                                {tpl.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between">
                        <Label>Câmera customizada</Label>
                        <Switch
                          checked={config.menuCameraEnabled}
                          onCheckedChange={(checked) => updateConfig({ menuCameraEnabled: checked })}
                        />
                      </div>

                      {config.menuCameraEnabled && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Posição da câmera (XYZ)</Label>
                            <div className="grid grid-cols-3 gap-2">
                              {(['x','y','z'] as const).map((axis) => (
                                <Input
                                  key={axis}
                                  type="number"
                                  step="0.1"
                                  value={config.menuCameraPosition[axis]}
                                  onChange={(e) => updateConfig({ menuCameraPosition: { ...config.menuCameraPosition, [axis]: Number(e.target.value) } })}
                                />
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>Olhar para (target XYZ)</Label>
                            <div className="grid grid-cols-3 gap-2">
                              {(['x','y','z'] as const).map((axis) => (
                                <Input
                                  key={axis}
                                  type="number"
                                  step="0.1"
                                  value={config.menuCameraTarget[axis]}
                                  onChange={(e) => updateConfig({ menuCameraTarget: { ...config.menuCameraTarget, [axis]: Number(e.target.value) } })}
                                />
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2 col-span-2">
                            <Label>FOV: {config.menuCameraFov.toFixed(0)}°</Label>
                            <Slider
                              value={[config.menuCameraFov]}
                              onValueChange={([value]) => updateConfig({ menuCameraFov: value })}
                              min={30}
                              max={90}
                              step={1}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <Label>Mostrar Título 3D</Label>
                        <Switch
                          checked={config.show3DTitle}
                          onCheckedChange={(checked) => updateConfig({ show3DTitle: checked })}
                        />
                      </div>

                      {config.show3DTitle && (
                        <>
                          <div>
                            <Label>Profundidade do Título 3D: {config.title3DDepth.toFixed(1)}</Label>
                            <Slider
                              value={[config.title3DDepth]}
                              onValueChange={([value]) => updateConfig({ title3DDepth: value })}
                              min={0.1}
                              max={2}
                              step={0.1}
                            />
                          </div>

                          <div>
                            <Label>Cor do Título 3D</Label>
                            <div className="flex gap-2">
                              <Input
                                type="color"
                                value={config.title3DColor}
                                onChange={(e) => updateConfig({ title3DColor: e.target.value })}
                                className="w-20"
                              />
                              <Input
                                value={config.title3DColor}
                                onChange={(e) => updateConfig({ title3DColor: e.target.value })}
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Buttons Settings */}
        <TabsContent value="buttons" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Botões do Menu</span>
                <Button size="sm" onClick={handleAddButton}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {config.buttons.map((button) => (
                <div key={button.id} className="flex items-center gap-2 p-3 bg-gray-800 rounded">
                  <GripVertical className="w-4 h-4 text-gray-500 cursor-move" />
                  
                  <div className="flex-1 space-y-2">
                    <Input
                      value={button.label}
                      onChange={(e) => updateButton(button.id, { label: e.target.value })}
                      placeholder="Texto do botão"
                      className="text-sm"
                    />
                    
                    <Select
                      value={button.action}
                      onValueChange={(value: any) => updateButton(button.id, { action: value })}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="start">Iniciar Jogo</SelectItem>
                        <SelectItem value="options">Opções</SelectItem>
                        <SelectItem value="exit">Sair</SelectItem>
                        <SelectItem value="custom">Personalizado</SelectItem>
                      </SelectContent>
                    </Select>

                    {button.action === 'custom' && (
                      <Input
                        value={button.customAction || ''}
                        onChange={(e) => updateButton(button.id, { customAction: e.target.value })}
                        placeholder="Script customizado"
                        className="text-sm"
                      />
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Switch
                      checked={button.enabled}
                      onCheckedChange={(checked) => updateButton(button.id, { enabled: checked })}
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        removeButton(button.id);
                        toast.success('Botão removido');
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Colors Settings */}
        <TabsContent value="colors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Esquema de Cores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'primaryColor', label: 'Cor Primária' },
                { key: 'secondaryColor', label: 'Cor Secundária' },
                { key: 'textColor', label: 'Cor do Texto' },
                { key: 'buttonColor', label: 'Cor do Botão' },
                { key: 'buttonHoverColor', label: 'Cor do Botão (Hover)' },
                { key: 'buttonTextColor', label: 'Cor do Texto do Botão' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={config[key as keyof typeof config] as string}
                      onChange={(e) => updateConfig({ [key]: e.target.value })}
                      className="w-20"
                    />
                    <Input
                      value={config[key as keyof typeof config] as string}
                      onChange={(e) => updateConfig({ [key]: e.target.value })}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
