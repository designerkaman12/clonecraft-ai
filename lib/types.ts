// ============================================================
// CloneCraft Global TypeScript Types
// ============================================================

export type Platform = 'amazon' | 'flipkart' | 'generic';
export type Tone = 'premium' | 'bold' | 'minimal' | 'luxury' | 'technical';
export type AspectRatio = '1:1' | '4:5' | '16:9' | '9:16' | '3:4';
export type OutputFormat = 'png' | 'jpg';
export type Mode = 'reference' | 'manual';
export type SimilarityLevel = 'low' | 'medium' | 'high';

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export interface ProductData {
  title: string;
  bullets: string[];
  features: string[];
  specs: Record<string, string>;
  benefits: string[];
  usageInstructions: string[];
  material?: string;
  size?: string;
  ingredients?: string[];
  packagingDetails?: string;
  imageUrls: string[];
  price?: string;
  rating?: number;
  category?: string;
}

export interface DesignSystem {
  imageCount: number;
  imageOrder: string[];
  layoutStyle: string;
  productPlacement: string;
  textPlacement: string;
  backgroundType: string;
  lightingStyle: string;
  typographyFeel: string;
  iconUsage: boolean;
  spacing: string;
  compositionBalance: string;
  colorMood: string;
  overallTone: string;
}

export interface GeneratedContent {
  headlines: string[];
  subheadings: string[];
  featurePoints: string[];
  benefitLines: string[];
  useCaseText: string[];
  callToAction: string;
  tagline: string;
}

export interface ImageSlot {
  id: string;
  index: number;
  type: 'hero' | 'feature' | 'before_after' | 'how_to_use' | 'uses' | 'creative_1' | 'creative_2' | 'custom';
  title: string;
  prompt: string;
  imageUrl?: string;
  imageBase64?: string;
  status: 'pending' | 'generating' | 'done' | 'error';
  errorMessage?: string;
}

export interface SessionInputs {
  mode: Mode;
  ownProductLink: string;
  referenceLink: string;
  manualContent: string;
  productName: string;
  platform: Platform;
  imageCount: number;
  aspectRatio: AspectRatio;
  colorTheme?: ColorPalette;
  tone: Tone;
  backgroundStyle: string;
  language: string;
  outputFormat: OutputFormat;
  similarityLevel: SimilarityLevel;
  fontPreference?: string;
  uploadedImages: File[];
  logoFile?: File;
}

export interface GenerationSession {
  id: string;
  inputs: SessionInputs;
  productData?: ProductData;
  referenceProductData?: ProductData;
  designSystem?: DesignSystem;
  generatedContent?: GeneratedContent;
  colorPalette?: ColorPalette;
  imageSlots: ImageSlot[];
  currentStep: 'idle' | 'scraping' | 'analyzing' | 'generating_content' | 'generating_prompts' | 'generating_images' | 'complete';
  error?: string;
}

export interface ExportPackage {
  sessionId: string;
  productName: string;
  images: { filename: string; base64: string }[];
  prompts: Record<string, string>;
  content: GeneratedContent;
  metadata: {
    generatedAt: string;
    platform: Platform;
    aspectRatio: AspectRatio;
    tone: Tone;
    imageCount: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
