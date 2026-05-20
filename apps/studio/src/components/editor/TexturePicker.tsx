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
  
  // Filter texture assets
  const textureAssets = projectAssets.filter(a => a.type === 'texture');
  
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
            "hover:bg-muted/80 border border-transparent focus:border-primary focus:outline-none",
            isOpen && "border-primary"
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
          
          {/* Actions */}
          {value && (
            <button
              onClick={clearTexture}
              className="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <ChevronDown className={cn(
            "w-3.5 h-3.5 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )} />
        </button>
        
        {/* Dropdown */}
        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-border">
              <button
                onClick={() => setActiveTab('assets')}
                className={cn(
                  "flex-1 px-3 py-2 text-xs font-medium transition-colors",
                  activeTab === 'assets' 
                    ? "bg-primary/10 text-primary border-b-2 border-primary -mb-px" 
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
                    ? "bg-primary/10 text-primary border-b-2 border-primary -mb-px" 
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
                      {textureAssets.map((asset) => (
                        <button
                          key={asset.id}
                          onClick={() => handleSelectAsset(asset)}
                          className={cn(
                            "relative group aspect-square rounded overflow-hidden border-2 transition-all",
                            value === asset.url 
                              ? "border-primary ring-1 ring-primary" 
                              : "border-transparent hover:border-primary/50"
                          )}
                        >
                          <img 
                            src={asset.thumbnail || asset.url} 
                            alt={asset.name}
                            className="w-full h-full object-cover"
                          />
                          {value === asset.url && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <Check className="w-4 h-4 text-primary" />
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
                    className="w-full px-2 py-1.5 bg-muted rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={handleUrlSubmit}
                    disabled={!urlInput.trim()}
                    className="w-full px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
