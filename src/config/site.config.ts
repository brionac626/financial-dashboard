export const siteConfig = {
  name: '家計 · Financial Dashboard',
  description: '把每一筆累積，看得更清楚。私密、安全的個人與家庭財務儀表板。',
};
export const categoryLabels = {
  cash: '現金資產',
  investment: '投資資產',
  nonCurrentAsset: '非流動資產',
  currentLiability: '流動負債',
  nonCurrentLiability: '非流動負債',
} as const;
export const categoryColors = {
  cash: 'var(--color-category-cash)',
  investment: 'var(--color-category-investment)',
  nonCurrentAsset: 'var(--color-category-non-current-asset)',
  currentLiability: 'var(--color-category-current-liability)',
  nonCurrentLiability: 'var(--color-category-non-current-liability)',
} as const;
