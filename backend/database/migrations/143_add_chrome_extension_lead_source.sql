-- Add chrome_extension as default lead source for all existing accounts
INSERT INTO lead_sources (account_id, name, label, color, icon, is_default, is_active, display_order)
SELECT
  a.id,
  'chrome_extension',
  'Extensão Chrome',
  '#10b981',
  'C',
  true,
  true,
  2
FROM accounts a
WHERE NOT EXISTS (
  SELECT 1 FROM lead_sources ls
  WHERE ls.account_id = a.id AND ls.name = 'chrome_extension'
)
AND EXISTS (
  SELECT 1 FROM lead_sources ls2
  WHERE ls2.account_id = a.id
);
