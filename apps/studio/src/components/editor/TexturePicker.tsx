import { useState, useRef, useEffect } from 'react';
import { Image, X, ChevronDown, Upload, Link, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAssetStore, ProjectAsset } from '@/stores/assetStore';

interface TexturePickerProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  placeholder?: string;
}

export const TexturePicker = ({ 
  value, 
  onChange, 
  label = 'Textura',
  placeholder = 'Selecione ou cole URL'
}: TexturePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [urlInput, setUrlInput] = useState(value || '');
  const [activeTab, setActiveTab] = useState<'assets' | 'url'>('assets');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { projectAssets, addProjectAsset } = useAssetStore();
  
  // Project image-like assets back both 3D materials and 2D spritesheets.
  const textureAssets = projectAssets.filter((asset) =>
    ['texture', 'image', 'sprite', 'spritesheet'].includes(asset.type)
  );
  
  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);
  
  // Sync urlInput with value
  useEffect(() => {
    setUrlInput(value || '');
  }, [value]);
  
  const handleSelectAsset = (asset: ProjectAsset) => {
    onChange(asset.url);
    setIsOpen(false);
  };
  
  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      setIsOpen(false);
    }
  };
  
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const url = URL.createObjectURL(file);
    addProjectAsset({
      name: file.name,
      type: 'texture',
      url,
      folder: 'sprites',
      metadata: { format: file.name.split('.').pop() || 'png' },
    });
    onChange(url);
    setIsOpen(false);
    e.target.value = '';
  };
  
  const clearTexture = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setUrlInput('');
  };
  
  const selectedAsset = textureAssets.find(a => a.url === value);
  
  return (
    <div className="space-y-1.5">
      <label className="inspector-label">{label}</label>
      
      <div className="relative" ref={dropdownRef}>
        {/* Trigger Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-full flex items-center gap-2 px-2 py-1.5 bg-muted rounded text-xs text-left transition-colors",
            "hover:bg-muted/80 border border-transparent focus:border-[var(--editor-command-highlight)] focus:outline-none",
            value && "pr-8",
            isOpen && "border-[var(--editor-command-highlight)]"
          )}
        >
          {/* Preview */}
          <div className="w-8 h-8 rounded bg-secondary/50 flex items-center justify-center overflow-hidden flex-shrink-0 border border-border">
            {value ? (
              <img 
                src={value} 
                alt="Texture preview" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <Image className="w-4 h-4 text-muted-foreground opacity-50" />
            )}
          </div>
          
          {/* Label */}
          <span className="flex-1 truncate text-muted-foreground">
            {selectedAsset?.name || (value ? 'URL externa' : placeholder)}
          </span>
          
          <ChevronDown className={cn(
            "w-3.5 h-3.5 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )} />
        </button>

        {value && (
          <button
            type="button"
            onClick={clearTexture}
            className="absolute right-6 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
            title="Limpar"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        
        {/* Dropdown */}
        {isOpen && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden border border-border bg-[var(--editor-panel)]">
            {/* Tabs */}
            <div className="flex border-b border-border">
              <button
                onClick={() => setActiveTab('assets')}
                className={cn(
                  "flex-1 px-3 py-2 text-xs font-medium transition-colors",
                  activeTab === 'assets' 
                    ? "border-b-2 border-[var(--editor-command-highlight)] bg-[var(--editor-command-active)] text-foreground -mb-px"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Image className="w-3 h-3 inline-block mr-1" />
                Assets do Projeto
              </button>
              <button
                onClick={() => setActiveTab('url')}
                className={cn(
                  "flex-1 px-3 py-2 text-xs font-medium transition-colors",
                  activeTab === 'url' 
                    ? "border-b-2 border-[var(--editor-command-highlight)] bg-[var(--editor-command-active)] text-foreground -mb-px"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Link className="w-3 h-3 inline-block mr-1" />
                URL Externa
              </button>
            </div>
            
            {/* Content */}
            <div className="max-h-48 overflow-y-auto">
              {activeTab === 'assets' ? (
                <div className="p-2">
                  {textureAssets.length > 0 ? (
                    <div className="grid grid-cols-4 gap-1.5">
                      {textureAssets.map((asset, index) => (
                        <button
                          key={`${asset.id}-${index}`}
                          onClick={() => handleSelectAsset(asset)}
                          className={cn(
                            "relative group aspect-square rounded overflow-hidden border-2 transition-all",
                            value === asset.url 
                              ? "border-[var(--editor-command-highlight)]"
                              : "border-transparent hover:border-[var(--editor-border-light)]"
                          )}
                        >
                          <img 
                            src={asset.thumbnail || asset.url} 
                            alt={asset.name}
                            className="w-full h-full object-cover"
                          />
                          {value === asset.url && (
                            <div className="absolute inset-0 flex items-center justify-center bg-[rgba(61,61,61,0.45)]">
                              <Check className="w-4 h-4 text-foreground" />
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[8px] text-white truncate block">
                              {asset.name}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <Image className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-xs">Nenhuma textura importada</p>
                      <p className="text-[10px] opacity-70 mt-1">
                        Importe texturas no Assets Browser
                      </p>
                    </div>
                  )}
                  
                  {/* Import button */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileImport}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-2 bg-secondary hover:bg-secondary/80 rounded text-xs text-muted-foreground transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Importar Textura
                  </button>
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  <input
                    type="text"
                    placeholder="https://exemplo.com/textura.png"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                    className="w-full rounded bg-muted px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--editor-command-highlight)]"
                  />
                  <button
                    onClick={handleUrlSubmit}
                    disabled={!urlInput.trim()}
                    className="w-full rounded border border-[var(--editor-command-border)] bg-[var(--editor-command-active)] px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-[var(--editor-command-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Aplicar URL
                  </button>
                  <p className="text-[10px] text-muted-foreground">
                     Use URLs públicas com CORS habilitado
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
