import { useEffect, useState, useCallback, useRef } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { usePixllandAssetStore, PixllandAsset } from '@/stores/pixllandAssetStore';
import { usePixllandProjectStore, PixllandProject } from '@/stores/pixllandProjectStore';
import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { usePixllandUserStore } from '@/stores/pixllandUserStore';

// Default origin used when running standalone. When embedded, we dynamically
// infer the parent origin from document.referrer or querystring.
const DEFAULT_PIXLLAND_ORIGIN = import.meta.env.VITE_PIXLLAND_PLATFORM_ORIGIN || 'http://localhost:3000';

// Singleton guards: the bridge is used in multiple components.
// We only want ONE message listener + one ENGINE_READY per page load.
let bridgeListenerAttached = false;
let engineReadySentGlobal = false;
let requestAuthSentGlobal = false;

export type PixllandMessageType = 
  | 'ENGINE_READY' 
  | 'FORK_GAME' 
  | 'REQUEST_AUTH' 
  | 'SAVE_PROJECT' 
  | 'PUBLISH_GAME' 
  | 'RECORD_VIX' 
  | 'CLOSE_OVERLAY'
  | 'REQUEST_STORE_ASSETS'
  | 'STORE_ASSETS_RESPONSE'
  | 'IMPORT_STORE_ASSET'
  | 'OPEN_STORE'
  | 'REQUEST_USER_LIBRARY'
  | 'USER_LIBRARY_RESPONSE'
  | 'SYNC_PROJECT_ASSETS'  // Engine sends this
  | 'PROJECT_ASSETS_RESPONSE'
  | 'ASSET_IMPORTED'
  | 'CONNECT_ACCOUNT'
  // Messages from platform (Pixlland → Engine)
  | 'SYNC_PROJECTS'        // Platform sends user projects
  | 'SYNC_INVENTORY'       // Platform sends user inventory
  // Messages from engine (Engine → Pixlland)
  | 'REQUEST_DATA'
  | 'DATA_RESPONSE'
  | 'LOAD_PROJECT'
  | 'GET_PROJECTS'         // Engine requests projects
  | 'REQUEST_PROJECTS'     // Alias for GET_PROJECTS
  | 'PROJECTS_RESPONSE'
  | 'GET_INVENTORY'        // Engine requests inventory
  | 'REQUEST_INVENTORY'    // Alias for GET_INVENTORY
  | 'INVENTORY_RESPONSE'
  | 'REQUEST_PROJECT_ASSETS' // Engine requests assets for a project
  | 'ADD_ASSET_TO_PROJECT'
  | 'ASSET_ADDED_RESPONSE';

export interface R3FGameData {
  type: 'r3f';
  r3fScene: {
    objects: any[];
    lights: any[];
    environment: string;
  };
  r3fAssets: {
    models: any[];
    textures: any[];
  };
  r3fConfig: {
    physics: boolean;
    shadows: boolean;
    controls?: string;
  };
}

export interface PixllandMessage {
  type: PixllandMessageType;
  payload?: any;
  requestId?: string;
}

export interface PixllandBridgeState {
  isEmbedded: boolean;
  isReady: boolean;
  authToken: string | null;
  userId: string | null;
  forkGameId: string | null;
  loadedProjectId: string | null;
}

// Pending requests for responses
const pendingRequests = new Map<string, {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}>();

export const usePixllandBridge = () => {
  const [state, setState] = useState<PixllandBridgeState>(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      isEmbedded: params.get('embedded') === 'true',
      isReady: false,
      authToken: null,
      userId: null,
      forkGameId: params.get('fork') || null,
      loadedProjectId: params.get('projectId') || null,
    };
  });
  
  const readySent = useRef(false);
  const requestAuthSent = useRef(false);
  const parentOriginRef = useRef<string>((() => {
    const params = new URLSearchParams(window.location.search);
    const originParam = params.get('parentOrigin') || params.get('origin');
    const referrerOrigin = (() => {
      try {
        return document.referrer ? new URL(document.referrer).origin : null;
      } catch {
        return null;
      }
    })();
    return originParam || referrerOrigin || DEFAULT_PIXLLAND_ORIGIN;
  })());
  const { objects, currentTemplateId, setObjects } = useEditorStore();

  // Send message to parent with optional promise-based response
  const sendToParent = useCallback((message: PixllandMessage): Promise<any> | void => {
    if (!state.isEmbedded) {
      console.log('[PixllandBridge] Not embedded, skipping message:', message.type);
      return;
    }
    
    try {
      const targetOrigin = parentOriginRef.current || DEFAULT_PIXLLAND_ORIGIN;
      window.parent.postMessage(message, targetOrigin);
      console.log('[PixllandBridge] Sent:', message.type, message.payload);
      
      // If message has requestId, return a promise for the response
      if (message.requestId) {
        return new Promise((resolve, reject) => {
          pendingRequests.set(message.requestId!, { resolve, reject });
          // Timeout after 30 seconds
          setTimeout(() => {
            if (pendingRequests.has(message.requestId!)) {
              pendingRequests.delete(message.requestId!);
              reject(new Error('Request timeout'));
            }
          }, 30000);
        });
      }
    } catch (error) {
      console.error('[PixllandBridge] Failed to send message:', error);
    }
  }, [state.isEmbedded]);

  // Send ENGINE_READY when loaded
  useEffect(() => {
    if (state.isEmbedded && !readySent.current && !engineReadySentGlobal) {
      const timer = setTimeout(() => {
        sendToParent({ type: 'ENGINE_READY' });
        setState(prev => ({ ...prev, isReady: true }));
        readySent.current = true;
        engineReadySentGlobal = true;
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [state.isEmbedded, sendToParent]);

  // After the engine signals ready, ask the platform for auth so we hydrate the Supabase session.
  useEffect(() => {
    if (!state.isEmbedded) return;
    if (!state.isReady) return;
    if (requestAuthSent.current || requestAuthSentGlobal) return;

    const requestId = crypto.randomUUID();
    sendToParent({ type: 'REQUEST_AUTH', requestId });
    requestAuthSent.current = true;
    requestAuthSentGlobal = true;
  }, [state.isEmbedded, state.isReady, sendToParent]);

  // Listen for messages from parent
  useEffect(() => {
    if (!state.isEmbedded) return;

    // Only attach ONE listener per page.
    if (bridgeListenerAttached) return;
    bridgeListenerAttached = true;

    const handleMessage = (event: MessageEvent) => {
      // Validate origin
      const expectedOrigin = parentOriginRef.current || DEFAULT_PIXLLAND_ORIGIN;
      if (event.origin !== expectedOrigin && event.origin !== DEFAULT_PIXLLAND_ORIGIN) {
        // Allow localhost for development
        if (!event.origin.includes('localhost') && !event.origin.includes('127.0.0.1')) {
          return;
        }
      }

      const message = event.data as PixllandMessage;
      if (!message?.type) return;

      console.log('[PixllandBridge] Received:', message.type, message.payload);

       // Handle response to pending requests
       // IMPORTANT: Some platform sync messages (e.g. SYNC_PROJECTS/SYNC_INVENTORY)
       // may include requestId but don't use a { success: boolean } envelope.
       // In that case we should resolve the pending promise (if any) but still
       // continue to the switch so the stores are updated.
       if (message.requestId && pendingRequests.has(message.requestId)) {
         const { resolve, reject } = pendingRequests.get(message.requestId)!;
         pendingRequests.delete(message.requestId);

         const successFlag = message.payload?.success;
         if (typeof successFlag === 'boolean') {
           if (successFlag) {
             resolve(message.payload);
           } else {
             reject(new Error(message.payload?.error || 'Unknown error'));
           }
           // For RPC-style responses (save/publish/etc), we stop here.
           return;
         }

         // For data sync responses, resolve but allow downstream handlers.
         resolve(message.payload);
       }

      switch (message.type) {
        case 'FORK_GAME':
          handleForkGame(message.payload);
          break;
        case 'REQUEST_AUTH':
          handleAuthToken(message.payload);
          break;
        case 'USER_LIBRARY_RESPONSE':
          handleUserLibrary(message.payload);
          break;
        case 'PROJECT_ASSETS_RESPONSE':
        case 'SYNC_PROJECT_ASSETS':
          handleProjectAssets(message.payload);
          break;
        case 'ASSET_IMPORTED':
          handleAssetImported(message.payload);
          break;
        case 'LOAD_PROJECT':
          handleLoadProject(message.payload);
          break;
        // Handle platform syncing projects (SYNC_PROJECTS from Pixlland)
        case 'SYNC_PROJECTS':
        case 'PROJECTS_RESPONSE':
          handleProjectsResponse(message.payload);
          break;
        // Handle platform syncing inventory (SYNC_INVENTORY from Pixlland)
        case 'SYNC_INVENTORY':
        case 'INVENTORY_RESPONSE':
          handleInventoryResponse(message.payload);
          break;
        case 'DATA_RESPONSE':
          handleDataResponse(message.payload);
          break;
        default:
          console.log('[PixllandBridge] Unknown message type:', message.type);
      }
    };

    window.addEventListener('message', handleMessage);
    // Intentionally not removing: this is a singleton listener.
    return () => {};
  }, [state.isEmbedded]);

  // Handle fork game data
  const handleForkGame = useCallback((payload: any) => {
    if (!payload) return;
    
    console.log('[PixllandBridge] Loading fork data:', payload);
    const { gameId, title, gameData, parentGameId, assets } = payload;
    
    // Load the scene with received data
    if (gameData?.r3fScene?.objects) {
      try {
        setObjects(gameData.r3fScene.objects);
      } catch (error) {
        console.error('[PixllandBridge] Failed to load fork scene:', error);
      }
    }
    
    setState(prev => ({ ...prev, forkGameId: gameId }));
    usePixllandProjectStore.getState().setCurrentProjectId(gameId);
  }, [setObjects]);

  // Handle loading a project
  const handleLoadProject = useCallback((payload: any) => {
    if (!payload) return;
    
    console.log('[PixllandBridge] Loading project:', payload.projectId);
    const { projectId, name, gameData, assets } = payload;
    
    // Load the scene with project data
    if (gameData?.r3fScene?.objects) {
      try {
        setObjects(gameData.r3fScene.objects);
      } catch (error) {
        console.error('[PixllandBridge] Failed to load project scene:', error);
      }
    }
    
    // Load project assets
    if (assets && Array.isArray(assets)) {
      const mappedAssets: PixllandAsset[] = assets.map((a: any) => ({
        id: a.id,
        name: a.name,
        type: a.asset_type || 'model',
        category: a.category || 'misc',
        thumbnailUrl: a.thumbnail_url,
        downloadUrl: a.asset_url,
        description: a.description,
        author: a.author,
        license: 'Standard',
        tags: a.tags,
        addedAt: Date.now(),
      }));
      usePixllandAssetStore.getState().setProjectAssets(mappedAssets);
    }
    
    setState(prev => ({ ...prev, loadedProjectId: projectId }));
    usePixllandProjectStore.getState().setCurrentProjectId(projectId);
  }, [setObjects]);

  // Handle projects list response (from SYNC_PROJECTS or PROJECTS_RESPONSE)
  const handleProjectsResponse = useCallback((payload: any) => {
    // Support both { projects: [...] } and direct array format
    const projectsList = payload?.projects || (Array.isArray(payload) ? payload : null);
    if (!projectsList) {
      console.log('[PixllandBridge] No projects in payload:', payload);
      usePixllandProjectStore.getState().setLoadingProjects(false);
      return;
    }
    
    console.log('[PixllandBridge] Received projects:', projectsList.length);
    
    const projects: PixllandProject[] = projectsList.map((p: any) => ({
      id: p.id,
      name: p.name || p.title,
      thumbnailUrl: p.thumbnail_url,
      status: p.status || 'draft',
      createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
      updatedAt: p.updated_at ? new Date(p.updated_at).getTime() : Date.now(),
      playCount: p.play_count,
      likeCount: p.like_count,
      category: p.category || p.genre,
      gameData: p.game_data || p.generated_code,
    }));
    
    usePixllandProjectStore.getState().setProjects(projects);
    usePixllandProjectStore.getState().setLoadingProjects(false);
  }, []);

  // Handle inventory response (from SYNC_INVENTORY or INVENTORY_RESPONSE)
  const handleInventoryResponse = useCallback((payload: any) => {
    // Support both { inventory: [...] }, { assets: [...] } and direct array format
    const inventoryList = payload?.inventory || payload?.assets || (Array.isArray(payload) ? payload : null);
    if (!inventoryList) {
      console.log('[PixllandBridge] No inventory in payload:', payload);
      usePixllandAssetStore.getState().setLoadingLibrary(false);
      return;
    }
    
    console.log('[PixllandBridge] Received inventory:', inventoryList.length, 'items');
    
    const assets: PixllandAsset[] = inventoryList.map((item: any) => {
      // Handle nested asset object from Supabase join
      const asset = item.asset || item;
      return {
        id: asset.id || item.id,
        name: asset.name,
        type: asset.asset_type || asset.type || 'model',
        category: asset.category || 'misc',
        thumbnailUrl: asset.thumbnail_url || asset.thumbnailUrl,
        downloadUrl: asset.asset_url || asset.downloadUrl,
        description: asset.description,
        author: asset.author,
        license: asset.license || 'Standard',
        tags: asset.tags,
        addedAt: item.acquired_at ? new Date(item.acquired_at).getTime() : Date.now(),
      };
    });
    
    usePixllandAssetStore.getState().setLibraryAssets(assets);
    usePixllandAssetStore.getState().setLoadingLibrary(false);
  }, []);

  // Handle generic data response
  const handleDataResponse = useCallback((payload: any) => {
    if (!payload?.requestId) return;
    
    console.log('[PixllandBridge] Data response for:', payload.requestId);
    
    // Resolve the pending promise if exists
    if (pendingRequests.has(payload.requestId)) {
      const { resolve } = pendingRequests.get(payload.requestId)!;
      pendingRequests.delete(payload.requestId);
      resolve(payload.data);
    }
  }, []);

  // Handle auth token
  const handleAuthToken = useCallback((payload: any) => {
    if (!payload?.token) return;
    
    console.log('[PixllandBridge] Auth received for user:', payload.userId);
    setState(prev => ({ 
      ...prev, 
      authToken: payload.token,
      userId: payload.userId || null,
    }));

    // If the platform provides a Supabase session, hydrate the client so
    // subsequent RPCs/tables use the authenticated user (shared across engine + platform).
    const session = payload.session;
    const accessToken = session?.access_token || payload.access_token || payload.token;
    const refreshToken = session?.refresh_token || payload.refresh_token;

    if (session) {
      supabase.auth.setSession(session)
        .catch((err) => console.error('[PixllandBridge] Failed to set Supabase session (session object)', err));
    } else if (accessToken && refreshToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .catch((err) => console.error('[PixllandBridge] Failed to set Supabase session (tokens)', err));
    } else {
      console.warn('[PixllandBridge] Received auth payload without refresh token; session may not persist.');
    }
    
    // Update global auth/profile store for UI (name/avatar)
    const profileName = payload.username || payload.full_name || payload.displayName || payload.name;
    const profileAvatar = payload.avatarUrl || payload.avatar_url;
    const profileUsername = payload.username || payload.handle || payload.user_name;
    const walletCoins = payload.coins ?? payload.wallet?.coins ?? payload.balance ?? payload.pixl_coins;
    const walletGems = payload.gems ?? payload.wallet?.gems;
    const walletPremium = payload.premium ?? payload.wallet?.premium;
    const badges = payload.badges || [];
    const roles = payload.roles || [];
    const plan = payload.plan || payload.tier || null;
    const locale = payload.locale || null;
    const level = payload.level ?? null;
    const xp = payload.xp ?? null;

    useAuthStore.getState().setProfile({
      displayName: profileName || null,
      avatarUrl: profileAvatar || null,
    });

    usePixllandUserStore.getState().setProfile({
      userId: payload.userId || payload.id || null,
      email: payload.email || null,
      username: profileUsername || null,
      displayName: profileName || null,
      avatarUrl: profileAvatar || null,
      badges,
      roles,
      plan,
      locale,
      wallet: {
        coins: walletCoins ?? null,
        gems: walletGems ?? null,
        premium: walletPremium ?? null,
      },
      level,
      xp,
    });

    // Update global token store
    usePixllandStore.getState().setAuth(payload.token, payload.userId);
    
    // Update asset store connection
    usePixllandAssetStore.getState().setConnection({
      isConnected: true,
      userId: payload.userId,
      username: payload.username || null,
      avatarUrl: payload.avatarUrl || null,
      lastSync: Date.now(),
    });
    
    // Note: The platform now auto-sends SYNC_PROJECTS and SYNC_INVENTORY
    // after ENGINE_READY, so we don't need to request explicitly here.
    // The handlers for SYNC_PROJECTS and SYNC_INVENTORY will update the stores.
    console.log('[PixllandBridge] Auth complete - waiting for SYNC_PROJECTS and SYNC_INVENTORY from platform');
  }, []);

  // Handle user library response from Pixlland
  const handleUserLibrary = useCallback((payload: any) => {
    if (!payload?.assets) return;
    
    console.log('[PixllandBridge] Received user library:', payload.assets.length, 'assets');
    
    const assets: PixllandAsset[] = payload.assets.map((a: any) => ({
      id: a.id,
      name: a.name,
      type: a.type || 'model',
      category: a.category || 'misc',
      thumbnailUrl: a.thumbnailUrl,
      downloadUrl: a.downloadUrl,
      description: a.description,
      author: a.author,
      license: a.license || 'Standard',
      tags: a.tags,
      addedAt: a.addedAt || Date.now(),
    }));
    
    usePixllandAssetStore.getState().setLibraryAssets(assets);
    usePixllandAssetStore.getState().setLoadingLibrary(false);
  }, []);

  // Handle project assets response from Pixlland
  const handleProjectAssets = useCallback((payload: any) => {
    if (!payload?.assets) return;
    
    console.log('[PixllandBridge] Received project assets:', payload.assets.length, 'assets');
    
    const assets: PixllandAsset[] = payload.assets.map((a: any) => ({
      id: a.id,
      name: a.name,
      type: a.type || 'model',
      category: a.category || 'misc',
      thumbnailUrl: a.thumbnailUrl,
      downloadUrl: a.downloadUrl,
      description: a.description,
      author: a.author,
      license: a.license || 'Standard',
      tags: a.tags,
      addedAt: a.addedAt || Date.now(),
    }));
    
    usePixllandAssetStore.getState().setProjectAssets(assets);
    usePixllandAssetStore.getState().setLoadingProject(false);
  }, []);

  // Handle asset imported notification
  const handleAssetImported = useCallback((payload: any) => {
    if (!payload?.asset) return;
    
    console.log('[PixllandBridge] Asset imported:', payload.asset.name);
    
    const asset: PixllandAsset = {
      id: payload.asset.id,
      name: payload.asset.name,
      type: payload.asset.type || 'model',
      category: payload.asset.category || 'misc',
      thumbnailUrl: payload.asset.thumbnailUrl,
      downloadUrl: payload.asset.downloadUrl,
      description: payload.asset.description,
      author: payload.asset.author,
      license: payload.asset.license || 'Standard',
      tags: payload.asset.tags,
      addedAt: Date.now(),
    };
    
    usePixllandAssetStore.getState().addToLibrary(asset);
    usePixllandAssetStore.getState().addToProject(asset);
  }, []);

  // Build game data from current editor state
  const buildGameData = useCallback((): R3FGameData => {
    const lights = objects.filter(obj => 
      obj.type === 'light' || obj.type === 'spotlight' || obj.type === 'sunlight'
    );
    const sceneObjects = objects.filter(obj => 
      obj.type !== 'light' && obj.type !== 'spotlight' && obj.type !== 'sunlight'
    );

    return {
      type: 'r3f',
      r3fScene: {
        objects: sceneObjects,
        lights: lights,
        environment: currentTemplateId || 'default',
      },
      r3fAssets: {
        models: [],
        textures: [],
      },
      r3fConfig: {
        physics: true,
        shadows: true,
      },
    };
  }, [objects, currentTemplateId]);

  // Save project to Pixlland
  const saveToPixlland = useCallback((options?: { 
    projectId?: string | null;
    title?: string;
  }) => {
    const requestId = crypto.randomUUID();
    
    return sendToParent({
      type: 'SAVE_PROJECT',
      requestId,
      payload: {
        projectId: options?.projectId || null,
        title: options?.title || 'Untitled Project',
        gameData: buildGameData(),
      },
    });
  }, [sendToParent, buildGameData]);

  // Publish game to Arcade
  const publishToPixlland = useCallback((metadata?: { 
    title?: string; 
    description?: string; 
    thumbnailUrl?: string;
    category?: string;
    tags?: string[];
  }) => {
    const requestId = crypto.randomUUID();
    
    return sendToParent({
      type: 'PUBLISH_GAME',
      requestId,
      payload: {
        title: metadata?.title || 'Untitled Game',
        description: metadata?.description || '',
        thumbnailUrl: metadata?.thumbnailUrl || '',
        category: metadata?.category || 'adventure',
        tags: metadata?.tags || [],
        gameData: buildGameData(),
      },
    });
  }, [sendToParent, buildGameData]);

  // Record VIX clip
  const recordVix = useCallback((options: {
    gameId: string;
    videoBlob?: Blob;
    videoUrl?: string;
    duration: number;
    thumbnailUrl: string;
  }) => {
    const requestId = crypto.randomUUID();
    
    return sendToParent({
      type: 'RECORD_VIX',
      requestId,
      payload: {
        gameId: options.gameId,
        videoBlob: options.videoBlob,
        videoUrl: options.videoUrl,
        duration: options.duration,
        thumbnailUrl: options.thumbnailUrl,
      },
    });
  }, [sendToParent]);

  // Close overlay
  const closeOverlay = useCallback(() => {
    sendToParent({ type: 'CLOSE_OVERLAY' });
  }, [sendToParent]);

  // Request store assets from Pixlland
  const requestStoreAssets = useCallback((options?: {
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const requestId = crypto.randomUUID();
    
    return sendToParent({
      type: 'REQUEST_STORE_ASSETS',
      requestId,
      payload: {
        category: options?.category || 'all',
        search: options?.search || '',
        page: options?.page || 1,
        limit: options?.limit || 50,
      },
    });
  }, [sendToParent]);

  // Import an asset from the store
  const importStoreAsset = useCallback((assetId: string) => {
    const requestId = crypto.randomUUID();
    
    return sendToParent({
      type: 'IMPORT_STORE_ASSET',
      requestId,
      payload: { assetId },
    });
  }, [sendToParent]);

  // Open the full store in Pixlland
  const openStore = useCallback(() => {
    if (state.isEmbedded) {
      sendToParent({ type: 'OPEN_STORE' });
    } else {
      window.open(`${DEFAULT_PIXLLAND_ORIGIN}/store`, '_blank');
    }
  }, [state.isEmbedded, sendToParent]);

  // Request user's library assets from Pixlland
  const requestUserLibrary = useCallback(() => {
    usePixllandAssetStore.getState().setLoadingLibrary(true);
    const requestId = crypto.randomUUID();
    
    return sendToParent({
      type: 'REQUEST_USER_LIBRARY',
      requestId,
      payload: {},
    });
  }, [sendToParent]);

  // Sync project assets with Pixlland
  const syncProjectAssets = useCallback((projectId?: string) => {
    usePixllandAssetStore.getState().setLoadingProject(true);
    const requestId = crypto.randomUUID();
    
    return sendToParent({
      type: 'SYNC_PROJECT_ASSETS',
      requestId,
      payload: { projectId },
    });
  }, [sendToParent]);

  // Connect to Pixlland account
  const connectAccount = useCallback(() => {
    if (state.isEmbedded) {
      sendToParent({ type: 'CONNECT_ACCOUNT' });
    } else {
      window.open(`${DEFAULT_PIXLLAND_ORIGIN}/auth?redirect=engine`, '_blank');
    }
  }, [state.isEmbedded, sendToParent]);

  // Request user's projects from Pixlland
  // Uses REQUEST_PROJECTS which platform listens to
  const requestProjects = useCallback(() => {
    usePixllandProjectStore.getState().setLoadingProjects(true);
    const requestId = crypto.randomUUID();
    
    // Send REQUEST_PROJECTS - the platform's handler listens for this
    return sendToParent({
      type: 'REQUEST_PROJECTS',
      requestId,
      payload: {},
    });
  }, [sendToParent]);

  // Request user's inventory from Pixlland
  // Uses REQUEST_INVENTORY which platform listens to
  const requestInventory = useCallback(() => {
    usePixllandAssetStore.getState().setLoadingLibrary(true);
    const requestId = crypto.randomUUID();
    
    // Send REQUEST_INVENTORY - the platform's handler listens for this
    return sendToParent({
      type: 'REQUEST_INVENTORY',
      requestId,
      payload: {},
    });
  }, [sendToParent]);
  
  // Request project-specific assets from Pixlland
  const requestProjectAssets = useCallback((projectId: string) => {
    usePixllandAssetStore.getState().setLoadingProject(true);
    const requestId = crypto.randomUUID();
    
    return sendToParent({
      type: 'REQUEST_PROJECT_ASSETS',
      requestId,
      payload: { projectId },
    });
  }, [sendToParent]);

  // Generic data request
  const requestData = useCallback((
    requestType: 'inventory' | 'projects' | 'project_assets',
    projectId?: string
  ): Promise<any> => {
    const requestId = crypto.randomUUID();
    
    sendToParent({
      type: 'REQUEST_DATA',
      requestId,
      payload: { requestType, requestId, projectId },
    });
    
    return new Promise((resolve, reject) => {
      pendingRequests.set(requestId, { resolve, reject });
      setTimeout(() => {
        if (pendingRequests.has(requestId)) {
          pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }, [sendToParent]);

  // Add asset to a project
  const addAssetToProject = useCallback((
    projectId: string,
    assetId: string
  ) => {
    const requestId = crypto.randomUUID();
    
    return sendToParent({
      type: 'ADD_ASSET_TO_PROJECT',
      requestId,
      payload: { projectId, assetId },
    });
  }, [sendToParent]);

  // Open a project for editing
  const openProject = useCallback((projectId: string) => {
    if (state.isEmbedded) {
      sendToParent({
        type: 'REQUEST_DATA',
        requestId: crypto.randomUUID(),
        payload: { requestType: 'load_project', projectId },
      });
    }
  }, [state.isEmbedded, sendToParent]);

  return {
    ...state,
    saveToPixlland,
    publishToPixlland,
    recordVix,
    closeOverlay,
    requestStoreAssets,
    importStoreAsset,
    openStore,
    requestUserLibrary,
    syncProjectAssets,
    connectAccount,
    sendToParent,
    buildGameData,
    // New methods for platform sync
    requestProjects,
    requestInventory,
    requestProjectAssets,
    requestData,
    addAssetToProject,
    openProject,
  };
};

// Global store for bridge state (accessible outside React)
interface PixllandStore {
  isEmbedded: boolean;
  authToken: string | null;
  userId: string | null;
  setAuth: (token: string | null, userId?: string | null) => void;
}

export const usePixllandStore = create<PixllandStore>((set) => ({
  isEmbedded: new URLSearchParams(window.location.search).get('embedded') === 'true',
  authToken: null,
  userId: null,
  setAuth: (token, userId = null) => set({ authToken: token, userId }),
}));
