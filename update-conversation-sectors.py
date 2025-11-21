#!/usr/bin/env python3
import re

# Read the file
with open('backend/src/controllers/conversationController.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to find: WHERE conv.id = $1 AND camp.account_id = $2 AND camp.user_id = $3
# NOT followed by ${sectorFilter}
pattern = r'([ \t]+)(// Verificar ownership - MULTI-TENANCY: Filter by account_id\n[ \t]+const checkQuery = `\n[ \t]+SELECT conv\.id\n[ \t]+FROM conversations conv\n[ \t]+INNER JOIN campaigns camp ON conv\.campaign_id = camp\.id\n[ \t]+WHERE conv\.id = \$1 AND camp\.account_id = \$2 AND camp\.user_id = \$3\n[ \t]+`;)\n\n([ \t]+const checkResult = await db\.query\(checkQuery, \[id, accountId, userId\]\);)'

replacement = r'\1// Get sector filter\n\1const { filter: sectorFilter, params: sectorParams } = await buildSectorFilter(userId, accountId);\n\n\1// Verificar ownership - MULTI-TENANCY + SECTOR: Filter by account_id and sectors\n\1const checkQuery = `\n\1  SELECT conv.id\n\1  FROM conversations conv\n\1  INNER JOIN campaigns camp ON conv.campaign_id = camp.id\n\1  WHERE conv.id = $1 AND camp.account_id = $2 AND camp.user_id = $3 ${sectorFilter}\n\1`;\n\n\1const queryParams = [id, accountId, userId, ...sectorParams];\n\1const checkResult = await db.query(checkQuery, queryParams);'

# Apply the replacement
content = re.sub(pattern, replacement, content)

# Write back
with open('backend/src/controllers/conversationController.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Updated conversationController.js with sector filtering")
