import { Badge } from '@/components/ui/Badge';

export default function BadgePreview() {
    return (
        <div className="min-h-screen bg-space-900 p-8 space-y-8">
      <h1 className="text-2xl font-display text-white">Badge Variants</h1>
      <div className="flex flex-wrap gap-4">
        <Badge variant="default">Default</Badge>
        <Badge variant="warning">Warning</Badge>
        <Badge variant="success">Success</Badge>
        <Badge variant="info">Info</Badge>
      </div>
    </div>
  );
}