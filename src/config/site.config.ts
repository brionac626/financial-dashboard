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
  cash: '#177b69', investment: '#75a999', nonCurrentAsset: '#b1c8bb',
  currentLiability: '#c18660', nonCurrentLiability: '#d8b99b',
} as const;
