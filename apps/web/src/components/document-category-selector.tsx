import { Button } from '@/components/ui/button';
import { FileText, User, CreditCard, File } from 'lucide-react';
import type { DocumentCategory } from '@/hooks/use-document-upload';

interface DocumentCategorySelectorProps {
  onSelect: (category: DocumentCategory) => void;
  selectedCategory?: DocumentCategory;
}

export function DocumentCategorySelector({ 
  onSelect, 
  selectedCategory 
}: DocumentCategorySelectorProps) {
  const categories = [
    { 
      value: 'contract' as DocumentCategory, 
      label: 'Contracts', 
      icon: FileText,
      description: 'Purchase agreements, leases'
    },
    { 
      value: 'identification' as DocumentCategory, 
      label: 'ID Documents', 
      icon: User,
      description: 'Driver\'s license, passport'
    },
    { 
      value: 'financial' as DocumentCategory, 
      label: 'Financial', 
      icon: CreditCard,
      description: 'Bank statements, pre-approval'
    },
    { 
      value: 'miscellaneous' as DocumentCategory, 
      label: 'Other', 
      icon: File,
      description: 'Additional documents'
    }
  ];

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Select Document Category</h4>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {categories.map(({ value, label, icon: Icon, description }) => (
          <Button
            key={value}
            variant={selectedCategory === value ? "default" : "outline"}
            onClick={() => onSelect(value)}
            className="h-auto flex-col gap-2 p-4"
          >
            <Icon size={20} />
            <div className="text-center">
              <div className="text-sm font-medium">{label}</div>
              <div className="text-xs text-muted-foreground">{description}</div>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
}
