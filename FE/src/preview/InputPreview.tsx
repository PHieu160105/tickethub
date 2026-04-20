import { Input } from '@/components/ui/Input';

export default function InputPreview() {
    return (
        <div className="min-h-screen bg-space-900 p-8 space-y-8">
      <h1 className="text-2xl font-display text-white">Input Variants</h1>
      <div className="flex flex-wrap gap-4">
        <Input variant="default">Default</Input>
        <Input variant="error">Error</Input>
        <Input variant="success">Succces</Input>
        <Input disabled>Disabled</Input>
      </div>
    </div>
  );
}