import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  GenerationSession,
  SessionInputs,
  ProductData,
  DesignSystem,
  GeneratedContent,
  ColorPalette,
  ImageSlot,
  Mode,
  Platform,
  Tone,
  AspectRatio,
  OutputFormat,
  SimilarityLevel,
} from './types';

const defaultInputs: SessionInputs = {
  mode: 'reference',
  ownProductLink: '',
  referenceLink: '',
  manualContent: '',
  productName: '',
  platform: 'amazon',
  imageCount: 7,
  aspectRatio: '1:1',
  tone: 'premium',
  backgroundStyle: 'clean white',
  language: 'English',
  outputFormat: 'png',
  similarityLevel: 'medium',
  uploadedImages: [],
};

interface CloneCraftStore {
  session: GenerationSession;

  // Input actions
  setMode: (mode: Mode) => void;
  setInput: <K extends keyof SessionInputs>(key: K, value: SessionInputs[K]) => void;
  setProductName: (name: string) => void;

  // Session data
  setProductData: (data: ProductData) => void;
  setReferenceProductData: (data: ProductData) => void;
  setDesignSystem: (ds: DesignSystem) => void;
  setGeneratedContent: (content: GeneratedContent) => void;
  setColorPalette: (palette: ColorPalette) => void;
  setImageSlots: (slots: ImageSlot[]) => void;
  updateImageSlot: (id: string, updates: Partial<ImageSlot>) => void;

  // Progress
  setCurrentStep: (step: GenerationSession['currentStep']) => void;
  setError: (error: string | undefined) => void;

  // Reset
  resetSession: () => void;

  // UI state
  activePanel: 'left' | 'center' | 'right';
  setActivePanel: (panel: 'left' | 'center' | 'right') => void;
  selectedSlotId: string | null;
  setSelectedSlotId: (id: string | null) => void;
  isExporting: boolean;
  setIsExporting: (v: boolean) => void;
}

const createSession = (): GenerationSession => ({
  id: uuidv4(),
  inputs: defaultInputs,
  imageSlots: [],
  currentStep: 'idle',
});

export const useStore = create<CloneCraftStore>((set) => ({
  session: createSession(),

  setMode: (mode) =>
    set((s) => ({
      session: { ...s.session, inputs: { ...s.session.inputs, mode } },
    })),

  setInput: (key, value) =>
    set((s) => ({
      session: { ...s.session, inputs: { ...s.session.inputs, [key]: value } },
    })),

  setProductName: (name) =>
    set((s) => ({
      session: { ...s.session, inputs: { ...s.session.inputs, productName: name } },
    })),

  setProductData: (data) =>
    set((s) => ({ session: { ...s.session, productData: data } })),

  setReferenceProductData: (data) =>
    set((s) => ({ session: { ...s.session, referenceProductData: data } })),

  setDesignSystem: (ds) =>
    set((s) => ({ session: { ...s.session, designSystem: ds } })),

  setGeneratedContent: (content) =>
    set((s) => ({ session: { ...s.session, generatedContent: content } })),

  setColorPalette: (palette) =>
    set((s) => ({ session: { ...s.session, colorPalette: palette } })),

  setImageSlots: (slots) =>
    set((s) => ({ session: { ...s.session, imageSlots: slots } })),

  updateImageSlot: (id, updates) =>
    set((s) => ({
      session: {
        ...s.session,
        imageSlots: s.session.imageSlots.map((slot) =>
          slot.id === id ? { ...slot, ...updates } : slot
        ),
      },
    })),

  setCurrentStep: (step) =>
    set((s) => ({ session: { ...s.session, currentStep: step } })),

  setError: (error) =>
    set((s) => ({ session: { ...s.session, error } })),

  resetSession: () => set({ session: createSession() }),

  activePanel: 'left',
  setActivePanel: (panel) => set({ activePanel: panel }),

  selectedSlotId: null,
  setSelectedSlotId: (id) => set({ selectedSlotId: id }),

  isExporting: false,
  setIsExporting: (v) => set({ isExporting: v }),
}));
