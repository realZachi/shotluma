import {
  Add01Icon,
  AiGenerativeIcon,
  AiNetworkIcon,
  AlignCenter as AlignCenterIcon,
  AlignLeft as AlignLeftIcon,
  AlignRight as AlignRightIcon,
  AlertCircleIcon,
  ArrowDown as ArrowDownIcon,
  ArrowUp as ArrowUpIcon,
  BatteryFullIcon,
  Blend as BlendIcon,
  Bold as BoldIcon,
  Check as CheckIcon,
  ChevronDown as ChevronDownIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  ChatGptIcon,
  ClaudeIcon,
  Cloud as CloudIcon,
  Copy as CopyIcon,
  CursorMagicSelection02Icon,
  Download as DownloadIcon,
  GoogleGeminiIcon,
  GrokIcon,
  Home01Icon,
  ImagePlus as ImagePlusIcon,
  Italic as ItalicIcon,
  KimiAiIcon,
  Layers as Layers3Icon,
  LayoutTwoColumnIcon,
  Link01Icon,
  Lock as LockIcon,
  LockKeyhole as LockKeyholeIcon,
  LockOpen as LockOpenIcon,
  Minus as MinusIcon,
  MonitorSmartphone as MonitorSmartphoneIcon,
  MoreHorizontalIcon,
  Palette as PaletteIcon,
  Plus as PlusIcon,
  QwenIcon,
  Redo2 as Redo2Icon,
  SaveIcon,
  Search01Icon,
  Shapes as ShapesIcon,
  SignalIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  StartUp02Icon,
  Strikethrough as StrikethroughIcon,
  Trash2 as Trash2Icon,
  Type as TypeIcon,
  Underline as UnderlineIcon,
  Undo2 as Undo2Icon,
  Upload as UploadIcon,
  UserCircleIcon,
  Wifi01Icon,
  X as XIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import type { ComponentProps } from 'react'

type IconProps = Omit<ComponentProps<typeof HugeiconsIcon>, 'icon'>

const createIcon = (icon: IconSvgElement) => (props: IconProps) => (
  <HugeiconsIcon icon={icon} {...props} />
)

export const AlignCenter = createIcon(AlignCenterIcon)
export const Add01 = createIcon(Add01Icon)
export const AiGenerative = createIcon(AiGenerativeIcon)
export const AiNetwork = createIcon(AiNetworkIcon)
export const AlignLeft = createIcon(AlignLeftIcon)
export const AlignRight = createIcon(AlignRightIcon)
export const AlertCircle = createIcon(AlertCircleIcon)
export const ArrowDown = createIcon(ArrowDownIcon)
export const ArrowUp = createIcon(ArrowUpIcon)
export const BatteryFull = createIcon(BatteryFullIcon)
export const Blend = createIcon(BlendIcon)
export const Bold = createIcon(BoldIcon)
export const Check = createIcon(CheckIcon)
export const ChevronDown = createIcon(ChevronDownIcon)
export const ChevronLeft = createIcon(ChevronLeftIcon)
export const ChevronRight = createIcon(ChevronRightIcon)
export const ChatGpt = createIcon(ChatGptIcon)
export const Claude = createIcon(ClaudeIcon)
export const Cloud = createIcon(CloudIcon)
export const Copy = createIcon(CopyIcon)
export const CursorMagicSelection02 = createIcon(CursorMagicSelection02Icon)
export const Download = createIcon(DownloadIcon)
export const GoogleGemini = createIcon(GoogleGeminiIcon)
export const Grok = createIcon(GrokIcon)
export const Home01 = createIcon(Home01Icon)
export const ImagePlus = createIcon(ImagePlusIcon)
export const Italic = createIcon(ItalicIcon)
export const KimiAi = createIcon(KimiAiIcon)
export const Layers3 = createIcon(Layers3Icon)
export const LayoutTwoColumn = createIcon(LayoutTwoColumnIcon)
export const Link01 = createIcon(Link01Icon)
export const Lock = createIcon(LockIcon)
export const LockKeyhole = createIcon(LockKeyholeIcon)
export const LockOpen = createIcon(LockOpenIcon)
export const Minus = createIcon(MinusIcon)
export const MonitorSmartphone = createIcon(MonitorSmartphoneIcon)
export const MoreHorizontal = createIcon(MoreHorizontalIcon)
export const Palette = createIcon(PaletteIcon)
export const Plus = createIcon(PlusIcon)
export const Qwen = createIcon(QwenIcon)
export const Redo2 = createIcon(Redo2Icon)
export const Save = createIcon(SaveIcon)
export const Search01 = createIcon(Search01Icon)
export const Shapes = createIcon(ShapesIcon)
export const Signal = createIcon(SignalIcon)
export const SlidersHorizontal = createIcon(SlidersHorizontalIcon)
export const Sparkles = createIcon(SparklesIcon)
export const StartUp02 = createIcon(StartUp02Icon)
export const Strikethrough = createIcon(StrikethroughIcon)
export const Trash2 = createIcon(Trash2Icon)
export const Type = createIcon(TypeIcon)
export const Underline = createIcon(UnderlineIcon)
export const Undo2 = createIcon(Undo2Icon)
export const Upload = createIcon(UploadIcon)
export const UserCircle = createIcon(UserCircleIcon)
export const Wifi01 = createIcon(Wifi01Icon)
export const X = createIcon(XIcon)
