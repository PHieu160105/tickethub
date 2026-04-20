import { Button } from '@/components/ui/Button';

export default function ButtonPreview() {
    return (
        <div className="min-h-screen bg-space-900 p-8 space-y-8">
      <h1 className="text-2xl font-display text-white">Button Variants</h1>
      <div className="flex flex-wrap gap-4">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button isLoading>Loading</Button>
        <Button disabled>Disabled</Button>
      </div>
      
      <h2 className="text-xl font-display text-white mt-8">Sizes</h2>
      <div className="flex flex-wrap items-center gap-4">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
      </div>
    </div>
  );
}