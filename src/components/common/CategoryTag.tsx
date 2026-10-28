import { categoryColors, categoryLabels } from '@/config/site.config';
import type { Category } from '@/types/finance';

export function CategoryTag({ category }: { category: Category }) {
  return <span className="category-tag" data-category={category} style={{ backgroundColor: categoryColors[category] }}>{categoryLabels[category]}</span>;
}
